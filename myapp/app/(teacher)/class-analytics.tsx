import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import {
    getSubjectAnalytics,
    SubjectAnalyticsBand,
    SubjectAnalyticsQuiz,
    SubjectAnalyticsResponse,
    SubjectAnalyticsStudent,
    SubjectAnalyticsSummary,
} from '@/services/api';

type PeriodFilter = 'all' | 7 | 30;

export default function ClassAnalyticsScreen() {
    const params = useLocalSearchParams<{ subjectId?: string | string[]; subjectName?: string | string[] }>();
    const insets = useSafeAreaInsets();

    const subjectIdParam = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
    const subjectNameParam = Array.isArray(params.subjectName) ? params.subjectName[0] : params.subjectName;
    const parsedSubjectId = Number(subjectIdParam || 0);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<SubjectAnalyticsResponse | null>(null);
    const [period, setPeriod] = useState<PeriodFilter>('all');

    const loadAnalytics = useCallback(async (isRefresh = false, selectedPeriod?: PeriodFilter) => {
        if (!parsedSubjectId) {
            setError('Disciplina invalida para analytics');
            setLoading(false);
            return;
        }

        const activePeriod = selectedPeriod ?? period;

        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const daysParam = activePeriod === 'all' ? undefined : activePeriod;
            const result = await getSubjectAnalytics(parsedSubjectId, daysParam);

            if (!result.success) {
                setError(result.error || 'Erro ao carregar analytics da turma');
                setPayload(null);
                return;
            }

            setPayload(result);
        } catch (err) {
            console.error('Erro ao carregar analytics:', err);
            setError('Erro de conexao ao carregar analytics');
            setPayload(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [parsedSubjectId, period]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    const summary: SubjectAnalyticsSummary = payload?.summary || {
        enrolled_students: 0,
        total_activities: 0,
        total_quizzes: 0,
        total_summaries: 0,
        total_quiz_responses: 0,
        total_summary_interactions: 0,
        quiz_avg_score: 0,
        quiz_error_rate: 0,
        quiz_participation_rate: 0,
    };

    const performanceBands: SubjectAnalyticsBand[] = payload?.performance_bands || [];
    const students: SubjectAnalyticsStudent[] = payload?.students || [];
    const recentQuizzes: SubjectAnalyticsQuiz[] = payload?.recent_quizzes || [];

    const needsHelpStudents = useMemo(
        () => students.filter((student) => student.status === 'needs_help' || student.status === 'attention'),
        [students]
    );

    const topStudents = useMemo(
        () => students
            .filter((student) => student.status === 'doing_well' && student.quizzes_answered > 0)
            .sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0))
            .slice(0, 5),
        [students]
    );

    const riskCounts = useMemo(() => ({
        needs_help: students.filter((student) => student.status === 'needs_help').length,
        attention: students.filter((student) => student.status === 'attention').length,
        doing_well: students.filter((student) => student.status === 'doing_well').length,
        no_data: students.filter((student) => student.status === 'no_data').length,
    }), [students]);

    const maxBandCount = useMemo(
        () => Math.max(1, ...performanceBands.map((band) => band.count || 0)),
        [performanceBands]
    );

    const maxQuizScore = useMemo(
        () => Math.max(1, ...recentQuizzes.map((quiz) => quiz.avg_score || 0)),
        [recentQuizzes]
    );

    const subjectName = payload?.subject?.name || subjectNameParam || 'Disciplina';

    const getStatusBadgeStyle = (status: SubjectAnalyticsStudent['status']) => {
        if (status === 'needs_help') return { bg: '#fee2e2', text: '#b91c1c', label: 'Precisa de ajuda' };
        if (status === 'attention') return { bg: '#fef3c7', text: '#92400e', label: 'Atencao' };
        if (status === 'doing_well') return { bg: '#dcfce7', text: '#166534', label: 'Indo bem' };
        return { bg: '#e2e8f0', text: '#334155', label: 'Sem dados' };
    };

    const getBandColor = (key: SubjectAnalyticsBand['key']) => {
        if (key === 'excellent') return '#16a34a';
        if (key === 'good') return '#0ea5e9';
        if (key === 'attention') return '#f59e0b';
        return '#ef4444';
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        const date = new Date(dateString.endsWith('Z') ? dateString : `${dateString}Z`);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handlePeriodChange = async (nextPeriod: PeriodFilter) => {
        if (period === nextPeriod) return;
        setPeriod(nextPeriod);
        await loadAnalytics(false, nextPeriod);
    };

    const periodLabel = period === 'all' ? 'Periodo completo' : `Ultimos ${period} dias`;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <LinearGradient
                    colors={['#0b5fb8', '#1d4ed8', '#0ea5e9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
                >
                    <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleWrap}>
                        <Text style={styles.headerTitle}>Analise da Turma</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>
                            {subjectName}
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.headerRefresh} onPress={() => loadAnalytics(true)}>
                        <MaterialIcons name="refresh" size={22} color={colors.white} />
                    </TouchableOpacity>
                </LinearGradient>

                {loading ? (
                    <View style={styles.centerState}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.stateText}>Carregando visao da turma...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.centerState}>
                        <MaterialIcons name="error-outline" size={44} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={() => loadAnalytics()}>
                            <Text style={styles.retryButtonText}>Tentar novamente</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnalytics(true)} />}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.filterRow}>
                            <TouchableOpacity
                                style={[styles.filterChip, period === 'all' && styles.filterChipActive]}
                                onPress={() => handlePeriodChange('all')}
                            >
                                <Text style={[styles.filterChipText, period === 'all' && styles.filterChipTextActive]}>Tudo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.filterChip, period === 7 && styles.filterChipActive]}
                                onPress={() => handlePeriodChange(7)}
                            >
                                <Text style={[styles.filterChipText, period === 7 && styles.filterChipTextActive]}>7 dias</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.filterChip, period === 30 && styles.filterChipActive]}
                                onPress={() => handlePeriodChange(30)}
                            >
                                <Text style={[styles.filterChipText, period === 30 && styles.filterChipTextActive]}>30 dias</Text>
                            </TouchableOpacity>
                            <Text style={styles.periodLabel}>{periodLabel}</Text>
                        </View>

                        <LinearGradient
                            colors={['#082f49', '#0f172a']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroCard}
                        >
                            <View style={styles.heroHeader}>
                                <Text style={styles.heroTitle}>Pulso da sala</Text>
                                <MaterialIcons name="insights" size={24} color="#7dd3fc" />
                            </View>

                            <View style={styles.heroMetricsRow}>
                                <View>
                                    <Text style={styles.heroBigNumber}>{summary.quiz_avg_score}%</Text>
                                    <Text style={styles.heroMetricLabel}>Media dos quizzes</Text>
                                </View>
                                <View style={styles.heroDivider} />
                                <View>
                                    <Text style={styles.heroBigNumber}>{summary.quiz_participation_rate}%</Text>
                                    <Text style={styles.heroMetricLabel}>Participacao</Text>
                                </View>
                                <View style={styles.heroDivider} />
                                <View>
                                    <Text style={[styles.heroBigNumber, { color: '#fca5a5' }]}>{summary.quiz_error_rate}%</Text>
                                    <Text style={styles.heroMetricLabel}>Taxa de erro</Text>
                                </View>
                            </View>

                            <View style={styles.dualBarsWrap}>
                                <Text style={styles.dualBarsTitle}>Acerto x Erro</Text>
                                <View style={styles.dualBarTrack}>
                                    <View style={[styles.dualBarSuccess, { width: `${Math.max(0, Math.min(100, summary.quiz_avg_score))}%` as `${number}%` }]} />
                                </View>
                                <View style={styles.dualBarLegendRow}>
                                    <Text style={styles.dualBarLegend}>Acerto: {summary.quiz_avg_score}%</Text>
                                    <Text style={styles.dualBarLegend}>Erro: {summary.quiz_error_rate}%</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        <View style={styles.grid}>
                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiLabel}>Alunos matriculados</Text>
                                <Text style={styles.kpiValue}>{summary.enrolled_students}</Text>
                            </View>
                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiLabel}>Atividades enviadas</Text>
                                <Text style={styles.kpiValue}>{summary.total_activities}</Text>
                            </View>
                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiLabel}>Quizzes enviados</Text>
                                <Text style={styles.kpiValue}>{summary.total_quizzes}</Text>
                            </View>
                            <View style={styles.kpiCard}>
                                <Text style={styles.kpiLabel}>Interacoes em resumo</Text>
                                <Text style={styles.kpiValue}>{summary.total_summary_interactions}</Text>
                            </View>
                        </View>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Mapa de risco da turma</Text>
                            <View style={styles.riskGrid}>
                                <View style={[styles.riskPill, { backgroundColor: '#fee2e2' }]}>
                                    <Text style={[styles.riskPillNumber, { color: '#b91c1c' }]}>{riskCounts.needs_help}</Text>
                                    <Text style={[styles.riskPillLabel, { color: '#7f1d1d' }]}>Precisa de ajuda</Text>
                                </View>
                                <View style={[styles.riskPill, { backgroundColor: '#fef3c7' }]}>
                                    <Text style={[styles.riskPillNumber, { color: '#92400e' }]}>{riskCounts.attention}</Text>
                                    <Text style={[styles.riskPillLabel, { color: '#78350f' }]}>Em atencao</Text>
                                </View>
                                <View style={[styles.riskPill, { backgroundColor: '#dcfce7' }]}>
                                    <Text style={[styles.riskPillNumber, { color: '#166534' }]}>{riskCounts.doing_well}</Text>
                                    <Text style={[styles.riskPillLabel, { color: '#14532d' }]}>Indo bem</Text>
                                </View>
                                <View style={[styles.riskPill, { backgroundColor: '#e2e8f0' }]}>
                                    <Text style={[styles.riskPillNumber, { color: '#334155' }]}>{riskCounts.no_data}</Text>
                                    <Text style={[styles.riskPillLabel, { color: '#1e293b' }]}>Sem dados</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Distribuicao de desempenho</Text>
                            {performanceBands.length === 0 ? (
                                <Text style={styles.emptyText}>Sem dados de quiz suficientes.</Text>
                            ) : (
                                performanceBands.map((band) => {
                                    const widthPct = Math.max(8, (band.count / maxBandCount) * 100);
                                    const fillColor = getBandColor(band.key);
                                    return (
                                        <View key={band.key} style={styles.bandRow}>
                                            <View style={styles.bandHeader}>
                                                <Text style={styles.bandLabel}>{band.label}</Text>
                                                <Text style={[styles.bandCount, { color: fillColor }]}>{band.count}</Text>
                                            </View>
                                            <View style={styles.bandBarTrack}>
                                                <View style={[styles.bandBarFill, { width: `${widthPct}%` as `${number}%`, backgroundColor: fillColor }]} />
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        <View style={styles.sectionCard}>
                            <View style={styles.sectionTitleRow}>
                                <Text style={styles.sectionTitle}>Ranking por risco</Text>
                                <Text style={styles.sectionHint}>Ordenado por prioridade</Text>
                            </View>
                            {students.length === 0 ? (
                                <Text style={styles.emptyText}>Sem alunos para mostrar.</Text>
                            ) : (
                                students.slice(0, 12).map((student, index) => {
                                    const badge = getStatusBadgeStyle(student.status);
                                    const widthPct = Math.max(6, (student.error_rate / 100) * 100);
                                    return (
                                        <View key={student.student_id} style={styles.studentCard}>
                                            <View style={styles.studentTopRow}>
                                                <Text style={styles.rankIndex}>#{index + 1}</Text>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.studentName}>{student.student_name}</Text>
                                                    <Text style={styles.studentMeta}>
                                                        Media: {student.avg_score}% | Erro: {student.error_rate}% | Quizzes: {student.quizzes_answered}
                                                    </Text>
                                                </View>
                                                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                                                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.riskBarTrack}>
                                                <View style={[styles.riskBarFill, { width: `${widthPct}%` as `${number}%`, backgroundColor: badge.text }]} />
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Top desempenhos</Text>
                            {topStudents.length === 0 ? (
                                <Text style={styles.emptyText}>Nenhum aluno com destaque ainda.</Text>
                            ) : (
                                topStudents.map((student, index) => (
                                    <View key={student.student_id} style={styles.topRow}>
                                        <View style={styles.topBadge}>
                                            <Text style={styles.topBadgeText}>{index + 1}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.topName}>{student.student_name}</Text>
                                            <Text style={styles.topMeta}>Media {student.avg_score}% • {student.quizzes_answered} quizzes</Text>
                                        </View>
                                        <MaterialIcons name="emoji-events" size={20} color="#eab308" />
                                    </View>
                                ))
                            )}
                        </View>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Ultimos quizzes (grafico rapido)</Text>
                            {recentQuizzes.length === 0 ? (
                                <Text style={styles.emptyText}>Ainda nao ha quizzes nesta disciplina.</Text>
                            ) : (
                                recentQuizzes.map((quiz) => {
                                    const pct = Math.max(8, (quiz.avg_score / maxQuizScore) * 100);
                                    return (
                                        <View key={quiz.activity_id} style={styles.quizChartRow}>
                                            <View style={styles.quizChartInfo}>
                                                <Text style={styles.quizTitle} numberOfLines={2}>{quiz.title}</Text>
                                                <Text style={styles.quizDate}>{formatDate(quiz.created_at)}</Text>
                                            </View>
                                            <View style={styles.quizChartBarsWrap}>
                                                <View style={styles.quizBarTrack}>
                                                    <View style={[styles.quizBarFill, { width: `${pct}%` as `${number}%` }]} />
                                                </View>
                                                <Text style={styles.quizStatText}>Acerto {quiz.avg_score}% • Erro {quiz.error_rate}% • Part. {quiz.participation_rate}%</Text>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Quem precisa de ajuda</Text>
                            {needsHelpStudents.length === 0 ? (
                                <Text style={styles.emptyText}>Nenhum aluno critico no momento.</Text>
                            ) : (
                                needsHelpStudents.slice(0, 10).map((student) => {
                                    const badge = getStatusBadgeStyle(student.status);
                                    return (
                                        <View key={student.student_id} style={styles.alertRow}>
                                            <MaterialIcons name="priority-high" size={20} color={badge.text} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.alertName}>{student.student_name}</Text>
                                                <Text style={styles.alertMeta}>Media {student.avg_score}% • Erro {student.error_rate}%</Text>
                                            </View>
                                            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                                                <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#eff6ff',
    },
    container: {
        flex: 1,
        backgroundColor: '#eff6ff',
    },
    header: {
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerBack: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    headerTitleWrap: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    headerTitle: {
        color: colors.white,
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
        marginTop: 2,
    },
    headerRefresh: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    centerState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    stateText: {
        marginTop: spacing.sm,
        color: colors.textSecondary,
        fontFamily: typography.fontFamily.body,
    },
    errorText: {
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        textAlign: 'center',
        color: colors.danger,
        fontFamily: typography.fontFamily.body,
    },
    retryButton: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary,
    },
    retryButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        paddingBottom: spacing['3xl'],
        gap: spacing.md,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    filterChip: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: borderRadius.full,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    filterChipActive: {
        backgroundColor: '#1d4ed8',
        borderColor: '#1d4ed8',
    },
    filterChipText: {
        color: '#1e3a8a',
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
        fontSize: typography.fontSize.xs,
    },
    filterChipTextActive: {
        color: colors.white,
    },
    periodLabel: {
        marginLeft: 'auto',
        color: '#334155',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    heroCard: {
        borderRadius: borderRadius.xl,
        padding: spacing.md,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    heroTitle: {
        color: '#e0f2fe',
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.bold,
    },
    heroMetricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    heroBigNumber: {
        color: colors.white,
        fontSize: typography.fontSize['2xl'],
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.bold,
    },
    heroMetricLabel: {
        color: '#bfdbfe',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    heroDivider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: 'rgba(125,211,252,0.35)',
    },
    dualBarsWrap: {
        marginTop: spacing.xs,
    },
    dualBarsTitle: {
        color: '#bae6fd',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
    },
    dualBarTrack: {
        height: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    dualBarSuccess: {
        height: '100%',
        backgroundColor: '#34d399',
        borderRadius: borderRadius.full,
    },
    dualBarLegendRow: {
        marginTop: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dualBarLegend: {
        color: '#dbeafe',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    kpiCard: {
        width: '48.5%',
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: '#dbeafe',
        shadowColor: '#1d4ed8',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    kpiLabel: {
        color: '#475569',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
        marginBottom: spacing.xs,
    },
    kpiValue: {
        color: '#0f172a',
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    sectionCard: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    sectionTitle: {
        color: '#0f172a',
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        marginBottom: spacing.sm,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    sectionHint: {
        color: '#64748b',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    riskGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    riskPill: {
        width: '48.5%',
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    riskPillNumber: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    riskPillLabel: {
        marginTop: 2,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    bandRow: {
        marginBottom: spacing.sm,
    },
    bandHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
        gap: spacing.sm,
    },
    bandLabel: {
        flex: 1,
        color: '#334155',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
    },
    bandCount: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    bandBarTrack: {
        height: 10,
        borderRadius: borderRadius.full,
        backgroundColor: '#e2e8f0',
        overflow: 'hidden',
    },
    bandBarFill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
    studentCard: {
        backgroundColor: '#f8fafc',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    studentTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    rankIndex: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#dbeafe',
        color: '#1d4ed8',
        textAlign: 'center',
        textAlignVertical: 'center',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.bold,
        overflow: 'hidden',
    },
    studentName: {
        color: '#0f172a',
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    studentMeta: {
        color: '#475569',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
        marginTop: 1,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
    },
    statusBadgeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    riskBarTrack: {
        marginTop: spacing.sm,
        height: 7,
        borderRadius: borderRadius.full,
        backgroundColor: '#e2e8f0',
        overflow: 'hidden',
    },
    riskBarFill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#f8fafc',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    topBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topBadgeText: {
        color: '#92400e',
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    topName: {
        color: '#0f172a',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
    },
    topMeta: {
        color: '#475569',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    quizChartRow: {
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: spacing.xs,
    },
    quizChartInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    quizTitle: {
        flex: 1,
        color: '#0f172a',
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    quizDate: {
        color: '#64748b',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    quizChartBarsWrap: {
        gap: 6,
    },
    quizBarTrack: {
        height: 8,
        borderRadius: borderRadius.full,
        backgroundColor: '#e2e8f0',
        overflow: 'hidden',
    },
    quizBarFill: {
        height: '100%',
        borderRadius: borderRadius.full,
        backgroundColor: '#0ea5e9',
    },
    quizStatText: {
        color: '#475569',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    alertRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    alertName: {
        color: '#0f172a',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
    },
    alertMeta: {
        color: '#475569',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    emptyText: {
        color: '#64748b',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
    },
});
