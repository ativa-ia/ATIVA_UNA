import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

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

    const handleSend = () => {
        if (!inputText.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            isUser: true,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');

        // Simulate AI response
        setTimeout(() => {
            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Entendi sua solicitação! Estou processando...\n\nEsta é uma demonstração. A integração com a IA será implementada em breve.',
                isUser: false,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiResponse]);
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 1000);

        scrollViewRef.current?.scrollToEnd({ animated: true });
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
                                </View>
                            </View>
                        ))}
                    </ScrollView>

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
                                maxLength={1000}
                            />
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    !inputText.trim() && styles.sendButtonDisabled,
                                ]}
                                onPress={handleSend}
                                disabled={!inputText.trim()}
                            >
                                <MaterialIcons
                                    name="send"
                                    size={24}
                                    color={inputText.trim() ? colors.white : colors.zinc600}
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
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.zinc800,
    },
});
