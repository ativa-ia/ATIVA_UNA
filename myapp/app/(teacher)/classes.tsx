import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

/**
 * ClassesScreen - Desempenho da Turma (Professor)
 * Tela de monitoramento de desempenho dos alunos
 */

interface Student {
    id: string;
    name: string;
    imageUrl: string;
    participation: 'high' | 'medium' | 'low';
    grade: number;
}

export default function ClassesScreen() {
    const [searchQuery, setSearchQuery] = useState('');

    // Mock data
    const students: Student[] = [
        {
            id: '1',
            name: 'Carlos Andrade',
            imageUrl: 'https://i.pravatar.cc/150?img=11',
            participation: 'high',
            grade: 9.2,
        },
        {
            id: '2',
            name: 'Beatriz Lima',
            imageUrl: 'https://i.pravatar.cc/150?img=5',
            participation: 'medium',
            grade: 7.8,
        },
        {
            id: '3',
            name: 'Daniel Costa',
            imageUrl: 'https://i.pravatar.cc/150?img=12',
            participation: 'high',
            grade: 8.9,
        },
    ];

    const getParticipationText = (participation: string) => {
        switch (participation) {
            case 'high':
                return 'Participação: Alta';
            case 'medium':
                return 'Participação: Média';
            case 'low':
                return 'Participação: Baixa';
            default:
                return '';
        }
    };

    const getParticipationStyle = (participation: string) => {
        switch (participation) {
            case 'high':
                return styles.participationHigh;
            case 'medium':
                return styles.participationMedium;
            case 'low':
                return styles.participationLow;
            default:
                return {};
        }
    };

    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back-ios-new" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Desempenho da Turma</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Filter Chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipsContainer}
                    >
                        <TouchableOpacity style={styles.chip}>
                            <MaterialIcons name="school" size={20} color={colors.zinc300} />
                            <Text style={styles.chipText}>Cálculo I - Turma A</Text>
                            <MaterialIcons name="expand-more" size={20} color={colors.zinc300} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chip}>
                            <MaterialIcons name="calendar-today" size={20} color={colors.zinc300} />
                            <Text style={styles.chipText}>Últimos 30 dias</Text>
                            <MaterialIcons name="expand-more" size={20} color={colors.zinc300} />
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Stats Cards */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statCard}>
                            <Text style={styles.statLabel}>Média da Turma</Text>
                            <Text style={styles.statValue}>8.5</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statLabel}>Taxa de Participação</Text>
                            <Text style={styles.statValue}>92%</Text>
                        </View>
                    </View>

                    {/* Progress Chart */}
                    <View style={styles.chartCard}>
                        <Text style={styles.chartTitle}>Progresso da Média da Turma</Text>
                        <View style={styles.chartHeader}>
                            <Text style={styles.chartValue}>8.5</Text>
                            <Text style={styles.chartChange}>+5.2%</Text>
                        </View>
                        <Text style={styles.chartSubtitle}>Últimos 30 dias</Text>

                        {/* SVG Chart */}
                        <View style={styles.chartContainer}>
                            <Svg width="100%" height={130} viewBox="0 0 472 150" preserveAspectRatio="none">
                                <Defs>
                                    <LinearGradient id="chartGradient" x1="236" y1="1" x2="236" y2="149" gradientUnits="userSpaceOnUse">
                                        <Stop stopColor={colors.primary} stopOpacity={0.2} />
                                        <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
                                    </LinearGradient>
                                </Defs>
                                <Path
                                    d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25V149H0V109Z"
                                    fill="url(#chartGradient)"
                                />
                                <Path
                                    d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25"
                                    stroke={colors.primary}
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                    fill="none"
                                />
                            </Svg>
                        </View>

                        {/* Chart Labels */}
                        <View style={styles.chartLabels}>
                            <Text style={styles.chartLabel}>Sem 1</Text>
                            <Text style={styles.chartLabel}>Sem 2</Text>
                            <Text style={styles.chartLabel}>Sem 3</Text>
                            <Text style={styles.chartLabel}>Sem 4</Text>
                        </View>
                    </View>

                    {/* Students Section */}
                    <View style={styles.studentsSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Alunos</Text>
                            <TouchableOpacity>
                                <Text style={styles.viewAllText}>Ver todos</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <MaterialIcons name="search" size={24} color={colors.zinc400} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar aluno específico"
                                placeholderTextColor={colors.zinc400}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        {/* Student List */}
                        <View style={styles.studentList}>
                            {filteredStudents.map((student) => (
                                <TouchableOpacity key={student.id} style={styles.studentCard}>
                                    <Image
                                        source={{ uri: student.imageUrl }}
                                        style={styles.studentImage}
                                    />
                                    <View style={styles.studentInfo}>
                                        <Text style={styles.studentName}>{student.name}</Text>
                                        <Text style={[styles.studentParticipation, getParticipationStyle(student.participation)]}>
                                            {getParticipationText(student.participation)}
                                        </Text>
                                    </View>
                                    <View style={styles.studentGradeContainer}>
                                        <Text style={styles.studentGrade}>{student.grade.toFixed(1)}</Text>
                                        <MaterialIcons name="chevron-right" size={24} color={colors.zinc500} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>
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
    },
    backButton: {
        width: 48,
        height: 48,
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
        width: 48,
        height: 48,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing['3xl'],
    },
    chipsContainer: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        gap: spacing.md,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        paddingHorizontal: spacing.base,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
        marginRight: spacing.md,
    },
    chipText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.base,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.base,
    },
    statCard: {
        flex: 1,
        minWidth: 158,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.zinc700,
        padding: spacing.base,
        gap: spacing.sm,
    },
    statLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    statValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    chartCard: {
        marginHorizontal: spacing.base,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.zinc700,
        padding: spacing.base,
    },
    chartTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    chartHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    chartValue: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    chartChange: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: '#4ade80', // Green
    },
    chartSubtitle: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    chartContainer: {
        minHeight: 160,
        paddingVertical: spacing.base,
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    chartLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        letterSpacing: 0.5,
    },
    studentsSection: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.xl,
        gap: spacing.base,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    viewAllText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        backgroundColor: 'rgba(39, 39, 42, 0.8)',
        borderRadius: borderRadius.xl,
        paddingHorizontal: spacing.base,
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    studentList: {
        gap: spacing.md,
    },
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.zinc700,
        padding: spacing.md,
        gap: spacing.base,
    },
    studentImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    studentParticipation: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
    },
    participationHigh: {
        color: colors.zinc400,
    },
    participationMedium: {
        color: '#eab308', // Yellow
    },
    participationLow: {
        color: '#ef4444', // Red
    },
    studentGradeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    studentGrade: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
});
