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
    Modal,
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
import { processContent, createQuiz, broadcastQuiz, Quiz } from '@/services/quiz';
import { getChatHistory, saveChatMessage, clearChatHistory } from '@/services/chat';

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

    const welcomeMessage: Message = {
        id: '1',
        text: `Olá! Sou seu assistente de IA para a disciplina ${subjectName}. Como posso ajudá-lo hoje?\n\nPosso ajudar com:\n• Gerar quizzes e atividades\n• Criar resumos de conteúdo\n• Sugerir planos de aula\n• Analisar desempenho dos alunos\n• Responder dúvidas sobre o conteúdo`,
        isUser: false,
        timestamp: new Date(),
    };

    const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
    const [inputText, setInputText] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(true);

    // Carregar histórico de chat ao iniciar
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const result = await getChatHistory(subjectId);
                if (result.success && result.messages && result.messages.length > 0) {
                    const loadedMessages: Message[] = result.messages.map((m) => ({
                        id: m.id.toString(),
                        text: m.content,
                        isUser: m.is_user,
                        timestamp: new Date(m.created_at),
                    }));
                    setMessages(loadedMessages);
                }
            } catch (error) {
                console.log('Erro ao carregar histórico:', error);
            } finally {
                setIsChatLoading(false);
            }
        };
        loadHistory();
    }, [subjectId]);

    // Limpar chat
    const handleClearChat = () => {
        Alert.alert(
            'Limpar Conversa',
            'Tem certeza que deseja apagar todo o histórico desta conversa?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Limpar', style: 'destructive', onPress: async () => {
                        await clearChatHistory(subjectId);
                        setMessages([welcomeMessage]);
                    }
                }
            ]
        );
    };

    // Speech Recognition State
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [dictationMode, setDictationMode] = useState(false); // Modo ditado (sem auto-enviar)
    const [interimText, setInterimText] = useState(''); // Texto sendo reconhecido em tempo real

    // Post-Dictation Actions State
    const [showDictationActions, setShowDictationActions] = useState(false);
    const [dictatedContent, setDictatedContent] = useState('');
    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const [generatedQuiz, setGeneratedQuiz] = useState<any>(null);
    const [showQuizPreview, setShowQuizPreview] = useState(false);
    const [quizTimeLimit, setQuizTimeLimit] = useState(300); // 5 minutos default

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

    // Track which results have been processed
    const processedResultsRef = useRef<Set<number>>(new Set());
    const lastFinalTextRef = useRef<string>(''); // Track last final to avoid duplicates

    useEffect(() => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                // Detect mobile browser
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                recognitionRef.current = new SpeechRecognition();
                // On mobile, don't use continuous to avoid duplications
                recognitionRef.current.continuous = !isMobile;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'pt-BR';

                recognitionRef.current.onresult = (event: any) => {
                    let currentInterim = '';

                    // Process only new final results
                    for (let i = 0; i < event.results.length; i++) {
                        const result = event.results[i];
                        const transcript = result[0].transcript.trim();

                        if (result.isFinal && transcript) {
                            // Only add if not already processed AND not duplicate of last text
                            if (!processedResultsRef.current.has(i) && transcript !== lastFinalTextRef.current) {
                                processedResultsRef.current.add(i);
                                lastFinalTextRef.current = transcript;
                                const separator = savedTextRef.current ? ' ' : '';
                                savedTextRef.current = savedTextRef.current + separator + transcript;
                                setInputText(savedTextRef.current);
                            }
                        } else if (!result.isFinal) {
                            // Show current interim (last one only)
                            currentInterim = transcript;
                        }
                    }

                    setInterimText(currentInterim);

                    // Reset silence timer
                    if (silenceTimer.current) clearTimeout(silenceTimer.current);

                    // Auto-send only if NOT in dictation mode
                    if (!dictationMode && savedTextRef.current.trim()) {
                        silenceTimer.current = setTimeout(() => {
                            console.log("Silêncio detectado, enviando...");
                            isRecordingRef.current = false;
                            recognitionRef.current.stop();
                            setIsRecording(false);
                            setInterimText('');
                            processedResultsRef.current.clear();
                            setTriggerAutoSend(true);
                        }, 2500);
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
                    // Clear processed results on session end
                    processedResultsRef.current.clear();

                    // In dictation mode, always restart automatically
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
    }, [dictationMode]);

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
                setInterimText('');
                if (silenceTimer.current) clearTimeout(silenceTimer.current);

                // Se estava em modo ditado e tem conteúdo, mostra ações
                if (dictationMode && inputText.trim()) {
                    setDictatedContent(inputText.trim());
                    setShowDictationActions(true);
                }
            } else {
                isRecordingRef.current = true;
                // Se o usuário já digitou algo, salvamos como texto base
                if (inputText.trim()) {
                    savedTextRef.current = inputText;
                } else {
                    savedTextRef.current = '';
                }
                // Clear tracking for new session
                processedResultsRef.current.clear();
                lastFinalTextRef.current = '';
                setInterimText('');

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

    // Handler para ações pós-ditado
    const handleDictationAction = async (action: 'quiz' | 'summary' | 'discussion') => {
        setProcessingAction(action);

        try {
            const result = await processContent(dictatedContent, action, subjectId);

            if (!result.success) {
                Alert.alert('Erro', result.error || 'Falha ao processar conteúdo');
                setProcessingAction(null);
                return;
            }

            if (action === 'quiz' && result.result?.questions) {
                setGeneratedQuiz(result.result);
                setShowDictationActions(false);
                setShowQuizPreview(true);
            } else if (action === 'summary' && result.result?.text) {
                // Adiciona o resumo como mensagem no chat
                const summaryMessage: Message = {
                    id: Date.now().toString(),
                    text: `📝 **Resumo do Conteúdo:**\n\n${result.result.text}`,
                    isUser: false,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, summaryMessage]);
                setShowDictationActions(false);
                setInputText('');
            } else if (action === 'discussion' && result.result?.questions) {
                // Adiciona perguntas de discussão no chat
                const discussionText = result.result.questions
                    .map((q: any, i: number) => `${i + 1}. ${q.question}\n   _${q.objective}_`)
                    .join('\n\n');
                const discussionMessage: Message = {
                    id: Date.now().toString(),
                    text: `💬 **Perguntas para Discussão:**\n\n${discussionText}`,
                    isUser: false,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, discussionMessage]);
                setShowDictationActions(false);
                setInputText('');
            }
        } catch (error) {
            console.error('Erro ao processar:', error);
            Alert.alert('Erro', 'Falha ao processar conteúdo');
        } finally {
            setProcessingAction(null);
        }
    };

    // Handler para enviar quiz ao vivo
    const handleBroadcastQuiz = async () => {
        if (!generatedQuiz?.questions) return;

        try {
            setProcessingAction('broadcasting');

            // Criar quiz no banco
            const createResult = await createQuiz(
                subjectId,
                `Quiz: ${subjectName}`,
                generatedQuiz.questions,
                quizTimeLimit,
                dictatedContent.substring(0, 200)
            );

            if (!createResult.success || !createResult.quiz) {
                Alert.alert('Erro', createResult.error || 'Falha ao criar quiz');
                setProcessingAction(null);
                return;
            }

            // Broadcast para todos os alunos
            const broadcastResult = await broadcastQuiz(createResult.quiz.id);

            if (!broadcastResult.success) {
                Alert.alert('Erro', broadcastResult.error || 'Falha ao enviar quiz');
                setProcessingAction(null);
                return;
            }

            // Sucesso!
            Alert.alert(
                '🎉 Quiz Enviado!',
                `Quiz enviado para ${broadcastResult.enrolled_students} alunos!\n\nTempo: ${Math.floor(quizTimeLimit / 60)} minutos`,
                [{
                    text: 'Ver Resultados', onPress: () => {
                        setShowQuizPreview(false);
                        setGeneratedQuiz(null);
                        setDictatedContent('');
                        setInputText('');
                        // Navegar para tela de resultados
                        router.push({
                            pathname: '/(teacher)/quiz-results',
                            params: {
                                quizId: createResult.quiz.id.toString(),
                                subject: subjectName
                            }
                        });
                    }
                }]
            );

            // Adiciona mensagem no chat
            const quizMessage: Message = {
                id: Date.now().toString(),
                text: `🎯 **Quiz Enviado!**\n\nQuiz com ${generatedQuiz.questions.length} perguntas enviado para ${broadcastResult.enrolled_students} alunos.\n\n⏱️ Tempo: ${Math.floor(quizTimeLimit / 60)} minutos`,
                isUser: false,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, quizMessage]);

        } catch (error) {
            console.error('Erro ao enviar quiz:', error);
            Alert.alert('Erro', 'Falha ao enviar quiz');
        } finally {
            setProcessingAction(null);
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
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={handleClearChat}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="delete-outline" size={22} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
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

                        {/* Popup de transcrição em tempo real (modo ditado) */}
                        {isRecording && dictationMode && (
                            <View style={styles.dictationPopup}>
                                <View style={styles.dictationPopupHeader}>
                                    <View style={styles.recordingIndicator}>
                                        <View style={styles.recordingDotAnimated} />
                                        <Text style={styles.recordingLabel}>Gravando...</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.stopDictationButton}
                                        onPress={handleMicPress}
                                    >
                                        <MaterialIcons name="stop" size={20} color={colors.white} />
                                        <Text style={styles.stopDictationText}>Parar</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.dictationContent}>
                                    <Text style={styles.dictationTranscript}>
                                        {inputText || 'Comece a falar...'}
                                    </Text>
                                    {interimText && (
                                        <Text style={styles.dictationInterim}>
                                            {interimText}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Indicador simples quando não está em modo ditado */}
                        {isRecording && !dictationMode && interimText && (
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

            {/* Modal: Ações pós-ditado */}
            <Modal
                visible={showDictationActions}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDictationActions(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.actionModal}>
                        <Text style={styles.actionModalTitle}>O que fazer com este conteúdo?</Text>
                        <Text style={styles.actionModalSubtitle} numberOfLines={2}>
                            "{dictatedContent.substring(0, 100)}..."
                        </Text>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDictationAction('quiz')}
                            disabled={processingAction !== null}
                        >
                            <MaterialIcons name="quiz" size={24} color="#10b981" />
                            <View style={styles.actionButtonText}>
                                <Text style={styles.actionButtonTitle}>🎯 Gerar Quiz ao Vivo</Text>
                                <Text style={styles.actionButtonDesc}>10 perguntas para os alunos</Text>
                            </View>
                            {processingAction === 'quiz' && <ActivityIndicator color="#10b981" />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDictationAction('summary')}
                            disabled={processingAction !== null}
                        >
                            <MaterialIcons name="summarize" size={24} color="#3b82f6" />
                            <View style={styles.actionButtonText}>
                                <Text style={styles.actionButtonTitle}>📝 Criar Resumo</Text>
                                <Text style={styles.actionButtonDesc}>Resumo didático do conteúdo</Text>
                            </View>
                            {processingAction === 'summary' && <ActivityIndicator color="#3b82f6" />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDictationAction('discussion')}
                            disabled={processingAction !== null}
                        >
                            <MaterialIcons name="forum" size={24} color="#f59e0b" />
                            <View style={styles.actionButtonText}>
                                <Text style={styles.actionButtonTitle}>💬 Perguntas de Discussão</Text>
                                <Text style={styles.actionButtonDesc}>5 perguntas para debate</Text>
                            </View>
                            {processingAction === 'discussion' && <ActivityIndicator color="#f59e0b" />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                setShowDictationActions(false);
                                setDictatedContent('');
                            }}
                        >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal: Preview do Quiz */}
            <Modal
                visible={showQuizPreview}
                transparent
                animationType="slide"
                onRequestClose={() => setShowQuizPreview(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.quizPreviewModal}>
                        <Text style={styles.quizPreviewTitle}>🎯 Quiz Gerado!</Text>
                        <Text style={styles.quizPreviewSubtitle}>
                            {generatedQuiz?.questions?.length || 0} perguntas prontas
                        </Text>

                        <ScrollView style={styles.quizPreviewList}>
                            {generatedQuiz?.questions?.map((q: any, i: number) => (
                                <View key={i} style={styles.quizPreviewItem}>
                                    <Text style={styles.quizPreviewQuestion}>
                                        {i + 1}. {q.question}
                                    </Text>
                                    {q.options?.map((opt: string, j: number) => (
                                        <Text
                                            key={j}
                                            style={[
                                                styles.quizPreviewOption,
                                                j === q.correct && styles.quizPreviewCorrect
                                            ]}
                                        >
                                            {String.fromCharCode(65 + j)}) {opt}
                                        </Text>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.quizTimeSelector}>
                            <Text style={styles.quizTimerLabel}>⏱️ Tempo para responder:</Text>
                            <View style={styles.quizTimerButtons}>
                                {[180, 300, 600, 900].map((time) => (
                                    <TouchableOpacity
                                        key={time}
                                        style={[
                                            styles.quizTimerButton,
                                            quizTimeLimit === time && styles.quizTimerButtonActive
                                        ]}
                                        onPress={() => setQuizTimeLimit(time)}
                                    >
                                        <Text style={[
                                            styles.quizTimerButtonText,
                                            quizTimeLimit === time && styles.quizTimerButtonTextActive
                                        ]}>
                                            {Math.floor(time / 60)} min
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.broadcastButton}
                            onPress={handleBroadcastQuiz}
                            disabled={processingAction === 'broadcasting'}
                        >
                            {processingAction === 'broadcasting' ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <>
                                    <MaterialIcons name="send" size={24} color={colors.white} />
                                    <Text style={styles.broadcastButtonText}>
                                        ENVIAR PARA ALUNOS
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                setShowQuizPreview(false);
                                setGeneratedQuiz(null);
                            }}
                        >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    clearButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
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
        borderRadius: borderRadius.default,
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
    dictationPopup: {
        backgroundColor: 'rgba(16, 24, 40, 0.98)',
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: '#10b981',
        padding: spacing.base,
        marginBottom: spacing.sm,
        minHeight: 120,
    },
    dictationPopupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    recordingDotAnimated: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
    },
    recordingLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: '#ef4444',
    },
    stopDictationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        backgroundColor: '#ef4444',
        borderRadius: borderRadius.default,
    },
    stopDictationText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    dictationContent: {
        flex: 1,
    },
    dictationTranscript: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        lineHeight: 24,
    },
    dictationInterim: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: '#10b981',
        fontStyle: 'italic',
        marginTop: spacing.sm,
    },
    interimContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        marginBottom: spacing.sm,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: borderRadius.default,
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
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.base,
    },
    actionModal: {
        backgroundColor: colors.zinc900,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    actionModalTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    actionModalSubtitle: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        textAlign: 'center',
        marginBottom: spacing.lg,
        fontStyle: 'italic',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    actionButtonText: {
        flex: 1,
    },
    actionButtonTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    actionButtonDesc: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    cancelButton: {
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    cancelButtonText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        textAlign: 'center',
    },
    // Quiz preview modal
    quizPreviewModal: {
        backgroundColor: colors.zinc900,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    quizPreviewTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    quizPreviewSubtitle: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: '#10b981',
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    quizPreviewList: {
        maxHeight: 300,
        marginBottom: spacing.md,
    },
    quizPreviewItem: {
        padding: spacing.md,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
    },
    quizPreviewQuestion: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: spacing.sm,
    },
    quizPreviewOption: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc300,
        paddingLeft: spacing.md,
        marginBottom: 4,
    },
    quizPreviewCorrect: {
        color: '#10b981',
        fontWeight: typography.fontWeight.semibold,
    },
    quizTimeSelector: {
        marginBottom: spacing.md,
    },
    quizTimerLabel: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: spacing.sm,
    },
    quizTimerButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    quizTimerButton: {
        flex: 1,
        padding: spacing.sm,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.default,
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    quizTimerButtonActive: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    quizTimerButtonText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        textAlign: 'center',
    },
    quizTimerButtonTextActive: {
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
    },
    broadcastButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: '#10b981',
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
    },
    broadcastButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
});
