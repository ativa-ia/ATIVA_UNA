import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView } from 'react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { MaterialIcons } from '@expo/vector-icons';

interface RankingStudent {
    position: number;
    student_id: number;
    student_name: string;
    points: number;
    score: number;
    total: number;
    percentage: number;
    time_taken: number;
}

interface RaceVisualizationProps {
    ranking: RankingStudent[];
    enrolledCount: number;
    maxPoints?: number;
}

export default function RaceVisualization({
    ranking,
    enrolledCount,
    maxPoints
}: RaceVisualizationProps) {
    // Calcular pontuação máxima se não fornecida
    const maxScore = maxPoints || (ranking.length > 0 ? ranking[0].points : 100);

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header com estatísticas */}
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <MaterialIcons name="people" size={24} color="#8b5cf6" />
                    <Text style={styles.statNumber}>{ranking.length}</Text>
                    <Text style={styles.statLabel}>Responderam</Text>
                </View>
                <View style={styles.statBox}>
                    <MaterialIcons name="hourglass-empty" size={24} color="#f59e0b" />
                    <Text style={styles.statNumber}>{enrolledCount - ranking.length}</Text>
                    <Text style={styles.statLabel}>Aguardando</Text>
                </View>
            </View>

            {/* Pistas de corrida */}
            <View style={styles.raceContainer}>
                {ranking.map((student, index) => (
                    <RaceTrack
                        key={student.student_id}
                        student={student}
                        maxPoints={maxScore}
                        isTop3={index < 3}
                    />
                ))}

                {/* Alunos aguardando */}
                {enrolledCount > ranking.length && (
                    <View style={styles.waitingSection}>
                        <Text style={styles.waitingTitle}>
                            ⏳ Aguardando respostas...
                        </Text>
                        <Text style={styles.waitingCount}>
                            {enrolledCount - ranking.length} aluno(s)
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

interface RaceTrackProps {
    student: RankingStudent;
    maxPoints: number;
    isTop3: boolean;
}

function RaceTrack({ student, maxPoints, isTop3 }: RaceTrackProps) {
    const progressAnim = useRef(new Animated.Value(0)).current;
    const progress = (student.points / maxPoints) * 100;

    useEffect(() => {
        Animated.spring(progressAnim, {
            toValue: progress,
            useNativeDriver: false,
            tension: 40,
            friction: 8,
        }).start();
    }, [progress]);

    const getMedalColor = (position: number) => {
        switch (position) {
            case 1: return '#FFD700'; // Ouro
            case 2: return '#C0C0C0'; // Prata
            case 3: return '#CD7F32'; // Bronze
            default: return colors.slate400;
        }
    };

    const getTrackColor = (position: number) => {
        // Keep white background for all tracks in light mode to ensure consistency
        // Highlight top 3 with very subtle border or shadow instead (handled in styles)
        return colors.white;
    };

    return (
        <View style={styles.track}>
            {/* Posição e Avatar */}
            <View style={styles.trackLeft}>
                <View style={[styles.positionBadge, { backgroundColor: getMedalColor(student.position) }]}>
                    {student.position <= 3 ? (
                        <MaterialIcons
                            name="emoji-events"
                            size={20}
                            color={colors.white}
                        />
                    ) : (
                        <Text style={styles.positionText}>{student.position}</Text>
                    )}
                </View>
                <View style={styles.studentInfo}>
                    <Text style={styles.studentName} numberOfLines={1}>
                        {student.student_name}
                    </Text>
                    <Text style={styles.studentStats}>
                        {student.score}/{student.total} • {student.percentage.toFixed(0)}%
                    </Text>
                </View>
            </View>

            {/* Barra de progresso animada */}
            <View style={styles.trackRight}>
                <View style={styles.progressBar}>
                    <Animated.View
                        style={[
                            styles.progressFill,
                            {
                                width: progressAnim.interpolate({
                                    inputRange: [0, 100],
                                    outputRange: ['0%', '100%'],
                                }),
                                backgroundColor: isTop3 ? '#8b5cf6' : '#6366f1',
                            },
                        ]}
                    />
                </View>
                <Text style={styles.pointsText}>{student.points} pts</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    statBox: {
        flex: 1,
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    statNumber: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.primary,
        marginTop: spacing.xs,
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        marginTop: 4,
    },
    raceContainer: {
        gap: spacing.sm,
        paddingBottom: spacing.xl,
    },
    track: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        backgroundColor: colors.white,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    trackLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.md,
    },
    positionBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    positionText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
    },
    studentStats: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    trackRight: {
        width: 120,
        alignItems: 'flex-end',
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: colors.slate100,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 4,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    pointsText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.primary,
    },
    waitingSection: {
        padding: spacing.lg,
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderStyle: 'dashed',
        alignItems: 'center',
        marginTop: spacing.md,
    },
    waitingTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    waitingCount: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
    },
});
