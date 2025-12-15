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
import { getLiveActivityReport, endLiveActivity, exportActivityPDF } from '@/services/api';
import RaceVisualization from '@/components/quiz/RaceVisualization';
import PodiumDisplay from '@/components/quiz/PodiumDisplay';
import PerformanceDistributionChart from '@/components/quiz/PerformanceDistributionChart';
import ScoreDistributionGraph from '@/components/quiz/ScoreDistributionGraph';
import TimeAnalysisDashboard from '@/components/quiz/TimeAnalysisDashboard';
import QuestionDifficultyChart from '@/components/quiz/QuestionDifficultyChart';
import ComparativeStatsPanel from '@/components/quiz/ComparativeStatsPanel';
import SupportActionPanel from '@/components/quiz/SupportActionPanel';
import { useWebSocket } from '@/hooks/useWebSocket';

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
    const [showPodium, setShowPodium] = useState(false);
    const [ranking, setRanking] = useState<any[]>([]);
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    // WebSocket para atualizações em tempo real
    const { isConnected, ranking: wsRanking } = useWebSocket({
        quizId: activityId > 0 ? activityId : quizId,
        enabled: true
    });

    // Log connection status
    useEffect(() => {
        console.log('[QUIZ-RESULTS] ========================================');
        console.log('[QUIZ-RESULTS] WebSocket Status:', isConnected ? 'CONECTADO ✅' : 'DESCONECTADO ❌');
        console.log('[QUIZ-RESULTS] Quiz ID:', activityId > 0 ? activityId : quizId);
        console.log('[QUIZ-RESULTS] ========================================');
    }, [isConnected]);

    // Atualizar ranking quando receber dados do WebSocket
    useEffect(() => {
        console.log('[QUIZ-RESULTS] ========================================');
        console.log('[QUIZ-RESULTS] wsRanking mudou!');
        console.log('[QUIZ-RESULTS] wsRanking:', wsRanking);

        if (wsRanking && wsRanking.ranking) {
            console.log('[QUIZ-RESULTS] ✅ Ranking recebido do WebSocket!');
            console.log('[QUIZ-RESULTS] Número de alunos:', wsRanking.ranking.length);
            console.log('[QUIZ-RESULTS] Dados:', wsRanking.ranking);

            const updatedRanking = wsRanking.ranking.map((r: any) => ({
                ...r,
                status: 'submitted'
            }));

            console.log('[QUIZ-RESULTS] Atualizando state do ranking...');
            setRanking(updatedRanking);
        } else {
            console.log('[QUIZ-RESULTS] ⚠️ wsRanking vazio ou sem ranking');
        }
        console.log('[QUIZ-RESULTS] ========================================');
    }, [wsRanking]);

    // Fallback: Polling a cada 5s caso WebSocket não esteja funcionando
    useEffect(() => {
        const pollingRef = setInterval(async () => {
            if (!showPodium) {
                console.log('[FALLBACK POLLING] Buscando ranking...');
                try {
                    let result;
                    if (activityId > 0) {
                        result = await getLiveActivityReport(activityId);
                    } else {
                        result = await getQuizReport(quizId);
                    }

                    if (result.success && result.report) {
                        setReport(result.report);
                        if (result.report.all_responses) {
                            const transformedRanking = result.report.all_responses.map((r: any, index: number) => ({
                                position: index + 1,
                                student_id: r.student_id || r.id,
                                student_name: r.student_name || 'Aluno',
                                points: r.score * 100,
                                score: r.score,
                                total: r.total,
                                percentage: r.percentage || 0,
                                time_taken: r.time_taken || 0,
                                status: 'submitted'
                            }));
                            console.log('[FALLBACK POLLING] Ranking atualizado:', transformedRanking.length, 'alunos');
                            setRanking(transformedRanking);
                        }
                    }
                } catch (error) {
                    console.log('[FALLBACK POLLING] Erro:', error);
                }
            }
        }, 5000);

        return () => clearInterval(pollingRef);
    }, [quizId, activityId, showPodium]);

    // Buscar relatório inicial
    useEffect(() => {
        const fetchInitialReport = async () => {
            try {
                let result;
                if (activityId > 0) {
                    result = await getLiveActivityReport(activityId);
                } else {
                    result = await getQuizReport(quizId);
                }

                if (result.success && result.report) {
                    setReport(result.report);
                    // Atualizar ranking inicial
                    if (result.report.all_responses) {
                        console.log('[INITIAL] Raw responses:', result.report.all_responses);
                        const transformedRanking = result.report.all_responses.map((r: any, index: number) => ({
                            position: index + 1,
                            student_id: r.student_id || r.id,
                            student_name: r.student_name || 'Aluno',
                            points: r.score * 100,
                            score: r.score,
                            total: r.total,
                            percentage: r.percentage || 0,
                            time_taken: r.time_taken || 0,
                            status: 'submitted'
                        }));
                        console.log('[INITIAL] Transformed ranking:', transformedRanking);
                        setRanking(transformedRanking);
                    }
                }
            } catch (error) {
                console.log('Erro ao buscar relatório inicial:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialReport();
    }, [quizId, activityId]);

    const handleEndQuiz = async () => {
        // Se já está mostrando o pódio, voltar para a tela anterior
        if (showPodium) {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.push('/(teacher)/dashboard');
            }
            return;
        }

        // Primeira vez: verificar se há respostas submetidas
        const submittedCount = ranking.filter((r: any) => r.status === 'submitted').length;

        console.log('[END QUIZ] Respostas submetidas:', submittedCount);
        console.log('[END QUIZ] Ranking completo:', ranking);

        if (submittedCount >= 1) {
            setEnding(true);
            try {
                // Encerrar a atividade no backend
                if (activityId > 0) {
                    await endLiveActivity(activityId);
                } else {
                    await endQuiz(quizId);
                }



                // Busca relatório final
                let result;
                if (activityId > 0) {
                    result = await getLiveActivityReport(activityId);
                } else {
                    result = await getQuizReport(quizId);
                }

                if (result.success && result.report) {
                    setReport(result.report);
                    // Atualizar ranking final
                    if (result.report.all_responses) {
                        setRanking(result.report.all_responses.map((r: any, index: number) => ({
                            position: index + 1,
                            student_id: r.student_id || r.id,
                            student_name: r.student_name || 'Aluno',
                            points: r.score * 100,
                            score: r.score,
                            total: r.total,
                            percentage: r.percentage || 0,
                            time_taken: r.time_taken || 0,
                            status: 'submitted'
                        })));
                    }
                }

                // Mostrar pódio
                setShowPodium(true);
                console.log('[END QUIZ] Mostrando pódio');
            } catch (error) {
                console.log('Erro ao encerrar quiz:', error);
            } finally {
                setEnding(false);
            }
        } else {
            // Se não houver respostas, voltar direto
            console.log('[END QUIZ] Sem respostas, voltando direto');
            router.back();
        }
    };

    const handleExportPDF = async () => {
        if (!activityId && !quizId) return;

        setIsExportingPDF(true);
        try {
            const id = activityId > 0 ? activityId : quizId;
            const blob = await exportActivityPDF(id);

            // Criar URL do blob e fazer download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `relatorio_quiz_${id}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
        }
        setIsExportingPDF(false);
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
                <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}>
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Resultados ao Vivo</Text>
                {showPodium ? (
                    <TouchableOpacity
                        style={styles.pdfButton}
                        onPress={handleExportPDF}
                        disabled={isExportingPDF}
                    >
                        {isExportingPDF ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <MaterialIcons name="picture-as-pdf" size={24} color={colors.primary} />
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={styles.placeholder} />
                )}
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
                    {(isActive || showPodium) && (
                        <TouchableOpacity
                            style={styles.endButton}
                            onPress={handleEndQuiz}
                            disabled={ending}
                        >
                            {ending ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <>
                                    <MaterialIcons name={showPodium ? "close" : "stop"} size={20} color={colors.white} />
                                    <Text style={styles.endButtonText}>
                                        {showPodium ? 'Fechar' : 'Encerrar e Ver Pódio'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Podium Display - FIRST after quiz ends */}
                {showPodium && ranking.filter((r: any) => r.status === 'submitted').length >= 1 ? (
                    <View style={styles.section}>
                        <PodiumDisplay
                            topStudents={ranking
                                .filter((r: any) => r.status === 'submitted')
                                .slice(0, 3)
                                .map((student: any, index: number) => ({
                                    position: index + 1,
                                    student_name: student.student_name,
                                    points: student.points || (student.score * 100),
                                    percentage: student.percentage || 0,
                                    score: student.score || 0,
                                    total: student.total || 0,
                                }))}
                        />
                    </View>
                ) : null}

                {/* Enhanced Analytics - Only show after quiz ends */}
                {showPodium && report?.performance_distribution && (
                    <>
                        {/* Performance Distribution */}
                        <PerformanceDistributionChart
                            distribution={report.performance_distribution}
                            total={report.response_count}
                        />

                        {/* Score Distribution */}
                        {report.score_distribution && (
                            <ScoreDistributionGraph
                                distribution={report.score_distribution}
                            />
                        )}

                        {/* Time Analytics */}
                        {report.time_analytics && (
                            <TimeAnalysisDashboard
                                timeAnalytics={report.time_analytics}
                            />
                        )}

                        {/* Question Difficulty Analysis */}
                        {report.question_analytics && report.question_analytics.length > 0 && (
                            <QuestionDifficultyChart
                                questionAnalytics={report.question_analytics}
                            />
                        )}

                        {/* Comparative Statistics */}
                        {report.comparative_stats && (
                            <ComparativeStatsPanel
                                stats={report.comparative_stats}
                            />
                        )}

                        {/* Support Action Panel */}
                        {(report.performance_distribution.below_average > 0 ||
                            report.performance_distribution.average > 0) && (
                                <SupportActionPanel
                                    quizId={quizId}
                                    activityId={activityId || quizId}
                                    performanceDistribution={{
                                        critical: report.performance_distribution.below_average,
                                        attention: report.performance_distribution.average,
                                        good: report.performance_distribution.good,
                                        excellent: report.performance_distribution.excellent
                                    }}
                                />
                            )}
                    </>
                )}

                {/* Average Score - Show during active quiz */}
                {!showPodium && (
                    <View style={styles.averageCard}>
                        <Text style={styles.sectionTitle}>Média da Turma</Text>
                        <View style={styles.averageCircle}>
                            <Text style={styles.averageValue}>{report?.average_score?.toFixed(1) || 0}%</Text>
                        </View>
                    </View>
                )}

                {/* Live Ranking - Show during active quiz */}
                {!showPodium && ranking.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🏁 Ranking ao Vivo</Text>
                        <RaceVisualization
                            ranking={ranking
                                .filter((r: any) => r.status === 'submitted')
                                .map((student: any, index: number) => ({
                                    position: index + 1,
                                    student_id: student.student_id,
                                    student_name: student.student_name,
                                    points: student.points || (student.score * 100),
                                    score: student.score || 0,
                                    total: student.total || 0,
                                    percentage: student.percentage || 0,
                                    time_taken: student.time_taken || 0,
                                }))}
                            enrolledCount={report?.enrolled_count || ranking.length}
                        />
                    </View>
                ) : null}

                {/* Best and Worst Questions - Only show after quiz ends */}
                {showPodium && (
                    <>
                        {report?.best_question && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>✅ Pergunta Mais Fácil</Text>
                                <View style={styles.bestCard}>
                                    <Text style={styles.bestQuestion}>{report.best_question.question}</Text>
                                    <Text style={styles.bestRate}>
                                        {report.best_question.correct_rate?.toFixed(0)}% acertaram
                                    </Text>
                                </View>
                            </View>
                        )}
                        {report?.worst_question && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>⚠️ Pergunta Mais Difícil</Text>
                                <View style={styles.worstCard}>
                                    <Text style={styles.worstQuestion}>{report.worst_question.question}</Text>
                                    <Text style={styles.worstRate}>
                                        Apenas {report.worst_question.correct_rate?.toFixed(0)}% acertaram
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
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
    pdfButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
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
    bestCard: {
        backgroundColor: '#f0fdf4', // Green-50
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderLeftWidth: 4,
        borderLeftColor: '#10b981',
    },
    bestQuestion: {
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        fontFamily: typography.fontFamily.display,
    },
    bestRate: {
        fontSize: typography.fontSize.xs,
        color: '#10b981',
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
