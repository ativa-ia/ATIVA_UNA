import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
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
    getSubjects,
    getSubjectAnalytics,
    Subject,
    sendTargetedSupportNotification,
    SubjectAnalyticsBand,
    SubjectAnalyticsQuiz,
    SubjectAnalyticsResponse,
    SubjectAnalyticsStudent,
    SubjectAnalyticsSummary,
} from '@/services/api';

type PeriodFilter = 'all' | 7 | 30;
type DashboardMode = 'compact' | 'detailed';

export default function ClassAnalyticsScreen() {
    const params = useLocalSearchParams<{ subjectId?: string | string[]; subjectName?: string | string[] }>();
    const insets = useSafeAreaInsets();
    const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

    const subjectIdParam = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
    const subjectNameParam = Array.isArray(params.subjectName) ? params.subjectName[0] : params.subjectName;
    const parsedSubjectId = Number(subjectIdParam || 0);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<SubjectAnalyticsResponse | null>(null);
    const [period, setPeriod] = useState<PeriodFilter>('all');
    const [dashboardMode, setDashboardMode] = useState<DashboardMode>('compact');
    const [supportModalVisible, setSupportModalVisible] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<SubjectAnalyticsStudent | null>(null);
    const [supportMessage, setSupportMessage] = useState('');
    const [sendingSupport, setSendingSupport] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [subjectSelectorVisible, setSubjectSelectorVisible] = useState(false);
    const [teacherSubjects, setTeacherSubjects] = useState<Subject[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(false);
    const [showAllRiskStudents, setShowAllRiskStudents] = useState(false);
    const [showAllQuizzes, setShowAllQuizzes] = useState(false);

    const loadAnalytics = useCallback(async (isRefresh = false, selectedPeriod?: PeriodFilter) => {
        if (!parsedSubjectId) {
            setError('Disciplina invalida para analytics');
            setLoading(false);
            return;
        }

        const activePeriod = selectedPeriod ?? period;
        const startedAt = Date.now();

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
            setLastUpdatedAt(new Date());

            if (isRefresh) {
                const elapsed = Date.now() - startedAt;
                if (elapsed < 450) {
                    await new Promise((resolve) => setTimeout(resolve, 450 - elapsed));
                }
            }
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

    useEffect(() => {
        const loadSubjects = async () => {
            try {
                setLoadingSubjects(true);
                const subjects = await getSubjects();
                setTeacherSubjects(subjects || []);
            } catch (err) {
                console.error('Erro ao carregar disciplinas do professor:', err);
            } finally {
                setLoadingSubjects(false);
            }
        };

        loadSubjects();
    }, []);

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

    const topRiskStudents = useMemo(
        () => students
            .filter((student) => student.status === 'needs_help' || student.status === 'attention')
            .sort((a, b) => {
                const rank = (s: SubjectAnalyticsStudent) => (s.status === 'needs_help' ? 2 : 1);
                const byRank = rank(b) - rank(a);
                if (byRank !== 0) return byRank;
                return (b.error_rate || 0) - (a.error_rate || 0);
            }),
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

    const toPercent = (value: number) => {
        if (!Number.isFinite(value)) return 0;
        return Math.max(0, Math.min(100, value));
    };

    const openSupportModal = (student: SubjectAnalyticsStudent) => {
        setSelectedStudent(student);
        setSupportMessage(
            `Oi, ${student.student_name}. Percebi que voce pode estar com dificuldade em ${subjectName}. Vamos revisar juntos? Veja os recaps da disciplina e me avise suas duvidas principais para eu te ajudar de forma direcionada.`
        );
        setSupportModalVisible(true);
    };

    const closeSupportModal = () => {
        if (sendingSupport) return;
        setSupportModalVisible(false);
        setSelectedStudent(null);
        setSupportMessage('');
    };

    const handleSendSupport = async () => {
        if (!selectedStudent) return;
        const trimmedMessage = supportMessage.trim();
        if (!trimmedMessage) {
            Alert.alert('Mensagem vazia', 'Escreva uma orientacao para enviar ao aluno.');
            return;
        }

        try {
            setSendingSupport(true);
            const response = await sendTargetedSupportNotification({
                subjectId: parsedSubjectId,
                studentIds: [selectedStudent.student_id],
                title: `Plano de apoio - ${subjectName}`,
                message: trimmedMessage,
                type: 'support',
            });

            if (!response.success) {
                Alert.alert('Falha no envio', response.message || 'Nao foi possivel enviar orientacao ao aluno.');
                return;
            }

            Alert.alert('Orientacao enviada', `Mensagem enviada para ${selectedStudent.student_name}.`);
            closeSupportModal();
        } catch (err) {
            console.error('Erro ao enviar apoio:', err);
            Alert.alert('Erro', 'Nao foi possivel enviar a orientacao agora.');
        } finally {
            setSendingSupport(false);
        }
    };

    const handlePeriodChange = async (nextPeriod: PeriodFilter) => {
        if (period === nextPeriod) return;
        setPeriod(nextPeriod);
        await loadAnalytics(false, nextPeriod);
    };

    const handleSelectSubject = (subject: Subject) => {
        if (subject.id === parsedSubjectId) {
            setSubjectSelectorVisible(false);
            return;
        }

        setSubjectSelectorVisible(false);
        router.replace({
            pathname: '/(teacher)/class-analytics',
            params: {
                subjectId: String(subject.id),
                subjectName: subject.name,
            },
        });
    };

    const periodLabel = period === 'all' ? 'Periodo completo' : `Ultimos ${period} dias`;
    const isCompact = dashboardMode === 'compact';
    const updatedLabel = lastUpdatedAt
        ? `Atualizado ${lastUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : 'Sem atualizacao';

    const compactRecentQuizzes = useMemo(
        () => recentQuizzes.slice(0, 3),
        [recentQuizzes]
    );

    const criticalNowCount = riskCounts.needs_help + riskCounts.attention;
    const firstPriorityStudent = topRiskStudents[0] || null;
    const isDesktopCompact = viewportWidth >= 1024;
    const isNarrowViewport = viewportWidth < 920;
    const compactBodyMinHeight = Math.max(360, viewportHeight - (insets.top + 300));
    const totalBandCount = useMemo(
        () => performanceBands.reduce((acc, band) => acc + (band.count || 0), 0),
        [performanceBands]
    );

    const compactMonitorItems = useMemo(
        () => [
            {
                key: 'avg',
                label: 'Acerto medio',
                value: `${summary.quiz_avg_score}%`,
                progress: toPercent(summary.quiz_avg_score),
                color: '#22c55e',
            },
            {
                key: 'err',
                label: 'Erro medio',
                value: `${summary.quiz_error_rate}%`,
                progress: toPercent(summary.quiz_error_rate),
                color: '#ef4444',
            },
            {
                key: 'part',
                label: 'Participacao',
                value: `${summary.quiz_participation_rate}%`,
                progress: toPercent(summary.quiz_participation_rate),
                color: '#3b82f6',
            },
            {
                key: 'risk',
                label: 'Risco ativo',
                value: String(criticalNowCount),
                progress: criticalNowCount > 0 ? 100 : 0,
                color: '#eab308',
            },
        ],
        [summary.quiz_avg_score, summary.quiz_error_rate, summary.quiz_participation_rate, criticalNowCount]
    );

    const riskRowsLimit = isNarrowViewport ? topRiskStudents.length : 5;
    const visibleRiskStudents = useMemo(
        () => (showAllRiskStudents ? topRiskStudents : topRiskStudents.slice(0, riskRowsLimit)),
        [showAllRiskStudents, topRiskStudents, riskRowsLimit]
    );

    const visibleDetailedQuizzes = useMemo(
        () => (showAllQuizzes ? recentQuizzes : recentQuizzes.slice(0, 5)),
        [showAllQuizzes, recentQuizzes]
    );

    const operationalSignal = useMemo(() => {
        if (criticalNowCount >= 3 || summary.quiz_error_rate >= 60 || summary.quiz_participation_rate < 25) {
            return {
                label: 'Critico',
                message: 'Intervencao imediata recomendada',
                color: '#ef4444',
                bg: '#fee2e2',
                icon: 'priority-high' as const,
            };
        }
        if (criticalNowCount >= 1 || summary.quiz_error_rate >= 40 || summary.quiz_participation_rate < 45) {
            return {
                label: 'Atencao',
                message: 'Acompanhar turma nas proximas 24h',
                color: '#d97706',
                bg: '#fef3c7',
                icon: 'warning-amber' as const,
            };
        }
        return {
            label: 'Estavel',
            message: 'Cenario controlado',
            color: '#15803d',
            bg: '#dcfce7',
            icon: 'verified' as const,
        };
    }, [criticalNowCount, summary.quiz_error_rate, summary.quiz_participation_rate]);

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
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{isCompact ? 'Compacto' : 'Detalhado'}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.subjectPickerButton, isNarrowViewport && styles.subjectPickerButtonNarrow]}
                        onPress={() => setSubjectSelectorVisible(true)}
                        disabled={loadingSubjects}
                    >
                        {loadingSubjects ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <>
                                <Text style={styles.subjectPickerButtonText} numberOfLines={1}>{subjectName}</Text>
                                <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.white} />
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.headerRefresh, refreshing && styles.headerRefreshLoading]}
                        onPress={() => loadAnalytics(true)}
                        disabled={refreshing}
                    >
                        {refreshing ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <MaterialIcons name="refresh" size={22} color={colors.white} />
                        )}
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
                        contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnalytics(true)} />}
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={!isCompact || isNarrowViewport}
                    >
                        <View style={[styles.filterRow, isNarrowViewport && styles.filterRowNarrow]}>
                            {isNarrowViewport ? (
                                <>
                                    <View style={[styles.modeSwitchWrap, styles.modeSwitchWrapNarrow]}>
                                        <TouchableOpacity
                                            style={[styles.modeChip, isCompact && styles.modeChipActive]}
                                            onPress={() => setDashboardMode('compact')}
                                        >
                                            <MaterialIcons name="view-quilt" size={14} color={isCompact ? colors.white : '#1e3a8a'} />
                                            <Text style={[styles.modeChipText, isCompact && styles.modeChipTextActive]}>Compacto</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modeChip, !isCompact && styles.modeChipActive]}
                                            onPress={() => setDashboardMode('detailed')}
                                        >
                                            <MaterialIcons name="view-stream" size={14} color={!isCompact ? colors.white : '#1e3a8a'} />
                                            <Text style={[styles.modeChipText, !isCompact && styles.modeChipTextActive]}>Detalhado</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={[styles.periodFilterWrap, styles.periodFilterWrapNarrow]}>
                                        <TouchableOpacity
                                            style={[styles.filterChip, styles.filterChipNarrow, period === 'all' && styles.filterChipActive]}
                                            onPress={() => handlePeriodChange('all')}
                                        >
                                            <Text style={[styles.filterChipText, period === 'all' && styles.filterChipTextActive]}>Tudo</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.filterChip, styles.filterChipNarrow, period === 7 && styles.filterChipActive]}
                                            onPress={() => handlePeriodChange(7)}
                                        >
                                            <Text style={[styles.filterChipText, period === 7 && styles.filterChipTextActive]}>7d</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.filterChip, styles.filterChipNarrow, period === 30 && styles.filterChipActive]}
                                            onPress={() => handlePeriodChange(30)}
                                        >
                                            <Text style={[styles.filterChipText, period === 30 && styles.filterChipTextActive]}>30d</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View style={styles.periodFilterWrap}>
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
                                    </View>
                                    <View style={styles.modeSwitchWrap}>
                                        <TouchableOpacity
                                            style={[styles.modeChip, isCompact && styles.modeChipActive]}
                                            onPress={() => setDashboardMode('compact')}
                                        >
                                            <MaterialIcons name="view-quilt" size={14} color={isCompact ? colors.white : '#1e3a8a'} />
                                            <Text style={[styles.modeChipText, isCompact && styles.modeChipTextActive]}>Compacto</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modeChip, !isCompact && styles.modeChipActive]}
                                            onPress={() => setDashboardMode('detailed')}
                                        >
                                            <MaterialIcons name="view-stream" size={14} color={!isCompact ? colors.white : '#1e3a8a'} />
                                            <Text style={[styles.modeChipText, !isCompact && styles.modeChipTextActive]}>Detalhado</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            {!isNarrowViewport && (
                                <View style={styles.periodInfoBadge}>
                                    <MaterialIcons name="schedule" size={14} color="#475569" />
                                    <Text style={styles.periodLabel}>{periodLabel}</Text>
                                    <Text style={styles.periodUpdatedLabel}>• {updatedLabel}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.compactStatsRow}>
                            <View style={[styles.compactTopMetricCard, { backgroundColor: '#22c55e' }, isDesktopCompact && styles.compactTopMetricCardDesktop]}>
                                <View>
                                    <Text style={styles.compactTopMetricLabel}>Media de Acertos</Text>
                                    <Text style={styles.compactTopMetricValue}>{summary.quiz_avg_score}%</Text>
                                </View>
                                <View style={styles.compactTopMetricIconWrap}>
                                    <MaterialIcons name="north-east" size={18} color={colors.white} />
                                </View>
                            </View>
                            <View style={[styles.compactTopMetricCard, { backgroundColor: '#3b82f6' }, isDesktopCompact && styles.compactTopMetricCardDesktop]}>
                                <View>
                                    <Text style={styles.compactTopMetricLabel}>Participacao</Text>
                                    <Text style={styles.compactTopMetricValue}>{summary.quiz_participation_rate}%</Text>
                                </View>
                                <View style={styles.compactTopMetricIconWrap}>
                                    <MaterialIcons name="person" size={18} color={colors.white} />
                                </View>
                            </View>
                            <View style={[styles.compactTopMetricCard, { backgroundColor: '#ef4444' }, isDesktopCompact && styles.compactTopMetricCardDesktop]}>
                                <View>
                                    <Text style={styles.compactTopMetricLabel}>Taxa de Erro</Text>
                                    <Text style={styles.compactTopMetricValue}>{summary.quiz_error_rate}%</Text>
                                </View>
                                <View style={styles.compactTopMetricIconWrap}>
                                    <MaterialIcons name="south" size={18} color={colors.white} />
                                </View>
                            </View>
                        </View>

                        <View style={styles.compactAlertBanner}>
                            <MaterialIcons name="warning" size={18} color="#dc2626" />
                            <Text style={styles.compactAlertText}>
                                <Text style={styles.compactAlertTextStrong}>Sinal Geral: </Text>
                                {operationalSignal.label} - {operationalSignal.message}
                            </Text>
                        </View>

                        {isCompact && (
                            <>
                                <View style={[styles.compactBody, !isNarrowViewport && { minHeight: compactBodyMinHeight }]}>
                                    <View style={styles.compactMainGrid}>
                                        <View style={[styles.compactColumnCard, isDesktopCompact && styles.compactColumnCardDesktop]}>
                                            <Text style={styles.compactColumnTitle}>Monitoramento</Text>
                                            <View style={styles.compactMonitorList}>
                                                {compactMonitorItems.map((item) => (
                                                    <View key={item.key} style={styles.compactMonitorItem}>
                                                        <View style={styles.compactMonitorTop}>
                                                            <Text style={styles.compactMonitorLabel}>{item.label}</Text>
                                                            <Text style={[styles.compactMonitorValue, { color: item.color }]}>{item.value}</Text>
                                                        </View>
                                                        <View style={styles.compactMonitorTrack}>
                                                            {item.progress > 0 ? (
                                                                <View style={[styles.compactMonitorFill, { width: `${item.progress}%` as `${number}%`, backgroundColor: item.color }]} />
                                                            ) : null}
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>

                                        <View style={[styles.compactColumnCard, isDesktopCompact && styles.compactColumnCardDesktop]}>
                                            <Text style={styles.compactColumnTitle}>Prioridade de Intervencao</Text>
                                            {firstPriorityStudent ? (
                                                <View style={styles.compactPriorityRow}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.compactPriorityName}>{firstPriorityStudent.student_name}</Text>
                                                        <Text style={styles.compactPriorityMeta}>Media {firstPriorityStudent.avg_score}% • Erro {firstPriorityStudent.error_rate}%</Text>
                                                    </View>
                                                    <View style={styles.compactPriorityActions}>
                                                        <View style={[styles.statusBadge, { backgroundColor: '#fee2e2' }]}>
                                                            <Text style={[styles.statusBadgeText, { color: '#b91c1c' }]}>Precisa de ajuda</Text>
                                                        </View>
                                                        <TouchableOpacity
                                                            style={styles.supportActionButton}
                                                            onPress={() => openSupportModal(firstPriorityStudent)}
                                                        >
                                                            <Text style={styles.supportActionButtonText}>Ajudar</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <Text style={styles.emptyText}>Nenhuma intervencao urgente no momento.</Text>
                                            )}
                                        </View>

                                        <View style={[styles.compactColumnCard, isDesktopCompact && styles.compactColumnCardDesktop]}>
                                            <Text style={styles.compactColumnTitle}>Ultimos Quizzes</Text>
                                            {compactRecentQuizzes.length === 0 ? (
                                                <Text style={styles.emptyText}>Sem quizzes recentes.</Text>
                                            ) : (
                                                compactRecentQuizzes.map((quiz) => (
                                                    <View key={`compact-quiz-${quiz.activity_id}`} style={styles.compactQuizCard}>
                                                        <Text style={styles.compactQuizCardTitle} numberOfLines={2}>{quiz.title}</Text>
                                                        <Text style={styles.compactQuizCardDate}>{formatDate(quiz.created_at)}</Text>
                                                        <View style={styles.compactQuizTagsRow}>
                                                            <View style={[styles.metricChip, { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' }]}>
                                                                <Text style={[styles.metricChipText, { color: '#1d4ed8' }]}>Acerto {quiz.avg_score}%</Text>
                                                            </View>
                                                            <View style={[styles.metricChip, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
                                                                <Text style={[styles.metricChipText, { color: '#dc2626' }]}>Erro {quiz.error_rate}%</Text>
                                                            </View>
                                                            <View style={[styles.metricChip, { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' }]}>
                                                                <Text style={[styles.metricChipText, { color: '#1d4ed8' }]}>Part. {quiz.participation_rate}%</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))
                                            )}
                                        </View>
                                    </View>

                                    <View style={[styles.quickActionRowCompact, isDesktopCompact && styles.quickActionRowCompactDesktop, styles.compactActionsDocked]}>
                                        <TouchableOpacity
                                            style={[styles.quickActionButton, styles.quickActionPrimary, isDesktopCompact && styles.quickActionButtonHalf]}
                                            onPress={() => router.push({
                                                pathname: '/(teacher)/recaps',
                                                params: { subjectId: String(parsedSubjectId), subjectName: subjectName },
                                            })}
                                        >
                                            <MaterialIcons name="history-edu" size={18} color={colors.white} />
                                            <Text style={styles.quickActionPrimaryText}>Abrir recaps da disciplina</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.quickActionButton, styles.quickActionGhost, isDesktopCompact && styles.quickActionButtonHalf]}
                                            onPress={() => setDashboardMode('detailed')}
                                        >
                                            <MaterialIcons name="unfold-more" size={18} color={colors.primary} />
                                            <Text style={styles.quickActionGhostText}>Ver analise completa</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </>
                        )}

                        {!isCompact && (
                            <>
                                <View style={[styles.detailedTopGrid, isNarrowViewport && styles.detailedTopGridNarrow]}>
                                    <View style={[styles.sectionCard, styles.detailedPanelCard, styles.detailedTopCol, isNarrowViewport && styles.detailedTopColNarrow]}>
                                        <View style={styles.detailedPanelTitleRow}>
                                            <MaterialIcons name="grid-view" size={18} color="#64748b" />
                                            <Text style={styles.sectionTitle}>Mapa de risco da turma</Text>
                                        </View>
                                        <View style={styles.riskGrid}>
                                            <View style={[styles.riskPill, styles.riskPillStrongRed]}>
                                                <Text style={styles.riskPillNumberWhite}>{riskCounts.needs_help}</Text>
                                                <Text style={styles.riskPillLabelWhite}>Precisa de ajuda</Text>
                                            </View>
                                            <View style={[styles.riskPill, styles.riskPillStrongYellow]}>
                                                <Text style={styles.riskPillNumberWhite}>{riskCounts.attention}</Text>
                                                <Text style={styles.riskPillLabelWhite}>Em atencao</Text>
                                            </View>
                                            <View style={[styles.riskPill, styles.riskPillStrongGreen]}>
                                                <Text style={styles.riskPillNumberWhite}>{riskCounts.doing_well}</Text>
                                                <Text style={styles.riskPillLabelWhite}>Indo bem</Text>
                                            </View>
                                            <View style={[styles.riskPill, styles.riskPillStrongGray]}>
                                                <Text style={styles.riskPillNumberWhite}>{riskCounts.no_data}</Text>
                                                <Text style={styles.riskPillLabelWhite}>Sem dados</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={[styles.sectionCard, styles.detailedPanelCard, styles.detailedTopCol, isNarrowViewport && styles.detailedTopColNarrow]}>
                                        <View style={styles.detailedPanelTitleRow}>
                                            <MaterialIcons name="bar-chart" size={18} color="#64748b" />
                                            <Text style={styles.sectionTitle}>Distribuicao de desempenho</Text>
                                        </View>
                                        {performanceBands.length === 0 ? (
                                            <Text style={styles.emptyText}>Sem dados de quiz suficientes.</Text>
                                        ) : (
                                            <>
                                                {performanceBands.map((band) => {
                                                    const widthPct = band.count > 0 ? (band.count / maxBandCount) * 100 : 0;
                                                    const fillColor = getBandColor(band.key);
                                                    const segmentPct = totalBandCount > 0 ? Math.round((band.count / totalBandCount) * 100) : 0;
                                                    return (
                                                        <View key={band.key} style={styles.bandRow}>
                                                            <View style={styles.bandHeader}>
                                                                <Text style={styles.bandLabel}>{band.label}</Text>
                                                                <Text style={[styles.bandCount, { color: fillColor }]}>{band.count} ({segmentPct}%)</Text>
                                                            </View>
                                                            <View style={styles.bandBarTrack}>
                                                                {widthPct > 0 ? (
                                                                    <View style={[styles.bandBarFill, { width: `${widthPct}%` as `${number}%`, backgroundColor: fillColor }]} />
                                                                ) : null}
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </View>
                                </View>

                                <View style={[styles.detailedBottomGrid, isNarrowViewport && styles.detailedBottomGridNarrow]}>
                                    <View style={[
                                        styles.sectionCard,
                                        styles.detailedPanelCard,
                                        styles.detailedBottomCol,
                                        !isNarrowViewport && styles.detailedBottomColFixed,
                                        isNarrowViewport && styles.detailedBottomColNarrow,
                                    ]}>
                                        <View style={styles.detailedListTitleRow}>
                                            <Text style={styles.sectionTitle}>Risco imediato</Text>
                                            {topRiskStudents.length > riskRowsLimit ? (
                                                <TouchableOpacity onPress={() => setShowAllRiskStudents((prev) => !prev)}>
                                                    <Text style={styles.sectionLink}>{showAllRiskStudents ? 'Mostrar menos' : 'Ver todos'}</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <Text style={styles.sectionHint}>Atual</Text>
                                            )}
                                        </View>
                                        {visibleRiskStudents.length === 0 ? (
                                            <Text style={styles.emptyText}>Sem alunos para mostrar.</Text>
                                        ) : (
                                            <ScrollView
                                                style={styles.detailedInnerList}
                                                contentContainerStyle={styles.detailedInnerListContent}
                                                showsVerticalScrollIndicator={false}
                                                nestedScrollEnabled
                                            >
                                                {visibleRiskStudents.map((student) => {
                                                    const badge = getStatusBadgeStyle(student.status);
                                                    return (
                                                        <View key={`risk-${student.student_id}`} style={styles.detailedListRow}>
                                                            <View style={styles.detailedAvatarCircle}>
                                                                <MaterialIcons name="person" size={16} color="#475569" />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.detailedListName}>{student.student_name}</Text>
                                                                <Text style={styles.detailedListMeta}>Media {student.avg_score}% • Erro {student.error_rate}%</Text>
                                                            </View>
                                                            <View style={styles.detailedRiskActions}>
                                                                <TouchableOpacity
                                                                    style={styles.detailedRiskHelpButton}
                                                                    onPress={() => openSupportModal(student)}
                                                                >
                                                                    <MaterialIcons name="volunteer-activism" size={13} color={colors.white} />
                                                                    <Text style={styles.detailedRiskHelpButtonText}>Ajudar</Text>
                                                                </TouchableOpacity>
                                                                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                                                                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                                                                </View>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </ScrollView>
                                        )}
                                    </View>

                                    <View style={[
                                        styles.sectionCard,
                                        styles.detailedPanelCard,
                                        styles.detailedBottomCol,
                                        !isNarrowViewport && styles.detailedBottomColFixed,
                                        isNarrowViewport && styles.detailedBottomColNarrow,
                                    ]}>
                                        <View style={styles.detailedListTitleRow}>
                                            <Text style={styles.sectionTitle}>Ultimos quizzes</Text>
                                            {recentQuizzes.length > 5 ? (
                                                <TouchableOpacity onPress={() => setShowAllQuizzes((prev) => !prev)}>
                                                    <Text style={styles.sectionLink}>{showAllQuizzes ? 'Mostrar menos' : 'Ver todos'}</Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                        {recentQuizzes.length === 0 ? (
                                            <Text style={styles.emptyText}>Ainda nao ha quizzes nesta disciplina.</Text>
                                        ) : (
                                            <ScrollView
                                                style={styles.detailedInnerList}
                                                contentContainerStyle={styles.detailedInnerListContent}
                                                showsVerticalScrollIndicator={false}
                                                nestedScrollEnabled
                                            >
                                                {visibleDetailedQuizzes.map((quiz) => (
                                                    <View key={`dq-${quiz.activity_id}`} style={styles.detailedQuizItem}>
                                                        <Text style={styles.detailedQuizTitle} numberOfLines={2}>{quiz.title}</Text>
                                                        <Text style={styles.detailedQuizDate}>{formatDate(quiz.created_at)}</Text>
                                                        <View style={styles.compactQuizTagsRow}>
                                                            <View style={[styles.metricChip, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                                                                <Text style={[styles.metricChipText, { color: '#166534' }]}>Acerto {quiz.avg_score}%</Text>
                                                            </View>
                                                            <View style={[styles.metricChip, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
                                                                <Text style={[styles.metricChipText, { color: '#b91c1c' }]}>Erro {quiz.error_rate}%</Text>
                                                            </View>
                                                            <View style={[styles.metricChip, { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' }]}>
                                                                <Text style={[styles.metricChipText, { color: '#1d4ed8' }]}>Part. {quiz.participation_rate}%</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))}
                                            </ScrollView>
                                        )}
                                    </View>

                                    <View style={[styles.detailedSideCol, !isNarrowViewport && styles.detailedSideColFixed, isNarrowViewport && styles.detailedSideColNarrow]}>
                                        <View style={[styles.sectionCard, styles.detailedPanelCard, styles.detailedHelpCard]}>
                                            <Text style={styles.sectionTitle}>Quem precisa de ajuda</Text>
                                            {firstPriorityStudent ? (
                                                <>
                                                    <View style={styles.detailedFocusHeader}>
                                                        <View style={styles.detailedAvatarLarge}>
                                                            <MaterialIcons name="person" size={26} color="#475569" />
                                                        </View>
                                                        <View>
                                                            <Text style={styles.detailedFocusName}>{firstPriorityStudent.student_name}</Text>
                                                            <Text style={styles.detailedFocusStatus}>Situacao critica</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.detailedFocusDescription}>
                                                        O aluno apresenta dificuldade consistente em {subjectName}, com taxa de erro de {firstPriorityStudent.error_rate}%.
                                                    </Text>
                                                    <TouchableOpacity style={[styles.detailedHelpButton, styles.detailedHelpButtonDocked]} onPress={() => openSupportModal(firstPriorityStudent)}>
                                                        <MaterialIcons name="volunteer-activism" size={16} color={colors.white} />
                                                        <Text style={styles.detailedHelpButtonText}>Ajudar {firstPriorityStudent.student_name}</Text>
                                                    </TouchableOpacity>
                                                </>
                                            ) : (
                                                <Text style={styles.emptyText}>Nenhum aluno critico no momento.</Text>
                                            )}
                                        </View>

                                        <View style={styles.detailedMiniStatsGrid}>
                                            <View style={styles.detailedMiniStatCard}>
                                                <MaterialIcons name="school" size={18} color="#64748b" />
                                                <Text style={styles.detailedMiniStatValue}>{summary.enrolled_students}</Text>
                                                <Text style={styles.detailedMiniStatLabel}>Alunos</Text>
                                            </View>
                                            <View style={styles.detailedMiniStatCard}>
                                                <MaterialIcons name="send" size={18} color="#64748b" />
                                                <Text style={styles.detailedMiniStatValue}>{summary.total_activities}</Text>
                                                <Text style={styles.detailedMiniStatLabel}>Atividades</Text>
                                            </View>
                                            <View style={styles.detailedMiniStatCard}>
                                                <MaterialIcons name="quiz" size={18} color="#64748b" />
                                                <Text style={styles.detailedMiniStatValue}>{summary.total_quizzes}</Text>
                                                <Text style={styles.detailedMiniStatLabel}>Quizzes</Text>
                                            </View>
                                            <View style={styles.detailedMiniStatCard}>
                                                <MaterialIcons name="summarize" size={18} color="#64748b" />
                                                <Text style={styles.detailedMiniStatValue}>{summary.total_summary_interactions}</Text>
                                                <Text style={styles.detailedMiniStatLabel}>Interacoes</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </>
                        )}

                        {!isCompact && (
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>Plano de acao rapido</Text>
                                <View style={styles.quickActionRowCompactDesktop}>
                                    <TouchableOpacity
                                        style={[styles.quickActionButton, styles.quickActionPrimary, styles.quickActionButtonHalf]}
                                        onPress={() => router.push({
                                            pathname: '/(teacher)/recaps',
                                            params: { subjectId: String(parsedSubjectId), subjectName: subjectName },
                                        })}
                                    >
                                        <MaterialIcons name="history-edu" size={18} color={colors.white} />
                                        <Text style={styles.quickActionPrimaryText}>Abrir recaps da disciplina</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickActionButton, styles.quickActionGhost, styles.quickActionButtonHalf]}
                                        onPress={() => setDashboardMode('compact')}
                                    >
                                        <MaterialIcons name="view-quilt" size={18} color={colors.primary} />
                                        <Text style={styles.quickActionGhostText}>Voltar para visao compacta</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                )}

                <Modal
                    visible={subjectSelectorVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setSubjectSelectorVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.subjectModalCard}>
                            <View style={styles.subjectModalHeader}>
                                <Text style={styles.subjectModalTitle}>Selecionar disciplina</Text>
                                <TouchableOpacity onPress={() => setSubjectSelectorVisible(false)}>
                                    <MaterialIcons name="close" size={20} color="#334155" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.subjectModalList} contentContainerStyle={styles.subjectModalListContent}>
                                {teacherSubjects.length === 0 ? (
                                    <Text style={styles.emptyText}>Nenhuma disciplina encontrada.</Text>
                                ) : (
                                    teacherSubjects.map((subject) => {
                                        const active = subject.id === parsedSubjectId;
                                        return (
                                            <TouchableOpacity
                                                key={`subj-${subject.id}`}
                                                style={[styles.subjectOptionButton, active && styles.subjectOptionButtonActive]}
                                                onPress={() => handleSelectSubject(subject)}
                                            >
                                                <Text style={[styles.subjectOptionText, active && styles.subjectOptionTextActive]} numberOfLines={1}>
                                                    {subject.name}
                                                </Text>
                                                {active ? <MaterialIcons name="check" size={16} color={colors.primary} /> : null}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                <Modal
                    visible={supportModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={closeSupportModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <LinearGradient
                                colors={['#0b5fb8', '#1d4ed8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalHeader}
                            >
                                <MaterialIcons name="support-agent" size={20} color={colors.white} />
                                <Text style={styles.modalHeaderTitle}>Orientacao para {selectedStudent?.student_name || 'aluno'}</Text>
                            </LinearGradient>

                            <View style={styles.modalBody}>
                                <Text style={styles.modalHint}>
                                    Essa mensagem chega no painel de notificacoes do aluno para incentivar acao imediata.
                                </Text>
                                <TextInput
                                    style={styles.modalInput}
                                    multiline
                                    value={supportMessage}
                                    onChangeText={setSupportMessage}
                                    placeholder="Escreva uma orientacao de apoio"
                                    placeholderTextColor={colors.slate400}
                                    editable={!sendingSupport}
                                    textAlignVertical="top"
                                />
                            </View>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.modalCancelButton}
                                    onPress={closeSupportModal}
                                    disabled={sendingSupport}
                                >
                                    <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalSendButton}
                                    onPress={handleSendSupport}
                                    disabled={sendingSupport}
                                >
                                    {sendingSupport ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <>
                                            <MaterialIcons name="send" size={16} color={colors.white} />
                                            <Text style={styles.modalSendButtonText}>Enviar apoio</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
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
    subjectPickerButton: {
        width: 170,
        marginHorizontal: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        backgroundColor: 'rgba(15, 23, 42, 0.28)',
    },
    subjectPickerButtonNarrow: {
        width: 132,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    subjectPickerButtonText: {
        flex: 1,
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
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
    headerRefreshLoading: {
        opacity: 0.85,
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
    scrollContentCompact: {
        flexGrow: 1,
        paddingBottom: spacing.base,
        gap: spacing.sm,
    },
    compactStatsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    compactTopMetricCard: {
        width: '100%',
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 2,
    },
    compactTopMetricCardDesktop: {
        width: '32.2%',
    },
    compactTopMetricLabel: {
        color: 'rgba(255,255,255,0.9)',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    compactTopMetricValue: {
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        marginTop: 2,
    },
    compactTopMetricIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.22)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactAlertBanner: {
        borderRadius: borderRadius.md,
        backgroundColor: '#fee2e2',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    compactAlertText: {
        color: '#991b1b',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.sm,
    },
    compactAlertTextStrong: {
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.bold,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    filterRowNarrow: {
        alignItems: 'flex-start',
        gap: spacing.xs,
        justifyContent: 'space-between',
    },
    periodFilterWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    modeSwitchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: spacing.sm,
    },
    modeSwitchWrapNarrow: {
        marginLeft: 0,
        gap: 4,
    },
    modeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: borderRadius.full,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    modeChipActive: {
        backgroundColor: '#1d4ed8',
        borderColor: '#1d4ed8',
    },
    modeChipText: {
        color: '#1e3a8a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
    },
    modeChipTextActive: {
        color: colors.white,
    },
    filterChip: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: borderRadius.full,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    filterChipNarrow: {
        paddingHorizontal: 8,
        paddingVertical: 5,
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
        color: '#334155',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    periodInfoBadge: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: borderRadius.full,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    periodInfoBadgeNarrow: {
        marginLeft: 0,
    },
    periodUpdatedLabel: {
        color: '#64748b',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    periodFilterWrapNarrow: {
        marginLeft: 'auto',
        gap: 4,
    },
    heroCard: {
        borderRadius: borderRadius.xl,
        padding: spacing.md,
    },
    heroCardCompact: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
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
    heroMetricsRowCompact: {
        marginBottom: spacing.sm,
    },
    heroBigNumber: {
        color: colors.white,
        fontSize: typography.fontSize['2xl'],
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.bold,
    },
    heroBigNumberCompact: {
        fontSize: typography.fontSize.xl,
    },
    heroBigNumberSuccess: {
        color: '#22c55e',
    },
    heroBigNumberError: {
        color: '#ef4444',
    },
    heroMetricLabel: {
        color: '#bfdbfe',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    heroMetricLabelError: {
        color: '#fca5a5',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    heroDivider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: 'rgba(125,211,252,0.35)',
    },
    signalBanner: {
        marginTop: spacing.xs,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    signalTitle: {
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
    },
    signalSubtitle: {
        color: '#334155',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    heroPulseGrid: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        gap: spacing.sm,
    },
    heroPulseCard: {
        flex: 1,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        gap: 2,
    },
    heroPulseValue: {
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
    },
    heroPulseLabel: {
        color: '#334155',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
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
        flexDirection: 'row',
    },
    dualBarSuccess: {
        height: '100%',
        backgroundColor: '#34d399',
    },
    dualBarError: {
        height: '100%',
        backgroundColor: '#ef4444',
    },
    dualBarLegendRow: {
        marginTop: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dualBarLegendSuccess: {
        color: '#dbeafe',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    dualBarLegendError: {
        color: '#fca5a5',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
        fontWeight: typography.fontWeight.semibold,
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
    sectionCardCompact: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
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
    sectionLink: {
        color: colors.primary,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
    },
    detailedTopGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    detailedTopGridNarrow: {
        flexDirection: 'column',
    },
    detailedBottomGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    detailedBottomGridNarrow: {
        flexDirection: 'column',
    },
    detailedPanelCard: {
        borderColor: '#c7d2fe',
        backgroundColor: '#ffffff',
    },
    detailedTopCol: {
        width: '48.8%',
    },
    detailedTopColNarrow: {
        width: '100%',
    },
    detailedBottomCol: {
        width: '32.2%',
    },
    detailedBottomColFixed: {
        height: 500,
    },
    detailedBottomColNarrow: {
        width: '100%',
    },
    detailedSideCol: {
        width: '32.2%',
        gap: spacing.sm,
    },
    detailedSideColFixed: {
        height: 500,
        justifyContent: 'space-between',
    },
    detailedSideColNarrow: {
        width: '100%',
    },
    detailedHelpCard: {
        flex: 1,
    },
    detailedPanelTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: spacing.sm,
    },
    riskPillStrongRed: {
        backgroundColor: '#ef4444',
    },
    riskPillStrongYellow: {
        backgroundColor: '#eab308',
    },
    riskPillStrongGreen: {
        backgroundColor: '#22c55e',
    },
    riskPillStrongGray: {
        backgroundColor: '#64748b',
    },
    riskPillNumberWhite: {
        color: colors.white,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    riskPillLabelWhite: {
        marginTop: 2,
        color: colors.white,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    riskPillNumberDark: {
        color: '#0f172a',
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    riskPillLabelDark: {
        marginTop: 2,
        color: '#1e293b',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    detailedListTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    detailedInnerList: {
        flex: 1,
    },
    detailedInnerListContent: {
        paddingBottom: spacing.xs,
    },
    detailedListRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: '#dbeafe',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        marginBottom: spacing.sm,
        backgroundColor: '#f8fbff',
    },
    detailedAvatarCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailedListName: {
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
    },
    detailedListMeta: {
        marginTop: 1,
        color: '#64748b',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    detailedRiskActions: {
        alignItems: 'flex-end',
        gap: 6,
    },
    detailedRiskHelpButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    detailedRiskHelpButtonText: {
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
    },
    detailedQuizItem: {
        borderWidth: 1,
        borderColor: '#dbeafe',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        marginBottom: spacing.sm,
        backgroundColor: '#f8fbff',
    },
    detailedQuizTitle: {
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
    },
    detailedQuizDate: {
        marginTop: 2,
        marginBottom: spacing.xs,
        color: '#64748b',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    detailedFocusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    detailedAvatarLarge: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailedFocusName: {
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
    },
    detailedFocusStatus: {
        color: '#b91c1c',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    detailedFocusDescription: {
        marginTop: spacing.xs,
        color: '#475569',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.sm,
        lineHeight: 18,
        marginBottom: spacing.sm,
    },
    detailedHelpButton: {
        borderRadius: borderRadius.md,
        backgroundColor: '#2563eb',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    detailedHelpButtonDocked: {
        marginTop: 'auto',
    },
    detailedHelpButtonText: {
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
    },
    detailedMiniStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    detailedMiniStatCard: {
        width: '48.5%',
        borderWidth: 1,
        borderColor: '#dbeafe',
        borderRadius: borderRadius.md,
        backgroundColor: '#f8fbff',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
    },
    detailedMiniStatValue: {
        marginTop: 4,
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
    },
    detailedMiniStatLabel: {
        marginTop: 2,
        color: '#64748b',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    compactStatsGrid: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    compactMainGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    compactBody: {
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    compactColumnCard: {
        width: '100%',
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: spacing.md,
        minHeight: 220,
    },
    compactColumnCardDesktop: {
        width: '32.2%',
    },
    compactColumnTitle: {
        color: '#111827',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        marginBottom: spacing.sm,
    },
    compactMonitorList: {
        gap: spacing.sm,
    },
    compactMonitorItem: {
        gap: 5,
    },
    compactMonitorTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    compactMonitorLabel: {
        color: '#475569',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.sm,
    },
    compactMonitorValue: {
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
    },
    compactMonitorTrack: {
        height: 8,
        borderRadius: borderRadius.full,
        backgroundColor: '#e5e7eb',
        overflow: 'hidden',
    },
    compactMonitorFill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
    compactPriorityRow: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        gap: spacing.sm,
    },
    compactPriorityName: {
        color: '#111827',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
    },
    compactPriorityMeta: {
        marginTop: 2,
        color: '#6b7280',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.sm,
    },
    compactPriorityActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    compactQuizCard: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    compactQuizCardTitle: {
        color: '#111827',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
    },
    compactQuizCardDate: {
        marginTop: 2,
        marginBottom: spacing.xs,
        color: '#6b7280',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    compactQuizTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    compactStatCard: {
        width: '48.5%',
        borderWidth: 1,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    compactStatLabel: {
        color: '#334155',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    compactStatValue: {
        marginTop: 3,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.bold,
        fontSize: typography.fontSize.xl,
    },
    compactSubSection: {
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: spacing.sm,
    },
    compactSubSectionTitle: {
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
    },
    compactQuizRow: {
        paddingVertical: 6,
        gap: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    compactQuizTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    compactQuizTitle: {
        flex: 1,
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    compactQuizMeta: {
        color: '#64748b',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    compactQuizMetricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    metricChip: {
        borderWidth: 1,
        borderRadius: borderRadius.full,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    metricChipText: {
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
    },
    riskModeSwitchRow: {
        flexDirection: 'row',
        gap: 6,
    },
    riskModeChip: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
        borderRadius: borderRadius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    riskModeChipActive: {
        borderColor: colors.primary,
        backgroundColor: '#e0e7ff',
    },
    riskModeChipText: {
        color: '#475569',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
    },
    riskModeChipTextActive: {
        color: colors.primary,
    },
    compactRiskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    compactRiskDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    compactRiskName: {
        color: '#0f172a',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
    },
    compactRiskMeta: {
        color: '#475569',
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
    bandStackTrack: {
        height: 12,
        borderRadius: borderRadius.full,
        backgroundColor: '#e2e8f0',
        overflow: 'hidden',
        flexDirection: 'row',
        marginBottom: spacing.sm,
    },
    bandStackSegment: {
        height: '100%',
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
    studentCardCompact: {
        paddingVertical: 7,
    },
    studentTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    rankIndexBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#dbeafe',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankIndexText: {
        color: '#1d4ed8',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.bold,
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
    quizChartRowDetailed: {
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: '#dbeafe',
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        backgroundColor: '#f8fbff',
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
    quizDetailedMetricsWrap: {
        gap: 6,
    },
    quizDetailedMetricRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    quizDetailedMetricLabel: {
        width: 44,
        color: '#475569',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    quizDetailedMetricValue: {
        width: 42,
        textAlign: 'right',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
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
    alertRowCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    supportActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
    },
    supportActionButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
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
    quickActionRow: {
        gap: spacing.sm,
    },
    quickActionRowCompact: {
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    compactActionsDocked: {
        marginTop: 'auto',
        paddingTop: spacing.xs,
    },
    quickActionRowCompactDesktop: {
        flexDirection: 'row',
    },
    quickActionButton: {
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.base,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    quickActionPrimary: {
        backgroundColor: colors.primary,
    },
    quickActionPrimaryText: {
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    quickActionGhost: {
        backgroundColor: '#eef2ff',
        borderWidth: 1,
        borderColor: '#c7d2fe',
    },
    quickActionGhostText: {
        color: colors.primary,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    quickActionButtonHalf: {
        flex: 1,
        justifyContent: 'center',
    },
    compactQuickSignalsRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        gap: spacing.xs,
    },
    compactQuickSignalCard: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: borderRadius.md,
        backgroundColor: '#f8fbff',
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    compactQuickSignalTitle: {
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
    },
    compactQuickSignalMeta: {
        marginTop: 2,
        color: '#334155',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
    },
    subjectModalCard: {
        width: '100%',
        maxWidth: 460,
        maxHeight: 460,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: '#dbeafe',
        overflow: 'hidden',
    },
    subjectModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fbff',
    },
    subjectModalTitle: {
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
    },
    subjectModalList: {
        width: '100%',
    },
    subjectModalListContent: {
        padding: spacing.sm,
        gap: spacing.xs,
    },
    subjectOptionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        backgroundColor: '#ffffff',
    },
    subjectOptionButtonActive: {
        borderColor: '#93c5fd',
        backgroundColor: '#eff6ff',
    },
    subjectOptionText: {
        flex: 1,
        color: '#0f172a',
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        paddingRight: spacing.xs,
    },
    subjectOptionTextActive: {
        color: colors.primary,
    },
    modalCard: {
        width: '100%',
        maxWidth: 720,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        backgroundColor: colors.white,
        elevation: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 18,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
    },
    modalHeaderTitle: {
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        flex: 1,
    },
    modalBody: {
        padding: spacing.base,
        gap: spacing.sm,
    },
    modalHint: {
        color: colors.slate600,
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.xs,
        lineHeight: 18,
    },
    modalInput: {
        minHeight: 120,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.slate300,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.sm,
        backgroundColor: colors.slate50,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.base,
    },
    modalCancelButton: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.slate300,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        backgroundColor: colors.white,
    },
    modalCancelButtonText: {
        color: colors.slate700,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    modalSendButton: {
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minWidth: 134,
        justifyContent: 'center',
    },
    modalSendButtonText: {
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
});
