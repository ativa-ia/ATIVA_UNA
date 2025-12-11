import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getClassPerformance, ClassPerformanceData, StudentGrade } from '@/services/api';

/**
 * ClassReportScreen - Relatório da Turma (Professor)
 * Tela com desempenho individual de cada aluno
 */
export default function ClassReportScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';
    const subjectId = params.subjectId as string;

    const [filter, setFilter] = useState<'all' | 'excellent' | 'warning'>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [performanceData, setPerformanceData] = useState<ClassPerformanceData | null>(null);

    // Buscar dados da API
    useEffect(() => {
        loadPerformanceData();
    }, [subjectId]);

    const loadPerformanceData = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getClassPerformance(parseInt(subjectId));
            setPerformanceData(data);
        } catch (err) {
            console.error('Erro ao carregar desempenho:', err);
            setError('Erro ao carregar dados de desempenho');
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
            default: return colors.zinc400;
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

    const filteredStudents = performanceData?.students.filter(student => {
        if (filter === 'all') return true;
        if (filter === 'excellent') return student.status === 'excellent' || student.status === 'good';
        if (filter === 'warning') return student.status === 'warning' || student.status === 'critical';
        return true;
    }) || [];

    if (loading) {
        return (
            <View style={styles.safeArea}>
                <View style={styles.container}>
                    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Relatório da Turma</Text>
                            <Text style={styles.headerSubtitle}>{subjectName}</Text>
                        </View>
                        <View style={styles.placeholder} />
                    </View>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Carregando desempenho...</Text>
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
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Relatório da Turma</Text>
                            <Text style={styles.headerSubtitle}>{subjectName}</Text>
                        </View>
                        <View style={styles.placeholder} />
                    </View>
                    <View style={styles.errorContainer}>
                        <MaterialIcons name="error-outline" size={64} color="#ef4444" />
                        <Text style={styles.errorText}>{error || 'Erro ao carregar dados'}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={loadPerformanceData}>
                            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Relatório da Turma</Text>
                        <Text style={styles.headerSubtitle}>{subjectName}</Text>
                    </View>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Overall Stats */}
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{performanceData.stats.total_students}</Text>
                            <Text style={styles.statLabel}>Alunos</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#3B82F6' }]}>
                                {performanceData.stats.average_final.toFixed(1)}
                            </Text>
                            <Text style={styles.statLabel}>Média Geral</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#10b981' }]}>
                                {performanceData.stats.approval_rate.toFixed(0)}%
                            </Text>
                            <Text style={styles.statLabel}>Aprovação</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#ef4444' }]}>
                                {performanceData.stats.at_risk}
                            </Text>
                            <Text style={styles.statLabel}>Em Risco</Text>
                        </View>
                    </View>

                    {/* Filter Chips */}
                    <View style={styles.filterContainer}>
                        <TouchableOpacity
                            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                            onPress={() => setFilter('all')}
                        >
                            <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
                                Todos
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterChip, filter === 'excellent' && styles.filterChipActive]}
                            onPress={() => setFilter('excellent')}
                        >
                            <Text style={[styles.filterChipText, filter === 'excellent' && styles.filterChipTextActive]}>
                                Bom Desempenho
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterChip, filter === 'warning' && styles.filterChipActive]}
                            onPress={() => setFilter('warning')}
                        >
                            <Text style={[styles.filterChipText, filter === 'warning' && styles.filterChipTextActive]}>
                                Precisam de Atenção
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Students List */}
                    <View style={styles.studentsSection}>
                        <Text style={styles.sectionTitle}>
                            Desempenho Individual ({filteredStudents.length})
                        </Text>

                        {filteredStudents.map((student) => (
                            <TouchableOpacity
                                key={student.student_id}
                                style={styles.studentCard}
                                activeOpacity={0.7}
                                onPress={() => router.push({
                                    pathname: './student-report',
                                    params: {
                                        studentId: student.student_id.toString(),
                                        subjectId: subjectId,
                                        studentName: student.student_name,
                                        subjectName: performanceData.subject.name
                                    }
                                } as any)}
                            >
                                <View style={styles.studentHeader}>
                                    <View style={[styles.avatar, { borderColor: getStatusColor(student.status) }]}>
                                        <Text style={styles.avatarText}>{student.student_name.charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View style={styles.studentInfo}>
                                        <Text style={styles.studentName} numberOfLines={1}>
                                            {student.student_name}
                                        </Text>
                                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(student.status) + '20' }]}>
                                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(student.status) }]} />
                                            <Text style={[styles.statusText, { color: getStatusColor(student.status) }]}>
                                                {getStatusLabel(student.status)}
                                            </Text>
                                        </View>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={24} color={colors.zinc500} />
                                </View>

                                <View style={styles.metricsRow}>
                                    <View style={styles.metricItem}>
                                        <MaterialIcons name="looks-one" size={18} color="#3B82F6" />
                                        <Text style={styles.metricLabel}>AV1</Text>
                                        <Text style={[styles.metricValue, { color: '#3B82F6' }]}>
                                            {student.av1 !== null ? student.av1.toFixed(1) : '-'}
                                        </Text>
                                    </View>
                                    <View style={styles.metricDivider} />
                                    <View style={styles.metricItem}>
                                        <MaterialIcons name="looks-two" size={18} color="#10b981" />
                                        <Text style={styles.metricLabel}>AV2</Text>
                                        <Text style={[styles.metricValue, { color: '#10b981' }]}>
                                            {student.av2 !== null ? student.av2.toFixed(1) : '-'}
                                        </Text>
                                    </View>
                                    <View style={styles.metricDivider} />
                                    <View style={styles.metricItem}>
                                        <MaterialIcons name="grade" size={18} color="#f59e0b" />
                                        <Text style={styles.metricLabel}>Média</Text>
                                        <Text style={[styles.metricValue, { color: '#f59e0b' }]}>
                                            {student.average !== null ? student.average.toFixed(1) : '-'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                {student.average !== null && (
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressBar}>
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        width: `${(student.average / 10) * 100}%`,
                                                        backgroundColor: getStatusColor(student.status)
                                                    }
                                                ]}
                                            />
                                        </View>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
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
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc800,
    },
    backButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -12,
    },
    headerTextContainer: {
        flex: 1,
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
        color: colors.zinc400,
    },
    placeholder: {
        width: 48,
        height: 48,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing['3xl'],
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: spacing.base,
        gap: spacing.sm,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        marginTop: 4,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.base,
        gap: spacing.sm,
        marginBottom: spacing.base,
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    filterChipActive: {
        backgroundColor: colors.primaryOpacity20,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    filterChipTextActive: {
        color: colors.primary,
    },
    studentsSection: {
        paddingHorizontal: spacing.base,
    },
    sectionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: spacing.md,
    },
    studentCard: {
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.zinc800,
    },
    studentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.zinc700,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    avatarText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
    },
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
    },
    metricItem: {
        alignItems: 'center',
        gap: 2,
    },
    metricLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc500,
    },
    metricValue: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    metricDivider: {
        width: 1,
        height: 32,
        backgroundColor: colors.zinc800,
    },
    progressContainer: {
        marginTop: spacing.sm,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.zinc800,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
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
        color: colors.zinc400,
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
});
