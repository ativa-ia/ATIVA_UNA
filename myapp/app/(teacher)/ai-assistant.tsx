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

import { processContent, createQuiz, broadcastQuiz, Quiz } from '@/services/quiz';
import { uploadContextFile, getContextFiles, deleteContextFile, generateSuggestions } from '@/services/api';
import { getAISession, getAIMessages, createAISession, listAISessions, activateAISession, deleteAISession } from '@/services/ai';
import { clearChatHistory } from '@/services/chat';
import * as DocumentPicker from 'expo-document-picker';
import Markdown from 'react-native-markdown-display';
import ContentEditorModal from '@/components/modals/ContentEditorModal';
import { shareContent } from '@/services/api';
import ConfirmationModal from '@/components/modals/ConfirmationModal';

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
        text: 'Olá! Sou seu assistente de IA. Anexe arquivos PDF ou texto para começar uma análise contextual.',
        isUser: false,
        timestamp: new Date(),
    };

    const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
    const [inputText, setInputText] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false); // Changed default to false since we are not loading history

    // State for Session Management
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historySessions, setHistorySessions] = useState<any[]>([]);

    // Carregar histórico (persistência)
    useEffect(() => {
        let isMounted = true;
        const initSession = async () => {
            try {
                // 1. Obter/Criar sessão
                const sessionResult = await getAISession(subjectId);
                if (sessionResult.success && sessionResult.session) {
                    const sessionId = sessionResult.session.id;
                    setSessionId(sessionId);
                    loadSessionData(sessionId);
                    return;

                    // 2. Buscar mensagens
                    const msgsResult = await getAIMessages(sessionId);

                    if (isMounted && msgsResult.success && msgsResult.messages.length > 0) {
                        const loadedMessages: Message[] = msgsResult.messages.map((m) => ({
                            id: m.id.toString(),
                            text: m.content,
                            isUser: m.role === 'user',
                            timestamp: new Date(m.created_at),
                        }));
                        // Manter mensagem de boas-vindas ou substituir? Geralmente colamos o histórico DEPOIS dela ou substituímos.
                        // Se tiver histórico, melhor mostrar o histórico.
                        setMessages([welcomeMessage, ...loadedMessages]);
                        // Scroll to bottom
                        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
                    }
                }
            } catch (error) {
                console.log('Erro ao carregar histórico:', error);
            } finally {
                if (isMounted) setIsChatLoading(false);
            }
        };

        initSession();
        return () => { isMounted = false; };
    }, [subjectId]);

    const loadSessionData = async (targetSessionId: number) => {
        setIsChatLoading(true);
        try {
            // 2. Buscar mensagens da sessão
            const msgsResult = await getAIMessages(targetSessionId);

            if (msgsResult.success && msgsResult.messages.length > 0) {
                const loadedMessages: Message[] = msgsResult.messages.map((m) => ({
                    id: m.id.toString(),
                    text: m.content,
                    isUser: m.role === 'user',
                    timestamp: new Date(m.created_at),
                }));
                setMessages([welcomeMessage, ...loadedMessages]);
                setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
            } else {
                setMessages([welcomeMessage]);
            }

            // 3. Carregar arquivos da sessão
            loadContextFiles(targetSessionId);

        } catch (error) {
            console.log('Erro ao carregar dados da sessão:', error);
        } finally {
            setIsChatLoading(false);
        }
    };

    // Load Context Files (By Session)
    const loadContextFiles = async (targetSessionId?: number) => {
        const sid = targetSessionId || sessionId;
        if (!sid) return;

        const result = await getContextFiles(subjectId, sid);
        if (result.success) {
            setContextFiles(result.files);
        } else {
            setContextFiles([]);
        }
    };

    // Share Content State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState<string | object>('');
    const [modalType, setModalType] = useState<'quiz' | 'summary'>('summary');
    const [showSuggestionInfo, setShowSuggestionInfo] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: 'Confirmar',
        isDestructive: false
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, visible: false }));

    const handleNewChat = () => {
        setConfirmModal({
            visible: true,
            title: 'Novo Chat',
            message: 'Deseja iniciar uma nova conversa? A atual será arquivada no histórico.',
            confirmText: 'Novo Chat',
            isDestructive: false,
            onConfirm: async () => {
                closeConfirmModal();
                setIsChatLoading(true);
                try {
                    const result = await createAISession(subjectId);
                    if (result.success && result.session) {
                        setSessionId(result.session.id);
                        setMessages([welcomeMessage]);
                        setContextFiles([]);
                    }
                } catch (e) {
                    Alert.alert('Erro', 'Não foi possível criar novo chat.');
                } finally {
                    setIsChatLoading(false);
                }
            }
        });
    };

    const handleOpenHistory = async () => {
        setIsChatLoading(true);
        try {
            const result = await listAISessions(subjectId);
            if (result.success) {
                setHistorySessions(result.sessions);
                setShowHistoryModal(true);
            }
        } catch (e) {
            Alert.alert('Erro', 'Não foi possível carregar o histórico.');
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleRestoreSession = async (session: any) => {
        setShowHistoryModal(false);
        if (session.id === sessionId) return;

        setSessionId(session.id);

        // Ativar a sessão no backend para persistência
        await activateAISession(session.id);

        loadSessionData(session.id);
    };

    const handleDeleteSession = (session: any) => {
        // Close history modal if needed, or keep it open? 
        // Logic: Delete confirm modal over history modal.

        setConfirmModal({
            visible: true,
            title: 'Apagar Conversa',
            message: `Tem certeza que deseja apagar a conversa de ${new Date(session.started_at).toLocaleDateString()}?`,
            confirmText: 'Apagar',
            isDestructive: true,
            onConfirm: async () => {
                closeConfirmModal();
                await deleteAISession(session.id);
                // Atualizar lista
                const list = await listAISessions(subjectId);
                if (list.success) setHistorySessions(list.sessions);
                // Se apagou a ativa, limpar tela
                if (session.id === sessionId) {
                    setIsChatLoading(true);
                    try {
                        // Se apagou a ativa, cria uma nova imediatamente para não ficar no limbo
                        const result = await createAISession(subjectId);
                        if (result.success && result.session) {
                            setSessionId(result.session.id);
                            setMessages([welcomeMessage]);
                            setContextFiles([]);
                        } else {
                            // Fallback
                            setSessionId(null);
                            setMessages([welcomeMessage]);
                            setContextFiles([]);
                        }
                    } catch (e) {
                        setSessionId(null);
                    } finally {
                        setIsChatLoading(false);
                    }
                }
            }
        });
    };

    // Context Files State
    const [contextFiles, setContextFiles] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showContextSidebar, setShowContextSidebar] = useState(false);

    const handleOpenShare = (text: string) => {
        // Simple heuristic to detect JSON/Quiz
        if (text.trim().startsWith('{') || text.includes('```json')) {
            setModalType('quiz');
            // Try to extract JSON string if mixed with text
            let contentToSet = text;
            if (text.includes('```json')) {
                // Extraction will be handled by Modal or backend, here use raw text
            }
            setModalContent(text);
        } else {
            setModalType('summary');
            setModalContent(text);
        }
        setModalVisible(true);
    };

    const handleShareContent = async (title: string, content: string | object, type: 'quiz' | 'summary') => {
        console.log('[UI] Sending content:', { title, type });
        const result = await shareContent(subjectId, content, type, title);
        console.log('[UI] Share Result:', result);

        if (!result.success) {
            const errorMsg = result.error || 'Falha ao enviar conteúdo.';
            console.error('[UI] Share Error:', errorMsg);
            Alert.alert('Erro', errorMsg);
            return;
        }

        // Success case - Handle Redirect
        if (type === 'quiz' && result.activity && result.activity.id) {
            Alert.alert('Sucesso', 'Quiz enviado! Redirecionando para o ranking...', [
                {
                    text: 'OK',
                    onPress: () => {
                        router.push({
                            pathname: '/(teacher)/quiz-results',
                            params: {
                                subjectId: subjectId,
                                activityId: result.activity.id
                            }
                        });
                    }
                }
            ]);
            // Fallback auto redirect
            setTimeout(() => {
                router.push({
                    pathname: '/(teacher)/quiz-results',
                    params: {
                        subjectId: subjectId,
                        activityId: result.activity.id
                    }
                });
            }, 1500);
        } else {
            Alert.alert('Sucesso', 'Conteúdo compartilhado com a turma!');
        }
    };



    // Estado de Ações Rápidas (começa com as padrão)
    const [activeQuickActions, setActiveQuickActions] = useState<QuickAction[]>([
        {
            id: '1',
            icon: 'quiz',
            title: 'Gerar Quiz',
            description: 'Perguntas sobre o material',
        },
        {
            id: '2',
            icon: 'assignment',
            title: 'Criar Atividade',
            description: 'Exercícios práticos',
        },
        {
            id: '3',
            icon: 'summarize',
            title: 'Resumir',
            description: 'Fazer um resumo',
        },
        {
            id: '4',
            icon: 'event-note',
            title: 'Plano de Aula',
            description: 'Estrutura de aula',
        },
    ]);

    const handleSend = async () => {
        if (!inputText.trim() || isChatLoading) return;


        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            isUser: true,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        const messageToSend = inputText;
        setInputText('');
        setIsChatLoading(true);
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
                text: 'Erro ao conectar. Tente novamente.',
                isUser: false,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsChatLoading(false);
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }
    };

    const handleQuickAction = (action: QuickAction) => {
        // Se for uma sugestão customizada (ID começa com 'sug_'), usa o título/descrição como prompt
        if (action.id.startsWith('sug_')) {
            setInputText(action.description); // Usa a pergunta completa como prompt
            return;
        }

        const prompts: { [key: string]: string } = {
            '1': `Gere um quiz com 5 perguntas objetivas baseadas EXCLUSIVAMENTE nos arquivos fornecidos.`,
            '2': `Crie uma atividade prática para os alunos com base no conteúdo dos arquivos anexados.`,
            '3': `Faça um resumo didático dos principais pontos abordados nos arquivos em anexo.`,
            '4': `Sugira um plano de aula estruturado utilizando o material de apoio fornecido.`,
        };

        setInputText(prompts[action.id] || '');
    };

    const handleDeleteFile = async (fileId: number) => {
        // Optimistic Update: Remove imediato da UI
        const previousFiles = [...contextFiles];
        setContextFiles(prev => prev.filter(f => f.id !== fileId));

        try {
            const result = await deleteContextFile(fileId);
            if (!result.success) {
                // Rollback em caso de erro
                setContextFiles(previousFiles);
                Alert.alert('Erro', 'Não foi possível excluir o arquivo.');
            }
        } catch (error) {
            setContextFiles(previousFiles);
            Alert.alert('Erro', 'Erro de conexão ao excluir arquivo.');
        }
    };

    const handleUploadFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            // 4MB limit removed - using Supabase Storage now

            setIsUploading(true);
            console.log('DEBUG FRONTEND UPLOAD:', { subjectId, sessionId });
            const uploadResult = await uploadContextFile(subjectId, file, { sessionId: sessionId || undefined });

            if (uploadResult.success) {
                Alert.alert('Sucesso', 'Arquivo adicionado ao contexto da IA!');
                loadContextFiles();

                // Gerar sugestões em background sem travar a UI
                generateSuggestions(subjectId).then(suggestionsResult => {
                    if (suggestionsResult.success && suggestionsResult.suggestions && suggestionsResult.suggestions.length > 0) {
                        const firstSuggestion = suggestionsResult.suggestions[0];
                        const newAction: QuickAction = {
                            id: `sug_${Date.now()}`,
                            icon: 'auto-awesome', // Updated icon to match "AI" theme
                            title: 'Sugestão IA',
                            description: firstSuggestion
                        };

                        setActiveQuickActions(prev => {
                            // Remove existing suggestions to keep only one
                            const cleanPrev = prev.filter(a => !a.id.startsWith('sug_'));
                            return [newAction, ...cleanPrev];
                        });
                    }
                });

            } else {
                Alert.alert('Erro', uploadResult.error || 'Falha ao enviar arquivo');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Erro ao selecionar arquivo');
        } finally {
            setIsUploading(false);
        }
    };



    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#4f46e5', '#8b5cf6']} // Indigo to Violet
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}

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
                        style={[styles.clearButton, { marginRight: 8 }]}
                        onPress={handleOpenHistory}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="history" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.clearButton, { marginRight: 8 }]}
                        onPress={handleNewChat}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="add-circle-outline" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => setShowContextSidebar(true)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="attach-file" size={22} color={contextFiles.length > 0 ? colors.white : "rgba(255,255,255,0.7)"} />
                        {contextFiles.length > 0 && (
                            <View style={styles.badge} />
                        )}
                    </TouchableOpacity>
                </LinearGradient>

                {contextFiles.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconContainer}>
                            <MaterialIcons name="cloud-upload" size={48} color={colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>Adicione Conteúdo</Text>
                        <Text style={styles.emptyDescription}>
                            Para iniciar o chat, adicione arquivos PDF ou texto para a IA usar como base de conhecimento.
                        </Text>
                        <TouchableOpacity style={styles.ctaButton} onPress={handleUploadFile}>
                            <MaterialIcons name="add" size={24} color={colors.white} />
                            <Text style={styles.ctaButtonText}>Selecionar Arquivos</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <KeyboardAvoidingView
                        style={styles.keyboardAvoid}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={0}
                    >
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
                                        {message.isUser ? (
                                            <Text style={[styles.messageText, styles.userMessageText]}>
                                                {message.text}
                                            </Text>
                                        ) : (
                                            <Markdown style={markdownStyles}>
                                                {message.text}
                                            </Markdown>
                                        )}
                                    </View>
                                    {!message.isUser && (
                                        <View style={styles.notifyButton}>
                                            <TouchableOpacity
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                                onPress={() => handleOpenShare(message.text)}
                                            >
                                                <MaterialIcons name="send" size={14} color={colors.primary} />
                                                <Text style={styles.notifyButtonText}>Enviar para Turma</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ))}
                            {isChatLoading && (
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

                        {/* Quick Actions (Pinned above input) */}
                        <View style={styles.quickActionsContainerCompact}>
                            {activeQuickActions.some(a => a.id.startsWith('sug_')) && (
                                <View style={styles.suggestionHeader}>
                                    <Text style={styles.suggestionTitle}>✨ Sugestão da IA</Text>
                                    <TouchableOpacity
                                        style={styles.infoButton}
                                        onPress={() => setShowSuggestionInfo(true)}
                                    >
                                        <MaterialIcons name="info-outline" size={14} color={colors.primary} />
                                        <Text style={styles.infoButtonText}>O que é isso?</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.quickActionsScrollCompact}
                            >
                                {activeQuickActions.map((action) => (
                                    <TouchableOpacity
                                        key={action.id}
                                        style={styles.quickActionChip}
                                        onPress={() => handleQuickAction(action)}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialIcons name={action.icon} size={16} color={colors.primary} />
                                        <Text style={styles.quickActionChipText}>{action.title}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* File Mention Chips */}
                        {contextFiles.length > 0 && (
                            <View style={styles.fileChipsContainer}>
                                <Text style={styles.fileChipsLabel}>Falar sobre:</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.fileChipsScroll}
                                >
                                    {contextFiles.map((file, index) => (
                                        <TouchableOpacity
                                            key={file.id || index}
                                            style={styles.fileChip}
                                            onPress={() => setInputText((prev) => prev + (prev ? ' ' : '') + `Sobre o arquivo "${file.filename}": `)}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialIcons name="description" size={12} color={colors.slate400} />
                                            <Text style={styles.fileChipText} numberOfLines={1}>
                                                {file.filename}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Input Area */}
                        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Digite sua mensagem..."
                                    placeholderTextColor={colors.slate500}
                                    value={inputText}
                                    onChangeText={setInputText}
                                    multiline
                                    maxLength={2000}
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.sendButton,
                                        (!inputText.trim() || isChatLoading) && styles.sendButtonDisabled,
                                    ]}
                                    onPress={handleSend}
                                    disabled={!inputText.trim() || isChatLoading}
                                >
                                    <MaterialIcons
                                        name="send"
                                        size={24}
                                        color={inputText.trim() && !isChatLoading ? colors.white : colors.slate600}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                )}
            </View>


            {/* Context Sidebar Modal */}
            <Modal
                visible={showContextSidebar}
                transparent
                animationType="slide"
                onRequestClose={() => setShowContextSidebar(false)}
            >
                <View style={styles.sidebarOverlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => setShowContextSidebar(false)}
                    />
                    <View style={styles.sidebarContainer}>
                        <View style={styles.sidebarHeader}>
                            <Text style={styles.sidebarTitle}>Contexto (Notebook)</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowContextSidebar(false)}
                            >
                                <MaterialIcons name="close" size={24} color={colors.slate400} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.uploadButton}
                            onPress={handleUploadFile}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <>
                                    <MaterialIcons name="add" size={24} color={colors.white} />
                                    <Text style={styles.uploadButtonText}>Adicionar Arquivo</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <ScrollView style={styles.fileList}>
                            {contextFiles.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <MaterialIcons name="library-books" size={48} color={colors.slate800} />
                                    <Text style={styles.emptyStateText}>
                                        Nenhum arquivo de contexto.{'\n'}Adicione PDFs para a IA usar como base.
                                    </Text>
                                </View>
                            ) : (
                                contextFiles.map((file, index) => (
                                    <View key={file.id || index} style={styles.fileItem}>
                                        <View style={styles.fileIcon}>
                                            <MaterialIcons name="description" size={20} color="#3b82f6" />
                                        </View>
                                        <View style={styles.fileInfo}>
                                            <Text style={styles.fileName} numberOfLines={1}>
                                                {file.filename}
                                            </Text>
                                            <Text style={styles.fileDate}>
                                                {new Date(file.created_at).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.deleteFileButton}
                                            onPress={() => handleDeleteFile(file.id)}
                                        >
                                            <MaterialIcons name="delete" size={20} color={colors.slate600} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ContentEditorModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSend={handleShareContent}
                initialContent={modalContent}
                type={modalType}
            />



            {/* Modal de Informação da Sugestão */}
            <Modal
                visible={showSuggestionInfo}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSuggestionInfo(false)}
            >
                <View style={styles.infoModalOverlay}>
                    <View style={styles.infoModalContainer}>
                        <View style={styles.infoModalHeader}>
                            <MaterialIcons name="auto-awesome" size={24} color={colors.primary} />
                            <Text style={styles.infoModalTitle}>Sugestão da IA</Text>
                        </View>
                        <Text style={styles.infoModalText}>
                            A Inteligência Artificial analisou os arquivos que você enviou e criou esta pergunta sugerida para iniciar a conversa de forma relevante.
                        </Text>
                        <Text style={styles.infoModalTextSecondary}>
                            Clique na sugestão para enviá-la para o chat.
                        </Text>
                        <TouchableOpacity
                            style={styles.infoModalButton}
                            onPress={() => setShowSuggestionInfo(false)}
                        >
                            <Text style={styles.infoModalButtonText}>Entendi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* History Modal */}
            <Modal
                visible={showHistoryModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowHistoryModal(false)}
            >
                <View style={styles.sidebarOverlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => setShowHistoryModal(false)}
                    />
                    <View style={styles.sidebarContainer}>
                        <View style={styles.sidebarHeader}>
                            <Text style={styles.sidebarTitle}>Histórico de Conversas</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowHistoryModal(false)}
                            >
                                <MaterialIcons name="close" size={24} color={colors.slate400} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.fileList}>
                            {historySessions.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <MaterialIcons name="history" size={48} color={colors.slate800} />
                                    <Text style={styles.emptyStateText}>Nenhuma conversa anterior.</Text>
                                </View>
                            ) : (
                                historySessions.map((session: any) => (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <TouchableOpacity
                                            key={session.id}
                                            style={[styles.fileItem, { flex: 1, marginRight: 8 }, session.id === sessionId && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                                            onPress={() => handleRestoreSession(session)}
                                        >
                                            <View style={styles.fileIcon}>
                                                <MaterialIcons name="chat" size={20} color={session.id === sessionId ? colors.primary : colors.slate500} />
                                            </View>
                                            <View style={styles.fileInfo}>
                                                <Text style={styles.fileName}>Conversa #{session.id}</Text>
                                                <Text style={styles.fileDate}>
                                                    {new Date(session.started_at).toLocaleDateString()} {new Date(session.started_at).toLocaleTimeString().slice(0, 5)}
                                                </Text>
                                            </View>
                                            {session.status === 'active' && (
                                                <View style={{ backgroundColor: colors.secondary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                                    <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: 'bold' }}>ATIVA</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteSession(session)}
                                            style={{ padding: 8 }}
                                        >
                                            <MaterialIcons name="delete-outline" size={24} color={colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ConfirmationModal
                visible={confirmModal.visible}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDestructive={confirmModal.isDestructive}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
            />
        </View >
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
        color: 'rgba(255,255,255,0.9)',
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
        backgroundColor: 'rgba(255,255,255,0.2)'
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
        color: colors.textPrimary,
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
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    quickActionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    quickActionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginBottom: 4,
    },
    quickActionDescription: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate500,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: spacing.base,
        paddingBottom: 20,
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
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    messageContent: {
        maxWidth: '85%',
        padding: spacing.md,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    userMessageContent: {
        backgroundColor: colors.secondary, // Emerald Green
        borderBottomRightRadius: 4,
    },
    aiMessageContent: {
        backgroundColor: colors.white,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: colors.slate100,
    },
    notifyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        alignSelf: 'flex-start',
    },
    notifyButtonText: {
        fontSize: typography.fontSize.xs,
        color: colors.primary,
        fontFamily: typography.fontFamily.display,
        fontWeight: '500',
    },
    messageText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        lineHeight: 22,
    },
    userMessageText: {
        color: colors.white,
    },
    inputContainer: {
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.base,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        backgroundColor: colors.white,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        backgroundColor: colors.slate50,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.slate200,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
    },
    textInput: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        maxHeight: 100,
        paddingVertical: spacing.xs,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.slate300,
    },
    // Empty State Styles
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.md,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.slate50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    emptyTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    emptyDescription: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 24,
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: 12,
        marginTop: spacing.lg,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    ctaButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    // Context Sidebar Styles - Adjusted for Light Mode
    badge: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.danger,
        borderWidth: 1.5,
        borderColor: colors.white,
    },
    sidebarOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sidebarContainer: {
        width: '85%',
        height: '100%',
        backgroundColor: colors.white,
        position: 'absolute',
        right: 0,
        paddingTop: 50, // Safe Area
        paddingHorizontal: spacing.md,
        borderLeftWidth: 1,
        borderLeftColor: colors.slate200,
        shadowColor: "#000",
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    sidebarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    sidebarTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        marginHorizontal: spacing.lg,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    uploadButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    fileList: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    fileIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate100,
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    fileDate: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
    },
    deleteFileButton: {
        padding: spacing.sm,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
        gap: spacing.md,
    },
    emptyStateText: {
        color: colors.textSecondary,
        textAlign: 'center',
        fontSize: typography.fontSize.sm,
        marginTop: spacing.md,
    },
    // Top Quick Actions
    quickActionsContainerCompact: {
        paddingVertical: spacing.sm,
        backgroundColor: colors.slate50,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
    },
    suggestionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        marginBottom: spacing.xs,
    },
    suggestionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    infoButtonText: {
        fontSize: 11,
        color: colors.primary,
        textDecorationLine: 'underline',
    },
    quickActionsScrollCompact: {
        paddingHorizontal: spacing.base,
        gap: spacing.sm,
    },
    quickActionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: colors.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    quickActionChipText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '500',
        color: colors.primary,
        fontFamily: typography.fontFamily.display,
    },
    // File Chips
    fileChipsContainer: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.base,
        backgroundColor: colors.white,
    },
    fileChipsLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        fontFamily: typography.fontFamily.display,
        marginBottom: 4,
    },
    fileChipsScroll: {
        gap: spacing.sm,
    },
    fileChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.slate100,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        gap: 6,
    },
    fileChipText: {
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
        maxWidth: 120,
        fontSize: typography.fontSize.xs,
    },
    // Info Modal Styles
    infoModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    infoModalContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 320,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
    },
    infoModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    infoModalTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    infoModalText: {
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        lineHeight: 24,
        fontFamily: typography.fontFamily.body,
        marginBottom: spacing.sm,
    },
    infoModalTextSecondary: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        fontFamily: typography.fontFamily.body,
        marginBottom: spacing.lg,
    },
    infoModalButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    infoModalButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
});

const markdownStyles = StyleSheet.create({
    body: { color: colors.textPrimary, fontSize: 16, fontFamily: typography.fontFamily.body },
    heading1: { color: colors.primary, marginTop: 10, marginBottom: 10, fontWeight: 'bold', fontSize: 24 },
    heading2: { color: colors.primaryDark, marginTop: 10, marginBottom: 5, fontWeight: 'bold', fontSize: 20 },
    strong: { fontWeight: 'bold', color: colors.textPrimary },
    em: { fontStyle: 'italic', color: colors.slate500 },
    bullet_list: { marginBottom: 10 },
    ordered_list: { marginBottom: 10 },
    code_inline: { backgroundColor: colors.slate100, padding: 4, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.primary },
    code_block: { backgroundColor: colors.slate100, padding: 10, borderRadius: 8, marginVertical: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.slate700 },
    fence: { backgroundColor: colors.slate100, padding: 10, borderRadius: 8, marginVertical: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.slate700 },
});
