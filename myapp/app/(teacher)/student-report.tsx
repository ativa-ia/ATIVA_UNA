import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getStudentPerformance, StudentPerformanceData } from '@/services/api';

const screenWidth = Dimensions.get('window').width;

/**
 * StudentReportScreen - Relatório Individual Completo do Aluno (Professor)
 */
export default function StudentReportScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const studentId = params.studentId as string;
    const subjectId = params.subjectId as string;
    const studentName = params.studentName as string || 'Aluno';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [performanceData, setPerformanceData] = useState<StudentPerformanceData | null>(null);

    useEffect(() => {
        loadPerformance();
    }, [studentId, subjectId]);

    const loadPerformance = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getStudentPerformance(parseInt(studentId), parseInt(subjectId));
            setPerformanceData(data);
        } catch (err) {
            console.error('Erro ao carregar desempenho:', err);
            setError('Erro ao carregar dados do aluno');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'excellent': return '#10b981';
            case 'good': return '#3B82F6';
            case 'warning': return '#f59e0b';
            case 'critical': return '#ef4444';
            default: return colors.slate500;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'excellent': return 'Excelente';
            case 'good': return 'Bom';
            case 'warning': return 'Atenção';
            case 'critical': return 'Crítico';
            case 'pending': return 'Pendente';
            default: return '';
        }
    };

    const getTrendIcon = (trend: string | null) => {
        switch (trend) {
            case 'improving': return 'trending-up';
            case 'declining': return 'trending-down';
            case 'stable': return 'trending-flat';
            default: return 'remove';
        }
    };

    const getTrendColor = (trend: string | null) => {
        switch (trend) {
            case 'improving': return '#10b981';
            case 'declining': return '#ef4444';
            case 'stable': return '#f59e0b';
            default: return colors.slate500;
        }
    };

    const getTrendLabel = (trend: string | null) => {
        switch (trend) {
            case 'improving': return 'Melhorando';
            case 'declining': return 'Piorando';
            case 'stable': return 'Estável';
            default: return 'N/A';
        }
    };

    if (loading) {
        return (
            <View style={styles.safeArea}>
                <View style={styles.container}>
                    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                        <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}>
                            <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Relatório Individual</Text>
                            <Text style={styles.headerSubtitle}>{studentName}</Text>
                        </View>
                        <View style={styles.placeholder} />
                    </View>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Carregando dados...</Text>
                    </View>
                </View>
            </View>
        );
    }

    if (error || !performanceData) {
        return (
            <View style={styles.safeArea}>
                <View style={styles.container}>
                    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                        <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}>
                            <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Relatório Individual</Text>
                            <Text style={styles.headerSubtitle}>{studentName}</Text>
                        </View>
                        <View style={styles.placeholder} />
                    </View>
                    <View style={styles.errorContainer}>
                        <MaterialIcons name="error-outline" size={64} color="#ef4444" />
                        <Text style={styles.errorText}>{error || 'Erro ao carregar dados'}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={loadPerformance}>
                            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    // Dados para o gráfico
    const chartData = {
        labels: ['AV1', 'AV2', 'Média Turma'],
        datasets: [{
            data: [
                performanceData.grades.av1 || 0,
                performanceData.grades.av2 || 0,
                performanceData.class_average
            ]
        }]
    };

    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}>
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Relatório Individual</Text>
                        <Text style={styles.headerSubtitle}>{performanceData.student.name}</Text>
                    </View>
                    <View style={styles.placeholder} />
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Student Info Card */}
                    <View style={styles.infoCard}>
                        <View style={[styles.avatar, { borderColor: getStatusColor(performanceData.grades.status) }]}>
                            <Text style={styles.avatarText}>
                                {performanceData.student.name.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.studentName}>{performanceData.student.name}</Text>
                            <Text style={styles.studentEmail}>{performanceData.student.email}</Text>
                            <Text style={styles.subjectInfo}>
                                {performanceData.subject.name} ({performanceData.subject.code})
                            </Text>
                        </View>
                    </View>

                    {/* Quick Stats */}
                    <View style={styles.quickStatsContainer}>
                        {performanceData.ranking && (
                            <View style={styles.quickStatCard}>
                                <MaterialIcons name="emoji-events" size={24} color="#f59e0b" />
                                <Text style={styles.quickStatValue}>
                                    {performanceData.ranking}º/{performanceData.total_students}
                                </Text>
                                <Text style={styles.quickStatLabel}>Ranking</Text>
                            </View>
                        )}
                        {performanceData.trend && (
                            <View style={styles.quickStatCard}>
                                <MaterialIcons
                                    name={getTrendIcon(performanceData.trend)}
                                    size={24}
                                    color={getTrendColor(performanceData.trend)}
                                />
                                <Text style={[styles.quickStatValue, { color: getTrendColor(performanceData.trend) }]}>
                                    {getTrendLabel(performanceData.trend)}
                                </Text>
                                <Text style={styles.quickStatLabel}>Tendência</Text>
                            </View>
                        )}
                        <View style={styles.quickStatCard}>
                            <MaterialIcons name="assignment" size={24} color="#3B82F6" />
                            <Text style={styles.quickStatValue}>
                                {performanceData.completed_activities}/{performanceData.total_activities}
                            </Text>
                            <Text style={styles.quickStatLabel}>Atividades</Text>
                        </View>
                    </View>

                    {/* Grades Chart */}
                    {performanceData.grades.av1 !== null && performanceData.grades.av2 !== null && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Desempenho Visual</Text>
                            <View style={styles.chartCard}>
                                <BarChart
                                    data={chartData}
                                    width={screenWidth - (spacing.base * 4)}
                                    height={220}
                                    yAxisLabel=""
                                    yAxisSuffix=""
                                    chartConfig={{
                                        backgroundColor: colors.slate900,
                                        backgroundGradientFrom: colors.slate900,
                                        backgroundGradientTo: colors.slate900,
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                                        style: {
                                            borderRadius: borderRadius.lg,
                                        },
                                        propsForDots: {
                                            r: '6',
                                            strokeWidth: '2',
                                            stroke: colors.slate800,
                                        },
                                    }}
                                    style={{
                                        borderRadius: 16,
                                    }}
                                    showValuesOnTopOfBars
                                    fromZero
                                />
                            </View>
                        </View>
                    )}

                    {/* Grades Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notas Detalhadas</Text>

                        <View style={styles.gradesContainer}>
                            <View style={styles.gradeCard}>
                                <MaterialIcons name="looks-one" size={20} color="#3B82F6" />
                                <Text style={styles.gradeLabel}>AV1</Text>
                                <Text style={[styles.gradeValue, { color: '#3B82F6' }]}>
                                    {performanceData.grades.av1 !== null ? performanceData.grades.av1.toFixed(1) : '-'}
                                </Text>
                            </View>
                            <View style={styles.gradeCard}>
                                <MaterialIcons name="looks-two" size={20} color="#10b981" />
                                <Text style={styles.gradeLabel}>AV2</Text>
                                <Text style={[styles.gradeValue, { color: '#10b981' }]}>
                                    {performanceData.grades.av2 !== null ? performanceData.grades.av2.toFixed(1) : '-'}
                                </Text>
                            </View>
                            <View style={styles.gradeCard}>
                                <MaterialIcons name="grade" size={20} color={getStatusColor(performanceData.grades.status)} />
                                <Text style={styles.gradeLabel}>Média</Text>
                                <Text style={[styles.gradeValue, { color: getStatusColor(performanceData.grades.status) }]}>
                                    {performanceData.grades.average !== null ? performanceData.grades.average.toFixed(1) : '-'}
                                </Text>
                            </View>
                        </View>

                        {/* Status Badge */}
                        {performanceData.grades.average !== null && (
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(performanceData.grades.status) + '20' }]}>
                                <View style={[styles.statusDot, { backgroundColor: getStatusColor(performanceData.grades.status) }]} />
                                <Text style={[styles.statusText, { color: getStatusColor(performanceData.grades.status) }]}>
                                    {getStatusLabel(performanceData.grades.status)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Insights */}
                    {performanceData.required_grade !== null && (
                        <View style={styles.insightCard}>
                            <MaterialIcons name="lightbulb" size={24} color="#f59e0b" />
                            <View style={styles.insightContent}>
                                <Text style={styles.insightTitle}>Nota Necessária</Text>
                                <Text style={styles.insightText}>
                                    Precisa tirar <Text style={styles.insightHighlight}>{performanceData.required_grade.toFixed(1)}</Text> na AV2 para atingir média 7.0
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Comparison with Class */}
                    {performanceData.grades.average !== null && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Comparação com a Turma</Text>
                            <View style={styles.comparisonCard}>
                                <View style={styles.comparisonRow}>
                                    <Text style={styles.comparisonLabel}>Média do Aluno</Text>
                                    <Text style={styles.comparisonValue}>
                                        {performanceData.grades.average.toFixed(1)}
                                    </Text>
                                </View>
                                <View style={styles.comparisonRow}>
                                    <Text style={styles.comparisonLabel}>Média da Turma</Text>
                                    <Text style={styles.comparisonValue}>
                                        {performanceData.class_average.toFixed(1)}
                                    </Text>
                                </View>
                                <View style={styles.comparisonRow}>
                                    <Text style={styles.comparisonLabel}>Diferença</Text>
                                    <Text style={[
                                        styles.comparisonValue,
                                        { color: performanceData.grades.average >= performanceData.class_average ? '#10b981' : '#ef4444' }
                                    ]}>
                                        {performanceData.grades.average >= performanceData.class_average ? '+' : ''}
                                        {(performanceData.grades.average - performanceData.class_average).toFixed(1)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Activities Section */}
                    {performanceData.activities && performanceData.activities.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Atividades ({performanceData.completed_activities}/{performanceData.total_activities})
                            </Text>

                            {performanceData.activities.map((activity) => (
                                <View key={activity.activity_id} style={styles.activityCard}>
                                    <View style={styles.activityHeader}>
                                        <MaterialIcons
                                            name={activity.type === 'quiz' ? 'quiz' : 'assignment'}
                                            size={20}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.activityTitle} numberOfLines={1}>
                                            {activity.title}
                                        </Text>
                                        <View style={[
                                            styles.activityStatusBadge,
                                            { backgroundColor: activity.status === 'graded' ? '#10b981' : activity.status === 'submitted' ? '#3B82F6' : '#f59e0b' }
                                        ]}>
                                            <Text style={styles.activityStatusText}>
                                                {activity.status === 'graded' ? 'Avaliada' : activity.status === 'submitted' ? 'Entregue' : 'Pendente'}
                                            </Text>
                                        </View>
                                    </View>
                                    {activity.grade !== null && (
                                        <View style={styles.activityGrade}>
                                            <Text style={styles.activityGradeLabel}>Nota:</Text>
                                            <Text style={styles.activityGradeValue}>{activity.grade.toFixed(1)}</Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Quizzes Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Quizzes ({performanceData.completed_quizzes}/{performanceData.total_quizzes})
                        </Text>

                        {performanceData.quizzes.length > 0 ? (
                            performanceData.quizzes.map((quiz) => (
                                <View key={quiz.quiz_id} style={styles.quizCard}>
                                    <View style={styles.quizHeader}>
                                        <MaterialIcons name="quiz" size={20} color={colors.primary} />
                                        <Text style={styles.quizTitle} numberOfLines={1}>
                                            {quiz.quiz_title}
                                        </Text>
                                    </View>
                                    <View style={styles.quizStats}>
                                        <View style={styles.quizStat}>
                                            <Text style={styles.quizStatLabel}>Acertos</Text>
                                            <Text style={styles.quizStatValue}>
                                                {quiz.score}/{quiz.total}
                                            </Text>
                                        </View>
                                        <View style={styles.quizStat}>
                                            <Text style={styles.quizStatLabel}>Percentual</Text>
                                            <Text style={[
                                                styles.quizStatValue,
                                                { color: quiz.percentage >= 70 ? '#10b981' : '#f59e0b' }
                                            ]}>
                                                {quiz.percentage.toFixed(0)}%
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialIcons name="quiz" size={48} color={colors.slate700} />
                                <Text style={styles.emptyText}>Nenhum quiz realizado</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundDark,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate800,
        backgroundColor: colors.backgroundDark,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTextContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    headerSubtitle: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
        marginTop: 2,
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    loadingText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
    },
    errorText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: '#ef4444',
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: 8,
        marginTop: spacing.sm,
    },
    retryButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: colors.slate900,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.slate800,
        marginBottom: spacing.base,
        alignItems: 'center',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary + '20',
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.base,
    },
    avatarText: {
        fontSize: 28,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
    },
    infoContent: {
        flex: 1,
    },
    studentName: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 2,
    },
    studentEmail: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
        marginBottom: 4,
    },
    subjectInfo: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate500,
    },
    quickStatsContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.base,
    },
    quickStatCard: {
        flex: 1,
        backgroundColor: colors.slate900,
        borderRadius: borderRadius.default,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate800,
        alignItems: 'center',
        gap: 4,
    },
    quickStatValue: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    quickStatLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: spacing.sm,
    },
    chartCard: {
        backgroundColor: colors.slate900,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate800,
        alignItems: 'center',
    },
    gradesContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    gradeCard: {
        flex: 1,
        backgroundColor: colors.slate900,
        borderRadius: borderRadius.default,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.slate800,
        alignItems: 'center',
        gap: 4,
    },
    gradeLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
    },
    gradeValue: {
        fontSize: 24,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    insightCard: {
        flexDirection: 'row',
        backgroundColor: '#f59e0b' + '20',
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: '#f59e0b' + '40',
        marginBottom: spacing.base,
        gap: spacing.sm,
    },
    insightContent: {
        flex: 1,
    },
    insightTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: '#f59e0b',
        marginBottom: 4,
    },
    insightText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate300,
    },
    insightHighlight: {
        fontWeight: typography.fontWeight.bold,
        color: '#f59e0b',
    },
    comparisonCard: {
        backgroundColor: colors.slate900,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.slate800,
        gap: spacing.sm,
    },
    comparisonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    comparisonLabel: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
    },
    comparisonValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    activityCard: {
        backgroundColor: colors.slate900,
        borderRadius: borderRadius.default,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.slate800,
        marginBottom: spacing.sm,
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    activityTitle: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    activityStatusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activityStatusText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    activityGrade: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    activityGradeLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
    },
    activityGradeValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: '#10b981',
    },
    quizCard: {
        backgroundColor: colors.slate900,
        borderRadius: borderRadius.default,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.slate800,
        marginBottom: spacing.sm,
    },
    quizHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    quizTitle: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    quizStats: {
        flexDirection: 'row',
        gap: spacing.base,
    },
    quizStat: {
        flex: 1,
        alignItems: 'center',
    },
    quizStatLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
        marginBottom: 2,
    },
    quizStatValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    emptyText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.slate500,
        marginTop: spacing.sm,
    },
});
