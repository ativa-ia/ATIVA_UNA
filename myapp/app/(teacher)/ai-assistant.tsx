import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { sendAIMessage } from '@/services/ai';
import { sendNotification } from '@/services/notifications';
// import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "@jamsch/expo-speech-recognition";

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
}

interface QuickAction {
    id: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    title: string;
    description: string;
}

/**
 * AIAssistantScreen - Assistente de IA (Professor)
 * Tela de chat com IA para auxiliar o professor
 */
export default function AIAssistantScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';
    const subjectId = parseInt(params.subjectId as string) || 1;
    const scrollViewRef = useRef<ScrollView>(null);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: `Olá! Sou seu assistente de IA para a disciplina ${subjectName}. Como posso ajudá-lo hoje?\n\nPosso ajudar com:\n• Gerar quizzes e atividades\n• Criar resumos de conteúdo\n• Sugerir planos de aula\n• Analisar desempenho dos alunos\n• Responder dúvidas sobre o conteúdo`,
            isUser: false,
            timestamp: new Date(),
        }
    ]);
    const [inputText, setInputText] = useState('');

    // Speech Recognition State
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [dictationMode, setDictationMode] = useState(false); // Modo ditado (sem auto-enviar)
    const [interimText, setInterimText] = useState(''); // Texto sendo reconhecido em tempo real

    const recognitionRef = useRef<any>(null);
    const isRecordingRef = useRef(false);
    const silenceTimer = useRef<any>(null);
    const currentSessionTextRef = useRef(''); // Texto da sessão atual
    const savedTextRef = useRef(''); // Texto salvo de sessões anteriores
    const [triggerAutoSend, setTriggerAutoSend] = useState(false);
    const [sendingNotificationId, setSendingNotificationId] = useState<string | null>(null);

    // Efeito para Auto-Send
    useEffect(() => {
        if (triggerAutoSend && inputText.trim()) {
            handleSend();
            setTriggerAutoSend(false);
            savedTextRef.current = '';
            currentSessionTextRef.current = '';
        }
    }, [triggerAutoSend]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'pt-BR';

                recognitionRef.current.onresult = (event: any) => {
                    let interimTranscript = '';
                    let finalTranscript = '';

                    // Iterar sobre os resultados para separar final de interim
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }

                    // Mostrar texto interim em tempo real
                    setInterimText(interimTranscript);

                    // No modo continuous do Chrome, event.results acumula tudo da sessão atual.
                    // Vamos pegar tudo o que já foi transcrito nesta sessão.
                    const sessionTranscript = Array.from(event.results)
                        .map((result: any) => result[0].transcript)
                        .join('');

                    currentSessionTextRef.current = sessionTranscript;

                    // Combinar texto salvo (de sessões anteriores) + texto da sessão atual
                    const fullText = (savedTextRef.current + (savedTextRef.current && sessionTranscript ? ' ' : '') + sessionTranscript).trim();
                    setInputText(fullText);

                    // Resetar timer de silêncio
                    if (silenceTimer.current) clearTimeout(silenceTimer.current);

                    // Só auto-enviar se NÃO estiver no modo ditado
                    if (sessionTranscript.trim() && !dictationMode) {
                        silenceTimer.current = setTimeout(() => {
                            console.log("Silêncio detectado, enviando...");
                            isRecordingRef.current = false;
                            recognitionRef.current.stop();
                            setIsRecording(false);
                            setInterimText('');
                            setTriggerAutoSend(true);
                        }, 2000);
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error', event.error);
                    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                        setIsRecording(false);
                        isRecordingRef.current = false;
                    }
                };

                recognitionRef.current.onend = () => {
                    // Salvar o texto da sessão que acabou
                    if (currentSessionTextRef.current) {
                        savedTextRef.current = (savedTextRef.current + ' ' + currentSessionTextRef.current).trim();
                        currentSessionTextRef.current = '';
                    }

                    if (isRecordingRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {
                            setIsRecording(false);
                            isRecordingRef.current = false;
                        }
                    } else {
                        setIsRecording(false);
                    }
                };
            }
        }
        return () => {
            if (silenceTimer.current) clearTimeout(silenceTimer.current);
        };
    }, []);

    const handleMicPress = async () => {
        if (Platform.OS === 'web') {
            if (!recognitionRef.current) {
                Alert.alert('Erro', 'Seu navegador não suporta reconhecimento de voz.');
                return;
            }

            if (isRecording) {
                isRecordingRef.current = false;
                recognitionRef.current.stop();
                setIsRecording(false);
                if (silenceTimer.current) clearTimeout(silenceTimer.current);
            } else {
                isRecordingRef.current = true;
                // Se o usuário já digitou algo, salvamos como texto base
                if (inputText.trim()) {
                    savedTextRef.current = inputText;
                } else {
                    savedTextRef.current = '';
                }
                currentSessionTextRef.current = '';

                try {
                    recognitionRef.current.start();
                    setIsRecording(true);
                } catch (e) {
                    console.error('Erro ao iniciar:', e);
                    isRecordingRef.current = false;
                }
            }
        } else {
            Alert.alert("Em breve", "O reconhecimento de voz no celular estará disponível na versão final.");
        }
    };

    const quickActions: QuickAction[] = [
        {
            id: '1',
            icon: 'quiz',
            title: 'Gerar Quiz',
            description: 'Criar perguntas sobre o conteúdo',
        },
        {
            id: '2',
            icon: 'assignment',
            title: 'Criar Atividade',
            description: 'Elaborar exercícios práticos',
        },
        {
            id: '3',
            icon: 'summarize',
            title: 'Resumir Conteúdo',
            description: 'Criar resumo de um tema',
        },
        {
            id: '4',
            icon: 'event-note',
            title: 'Plano de Aula',
            description: 'Sugerir estrutura de aula',
        },
    ];

    const handleSend = async () => {
        if (!inputText.trim() || isLoading) return;

        /*
        if (isRecording) {
            ExpoSpeechRecognitionModule.stop();
            setIsRecording(false);
        }
        */

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            isUser: true,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        const messageToSend = inputText;
        setInputText('');
        setIsLoading(true);
        scrollViewRef.current?.scrollToEnd({ animated: true });

        try {
            const response = await sendAIMessage(subjectId, messageToSend);

            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: response.success ? response.response || 'Resposta vazia' : (response.error || 'Erro ao processar'),
                isUser: false,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiResponse]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Erro ao conectar com a IA. Verifique sua conexão.',
                isUser: false,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }
    };

    const handleQuickAction = (action: QuickAction) => {
        const prompts: { [key: string]: string } = {
            '1': `Gere um quiz com 5 perguntas sobre ${subjectName}`,
            '2': `Crie uma atividade prática para a disciplina de ${subjectName}`,
            '3': `Faça um resumo do último conteúdo de ${subjectName}`,
            '4': `Sugira um plano de aula para ${subjectName}`,
        };

        setInputText(prompts[action.id] || '');
    };

    const handleSendToStudents = async (message: Message) => {
        setSendingNotificationId(message.id);
        try {
            const result = await sendNotification({
                subject_id: subjectId,
                title: 'Nova mensagem do Professor',
                message: message.text,
                type: 'general'
            });

            if (result.success) {
                Alert.alert('Sucesso', 'Notificação enviada para os alunos!');
            } else {
                Alert.alert('Erro', result.message || 'Falha ao enviar notificação');
            }
        } catch (error) {
            Alert.alert('Erro', 'Erro de conexão ao enviar notificação');
        } finally {
            setSendingNotificationId(null);
        }
    };

    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#10b981', '#14b8a6', '#3B82F6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <MaterialIcons name="auto-awesome" size={24} color={colors.white} />
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Assistente de IA</Text>
                            <Text style={styles.headerSubtitle}>{subjectName}</Text>
                        </View>
                    </View>
                    <View style={styles.placeholder} />
                </LinearGradient>

                <KeyboardAvoidingView
                    style={styles.keyboardAvoid}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={0}
                >
                    {/* Quick Actions */}
                    {messages.length <= 1 && (
                        <View style={styles.quickActionsContainer}>
                            <Text style={styles.quickActionsTitle}>Ações Rápidas</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.quickActionsScroll}
                            >
                                {quickActions.map((action) => (
                                    <TouchableOpacity
                                        key={action.id}
                                        style={styles.quickActionCard}
                                        onPress={() => handleQuickAction(action)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.quickActionIcon}>
                                            <MaterialIcons name={action.icon} size={24} color={colors.primary} />
                                        </View>
                                        <Text style={styles.quickActionTitle}>{action.title}</Text>
                                        <Text style={styles.quickActionDescription}>{action.description}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Messages */}
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.messagesContainer}
                        contentContainerStyle={styles.messagesContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {messages.map((message) => (
                            <View
                                key={message.id}
                                style={[
                                    styles.messageBubble,
                                    message.isUser ? styles.userBubble : styles.aiBubble,
                                ]}
                            >
                                {!message.isUser && (
                                    <View style={styles.aiAvatar}>
                                        <MaterialIcons name="auto-awesome" size={16} color={colors.white} />
                                    </View>
                                )}
                                <View style={[
                                    styles.messageContent,
                                    message.isUser ? styles.userMessageContent : styles.aiMessageContent,
                                ]}>
                                    <Text style={[
                                        styles.messageText,
                                        message.isUser && styles.userMessageText,
                                    ]}>
                                        {message.text}
                                    </Text>
                                    {!message.isUser && (
                                        <TouchableOpacity
                                            style={styles.notifyButton}
                                            onPress={() => handleSendToStudents(message)}
                                            disabled={sendingNotificationId === message.id}
                                        >
                                            {sendingNotificationId === message.id ? (
                                                <ActivityIndicator size="small" color={colors.white} />
                                            ) : (
                                                <>
                                                    <MaterialIcons name="notifications-active" size={14} color={colors.zinc400} />
                                                    <Text style={styles.notifyButtonText}>Enviar para Alunos</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                        {isLoading && (
                            <View style={[styles.messageBubble, styles.aiBubble]}>
                                <View style={styles.aiAvatar}>
                                    <MaterialIcons name="auto-awesome" size={16} color={colors.white} />
                                </View>
                                <View style={[styles.messageContent, styles.aiMessageContent]}>
                                    <ActivityIndicator size="small" color="#10b981" />
                                    <Text style={[styles.messageText, { marginTop: 8 }]}>Pensando...</Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Input Area */}
                    <View style={[styles.inputContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
                        {/* Modo Ditado Toggle */}
                        <View style={styles.dictationToggle}>
                            <TouchableOpacity
                                style={[styles.dictationButton, dictationMode && styles.dictationButtonActive]}
                                onPress={() => setDictationMode(!dictationMode)}
                            >
                                <MaterialIcons
                                    name="edit-note"
                                    size={18}
                                    color={dictationMode ? colors.white : colors.zinc500}
                                />
                                <Text style={[styles.dictationText, dictationMode && styles.dictationTextActive]}>
                                    {dictationMode ? 'Modo Ditado ON' : 'Modo Ditado'}
                                </Text>
                            </TouchableOpacity>
                            {dictationMode && (
                                <Text style={styles.dictationHint}>
                                    Ditado não envia automaticamente
                                </Text>
                            )}
                        </View>

                        {/* Indicador de transcrição em tempo real */}
                        {isRecording && interimText && (
                            <View style={styles.interimContainer}>
                                <View style={styles.recordingDot} />
                                <Text style={styles.interimText} numberOfLines={1}>
                                    {interimText}
                                </Text>
                            </View>
                        )}

                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.textInput}
                                placeholder={isRecording ? "🎤 Ouvindo..." : "Digite sua mensagem..."}
                                placeholderTextColor={isRecording ? '#10b981' : colors.zinc500}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                maxLength={2000}
                                editable={!isRecording || dictationMode}
                            />
                            <TouchableOpacity
                                style={[
                                    styles.micButton,
                                    isRecording && styles.micButtonActive,
                                ]}
                                onPress={handleMicPress}
                            >
                                <MaterialIcons
                                    name={isRecording ? "stop" : "mic"}
                                    size={24}
                                    color={isRecording ? colors.white : colors.zinc600}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                                ]}
                                onPress={handleSend}
                                disabled={!inputText.trim() || isLoading}
                            >
                                <MaterialIcons
                                    name="send"
                                    size={24}
                                    color={inputText.trim() && !isLoading ? colors.white : colors.zinc600}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundDark,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -12,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    headerSubtitle: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: 'rgba(255,255,255,0.8)',
    },
    placeholder: {
        width: 48,
        height: 48,
    },
    keyboardAvoid: {
        flex: 1,
    },
    quickActionsContainer: {
        paddingTop: spacing.lg,
    },
    quickActionsTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        paddingHorizontal: spacing.base,
        marginBottom: spacing.sm,
    },
    quickActionsScroll: {
        paddingHorizontal: spacing.base,
        gap: spacing.md,
    },
    quickActionCard: {
        width: 140,
        padding: spacing.base,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.zinc800,
    },
    quickActionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryOpacity20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    quickActionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 4,
    },
    quickActionDescription: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: spacing.base,
        gap: spacing.md,
    },
    messageBubble: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    userBubble: {
        justifyContent: 'flex-end',
    },
    aiBubble: {
        justifyContent: 'flex-start',
    },
    aiAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageContent: {
        maxWidth: '80%',
        padding: spacing.base,
        borderRadius: borderRadius.lg,
    },
    userMessageContent: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    aiMessageContent: {
        backgroundColor: 'rgba(39, 39, 42, 0.8)',
        borderBottomLeftRadius: 4,
    },
    notifyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        alignSelf: 'flex-start',
    },
    notifyButtonText: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc400,
        fontFamily: typography.fontFamily.display,
    },
    messageText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        lineHeight: 22,
    },
    userMessageText: {
        color: colors.white,
    },
    inputContainer: {
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.base,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
        backgroundColor: colors.backgroundDark,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.zinc700,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
    },
    textInput: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        maxHeight: 100,
        paddingVertical: spacing.xs,
    },
    micButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.zinc800,
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButtonActive: {
        backgroundColor: '#ef4444',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.zinc800,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    dictationToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    dictationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.md,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    dictationButtonActive: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    dictationText: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc500,
    },
    dictationTextActive: {
        color: colors.white,
    },
    dictationHint: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc500,
        fontStyle: 'italic',
    },
    interimContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        marginBottom: spacing.sm,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },
    interimText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: '#10b981',
        fontStyle: 'italic',
    },
});
