import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface QuestionDifficultyChartProps {
    questionAnalytics: Array<{
        question_id: number;
        question_text: string;
        correct_count: number;
        incorrect_count: number;
        correct_rate: number;
        difficulty_level: 'easy' | 'medium' | 'hard';
        most_common_wrong_answer: number | null;
    }>;
}

export default function QuestionDifficultyChart({ questionAnalytics }: QuestionDifficultyChartProps) {
    const getDifficultyColor = (level: string) => {
        switch (level) {
            case 'easy': return '#10b981';
            case 'medium': return '#f59e0b';
            case 'hard': return '#ef4444';
            default: return colors.slate500;
        }
    };

    const getDifficultyIcon = (level: string) => {
        switch (level) {
            case 'easy': return 'sentiment-very-satisfied';
            case 'medium': return 'sentiment-neutral';
            case 'hard': return 'sentiment-very-dissatisfied';
            default: return 'help';
        }
    };

    const getDifficultyLabel = (level: string) => {
        switch (level) {
            case 'easy': return 'Fácil';
            case 'medium': return 'Média';
            case 'hard': return 'Difícil';
            default: return 'N/A';
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="quiz" size={24} color={colors.primary} />
                <Text style={styles.title}>Análise de Dificuldade das Questões</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {questionAnalytics.map((question, index) => {
                    const total = question.correct_count + question.incorrect_count;
                    const correctPercentage = total > 0 ? (question.correct_count / total) * 100 : 0;
                    const incorrectPercentage = total > 0 ? (question.incorrect_count / total) * 100 : 0;

                    return (
                        <View key={question.question_id} style={styles.questionCard}>
                            <View style={styles.questionHeader}>
                                <Text style={styles.questionNumber}>Q{index + 1}</Text>
                                <View style={[
                                    styles.difficultyBadge,
                                    { backgroundColor: getDifficultyColor(question.difficulty_level) + '20' }
                                ]}>
                                    <MaterialIcons
                                        name={getDifficultyIcon(question.difficulty_level) as any}
                                        size={16}
                                        color={getDifficultyColor(question.difficulty_level)}
                                    />
                                    <Text style={[
                                        styles.difficultyText,
                                        { color: getDifficultyColor(question.difficulty_level) }
                                    ]}>
                                        {getDifficultyLabel(question.difficulty_level)}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.questionText} numberOfLines={2}>
                                {question.question_text}
                            </Text>

                            <View style={styles.statsContainer}>
                                <View style={styles.statRow}>
                                    <MaterialIcons name="check-circle" size={16} color="#10b981" />
                                    <Text style={styles.statLabel}>Acertos:</Text>
                                    <Text style={[styles.statValue, { color: '#10b981' }]}>
                                        {question.correct_count}
                                    </Text>
                                </View>

                                <View style={styles.statRow}>
                                    <MaterialIcons name="cancel" size={16} color="#ef4444" />
                                    <Text style={styles.statLabel}>Erros:</Text>
                                    <Text style={[styles.statValue, { color: '#ef4444' }]}>
                                        {question.incorrect_count}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.progressBarContainer}>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${correctPercentage}%`,
                                                backgroundColor: '#10b981'
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.percentageText}>
                                    {question.correct_rate.toFixed(1)}% de acerto
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.slate200,
        marginBottom: spacing.base,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.base,
    },
    title: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
    },
    scrollContent: {
        gap: spacing.sm,
        paddingRight: spacing.base,
    },
    questionCard: {
        width: 280,
        backgroundColor: colors.slate100,
        borderRadius: borderRadius.default,
        padding: spacing.base,
        gap: spacing.sm,
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    questionNumber: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
    },
    difficultyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    difficultyText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    questionText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
        lineHeight: 18,
    },
    statsContainer: {
        gap: spacing.sm,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
        flex: 1,
    },
    statValue: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    progressBarContainer: {
        gap: 4,
    },
    progressBar: {
        height: 6,
        backgroundColor: colors.slate200,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    percentageText: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
        textAlign: 'center',
    },
});
