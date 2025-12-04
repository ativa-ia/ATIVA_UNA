import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface StudentPerformance {
    id: string;
    name: string;
    avatar: string;
    grade: number;
    attendance: number;
    activitiesCompleted: number;
    totalActivities: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
}

/**
 * ClassReportScreen - Relatório da Turma (Professor)
 * Tela com desempenho individual de cada aluno
 */
export default function ClassReportScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';

    const [filter, setFilter] = useState<'all' | 'excellent' | 'warning'>('all');

    // Mock data - será substituído por dados reais do backend
    const classStats = {
        totalStudents: 35,
        averageGrade: 7.2,
        averageAttendance: 85,
        atRiskStudents: 5,
    };

    const students: StudentPerformance[] = [
        { id: '1', name: 'Ana Carolina Silva', avatar: 'A', grade: 9.2, attendance: 95, activitiesCompleted: 12, totalActivities: 12, status: 'excellent' },
        { id: '2', name: 'Bruno Costa Santos', avatar: 'B', grade: 8.5, attendance: 90, activitiesCompleted: 11, totalActivities: 12, status: 'excellent' },
        { id: '3', name: 'Carlos Eduardo Mendes', avatar: 'C', grade: 7.8, attendance: 88, activitiesCompleted: 10, totalActivities: 12, status: 'good' },
        { id: '4', name: 'Diana Oliveira Lima', avatar: 'D', grade: 7.0, attendance: 82, activitiesCompleted: 9, totalActivities: 12, status: 'good' },
        { id: '5', name: 'Eduardo Santos Filho', avatar: 'E', grade: 6.5, attendance: 75, activitiesCompleted: 8, totalActivities: 12, status: 'warning' },
        { id: '6', name: 'Fernanda Almeida', avatar: 'F', grade: 5.8, attendance: 70, activitiesCompleted: 7, totalActivities: 12, status: 'warning' },
        { id: '7', name: 'Gabriel Rocha', avatar: 'G', grade: 4.5, attendance: 60, activitiesCompleted: 5, totalActivities: 12, status: 'critical' },
        { id: '8', name: 'Helena Martins', avatar: 'H', grade: 8.8, attendance: 92, activitiesCompleted: 12, totalActivities: 12, status: 'excellent' },
        { id: '9', name: 'Igor Pereira', avatar: 'I', grade: 7.5, attendance: 85, activitiesCompleted: 10, totalActivities: 12, status: 'good' },
        { id: '10', name: 'Julia Fernandes', avatar: 'J', grade: 3.8, attendance: 55, activitiesCompleted: 4, totalActivities: 12, status: 'critical' },
    ];

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
            default: return '';
        }
    };

    const filteredStudents = students.filter(student => {
        if (filter === 'all') return true;
        if (filter === 'excellent') return student.status === 'excellent' || student.status === 'good';
        if (filter === 'warning') return student.status === 'warning' || student.status === 'critical';
        return true;
    });

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
                            <Text style={styles.statValue}>{classStats.totalStudents}</Text>
                            <Text style={styles.statLabel}>Alunos</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#3B82F6' }]}>
                                {classStats.averageGrade.toFixed(1)}
                            </Text>
                            <Text style={styles.statLabel}>Média Geral</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#10b981' }]}>
                                {classStats.averageAttendance}%
                            </Text>
                            <Text style={styles.statLabel}>Frequência</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#ef4444' }]}>
                                {classStats.atRiskStudents}
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
                                key={student.id}
                                style={styles.studentCard}
                                activeOpacity={0.7}
                            >
                                <View style={styles.studentHeader}>
                                    <View style={[styles.avatar, { borderColor: getStatusColor(student.status) }]}>
                                        <Text style={styles.avatarText}>{student.avatar}</Text>
                                    </View>
                                    <View style={styles.studentInfo}>
                                        <Text style={styles.studentName} numberOfLines={1}>
                                            {student.name}
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
                                        <MaterialIcons name="grade" size={18} color="#3B82F6" />
                                        <Text style={styles.metricLabel}>Nota</Text>
                                        <Text style={[styles.metricValue, { color: '#3B82F6' }]}>
                                            {student.grade.toFixed(1)}
                                        </Text>
                                    </View>
                                    <View style={styles.metricDivider} />
                                    <View style={styles.metricItem}>
                                        <MaterialIcons name="event-available" size={18} color="#10b981" />
                                        <Text style={styles.metricLabel}>Frequência</Text>
                                        <Text style={[styles.metricValue, { color: '#10b981' }]}>
                                            {student.attendance}%
                                        </Text>
                                    </View>
                                    <View style={styles.metricDivider} />
                                    <View style={styles.metricItem}>
                                        <MaterialIcons name="assignment-turned-in" size={18} color="#f59e0b" />
                                        <Text style={styles.metricLabel}>Atividades</Text>
                                        <Text style={[styles.metricValue, { color: '#f59e0b' }]}>
                                            {student.activitiesCompleted}/{student.totalActivities}
                                        </Text>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressBar}>
                                        <View
                                            style={[
                                                styles.progressFill,
                                                {
                                                    width: `${(student.grade / 10) * 100}%`,
                                                    backgroundColor: getStatusColor(student.status)
                                                }
                                            ]}
                                        />
                                    </View>
                                </View>
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
});
