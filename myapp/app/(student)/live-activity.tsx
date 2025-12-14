import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { LiveActivity, submitActivityResponse, isActivitySubmitted, submitQuizProgress } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * LiveActivityScreen - Tela para aluno responder atividades ao vivo
 * Suporta: Quiz, Perguntas Abertas
 */
export default function LiveActivityScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();

    // Parse activity data safely
    const activity = params.activity ? JSON.parse(params.activity as string) : null;

    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [textAnswer, setTextAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [timeRemaining, setTimeRemaining] = useState<number>(activity?.time_remaining || 300);

    // Verificação inicial de segurança
    useEffect(() => {
        if (activity && isActivitySubmitted(activity.id)) {
            // Se já foi enviado localmente, forçar estado de enviado
            setIsSubmitted(true);
            // Poderíamos buscar o resultado aqui se necessário, 
            // mas por enquanto apenas bloqueia o reenvio e mostra concluído
        }
    }, [activity]);

    const timerRef = useRef<any>(null);

    // Timer countdown
    useEffect(() => {
        if (isSubmitted || !activity) return;

        timerRef.current = setInterval(() => {
            setTimeRemaining((prev: number) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleSubmit(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isSubmitted, activity]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
        if (isSubmitted) return;
        setAnswers(prev => ({
            ...prev,
            [questionIndex.toString()]: optionIndex
        }));
    };

    const handleNextQuestion = async () => {
        const questions = activity?.content?.questions || [];

        // Sync progress
        if (activity.activity_type === 'quiz') {
            const totalTime = activity.time_limit || 300;
            const timeTaken = totalTime - timeRemaining;

            // Send silently (don't block UI)
            submitQuizProgress(activity.id, {
                answers: answers,
                time_taken: timeTaken
            }).then(res => {
                console.log('Progress synced:', res);
            });
        }

        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
        }
    };

    const handlePrevQuestion = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1);
        }
    };

    const handleSubmit = async (autoSubmit = false) => {
        if (!activity) return;

        if (activity.activity_type === 'quiz') {
            const questions = activity.content?.questions || [];
            const answeredCount = Object.keys(answers).length;
            const minRequired = Math.ceil(questions.length * 0.8);

            if (!autoSubmit && answeredCount < minRequired) {
                Alert.alert(
                    'Responda Mais Perguntas',
                    `Você precisa responder pelo menos ${minRequired} de ${questions.length} perguntas.`,
                    [{ text: 'OK' }]
                );
                return;
            }
        } else if (activity.activity_type === 'open_question') {
            if (!autoSubmit && textAnswer.trim().length < 5) {
                Alert.alert('Resposta muito curta', 'Por favor, escreva uma resposta mais detalhada.');
                return;
            }
        }

        await submitAnswers();
    };

    const submitAnswers = async () => {
        if (!activity) return;

        setIsSubmitting(true);
        if (timerRef.current) clearInterval(timerRef.current);

        try {
            const data = activity.activity_type === 'quiz'
                ? { answers }
                : activity.activity_type === 'summary'
                    ? { read: true }
                    : { text: textAnswer };

            const response = await submitActivityResponse(activity.id, data);

            if (response.success && response.result) {
                setResult(response.result);
                setIsSubmitted(true);
            } else if (response.error && (response.error.includes('já respondeu') || response.error.includes('Encerrada'))) {
                // Se já respondeu ou encerrou, liberar o usuario
                Alert.alert('Aviso', 'Atividade já concluída ou encerrada.', [
                    {
                        text: 'OK',
                        onPress: () => {
                            setIsSubmitted(true);
                            router.back();
                        }
                    }
                ]);
            } else {
                Alert.alert('Erro', response.error || 'Falha ao enviar resposta');
            }
        } catch (error) {
            console.error('Erro ao enviar:', error);
            Alert.alert('Erro', 'Falha ao enviar resposta');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!activity) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar style="dark" />
                <Text style={styles.errorText}>Atividade não encontrada</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backLink}>Voltar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Tela de resultado
    if (isSubmitted && result) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar style="dark" />
                <View style={styles.resultContainer}>
                    <Text style={styles.resultIcon}>
                        {activity.activity_type === 'quiz'
                            ? (result.percentage >= 70 ? '🎉' : result.percentage >= 50 ? '👍' : '📚')
                            : '✅'}
                    </Text>
                    <Text style={styles.resultTitle}>
                        {activity.activity_type === 'quiz' ? 'Quiz Concluído!' : 'Resposta Enviada!'}
                    </Text>

                    {activity.activity_type === 'quiz' && (
                        <>
                            <Text style={styles.resultScore}>
                                {result.score} / {result.total}
                            </Text>

                            {/* Points Display */}
                            {result.points !== undefined && (
                                <View style={styles.pointsContainer}>
                                    <MaterialIcons name="stars" size={24} color="#F59E0B" />
                                    <Text style={styles.pointsText}>+{result.points} pts</Text>
                                </View>
                            )}

                            <Text style={styles.resultPercentage}>
                                {result.percentage.toFixed(0)}% de acertos
                            </Text>
                            <View style={styles.resultBar}>
                                <View
                                    style={[
                                        styles.resultBarFill,
                                        { width: `${result.percentage}%` },
                                        result.percentage >= 70 ? styles.resultBarGreen :
                                            result.percentage >= 50 ? styles.resultBarYellow : styles.resultBarRed
                                    ]}
                                />
                            </View>
                        </>
                    )}

                    <Text style={styles.resultMessage}>
                        {activity.activity_type === 'quiz'
                            ? (result.percentage >= 70
                                ? 'Excelente! Continue assim!'
                                : result.percentage >= 50
                                    ? 'Bom trabalho! Revise os pontos que errou.'
                                    : 'Não desanime! Revise o conteúdo.')
                            : 'Sua resposta foi registrada com sucesso!'}
                    </Text>

                    <TouchableOpacity
                        style={styles.resultButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.resultButtonText}>Voltar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Render Quiz
    if (activity.activity_type === 'quiz') {
        const questions = activity.content?.questions || [];
        const currentQ = questions[currentQuestion];
        const selectedAnswer = answers[currentQuestion.toString()];

        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar style="dark" />
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.activityTitle}>{activity.title}</Text>
                        <Text style={styles.questionCounter}>
                            Pergunta {currentQuestion + 1} de {questions.length}
                        </Text>
                    </View>
                    <View style={[
                        styles.timer,
                        timeRemaining <= 60 && styles.timerWarning,
                        timeRemaining <= 30 && styles.timerDanger
                    ]}>
                        <MaterialIcons
                            name="timer"
                            size={20}
                            color={timeRemaining <= 30 ? '#fff' : timeRemaining <= 60 ? '#f59e0b' : '#10b981'}
                        />
                        <Text style={[
                            styles.timerText,
                            timeRemaining <= 60 && styles.timerTextWarning,
                            timeRemaining <= 30 && styles.timerTextDanger
                        ]}>
                            {formatTime(timeRemaining)}
                        </Text>
                    </View>
                </View>

                {/* Progress */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${((currentQuestion + 1) / questions.length) * 100}%` }
                            ]}
                        />
                    </View>
                </View>

                {/* Question */}
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.questionCard}>
                        <Text style={styles.questionText}>{currentQ?.question}</Text>

                        <View style={styles.optionsContainer}>
                            {currentQ?.options?.map((option: string, index: number) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.optionButton,
                                        selectedAnswer === index && styles.optionSelected
                                    ]}
                                    onPress={() => handleSelectAnswer(currentQuestion, index)}
                                    disabled={isSubmitted}
                                >
                                    <View style={[
                                        styles.optionLetter,
                                        selectedAnswer === index && styles.optionLetterSelected
                                    ]}>
                                        <Text style={[
                                            styles.optionLetterText,
                                            selectedAnswer === index && styles.optionLetterTextSelected
                                        ]}>
                                            {String.fromCharCode(65 + index)}
                                        </Text>
                                    </View>
                                    <Text style={[
                                        styles.optionText,
                                        selectedAnswer === index && styles.optionTextSelected
                                    ]}>
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                {/* Navigation */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                    <TouchableOpacity
                        style={[styles.navButton, currentQuestion === 0 && styles.navButtonDisabled]}
                        onPress={handlePrevQuestion}
                        disabled={currentQuestion === 0}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                        <Text style={styles.navButtonText}>Anterior</Text>
                    </TouchableOpacity>

                    {currentQuestion === questions.length - 1 ? (
                        <TouchableOpacity
                            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                            onPress={() => handleSubmit()}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <>
                                    <Text style={styles.submitButtonText}>Enviar</Text>
                                    <MaterialIcons name="send" size={24} color={colors.white} />
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.navButton}
                            onPress={handleNextQuestion}
                        >
                            <Text style={styles.navButtonText}>Próxima</Text>
                            <MaterialIcons name="arrow-forward" size={24} color={colors.white} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    // Render Summary
    if (activity.activity_type === 'summary') {
        const summaryText = typeof activity.content === 'string'
            ? activity.content
            : activity.content?.summary_text || activity.ai_generated_content || '';

        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar style="dark" />
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.activityTitle}>{activity.title}</Text>
                        <Text style={styles.questionCounter}>Resumo da Aula</Text>
                    </View>
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.questionCard}>
                        <ScrollView style={{ maxHeight: '100%' }}>
                            <Markdown style={markdownStyles}>
                                {summaryText}
                            </Markdown>
                        </ScrollView>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                    <TouchableOpacity
                        style={[styles.submitButton, { width: '100%', justifyContent: 'center' }]}
                        onPress={() => handleSubmit(true)}
                    >
                        <Text style={styles.submitButtonText}>Entendi</Text>
                        <MaterialIcons name="check" size={24} color={colors.white} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Render Open Question
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar style="dark" />
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.questionCounter}>Pergunta Aberta</Text>
                </View>
                <View style={[
                    styles.timer,
                    timeRemaining <= 60 && styles.timerWarning,
                    timeRemaining <= 30 && styles.timerDanger
                ]}>
                    <MaterialIcons
                        name="timer"
                        size={20}
                        color={timeRemaining <= 30 ? '#fff' : timeRemaining <= 60 ? '#f59e0b' : '#10b981'}
                    />
                    <Text style={[
                        styles.timerText,
                        timeRemaining <= 60 && styles.timerTextWarning,
                        timeRemaining <= 30 && styles.timerTextDanger
                    ]}>
                        {formatTime(timeRemaining)}
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.questionCard}>
                    <Text style={styles.questionText}>
                        {activity.content?.question || 'Qual sua resposta?'}
                    </Text>

                    <TextInput
                        style={styles.textInput}
                        multiline
                        numberOfLines={6}
                        value={textAnswer}
                        onChangeText={setTextAnswer}
                        placeholder="Digite sua resposta aqui..."
                        placeholderTextColor={colors.textSecondary}
                        editable={!isSubmitted}
                    />

                    <Text style={styles.charCount}>{textAnswer.length} caracteres</Text>
                </View>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => router.back()}
                >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={() => handleSubmit()}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <>
                            <Text style={styles.submitButtonText}>Enviar</Text>
                            <MaterialIcons name="send" size={24} color={colors.white} />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.slate50,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
    },
    headerLeft: {
        flex: 1,
    },
    activityTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    questionCounter: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
    },
    timer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    timerWarning: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    timerDanger: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    timerText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.secondary,
    },
    timerTextWarning: {
        color: '#f59e0b',
    },
    timerTextDanger: {
        color: colors.danger,
    },
    progressContainer: {
        paddingHorizontal: spacing.base,
        marginBottom: spacing.md,
    },
    progressBar: {
        height: 8,
        backgroundColor: colors.slate200,
        borderRadius: 4,
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.secondary,
        borderRadius: 4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
    },
    questionCard: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    questionText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        marginBottom: spacing.lg,
        lineHeight: 28,
    },
    optionsContainer: {
        gap: spacing.sm,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    optionSelected: {
        borderColor: colors.secondary,
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        shadowColor: colors.secondary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    optionLetter: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    optionLetterSelected: {
        backgroundColor: colors.secondary,
        borderColor: colors.secondary,
    },
    optionLetterText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.textSecondary,
    },
    optionLetterTextSelected: {
        color: colors.white,
    },
    optionText: {
        flex: 1,
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
    },
    optionTextSelected: {
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.semibold,
    },
    textInput: {
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        minHeight: 150,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    charCount: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'right',
        marginTop: spacing.sm,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        backgroundColor: colors.white,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    navButtonDisabled: {
        opacity: 0.5,
        backgroundColor: colors.slate50,
    },
    navButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
    },
    cancelButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    cancelButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textSecondary,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.lg,
        shadowColor: colors.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    pointsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginTop: spacing.xs,
        marginBottom: spacing.xs,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    pointsText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: '#F59E0B',
    },
    errorText: {
        fontSize: typography.fontSize.lg,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 100,
    },
    backLink: {
        fontSize: typography.fontSize.base,
        color: colors.secondary,
        textAlign: 'center',
        marginTop: spacing.md,
    },
    // Result screen
    resultContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    resultIcon: {
        fontSize: 80,
        marginBottom: spacing.md,
    },
    resultTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    resultScore: {
        fontSize: typography.fontSize['4xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.secondary,
        marginBottom: spacing.xs,
    },
    resultPercentage: {
        fontSize: typography.fontSize.lg,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    resultBar: {
        width: '100%',
        height: 12,
        backgroundColor: colors.slate200,
        borderRadius: 6,
        marginBottom: spacing.lg,
    },
    resultBarFill: {
        height: '100%',
        borderRadius: 6,
    },
    resultBarGreen: {
        backgroundColor: colors.secondary,
    },
    resultBarYellow: {
        backgroundColor: '#f59e0b',
    },
    resultBarRed: {
        backgroundColor: colors.danger,
    },
    resultMessage: {
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    resultButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    resultButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
    },
});

const markdownStyles = StyleSheet.create({
    body: {
        fontSize: 16,
        color: colors.textPrimary,
        lineHeight: 24,
    },
    heading1: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 10,
        marginTop: 20,
    },
    heading2: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
        marginTop: 16,
    },
    list_item: {
        marginVertical: 4,
    },
    bullet_list: {
        marginVertical: 8,
    },
});
