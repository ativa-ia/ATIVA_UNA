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

/**
 * QuizResultsScreen - Resultados do Quiz em Tempo Real (Professor)
 * Mostra respostas dos alunos enquanto o quiz está ativo
 */
export default function QuizResultsScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const quizId = parseInt(params.quizId as string) || 0;
    const subjectName = params.subject as string || 'Disciplina';

    const [report, setReport] = useState<QuizReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState(false);
    const pollingRef = useRef<any>(null);

    // Polling para atualizar resultados em tempo real
    useEffect(() => {
        const fetchReport = async () => {
            try {
                const result = await getQuizReport(quizId);
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
    }, [quizId]);

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
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
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
                            color={isActive ? "#10b981" : colors.zinc400}
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
        backgroundColor: colors.backgroundDark,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.zinc400,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.md,
        backgroundColor: colors.zinc900,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.zinc800,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
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
    },
    activeCard: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    endedCard: {
        backgroundColor: colors.zinc800,
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
    },
    quizTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginTop: spacing.xs,
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
        color: colors.white,
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc400,
        marginTop: spacing.xs,
    },
    statDivider: {
        width: 1,
        backgroundColor: colors.zinc600,
    },
    endButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#ef4444',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
    },
    endButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    averageCard: {
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    averageCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
    },
    section: {
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
        marginBottom: spacing.md,
    },
    studentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc700,
    },
    medal: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.zinc600,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    goldMedal: {
        backgroundColor: '#fbbf24',
    },
    silverMedal: {
        backgroundColor: '#9ca3af',
    },
    bronzeMedal: {
        backgroundColor: '#d97706',
    },
    medalText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    studentName: {
        flex: 1,
        fontSize: typography.fontSize.base,
        color: colors.white,
    },
    studentScore: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: '#10b981',
    },
    worstCard: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    worstQuestion: {
        fontSize: typography.fontSize.sm,
        color: colors.white,
        marginBottom: spacing.sm,
    },
    worstRate: {
        fontSize: typography.fontSize.xs,
        color: '#ef4444',
        fontWeight: typography.fontWeight.semibold,
    },
    responseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc700,
    },
    responseName: {
        fontSize: typography.fontSize.sm,
        color: colors.white,
    },
    responseScore: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    responseScoreText: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    responsePercent: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        minWidth: 45,
        textAlign: 'right',
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
