import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface RankingStudent {
    position: number;
    student_name: string;
    points: number;
    answered: number;
    total: number;
}

interface Props {
    data: {
        title?: string;
        ranking: RankingStudent[];
        total_students: number;
    };
}

export default function LiveRankingSlide({ data }: Props) {
    const { title = '🏆 Ranking ao Vivo', ranking, total_students } = data;

    const getMedalIcon = (position: number) => {
        switch (position) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return null;
        }
    };

    const getPositionColor = (position: number) => {
        switch (position) {
            case 1: return '#FFD700'; // Ouro
            case 2: return '#C0C0C0'; // Prata
            case 3: return '#CD7F32'; // Bronze
            default: return colors.primary;
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                    {total_students} {total_students === 1 ? 'aluno participando' : 'alunos participando'}
                </Text>
            </View>

            {/* Ranking List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.rankingList}
                showsVerticalScrollIndicator={false}
            >
                {ranking.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="hourglass-empty" size={64} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.emptyText}>Aguardando respostas...</Text>
                    </View>
                ) : (
                    ranking.map((student, index) => (
                        <View
                            key={`${student.position}-${student.student_name}`}
                            style={[
                                styles.rankingItem,
                                index < 3 && styles.topThreeItem
                            ]}
                        >
                            {/* Position */}
                            <View style={[
                                styles.positionBadge,
                                { backgroundColor: getPositionColor(student.position) }
                            ]}>
                                {getMedalIcon(student.position) ? (
                                    <Text style={styles.medalEmoji}>{getMedalIcon(student.position)}</Text>
                                ) : (
                                    <Text style={styles.positionText}>{student.position}º</Text>
                                )}
                            </View>

                            {/* Student Info */}
                            <View style={styles.studentInfo}>
                                <Text style={styles.studentName} numberOfLines={1}>
                                    {student.student_name}
                                </Text>

                                {/* Progress Bar */}
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressBar}>
                                        <View
                                            style={[
                                                styles.progressFill,
                                                {
                                                    width: `${(student.answered / student.total) * 100}%`,
                                                    backgroundColor: getPositionColor(student.position)
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.progressText}>
                                        {student.answered}/{student.total}
                                    </Text>
                                </View>
                            </View>

                            {/* Points */}
                            <View style={styles.pointsContainer}>
                                <Text style={styles.pointsValue}>{student.points}</Text>
                                <Text style={styles.pointsLabel}>pts</Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>AO VIVO</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: typography.fontSize['4xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.sm,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: typography.fontSize.lg,
        color: 'rgba(255,255,255,0.8)',
    },
    scrollView: {
        flex: 1,
    },
    rankingList: {
        paddingHorizontal: spacing.md,
        gap: spacing.md,
    },
    rankingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        gap: spacing.md,
    },
    topThreeItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    positionBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    medalEmoji: {
        fontSize: 32,
    },
    positionText: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    studentInfo: {
        flex: 1,
        gap: spacing.xs,
    },
    studentName: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    progressBar: {
        flex: 1,
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressText: {
        fontSize: typography.fontSize.sm,
        color: 'rgba(255,255,255,0.7)',
        minWidth: 50,
    },
    pointsContainer: {
        alignItems: 'center',
        minWidth: 80,
    },
    pointsValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    pointsLabel: {
        fontSize: typography.fontSize.xs,
        color: 'rgba(255,255,255,0.7)',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing['2xl'],
    },
    emptyText: {
        fontSize: typography.fontSize.xl,
        color: 'rgba(255,255,255,0.5)',
        marginTop: spacing.md,
    },
    footer: {
        marginTop: spacing.lg,
        alignItems: 'center',
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: '#ef4444',
        gap: spacing.sm,
    },
    liveDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },
    liveText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: '#ef4444',
        letterSpacing: 1,
    },
});
