import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getQuizReport, endQuiz, QuizReport } from '@/services/quiz';
import { getLiveActivityReport } from '@/services/api';

/**
 * QuizResultsScreen - Resultados do Quiz em Tempo Real (Professor)
 * Mostra respostas dos alunos enquanto o quiz está ativo
 */
export default function QuizResultsScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const quizId = parseInt(params.quizId as string) || 0;
    const activityId = parseInt(params.activityId as string) || 0;
    const subjectName = params.subject as string || 'Disciplina';

    const [report, setReport] = useState<QuizReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState(false);
    const pollingRef = useRef<any>(null);

    // Polling para atualizar resultados em tempo real
    useEffect(() => {
        const fetchReport = async () => {
            try {
                let result;
                if (activityId > 0) {
                    result = await getLiveActivityReport(activityId);
                } else {
                    result = await getQuizReport(quizId);
                }

                if (result.success && result.report) {
                    setReport(result.report);
                }
            } catch (error) {
                console.log('Erro ao buscar relatório:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
        pollingRef.current = setInterval(fetchReport, 3000); // Atualiza a cada 3s

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [quizId, activityId]);

    const handleEndQuiz = async () => {
        setEnding(true);
        try {
            await endQuiz(quizId);
            // Para o polling
            if (pollingRef.current) clearInterval(pollingRef.current);
            // Busca relatório final
            const result = await getQuizReport(quizId);
            if (result.success && result.report) {
                setReport(result.report);
            }
        } catch (error) {
            console.log('Erro ao encerrar quiz:', error);
        } finally {
            setEnding(false);
        }
    };

    const isActive = report?.quiz?.status === 'active';

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Carregando resultados...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Resultados ao Vivo</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Status Card */}
                <View style={[styles.statusCard, isActive ? styles.activeCard : styles.endedCard]}>
                    <View style={styles.statusHeader}>
                        <MaterialIcons
                            name={isActive ? "live-tv" : "check-circle"}
                            size={32}
                            color={isActive ? "#10b981" : colors.slate400}
                        />
                        <View style={styles.statusInfo}>
                            <Text style={styles.statusTitle}>
                                {isActive ? "Quiz em Andamento" : "Quiz Encerrado"}
                            </Text>
                            <Text style={styles.quizTitle}>{report?.quiz?.title}</Text>
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{report?.response_count || 0}</Text>
                            <Text style={styles.statLabel}>Respostas</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{report?.enrolled_count || 0}</Text>
                            <Text style={styles.statLabel}>Matriculados</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{Math.round(report?.response_rate || 0)}%</Text>
                            <Text style={styles.statLabel}>Participação</Text>
                        </View>
                    </View>

                    {/* End Quiz Button */}
                    {isActive && (
                        <TouchableOpacity
                            style={styles.endButton}
                            onPress={handleEndQuiz}
                            disabled={ending}
                        >
                            {ending ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <>
                                    <MaterialIcons name="stop" size={20} color={colors.white} />
                                    <Text style={styles.endButtonText}>Encerrar Quiz</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Average Score */}
                <View style={styles.averageCard}>
                    <Text style={styles.sectionTitle}>Média da Turma</Text>
                    <View style={styles.averageCircle}>
                        <Text style={styles.averageValue}>{report?.average_score?.toFixed(1) || 0}%</Text>
                    </View>
                </View>

                {/* Top Students */}
                {report?.top_students && report.top_students.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🏆 Top Alunos</Text>
                        {report.top_students.map((student, index) => (
                            <View key={student.id} style={styles.studentRow}>
                                <View style={[styles.medal, index === 0 && styles.goldMedal, index === 1 && styles.silverMedal, index === 2 && styles.bronzeMedal]}>
                                    <Text style={styles.medalText}>{index + 1}º</Text>
                                </View>
                                <Text style={styles.studentName}>{student.student_name || 'Aluno'}</Text>
                                <Text style={styles.studentScore}>{student.percentage?.toFixed(0)}%</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Worst Question */}
                {report?.worst_question && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>⚠️ Pergunta Mais Errada</Text>
                        <View style={styles.worstCard}>
                            <Text style={styles.worstQuestion}>{report.worst_question.question}</Text>
                            <Text style={styles.worstRate}>
                                Apenas {report.worst_question.correct_rate?.toFixed(0)}% acertaram
                            </Text>
                        </View>
                    </View>
                )}

                {/* All Responses */}
                {report?.all_responses && report.all_responses.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Todas as Respostas</Text>
                        {report.all_responses.map((response) => (
                            <View key={response.id} style={styles.responseRow}>
                                <Text style={styles.responseName}>{response.student_name || 'Aluno'}</Text>
                                <View style={styles.responseScore}>
                                    <Text style={styles.responseScoreText}>
                                        {response.score}/{response.total}
                                    </Text>
                                    <Text style={[
                                        styles.responsePercent,
                                        response.percentage >= 70 ? styles.goodScore :
                                            response.percentage >= 50 ? styles.mediumScore : styles.badScore
                                    ]}>
                                        {response.percentage?.toFixed(0)}%
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.slate50, // Light Background
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.md,
        backgroundColor: colors.white, // White Header
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    placeholder: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        paddingBottom: spacing.xl,
    },
    statusCard: {
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: colors.white,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    activeCard: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: '#10b981', // Border indicates active
    },
    endedCard: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    statusInfo: {
        flex: 1,
    },
    statusTitle: {
        fontSize: typography.fontSize.sm,
        color: '#10b981',
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    quizTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        marginTop: spacing.xs,
        fontFamily: typography.fontFamily.display,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: spacing.lg,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        fontFamily: typography.fontFamily.display,
    },
    statDivider: {
        width: 1,
        backgroundColor: colors.slate200,
    },
    endButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#ef4444',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    endButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    averageCard: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    averageCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 3,
        borderColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.md,
    },
    averageValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: '#10b981',
        fontFamily: typography.fontFamily.display,
    },
    section: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        marginBottom: spacing.md,
        fontFamily: typography.fontFamily.display,
    },
    studentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    medal: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    goldMedal: {
        backgroundColor: '#fef3c7', // Yellow-100
    },
    silverMedal: {
        backgroundColor: '#f3f4f6', // Gray-100
    },
    bronzeMedal: {
        backgroundColor: '#ffedd5', // Orange-100
    },
    medalText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    studentName: {
        flex: 1,
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    studentScore: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: '#10b981',
        fontFamily: typography.fontFamily.display,
    },
    worstCard: {
        backgroundColor: '#fef2f2', // Red-50
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#fecaca', // Red-200
    },
    worstQuestion: {
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        fontFamily: typography.fontFamily.display,
    },
    worstRate: {
        fontSize: typography.fontSize.xs,
        color: '#ef4444',
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    responseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    responseName: {
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    responseScore: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    responseScoreText: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        fontFamily: typography.fontFamily.display,
    },
    responsePercent: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        minWidth: 45,
        textAlign: 'right',
        fontFamily: typography.fontFamily.display,
    },
    goodScore: {
        color: '#10b981',
    },
    mediumScore: {
        color: '#f59e0b',
    },
    badScore: {
        color: '#ef4444',
    },
});
