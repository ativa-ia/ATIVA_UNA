import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    TextInput,
    Image,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Modal,
    FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getSubjects, Subject, refineTranscription, socraticChat } from '@/services/api';

// @ts-ignore
import SocraticAvatar from '@/assets/images/socratic_avatar.png';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function SocraticScreen() {
    // State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isRefining, setIsRefining] = useState(false);

    // Subject selection
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [showSubjectPicker, setShowSubjectPicker] = useState(false);
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    // Refs
    const scrollViewRef = useRef<ScrollView>(null);
    const recognitionRef = useRef<any>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const typingDots = useRef(new Animated.Value(0)).current;

    // Load subjects on mount
    useEffect(() => {
        loadSubjects();
    }, []);

    // Fade in animation
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, []);

    // Typing indicator animation
    useEffect(() => {
        if (isLoading) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(typingDots, { toValue: 1, duration: 500, useNativeDriver: true }),
                    Animated.timing(typingDots, { toValue: 0, duration: 500, useNativeDriver: true }),
                ])
            ).start();
        } else {
            typingDots.setValue(0);
        }
    }, [isLoading]);

    // Pulse animation for recording
    useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording]);

    const loadSubjects = async () => {
        try {
            setLoadingSubjects(true);
            const data = await getSubjects();
            setSubjects(data);
            // Auto-select if only one subject
            if (data.length === 1) {
                setSelectedSubject(data[0]);
            } else if (data.length > 1) {
                setShowSubjectPicker(true);
            }
        } catch (err) {
            console.error('Erro ao carregar disciplinas:', err);
        } finally {
            setLoadingSubjects(false);
        }
    };

    // Welcome message when subject is selected
    useEffect(() => {
        if (selectedSubject && messages.length === 0) {
            const welcomeMsg: ChatMessage = {
                id: 'welcome',
                role: 'assistant',
                content: `Olá! 👋 Eu sou o Sócrates, seu assistente de estudo!\n\nEstou aqui para te ajudar a aprender **${selectedSubject.name}** de forma mais profunda.\n\n🎯 Me explique o que você entendeu sobre o assunto, e eu vou te fazer perguntas para testar seu conhecimento!\n\nVocê pode digitar ou usar o microfone 🎙️ para falar.`,
                timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
        }
    }, [selectedSubject]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, isLoading]);

    // ===== STT (Web Speech API) =====
    const startRecording = () => {
        if (Platform.OS !== 'web') {
            // TODO: native STT
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Seu navegador não suporta reconhecimento de voz.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onresult = (event: any) => {
            let finalText = '';
            let interimText = '';
            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript + ' ';
                } else {
                    interimText += transcript;
                }
            }
            setInputText((finalText + interimText).trim());
        };

        recognition.onerror = (event: any) => {
            console.error('STT Error:', event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsRecording(false);
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // ===== Send Message =====
    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || isLoading || !selectedSubject) return;

        // Stop recording if active
        if (isRecording) stopRecording();

        // Add user message immediately
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsLoading(true);

        try {
            // Step 1: Refine transcription
            setIsRefining(true);
            const refineResult = await refineTranscription(text);
            const refinedText = refineResult.success && refineResult.refined_text
                ? refineResult.refined_text
                : text;
            setIsRefining(false);

            // Update user message if text was refined
            if (refinedText !== text) {
                setMessages(prev => prev.map(m =>
                    m.id === userMsg.id ? { ...m, content: refinedText } : m
                ));
            }

            // Step 2: Send to Socratic chat
            const chatHistory = messages
                .filter(m => m.id !== 'welcome')
                .map(m => ({ role: m.role, content: m.content }));

            const result = await socraticChat(
                selectedSubject.name,
                chatHistory,
                refinedText
            );

            if (result.success && result.response) {
                const assistantMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: result.response,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, assistantMsg]);
            } else {
                const errorMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: '😕 Desculpe, tive um problema ao processar sua mensagem. Pode tentar novamente?',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '❌ Erro de conexão. Verifique sua internet e tente novamente.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            setIsRefining(false);
        }
    };

    // ===== Render Functions =====
    const renderMessage = (msg: ChatMessage) => {
        const isUser = msg.role === 'user';

        return (
            <View
                key={msg.id}
                style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAssistant,
                ]}
            >
                {!isUser && (
                    <Image source={SocraticAvatar} style={styles.avatar} />
                )}
                <View
                    style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.assistantBubble,
                    ]}
                >
                    <Text style={[
                        styles.messageText,
                        isUser ? styles.userMessageText : styles.assistantMessageText,
                    ]}>
                        {msg.content}
                    </Text>
                    <Text style={[
                        styles.messageTime,
                        isUser ? styles.userMessageTime : styles.assistantMessageTime,
                    ]}>
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    const renderTypingIndicator = () => (
        <View style={[styles.messageRow, styles.messageRowAssistant]}>
            <Image source={SocraticAvatar} style={styles.avatar} />
            <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
                <Animated.View style={{ opacity: typingDots }}>
                    <Text style={styles.typingText}>
                        {isRefining ? '✨ Refinando texto...' : '🤔 Pensando...'}
                    </Text>
                </Animated.View>
            </View>
        </View>
    );

    // Subject Picker Modal
    const renderSubjectPicker = () => (
        <Modal
            visible={showSubjectPicker}
            transparent
            animationType="slide"
            onRequestClose={() => {
                if (selectedSubject) setShowSubjectPicker(false);
            }}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <LinearGradient
                        colors={['#4f46e5', '#7c3aed']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.modalHeader}
                    >
                        <Image source={SocraticAvatar} style={styles.modalAvatar} />
                        <Text style={styles.modalTitle}>Escolha a Disciplina</Text>
                        <Text style={styles.modalSubtitle}>
                            Selecione sobre qual matéria quer estudar
                        </Text>
                    </LinearGradient>

                    {loadingSubjects ? (
                        <View style={styles.modalLoading}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={subjects}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={styles.subjectList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.subjectItem,
                                        selectedSubject?.id === item.id && styles.subjectItemActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedSubject(item);
                                        setShowSubjectPicker(false);
                                        // Reset conversation when switching subject
                                        setMessages([]);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcons
                                        name="school"
                                        size={24}
                                        color={selectedSubject?.id === item.id ? colors.white : colors.primary}
                                    />
                                    <Text style={[
                                        styles.subjectItemText,
                                        selectedSubject?.id === item.id && styles.subjectItemTextActive,
                                    ]}>
                                        {item.name}
                                    </Text>
                                    {selectedSubject?.id === item.id && (
                                        <MaterialIcons name="check-circle" size={22} color={colors.white} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                {/* Header */}
                <LinearGradient
                    colors={['#4f46e5', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Image source={SocraticAvatar} style={styles.headerAvatar} />
                        <View>
                            <Text style={styles.headerTitle}>Sócrates</Text>
                            <TouchableOpacity
                                onPress={() => setShowSubjectPicker(true)}
                                style={styles.subjectSelector}
                            >
                                <Text style={styles.headerSubject} numberOfLines={1}>
                                    {selectedSubject?.name || 'Selecionar disciplina'}
                                </Text>
                                <MaterialIcons name="expand-more" size={18} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.headerStatus}>
                        <View style={[styles.statusDot, isLoading && styles.statusDotBusy]} />
                        <Text style={styles.statusText}>
                            {isLoading ? 'Pensando' : 'Online'}
                        </Text>
                    </View>
                </LinearGradient>

                {/* Chat Area */}
                <KeyboardAvoidingView
                    style={styles.chatArea}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={90}
                >
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.messagesContainer}
                        contentContainerStyle={styles.messagesContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {messages.map(renderMessage)}
                        {isLoading && renderTypingIndicator()}
                    </ScrollView>

                    {/* Input Area */}
                    <View style={styles.inputArea}>
                        <View style={styles.inputRow}>
                            {/* Mic Button */}
                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <TouchableOpacity
                                    style={[
                                        styles.micButton,
                                        isRecording && styles.micButtonRecording,
                                    ]}
                                    onPress={toggleRecording}
                                    activeOpacity={0.7}
                                    disabled={!selectedSubject}
                                >
                                    <MaterialIcons
                                        name={isRecording ? 'stop' : 'mic'}
                                        size={24}
                                        color={isRecording ? colors.white : colors.primary}
                                    />
                                </TouchableOpacity>
                            </Animated.View>

                            {/* Text Input */}
                            <TextInput
                                style={styles.textInput}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder={
                                    !selectedSubject
                                        ? 'Selecione uma disciplina...'
                                        : isRecording
                                            ? 'Ouvindo... 🎙️'
                                            : 'Explique o que você entendeu...'
                                }
                                placeholderTextColor={colors.slate400}
                                multiline
                                maxLength={2000}
                                editable={!!selectedSubject && !isLoading}
                                onSubmitEditing={handleSend}
                            />

                            {/* Send Button */}
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    (!inputText.trim() || isLoading || !selectedSubject) && styles.sendButtonDisabled,
                                ]}
                                onPress={handleSend}
                                disabled={!inputText.trim() || isLoading || !selectedSubject}
                                activeOpacity={0.7}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <MaterialIcons name="send" size={22} color={colors.white} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {isRecording && (
                            <View style={styles.recordingIndicator}>
                                <View style={styles.recordingDot} />
                                <Text style={styles.recordingText}>Gravando... Toque no microfone para parar</Text>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>

                {/* Subject Picker Modal */}
                {renderSubjectPicker()}
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
    },
    container: {
        flex: 1,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        paddingTop: spacing.lg,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: spacing.md,
        gap: spacing.sm,
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    subjectSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    headerSubject: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
        color: 'rgba(255,255,255,0.8)',
        maxWidth: 180,
    },
    headerStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#34d399',
    },
    statusDotBusy: {
        backgroundColor: '#fbbf24',
    },
    statusText: {
        fontSize: 11,
        color: colors.white,
        fontFamily: typography.fontFamily.body,
    },

    // Chat area
    chatArea: {
        flex: 1,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        paddingBottom: spacing.xl,
    },

    // Messages
    messageRow: {
        flexDirection: 'row',
        marginBottom: spacing.md,
        alignItems: 'flex-end',
        gap: spacing.sm,
    },
    messageRowUser: {
        justifyContent: 'flex-end',
    },
    messageRowAssistant: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: colors.primaryLight,
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
    },
    userBubble: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    assistantBubble: {
        backgroundColor: colors.white,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    messageText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        lineHeight: typography.fontSize.base * 1.5,
    },
    userMessageText: {
        color: colors.white,
    },
    assistantMessageText: {
        color: colors.textPrimary,
    },
    messageTime: {
        fontSize: 10,
        marginTop: 4,
        textAlign: 'right',
    },
    userMessageTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    assistantMessageTime: {
        color: colors.slate400,
    },

    // Typing indicator
    typingBubble: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    typingText: {
        fontSize: typography.fontSize.sm,
        color: colors.slate500,
        fontFamily: typography.fontFamily.body,
    },

    // Input area
    inputArea: {
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        backgroundColor: colors.white,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
    },
    micButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
    micButtonRecording: {
        backgroundColor: colors.danger,
        borderColor: colors.danger,
    },
    textInput: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        backgroundColor: colors.slate50,
        borderRadius: 22,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    sendButtonDisabled: {
        backgroundColor: colors.slate300,
        shadowOpacity: 0,
        elevation: 0,
    },

    // Recording indicator
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingTop: spacing.xs,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.danger,
    },
    recordingText: {
        fontSize: typography.fontSize.xs,
        color: colors.danger,
        fontFamily: typography.fontFamily.body,
    },

    // Modal - Subject Picker
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70%',
        overflow: 'hidden',
    },
    modalHeader: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.base,
    },
    modalAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.4)',
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
        color: 'rgba(255,255,255,0.8)',
    },
    modalLoading: {
        padding: spacing['3xl'],
        alignItems: 'center',
    },
    subjectList: {
        padding: spacing.base,
        gap: spacing.sm,
    },
    subjectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.slate50,
        gap: spacing.md,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    subjectItemActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primaryDark,
    },
    subjectItemText: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    subjectItemTextActive: {
        color: colors.white,
    },
});
