import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface PerformanceDistributionChartProps {
    distribution: {
        excellent: number;
        good: number;
        average: number;
        below_average: number;
    };
    total: number;
}

export default function PerformanceDistributionChart({ distribution, total }: PerformanceDistributionChartProps) {
    const categories = [
        { key: 'excellent', label: 'Excelente', color: '#10b981', icon: 'emoji-events', range: '90-100%' },
        { key: 'good', label: 'Bom', color: '#3B82F6', icon: 'thumb-up', range: '70-89%' },
        { key: 'average', label: 'Médio', color: '#f59e0b', icon: 'trending-flat', range: '50-69%' },
        { key: 'below_average', label: 'Abaixo da Média', color: '#ef4444', icon: 'trending-down', range: '<50%' },
    ];

    const getPercentage = (count: number) => {
        return total > 0 ? Math.round((count / total) * 100) : 0;
    };

    const getBarWidth = (count: number) => {
        return total > 0 ? `${(count / total) * 100}%` : '0%';
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="bar-chart" size={24} color={colors.primary} />
                <Text style={styles.title}>Distribuição de Desempenho</Text>
            </View>

            <View style={styles.chartContainer}>
                {categories.map((category) => {
                    const count = distribution[category.key as keyof typeof distribution];
                    const percentage = getPercentage(count);

                    return (
                        <View key={category.key} style={styles.barRow}>
                            <View style={styles.labelContainer}>
                                <MaterialIcons name={category.icon as any} size={20} color={category.color} />
                                <View style={styles.labelTextContainer}>
                                    <Text style={styles.labelText}>{category.label}</Text>
                                    <Text style={styles.rangeText}>{category.range}</Text>
                                </View>
                            </View>

                            <View style={styles.barContainer}>
                                <View
                                    style={[
                                        styles.bar,
                                        { width: getBarWidth(count) as any },
                                        { backgroundColor: category.color }
                                    ]}
                                />
                            </View>

                            <View style={styles.valueContainer}>
                                <Text style={styles.countText}>{count}</Text>
                                <Text style={styles.percentageText}>({percentage}%)</Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Total de respostas: {total}</Text>
            </View>
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
    chartContainer: {
        gap: spacing.md,
    },
    barRow: {
        gap: spacing.sm,
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: 4,
    },
    labelTextContainer: {
        flex: 1,
    },
    labelText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
    },
    rangeText: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
    },
    barContainer: {
        height: 32,
        backgroundColor: colors.slate200,
        borderRadius: borderRadius.default,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: borderRadius.default,
        minWidth: 2,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    countText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
    },
    percentageText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
    },
    footer: {
        marginTop: spacing.base,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
    },
    footerText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
        textAlign: 'center',
    },
});
