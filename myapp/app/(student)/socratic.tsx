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
import SocraticAvatar from '@/assets/images/avatar-assistente.png';

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

    // UI State
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [showTextInput, setShowTextInput] = useState(false);

    // Subject selection
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [showSubjectPicker, setShowSubjectPicker] = useState(false);
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    // Refs
    const scrollViewRef = useRef<ScrollView>(null);
    const recognitionRef = useRef<any>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Avatar animations
    const avatarScale = useRef(new Animated.Value(1)).current;
    const avatarGlow = useRef(new Animated.Value(0)).current;

    // Load subjects on mount
    useEffect(() => {
        loadSubjects();
    }, []);

    // Pulse animation for recording (Mic button)
    useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording]);

    // Avatar animation when speaking (assistant processing/replying)
    useEffect(() => {
        if (isLoading || isRefining) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(avatarScale, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
                    Animated.timing(avatarScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
                ])
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(avatarGlow, { toValue: 1, duration: 1500, useNativeDriver: true }),
                    Animated.timing(avatarGlow, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
                ])
            ).start();
        } else {
            avatarScale.setValue(1);
            avatarGlow.setValue(0);
        }
    }, [isLoading, isRefining]);

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
                content: `Olá! 👋 Eu sou o Fred, seu assistente de estudo!\n\nEstou aqui para te ajudar a aprender sobre ${selectedSubject.name}.\n\nFale comigo para começarmos!`,
                timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
        }
    }, [selectedSubject]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (showChatHistory && messages.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, showChatHistory]);

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
            // If we are recording and press the button, we want to STOP and SEND.
            handleSend();
        } else {
            startRecording();
        }
    };

    // ===== Send Message =====
    const handleSend = async () => {
        // Stop recording if active - do this first to ensure UI updates
        if (isRecording) {
            stopRecording();
        }

        // Slight delay to ensure final STT results are processed if any
        // In a real app we might rely on a 'final' event or debounce, 
        // but for now we'll grab what's in inputText.

        // Use a small timeout to allow state to settle if needed, or just proceed.
        // For immediate responsiveness, we'll try to just send current inputText.
        const text = inputText.trim();

        if (!text) {
            // If no text, nothing to do.
            return;
        }

        if (isLoading || !selectedSubject) return;

        // Add user message via text (or STT final result)
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        // Hide text input after sending if it was open
        setShowTextInput(false);

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
                // Here we would trigger TTS play
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
                    <Image source={SocraticAvatar} style={styles.chatAvatar} />
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
                            Sobre qual matéria vamos conversar hoje?
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

    // Chat History Modal
    const renderChatHistory = () => (
        <Modal
            visible={showChatHistory}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowChatHistory(false)}
        >
            <View style={styles.historyContainer}>
                <View style={styles.historyHeader}>
                    <Text style={styles.historyTitle}>Histórico da Conversa</Text>
                    <TouchableOpacity onPress={() => setShowChatHistory(false)} style={styles.closeHistoryButton}>
                        <MaterialIcons name="close" size={24} color={colors.slate600} />
                    </TouchableOpacity>
                </View>
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                >
                    {messages.map(renderMessage)}
                </ScrollView>
            </View>
        </Modal>
    );

    // Helper to get last assistant message
    const lastAssistantMessage = messages.slice().reverse().find(m => m.role === 'assistant');

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Top Controls */}
                <View style={styles.topControls}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={28} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.subjectPill}
                        onPress={() => setShowSubjectPicker(true)}
                    >
                        <MaterialIcons name="school" size={16} color="white" />
                        <Text style={styles.subjectPillText}>
                            {selectedSubject?.name || 'Selecionar'}
                        </Text>
                        <MaterialIcons name="expand-more" size={16} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => setShowChatHistory(true)}
                    >
                        <MaterialIcons name="history" size={28} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>

                {/* Main Avatar Area */}
                <View style={styles.avatarContainer}>
                    <Animated.View style={[
                        styles.avatarWrapper,
                        { transform: [{ scale: avatarScale }] }
                    ]}>
                        <Animated.View style={[
                            styles.avatarGlow,
                            { opacity: avatarGlow, transform: [{ scale: Animated.add(1, avatarGlow) }] }
                        ]} />
                        <Image source={SocraticAvatar} style={styles.mainAvatar} resizeMode="cover" />
                    </Animated.View>

                    <View style={styles.statusContainer}>
                        {isLoading || isRefining ? (
                            <View style={styles.statusBadge}>
                                <ActivityIndicator size="small" color="white" style={{ marginRight: 6 }} />
                                <Text style={styles.statusText}>
                                    {isRefining ? 'Ouvindo...' : 'Pensando...'}
                                </Text>
                            </View>
                        ) : isRecording ? (
                            <View style={[styles.statusBadge, styles.statusBadgeRecording]}>
                                <View style={styles.recordingDot} />
                                <Text style={styles.statusText}>Ouvindo você...</Text>
                            </View>
                        ) : (
                            <Text style={styles.instructionText}>
                                Toque no microfone para falar
                            </Text>
                        )}
                    </View>

                    {/* Display Last Assistant Message */}
                    {lastAssistantMessage && !isLoading && !isRecording && (
                        <View style={styles.lastMessageContainer}>
                            <Text style={styles.lastMessageText}>
                                {lastAssistantMessage.content}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Bottom Controls */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.bottomControls}
                >
                    {/* Input or Controls */}
                    {showTextInput ? (
                        <View style={styles.textInputContainer}>
                            <TouchableOpacity
                                onPress={() => setShowTextInput(false)}
                                style={styles.closeInputButton}
                            >
                                <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.mainInput}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Digite sua resposta..."
                                placeholderTextColor="rgba(255,255,255,0.5)"
                                autoFocus
                                onSubmitEditing={handleSend}
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                                onPress={handleSend}
                                disabled={!inputText.trim()}
                            >
                                <MaterialIcons name="send" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.controlsRow}>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => setShowTextInput(true)}
                            >
                                <MaterialIcons name="keyboard" size={28} color="white" />
                            </TouchableOpacity>

                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <TouchableOpacity
                                    style={[
                                        styles.mainMicButton,
                                        isRecording && styles.mainMicButtonRecording
                                    ]}
                                    onPress={toggleRecording}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons
                                        name={isRecording ? 'stop' : 'mic'}
                                        size={48}
                                        color={isRecording ? colors.white : colors.primary}
                                    />
                                </TouchableOpacity>
                            </Animated.View>

                            {/* Placeholder for symmetry or another action */}
                            <View style={styles.secondaryButtonPlaceholder} />
                        </View>
                    )}
                </KeyboardAvoidingView>

                {/* Modals */}
                {renderSubjectPicker()}
                {renderChatHistory()}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        justifyContent: 'space-between',
    },

    // Top Controls
    topControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        zIndex: 10,
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    subjectPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    subjectPillText: {
        color: 'white',
        fontWeight: '600',
        fontSize: typography.fontSize.sm,
    },

    // Avatar Area
    avatarContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 40,
        paddingHorizontal: spacing.lg,
    },
    lastMessageContainer: {
        marginTop: spacing.xl,
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: spacing.md,
        borderRadius: 16,
        maxWidth: '90%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    lastMessageText: {
        color: 'white',
        fontSize: typography.fontSize.base,
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500',
    },
    avatarWrapper: {
        width: 250,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        position: 'relative',
    },
    avatarGlow: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    mainAvatar: {
        width: 250,
        height: 250,
        borderRadius: 125,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    statusContainer: {
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    statusBadgeRecording: {
        backgroundColor: 'rgba(220, 38, 38, 0.3)', // Red tint
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
        marginRight: 8,
    },
    statusText: {
        color: 'white',
        fontSize: typography.fontSize.base,
        fontWeight: '600',
    },
    instructionText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.fontSize.base,
        marginTop: spacing.sm,
    },

    // Bottom Controls
    bottomControls: {
        paddingHorizontal: spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 20 : 40,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mainMicButton: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    mainMicButtonRecording: {
        backgroundColor: '#ef4444', // Red
    },
    secondaryButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButtonPlaceholder: {
        width: 50,
    },

    // Text Input Overlay
    textInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 30,
        padding: 6,
    },
    mainInput: {
        flex: 1,
        color: 'white',
        fontSize: typography.fontSize.base,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        height: 48,
    },
    closeInputButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
        opacity: 0.7,
    },

    // Modal Common
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
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: spacing.md,
        borderWidth: 2,
        borderColor: 'white',
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

    // Chat History Modal
    historyContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    historyTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.slate800,
    },
    closeHistoryButton: {
        padding: 8,
    },

    // Messages (for History view)
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: spacing.md,
        gap: spacing.md,
        paddingBottom: 40,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    messageRowUser: {
        justifyContent: 'flex-end',
    },
    messageRowAssistant: {
        justifyContent: 'flex-start',
    },
    chatAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
    },
    userBubble: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 2,
    },
    assistantBubble: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userMessageText: {
        color: 'white',
    },
    assistantMessageText: {
        color: colors.slate800,
    },
    messageTime: {
        fontSize: 10,
        textAlign: 'right',
        marginTop: 4,
    },
    userMessageTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    assistantMessageTime: {
        color: '#94a3b8',
    },
});
