import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { Quiz, QuizQuestion } from '@/services/quiz';
import { submitActivityResponse } from '@/services/api';

/**
 * LiveQuizScreen - Tela para aluno responder quiz ao vivo
 */
export default function LiveQuizScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const quizData = params.quiz ? JSON.parse(params.quiz as string) : null;

    const [quiz, setQuiz] = useState<Quiz | null>(() => {
        if (!quizData) return null;
        // Force IDs to be indices to ensure alignment with backend enumerate() logic
        if (quizData.questions) {
            quizData.questions = quizData.questions.map((q: any, i: number) => ({
                ...q,
                id: i // Force usage of index as ID
            }));
        }
        return quizData;
    });
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [timeRemaining, setTimeRemaining] = useState(quizData?.time_remaining || 300);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [startTime] = useState(Date.now()); // Track when quiz started

    const timerRef = useRef<any>(null);

    // Timer countdown
    useEffect(() => {
        Alert.alert("DEBUG", "Versão Light Mode Carregada!"); // Debug
        if (isSubmitted || !quiz) return;

        timerRef.current = setInterval(() => {
            setTimeRemaining((prev: number) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleSubmit(true); // Auto-submit when time ends
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isSubmitted, quiz]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSelectAnswer = (questionId: number, optionIndex: number) => {
        if (isSubmitted) return;
        setAnswers(prev => ({
            ...prev,
            [questionId.toString()]: optionIndex
        }));
    };

    const handleNextQuestion = () => {
        if (quiz?.questions && currentQuestion < quiz.questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
        }
    };

    const handlePrevQuestion = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1);
        }
    };

    const handleSubmit = async (autoSubmit = false) => {
        if (!quiz) return;

        const answeredCount = Object.keys(answers).length;
        const totalQuestions = quiz.questions?.length || 0;
        const minRequired = Math.ceil(totalQuestions * 0.8); // 80% mínimo

        if (answeredCount < minRequired && !autoSubmit) {
            Alert.alert(
                '⚠️ Responda Mais Perguntas',
                `Você precisa responder pelo menos ${minRequired} de ${totalQuestions} perguntas (80%).\n\nVocê respondeu apenas ${answeredCount}.`,
                [{ text: 'OK' }]
            );
            return;
        }

        // DEBUG: Mostrar o que está sendo enviado
        // console.log('Enviando respostas:', JSON.stringify(answers));
        // Alert.alert('Debug', `Enviando: ${JSON.stringify(answers)}`);

        await submitAnswers();
    };

    // Keep a ref of answers to ensure submission function always has latest state
    const answersRef = useRef(answers);
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    const submitAnswers = async () => {
        if (!quiz) return;

        setIsSubmitting(true);
        if (timerRef.current) clearInterval(timerRef.current);

        // Calculate time taken in seconds
        const timeTaken = Math.floor((Date.now() - startTime) / 1000);

        // Use Ref to guarantee latest answers
        const currentAnswers = answersRef.current;

        try {
            const response = await submitActivityResponse(quiz.id, {
                answers: currentAnswers,
                time_taken: timeTaken
            });
            console.log('Submit response:', response);

            if (response.success) {
                // Use result data from response
                const resultData = response.result || {
                    score: Object.keys(currentAnswers).length,
                    total: quiz.questions?.length || 0,
                    percentage: 0,
                    points: 0
                };

                // Calculate percentage if not provided
                if (!resultData.percentage && resultData.total > 0) {
                    resultData.percentage = (resultData.score / resultData.total) * 100;
                }

                setResult(resultData);
                setIsSubmitted(true);
            } else {
                Alert.alert('Erro', response.error || 'Falha ao enviar respostas');
            }
        } catch (error) {
            console.error('Erro ao enviar:', error);
            Alert.alert('Erro', 'Falha ao enviar respostas');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!quiz || !quiz.questions) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Text style={styles.errorText}>Quiz não encontrado</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backLink}>Voltar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const currentQ = quiz.questions[currentQuestion];
    const selectedAnswer = answers[currentQ?.id?.toString()];

    // Tela de resultado
    if (isSubmitted && result) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.resultContainer}>
                    <Text style={styles.resultIcon}>
                        {result.percentage >= 70 ? '🎉' : result.percentage >= 50 ? '👍' : '📚'}
                    </Text>

                    <Text style={styles.resultTitle}>Quiz Concluído!</Text>

                    {/* Pontuação Gamificada */}
                    {result.points > 0 && (
                        <View style={styles.pointsContainer}>
                            <Text style={styles.pointsLabel}>🏆 Pontuação</Text>
                            <Text style={styles.pointsValue}>{result.points} pts</Text>
                        </View>
                    )}

                    <Text style={styles.resultScore}>
                        {result.score} / {result.total}
                    </Text>
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

                    <Text style={styles.resultMessage}>
                        {result.percentage >= 70
                            ? 'Excelente! Continue assim!'
                            : result.percentage >= 50
                                ? 'Bom trabalho! Revise os pontos que errou.'
                                : 'Não desanime! Revise o conteúdo e tente novamente.'}
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar style="dark" />
            {/* Header with timer */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.quizTitle}>{quiz.title}</Text>
                    <Text style={styles.questionCounter}>
                        Pergunta {currentQuestion + 1} de {quiz.questions.length}
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

            {/* Progress bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }
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
                                onPress={() => handleSelectAnswer(currentQ.id, index)}
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

                {/* Quick navigation */}
                <View style={styles.quickNav}>
                    <View style={styles.quickNavHeader}>
                        <Text style={styles.quickNavLabel}>Ir para pergunta:</Text>
                        <Text style={styles.answeredCount}>
                            {Object.keys(answers).length}/{quiz.questions.length} respondidas
                        </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.quickNavButtons}>
                            {quiz.questions.map((q: QuizQuestion, i: number) => {
                                const isAnswered = answers[q.id?.toString()] !== undefined;
                                const isCurrent = i === currentQuestion;
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[
                                            styles.quickNavBtn,
                                            isCurrent && styles.quickNavBtnActive,
                                            isAnswered && styles.quickNavBtnAnswered,
                                            !isAnswered && !isCurrent && styles.quickNavBtnUnanswered
                                        ]}
                                        onPress={() => setCurrentQuestion(i)}
                                    >
                                        <Text style={[
                                            styles.quickNavBtnText,
                                            isCurrent && styles.quickNavBtnTextActive,
                                            !isAnswered && !isCurrent && styles.quickNavBtnTextUnanswered
                                        ]}>
                                            {i + 1}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            </ScrollView>

            {/* Navigation buttons */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                <TouchableOpacity
                    style={[styles.navButton, currentQuestion === 0 && styles.navButtonDisabled]}
                    onPress={handlePrevQuestion}
                    disabled={currentQuestion === 0}
                >
                    <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                    <Text style={styles.navButtonText}>Anterior</Text>
                </TouchableOpacity>

                {currentQuestion === quiz.questions.length - 1 ? (
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
    quizTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    questionCounter: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
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
        fontFamily: typography.fontFamily.display,
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
        fontFamily: typography.fontFamily.display,
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
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
    },
    optionLetterTextSelected: {
        color: colors.white,
    },
    optionText: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    optionTextSelected: {
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.semibold,
    },
    quickNav: {
        marginTop: spacing.lg,
    },
    quickNavLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    quickNavButtons: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    quickNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    quickNavBtnActive: {
        backgroundColor: colors.secondary,
        borderColor: colors.secondary,
    },
    quickNavBtnAnswered: {
        borderColor: colors.secondary,
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
    },
    quickNavBtnUnanswered: {
        borderColor: colors.danger,
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
    quickNavBtnText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
    },
    quickNavBtnTextActive: {
        color: colors.white,
    },
    quickNavBtnTextUnanswered: {
        color: colors.danger,
    },
    quickNavHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    answeredCount: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.secondary,
        fontWeight: typography.fontWeight.semibold,
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
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
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
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    errorText: {
        fontSize: typography.fontSize.lg,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 100,
    },
    backLink: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
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
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    pointsContainer: {
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    pointsLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 4,
    },
    pointsValue: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
        textAlign: 'center',
    },
    resultScore: {
        fontSize: typography.fontSize['4xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.secondary,
        marginBottom: spacing.xs,
    },
    resultPercentage: {
        fontSize: typography.fontSize.lg,
        fontFamily: typography.fontFamily.display,
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
        fontFamily: typography.fontFamily.display,
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
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
});
