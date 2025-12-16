import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getMyGrades, StudentGradesData } from '@/services/api';

/**
 * GradesScreen - Notas (Aluno)
 * Tela para visualização de notas do aluno
 */
export default function GradesScreen() {
    const [activeNavId, setActiveNavId] = useState('grades');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gradesData, setGradesData] = useState<StudentGradesData | null>(null);

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'materials', label: 'Materiais', iconName: 'folder-open' },
        { id: 'calendar', label: 'Calendário', iconName: 'calendar-today' },
        { id: 'grades', label: 'Notas', iconName: 'school' },
    ];

    useEffect(() => {
        loadGrades();
    }, []);

    const loadGrades = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getMyGrades();
            setGradesData(data);
        } catch (err) {
            console.error('Erro ao carregar notas:', err);
            setError('Erro ao carregar notas');
        } finally {
            setLoading(false);
        }
    };

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                router.push('./dashboard');
                break;
            case 'materials':
                router.push('/(student)/materials');
                break;
            case 'calendar':
                router.push('./calendar');
                break;
            case 'grades':
                // Already on grades
                break;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return '#10b981';
            case 'warning': return '#f59e0b';
            case 'failed': return '#ef4444';
            default: return colors.zinc500;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved': return 'Aprovado';
            case 'warning': return 'Atenção';
            case 'failed': return 'Reprovado';
            case 'pending': return 'Pendente';
            default: return '';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return 'check-circle';
            case 'warning': return 'warning';
            case 'failed': return 'cancel';
            default: return 'schedule';
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Minhas Notas</Text>
                        <View style={styles.placeholder} />
                    </View>

                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Carregando notas...</Text>
                    </View>

                    <BottomNav
                        items={navItems}
                        activeId={activeNavId}
                        onItemPress={handleNavPress}
                        darkMode
                    />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !gradesData) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Minhas Notas</Text>
                        <View style={styles.placeholder} />
                    </View>

                    <View style={styles.errorContainer}>
                        <MaterialIcons name="error-outline" size={64} color="#ef4444" />
                        <Text style={styles.errorText}>{error || 'Erro ao carregar notas'}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={loadGrades}>
                            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
                        </TouchableOpacity>
                    </View>

                    <BottomNav
                        items={navItems}
                        activeId={activeNavId}
                        onItemPress={handleNavPress}
                        darkMode
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Minhas Notas</Text>
                    <View style={styles.placeholder} />
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Summary Cards */}
                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryCard}>
                            <MaterialIcons name="school" size={32} color={colors.primary} />
                            <Text style={styles.summaryValue}>
                                {gradesData.general_average.toFixed(1)}
                            </Text>
                            <Text style={styles.summaryLabel}>Média Geral</Text>
                        </View>
                        <View style={styles.summaryCard}>
                            <MaterialIcons name="book" size={32} color="#10b981" />
                            <Text style={styles.summaryValue}>
                                {gradesData.total_subjects}
                            </Text>
                            <Text style={styles.summaryLabel}>Disciplinas</Text>
                        </View>
                    </View>

                    {/* Subjects List */}
                    <View style={styles.subjectsContainer}>
                        <Text style={styles.sectionTitle}>
                            Notas por Disciplina
                        </Text>

                        {gradesData.subjects.map((subject) => (
                            <View key={subject.subject_id} style={styles.subjectCard}>
                                {/* Subject Header */}
                                <View style={styles.subjectHeader}>
                                    <View style={styles.subjectInfo}>
                                        <Text style={styles.subjectName} numberOfLines={1}>
                                            {subject.subject_name}
                                        </Text>
                                        <Text style={styles.subjectCode}>
                                            {subject.subject_code}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subject.status) + '20' }]}>
                                        <MaterialIcons
                                            name={getStatusIcon(subject.status)}
                                            size={16}
                                            color={getStatusColor(subject.status)}
                                        />
                                        <Text style={[styles.statusText, { color: getStatusColor(subject.status) }]}>
                                            {getStatusLabel(subject.status)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Grades */}
                                <View style={styles.gradesRow}>
                                    <View style={styles.gradeItem}>
                                        <Text style={styles.gradeLabel}>AV1</Text>
                                        <Text style={[styles.gradeValue, { color: '#3B82F6' }]}>
                                            {subject.av1 !== null ? subject.av1.toFixed(1) : '-'}
                                        </Text>
                                    </View>
                                    <View style={styles.gradeDivider} />
                                    <View style={styles.gradeItem}>
                                        <Text style={styles.gradeLabel}>AV2</Text>
                                        <Text style={[styles.gradeValue, { color: '#10b981' }]}>
                                            {subject.av2 !== null ? subject.av2.toFixed(1) : '-'}
                                        </Text>
                                    </View>
                                    <View style={styles.gradeDivider} />
                                    <View style={styles.gradeItem}>
                                        <Text style={styles.gradeLabel}>Média</Text>
                                        <Text style={[styles.gradeValue, { color: getStatusColor(subject.status) }]}>
                                            {subject.average !== null ? subject.average.toFixed(1) : '-'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                {subject.average !== null && (
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressBar}>
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        width: `${(subject.average / 10) * 100}%`,
                                                        backgroundColor: getStatusColor(subject.status)
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.progressText}>
                                            {((subject.average / 10) * 100).toFixed(0)}%
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </ScrollView>

                {/* Bottom Navigation */}
                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={handleNavPress}
                    darkMode
                />
            </View>
        </SafeAreaView>
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
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    placeholder: {
        width: 40,
        height: 40,
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
    summaryContainer: {
        flexDirection: 'row',
        gap: spacing.base,
        marginBottom: spacing.lg,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: colors.zinc900,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.zinc800,
    },
    summaryValue: {
        fontSize: 32,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginTop: spacing.xs,
    },
    summaryLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        marginTop: spacing.xxs,
    },
    subjectsContainer: {
        gap: spacing.base,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: spacing.sm,
    },
    subjectCard: {
        backgroundColor: colors.zinc900,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.zinc800,
        gap: spacing.sm,
    },
    subjectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    subjectInfo: {
        flex: 1,
        marginRight: spacing.sm,
    },
    subjectName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 2,
    },
    subjectCode: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc500,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    gradesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.zinc800 + '40',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
    },
    gradeItem: {
        flex: 1,
        alignItems: 'center',
    },
    gradeLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        marginBottom: 4,
    },
    gradeValue: {
        fontSize: 24,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    gradeDivider: {
        width: 1,
        height: 32,
        backgroundColor: colors.zinc700,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: colors.zinc800,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        minWidth: 40,
        textAlign: 'right',
    },
});
