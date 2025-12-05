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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { Quiz, QuizQuestion, submitQuizResponse } from '@/services/quiz';

/**
 * LiveQuizScreen - Tela para aluno responder quiz ao vivo
 */
export default function LiveQuizScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const quizData = params.quiz ? JSON.parse(params.quiz as string) : null;

    const [quiz, setQuiz] = useState<Quiz | null>(quizData);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [timeRemaining, setTimeRemaining] = useState(quizData?.time_remaining || 300);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);

    const timerRef = useRef<any>(null);

    // Timer countdown
    useEffect(() => {
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

        if (!autoSubmit && answeredCount < minRequired) {
            Alert.alert(
                '⚠️ Responda Mais Perguntas',
                `Você precisa responder pelo menos ${minRequired} de ${totalQuestions} perguntas (80%).\n\nVocê respondeu apenas ${answeredCount}.`,
                [{ text: 'OK' }]
            );
            return;
        }

        await submitAnswers();
    };

    const submitAnswers = async () => {
        if (!quiz) return;

        setIsSubmitting(true);
        if (timerRef.current) clearInterval(timerRef.current);

        try {
            const response = await submitQuizResponse(quiz.id, answers);

            if (response.success && response.result) {
                setResult(response.result);
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
        backgroundColor: colors.backgroundDark,
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
        color: colors.white,
    },
    questionCounter: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    timer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderRadius: borderRadius.full,
    },
    timerWarning: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    timerDanger: {
        backgroundColor: '#ef4444',
    },
    timerText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: '#10b981',
    },
    timerTextWarning: {
        color: '#f59e0b',
    },
    timerTextDanger: {
        color: colors.white,
    },
    progressContainer: {
        paddingHorizontal: spacing.base,
        marginBottom: spacing.md,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.zinc700,
        borderRadius: 2,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: 2,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
    },
    questionCard: {
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    questionText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
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
        backgroundColor: 'rgba(24, 24, 27, 0.5)',
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.zinc700,
    },
    optionSelected: {
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    optionLetter: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.zinc700,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionLetterSelected: {
        backgroundColor: '#10b981',
    },
    optionLetterText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc300,
    },
    optionLetterTextSelected: {
        color: colors.white,
    },
    optionText: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc300,
    },
    optionTextSelected: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
    },
    quickNav: {
        marginTop: spacing.lg,
    },
    quickNavLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
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
        backgroundColor: colors.zinc800,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    quickNavBtnActive: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    quickNavBtnAnswered: {
        borderColor: '#10b981',
    },
    quickNavBtnUnanswered: {
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    quickNavBtnText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    quickNavBtnTextActive: {
        color: colors.white,
    },
    quickNavBtnTextUnanswered: {
        color: '#ef4444',
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
        color: '#10b981',
        fontWeight: typography.fontWeight.semibold,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: '#10b981',
        borderRadius: borderRadius.lg,
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
        color: colors.zinc400,
        textAlign: 'center',
        marginTop: 100,
    },
    backLink: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: '#10b981',
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
        color: colors.white,
        marginBottom: spacing.sm,
    },
    resultScore: {
        fontSize: typography.fontSize['4xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: '#10b981',
        marginBottom: spacing.xs,
    },
    resultPercentage: {
        fontSize: typography.fontSize.lg,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc300,
        marginBottom: spacing.lg,
    },
    resultBar: {
        width: '100%',
        height: 8,
        backgroundColor: colors.zinc700,
        borderRadius: 4,
        marginBottom: spacing.lg,
    },
    resultBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    resultBarGreen: {
        backgroundColor: '#10b981',
    },
    resultBarYellow: {
        backgroundColor: '#f59e0b',
    },
    resultBarRed: {
        backgroundColor: '#ef4444',
    },
    resultMessage: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    resultButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
    },
    resultButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
});
