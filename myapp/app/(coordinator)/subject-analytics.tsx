import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
    Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import {
    getCoordinatorSubjectAnalytics,
    SubjectAnalyticsResponse, SubjectAnalyticsSummary, SubjectAnalyticsBand, SubjectAnalyticsStudent, SubjectAnalyticsQuiz,
} from '@/services/api';

type PeriodFilter = 'all' | 7 | 30;

export default function SubjectAnalyticsScreen() {
    const params = useLocalSearchParams<{ subjectId?: string; subjectName?: string }>();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 900;

    const subjectId = Number(params.subjectId || 0);
    const subjectNameParam = params.subjectName || 'Disciplina';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payload, setPayload] = useState<SubjectAnalyticsResponse | null>(null);
    const [period, setPeriod] = useState<PeriodFilter>('all');
    const [error, setError] = useState<string | null>(null);

    const loadAnalytics = useCallback(async (isRefresh = false, selectedPeriod?: PeriodFilter) => {
        if (!subjectId) { setError('ID inválido'); setLoading(false); return; }
        try {
            if (isRefresh) setRefreshing(true); else setLoading(true);
            setError(null);
            const daysParam = (selectedPeriod ?? period) === 'all' ? undefined : (selectedPeriod ?? period) as 7 | 30;
            const result = await getCoordinatorSubjectAnalytics(subjectId, daysParam);
            if (!result.success) { setError('Erro ao carregar analytics'); return; }
            setPayload(result);
        } catch { setError('Erro de conexão'); } finally { setLoading(false); setRefreshing(false); }
    }, [subjectId, period]);

    useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

    const summary: SubjectAnalyticsSummary = payload?.summary || {
        enrolled_students: 0, total_activities: 0, total_quizzes: 0, total_summaries: 0,
        total_quiz_responses: 0, total_summary_interactions: 0, quiz_avg_score: 0, quiz_error_rate: 0, quiz_participation_rate: 0,
    };
    const performanceBands: SubjectAnalyticsBand[] = payload?.performance_bands || [];
    const students: SubjectAnalyticsStudent[] = payload?.students || [];
    const recentQuizzes: SubjectAnalyticsQuiz[] = payload?.recent_quizzes || [];
    const subjectName = payload?.subject?.name || subjectNameParam;

    const riskStudents = useMemo(() =>
        students.filter((s) => s.status === 'needs_help' || s.status === 'attention')
            .sort((a, b) => (a.avg_score || 0) - (b.avg_score || 0)),
        [students]);

    const maxBandCount = useMemo(() => Math.max(1, ...performanceBands.map((b) => b.count || 0)), [performanceBands]);

    const getBandColor = (key: string) => {
        if (key === 'excellent') return '#16a34a';
        if (key === 'good') return '#0ea5e9';
        if (key === 'attention') return '#f59e0b';
        return '#ef4444';
    };

    const statusBadge = (status: string) => {
        if (status === 'needs_help') return { bg: '#fee2e2', text: '#b91c1c', label: 'Precisa de ajuda' };
        if (status === 'attention') return { bg: '#fef3c7', text: '#92400e', label: 'Atenção' };
        if (status === 'doing_well') return { bg: '#dcfce7', text: '#166534', label: 'Indo bem' };
        return { bg: '#e2e8f0', text: '#334155', label: 'Sem dados' };
    };

    const formatDate = (d: string | null) => {
        if (!d) return '-';
        return new Date(d.endsWith('Z') ? d : `${d}Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const handlePeriodChange = (p: PeriodFilter) => { if (p !== period) { setPeriod(p); loadAnalytics(false, p); } };

    return (
        <SafeAreaView style={s.safe}>
            <LinearGradient colors={['#0b5fb8', '#1d4ed8', '#0ea5e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="arrow-back-ios" size={20} color="#fff" /></TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.headerTitle}>Analytics da Disciplina</Text>
                    <Text style={s.headerSub} numberOfLines={1}>{subjectName} · Somente leitura</Text>
                </View>
                <TouchableOpacity onPress={() => loadAnalytics(true)} disabled={refreshing} style={s.refreshBtn}>
                    {refreshing ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="refresh" size={22} color="#fff" />}
                </TouchableOpacity>
            </LinearGradient>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={s.centerText}>Carregando analytics...</Text></View>
            ) : error ? (
                <View style={s.center}><MaterialIcons name="error-outline" size={40} color="#ef4444" /><Text style={s.errorText}>{error}</Text></View>
            ) : (
                <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnalytics(true)} />}>
                    {/* Period Filter */}
                    <View style={s.filterRow}>
                        {(['all', 7, 30] as PeriodFilter[]).map((p) => (
                            <TouchableOpacity key={String(p)} style={[s.filterChip, period === p && s.filterChipActive]} onPress={() => handlePeriodChange(p)}>
                                <Text style={[s.filterChipText, period === p && s.filterChipTextActive]}>{p === 'all' ? 'Tudo' : `${p}d`}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Top Metrics */}
                    <View style={s.metricsRow}>
                        <View style={[s.metricCard, { backgroundColor: '#22c55e' }]}><Text style={s.metricLabel}>Média</Text><Text style={s.metricValue}>{summary.quiz_avg_score}%</Text></View>
                        <View style={[s.metricCard, { backgroundColor: '#3b82f6' }]}><Text style={s.metricLabel}>Participação</Text><Text style={s.metricValue}>{summary.quiz_participation_rate}%</Text></View>
                        <View style={[s.metricCard, { backgroundColor: '#ef4444' }]}><Text style={s.metricLabel}>Erro</Text><Text style={s.metricValue}>{summary.quiz_error_rate}%</Text></View>
                    </View>

                    {/* Performance Bands */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Distribuição de Desempenho</Text>
                        {performanceBands.length === 0 ? <Text style={s.emptyText}>Sem dados suficientes</Text> : performanceBands.map((band) => {
                            const widthPct = band.count > 0 ? (band.count / maxBandCount) * 100 : 0;
                            return (
                                <View key={band.key} style={s.bandRow}>
                                    <View style={s.bandHeader}><Text style={s.bandLabel}>{band.label}</Text><Text style={[s.bandCount, { color: getBandColor(band.key) }]}>{band.count}</Text></View>
                                    <View style={s.bandTrack}>{widthPct > 0 && <View style={[s.bandFill, { width: `${widthPct}%` as any, backgroundColor: getBandColor(band.key) }]} />}</View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Risk Students */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Alunos em Risco ({riskStudents.length})</Text>
                        {riskStudents.length === 0 ? <Text style={s.emptyText}>Nenhum aluno em risco</Text> : riskStudents.slice(0, 10).map((st) => {
                            const badge = statusBadge(st.status);
                            return (
                                <View key={st.student_id} style={s.studentRow}>
                                    <View style={s.studentAvatar}><MaterialIcons name="person" size={16} color="#475569" /></View>
                                    <View style={{ flex: 1 }}><Text style={s.studentName}>{st.student_name}</Text><Text style={s.studentMeta}>Média {st.avg_score}% · Erro {st.error_rate}%</Text></View>
                                    <View style={[s.statusBadge, { backgroundColor: badge.bg }]}><Text style={[s.statusBadgeText, { color: badge.text }]}>{badge.label}</Text></View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Recent Quizzes */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Quizzes Recentes ({recentQuizzes.length})</Text>
                        {recentQuizzes.length === 0 ? <Text style={s.emptyText}>Nenhum quiz ainda</Text> : recentQuizzes.slice(0, 5).map((quiz) => (
                            <View key={quiz.activity_id} style={s.quizRow}>
                                <Text style={s.quizTitle} numberOfLines={2}>{quiz.title}</Text>
                                <Text style={s.quizDate}>{formatDate(quiz.created_at)}</Text>
                                <View style={s.quizTags}>
                                    <View style={[s.quizTag, { backgroundColor: '#dbeafe' }]}><Text style={[s.quizTagText, { color: '#1d4ed8' }]}>Acerto {quiz.avg_score}%</Text></View>
                                    <View style={[s.quizTag, { backgroundColor: '#fee2e2' }]}><Text style={[s.quizTagText, { color: '#dc2626' }]}>Erro {quiz.error_rate}%</Text></View>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Summary Info */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Resumo</Text>
                        <View style={s.summaryGrid}>
                            <View style={s.summaryItem}><Text style={s.summaryValue}>{summary.enrolled_students}</Text><Text style={s.summaryLabel}>Matriculados</Text></View>
                            <View style={s.summaryItem}><Text style={s.summaryValue}>{summary.total_quizzes}</Text><Text style={s.summaryLabel}>Quizzes</Text></View>
                            <View style={s.summaryItem}><Text style={s.summaryValue}>{summary.total_summaries}</Text><Text style={s.summaryLabel}>Resumos</Text></View>
                            <View style={s.summaryItem}><Text style={s.summaryValue}>{summary.total_quiz_responses}</Text><Text style={s.summaryLabel}>Respostas</Text></View>
                        </View>
                    </View>

                    <View style={{ height: 30 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 14 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
    refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    centerText: { color: '#64748b', marginTop: 10, fontSize: 14 },
    errorText: { color: '#ef4444', marginTop: 10, fontSize: 15, fontWeight: '600' },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.md },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
    filterChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
    filterChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    filterChipTextActive: { color: '#fff' },
    metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    metricCard: { flex: 1, borderRadius: 12, padding: 14 },
    metricLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '500' },
    metricValue: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
    section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
    emptyText: { color: '#94a3b8', fontSize: 14 },
    bandRow: { marginBottom: 10 },
    bandHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    bandLabel: { fontSize: 13, color: '#475569', fontWeight: '500' },
    bandCount: { fontSize: 13, fontWeight: '700' },
    bandTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4 },
    bandFill: { height: 8, borderRadius: 4 },
    studentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    studentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    studentName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
    studentMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusBadgeText: { fontSize: 10, fontWeight: '600' },
    quizRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    quizTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    quizDate: { fontSize: 12, color: '#64748b', marginTop: 2 },
    quizTags: { flexDirection: 'row', gap: 6, marginTop: 6 },
    quizTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    quizTagText: { fontSize: 11, fontWeight: '600' },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    summaryItem: { flex: 1, minWidth: 80, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, padding: 12 },
    summaryValue: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    summaryLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },
});
