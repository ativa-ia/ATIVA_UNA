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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { LiveActivity, submitActivityResponse } from '@/services/api';

/**
 * LiveActivityScreen - Tela para aluno responder atividades ao vivo
 * Suporta: Quiz, Perguntas Abertas
 */
export default function LiveActivityScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const activityData = params.activity ? JSON.parse(params.activity as string) : null;

    const [activity, setActivity] = useState<LiveActivity | null>(activityData);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [textAnswer, setTextAnswer] = useState('');
    const [timeRemaining, setTimeRemaining] = useState(activityData?.time_remaining || 300);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);

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

    const handleNextQuestion = () => {
        const questions = activity?.content?.questions || [];
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
                : { text: textAnswer };

            const response = await submitActivityResponse(activity.id, data);

            if (response.success && response.result) {
                setResult(response.result);
                setIsSubmitted(true);
            } else {
                Alert.alert('Erro', 'Falha ao enviar resposta');
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

    // Render Open Question
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
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
                        placeholderTextColor={colors.zinc500}
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
    activityTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    questionCounter: {
        fontSize: typography.fontSize.sm,
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
        color: colors.zinc300,
    },
    optionLetterTextSelected: {
        color: colors.white,
    },
    optionText: {
        flex: 1,
        fontSize: typography.fontSize.base,
        color: colors.zinc300,
    },
    optionTextSelected: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
    },
    textInput: {
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.white,
        minHeight: 150,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    charCount: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc500,
        textAlign: 'right',
        marginTop: spacing.sm,
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
        color: colors.white,
    },
    cancelButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
    },
    cancelButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.zinc400,
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
        color: colors.white,
    },
    errorText: {
        fontSize: typography.fontSize.lg,
        color: colors.zinc400,
        textAlign: 'center',
        marginTop: 100,
    },
    backLink: {
        fontSize: typography.fontSize.base,
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
        color: colors.white,
        marginBottom: spacing.sm,
    },
    resultScore: {
        fontSize: typography.fontSize['4xl'],
        fontWeight: typography.fontWeight.bold,
        color: '#10b981',
        marginBottom: spacing.xs,
    },
    resultPercentage: {
        fontSize: typography.fontSize.lg,
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
        color: colors.white,
    },
});
