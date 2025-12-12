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
import { getChatHistory, saveChatMessage, clearChatHistory } from '@/services/chat';
import * as DocumentPicker from 'expo-document-picker';
import Markdown from 'react-native-markdown-display';

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

    /*
    // Desabilitado: Chat agora é temporário (sessão única)
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
    */

    // Limpar chat
    const handleClearChat = () => {
        Alert.alert(
            'Limpar Conversa',
            'Tem certeza que deseja limpar a tela?',
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

    // Context Files State
    const [contextFiles, setContextFiles] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showContextSidebar, setShowContextSidebar] = useState(false);

    // Load Context Files
    useEffect(() => {
        loadContextFiles();
    }, [subjectId]);

    const loadContextFiles = async () => {
        const result = await getContextFiles(subjectId);
        if (result.success) {
            setContextFiles(result.files);
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

            setIsUploading(true);
            const uploadResult = await uploadContextFile(subjectId, result.assets[0]);

            if (uploadResult.success) {
                Alert.alert('Sucesso', 'Arquivo adicionado ao contexto da IA!');
                loadContextFiles();

                // Gerar sugestões em background sem travar a UI
                generateSuggestions(subjectId).then(suggestionsResult => {
                    if (suggestionsResult.success && suggestionsResult.suggestions && suggestionsResult.suggestions.length > 0) {
                        const newActions: QuickAction[] = suggestionsResult.suggestions.map((sug: string, index: number) => ({
                            id: `sug_${Date.now()}_${index}`,
                            icon: 'lightbulb',
                            title: 'Sugestão IA',
                            description: sug
                        }));
                        setActiveQuickActions(prev => [...newActions, ...prev]);
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
                        style={[styles.clearButton, { marginRight: 8 }]}
                        onPress={handleClearChat}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="delete-outline" size={22} color="rgba(255,255,255,0.7)" />
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
                                        <MaterialIcons name={action.icon} size={16} color={colors.white} />
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
                                            <MaterialIcons name="description" size={12} color={colors.zinc400} />
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
                                    placeholderTextColor={colors.zinc500}
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
                                        color={inputText.trim() && !isChatLoading ? colors.white : colors.zinc600}
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
                                <MaterialIcons name="close" size={24} color={colors.zinc400} />
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
                                    <MaterialIcons name="library-books" size={48} color={colors.zinc800} />
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
                                            <MaterialIcons name="delete" size={20} color={colors.zinc600} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

        </View >
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
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    emptyTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    emptyDescription: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
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
        borderRadius: borderRadius.lg, // Using standard radius instead of pill for consistency
        marginTop: spacing.lg,
    },
    ctaButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    // Context Sidebar Styles
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
        borderWidth: 1.5,
        borderColor: colors.zinc800,
    },
    sidebarOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sidebarContainer: {
        width: '80%',
        height: '100%',
        backgroundColor: colors.zinc900,
        position: 'absolute',
        right: 0,
        paddingTop: 50, // Safe Area
        paddingHorizontal: spacing.md,
        borderLeftWidth: 1,
        borderLeftColor: colors.zinc800,
    },
    sidebarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc800,
    },
    sidebarTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    closeButton: {
        padding: spacing.sm,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    uploadButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.base,
    },
    fileList: {
        flex: 1,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    fileIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.medium,
    },
    // File Chips
    fileChipsContainer: {
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.sm,
        gap: spacing.xs,
    },
    fileChipsLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc500,
        fontFamily: typography.fontFamily.display,
        marginBottom: 4,
    },
    fileChipsScroll: {
        gap: spacing.sm,
    },
    fileChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.zinc800,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.zinc600,
        gap: 6,
    },
    fileChipText: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc300,
        fontFamily: typography.fontFamily.display,
        maxWidth: 120,
    },
    fileDate: {
        color: colors.zinc500,
        fontSize: typography.fontSize.xs,
        marginTop: 2,
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
        color: colors.zinc500,
        textAlign: 'center',
        fontSize: typography.fontSize.sm,
    },
    // Compact Quick Actions (Pinned)
    quickActionsContainerCompact: {
        paddingVertical: spacing.sm,
        // backgroundColor: colors.zinc900, // removed to blend
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    quickActionsScrollCompact: {
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    quickActionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    quickActionChipText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
});

const markdownStyles = StyleSheet.create({
    body: { color: colors.white, fontSize: 16, fontFamily: typography.fontFamily.body },
    heading1: { color: colors.white, marginTop: 10, marginBottom: 10, fontWeight: 'bold', fontSize: 24 },
    heading2: { color: colors.zinc200, marginTop: 10, marginBottom: 5, fontWeight: 'bold', fontSize: 20 },
    strong: { fontWeight: 'bold', color: colors.white },
    em: { fontStyle: 'italic', color: colors.zinc300 },
    bullet_list: { marginBottom: 10 },
    ordered_list: { marginBottom: 10 },
    code_inline: { backgroundColor: colors.zinc800, padding: 4, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.zinc200 },
    code_block: { backgroundColor: colors.zinc800, padding: 10, borderRadius: 8, marginVertical: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.zinc200 },
    fence: { backgroundColor: colors.zinc800, padding: 10, borderRadius: 8, marginVertical: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.zinc200 },
});
