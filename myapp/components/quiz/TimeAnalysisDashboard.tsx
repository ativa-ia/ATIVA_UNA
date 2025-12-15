import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface TimeAnalysisDashboardProps {
    timeAnalytics: {
        average_completion_time: number;
        fastest_completion: number;
        slowest_completion: number;
        median_time: number;
    };
}

export default function TimeAnalysisDashboard({ timeAnalytics }: TimeAnalysisDashboardProps) {
    const formatTime = (seconds: number) => {
        if (seconds === 0) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const metrics = [
        {
            label: 'Tempo Médio',
            value: timeAnalytics.average_completion_time,
            icon: 'access-time',
            color: colors.primary,
        },
        {
            label: 'Mediana',
            value: timeAnalytics.median_time,
            icon: 'timeline',
            color: '#3B82F6',
        },
        {
            label: 'Mais Rápido',
            value: timeAnalytics.fastest_completion,
            icon: 'flash-on',
            color: '#10b981',
        },
        {
            label: 'Mais Lento',
            value: timeAnalytics.slowest_completion,
            icon: 'hourglass-empty',
            color: '#f59e0b',
        },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="schedule" size={24} color={colors.primary} />
                <Text style={styles.title}>Análise de Tempo</Text>
            </View>

            <View style={styles.metricsGrid}>
                {metrics.map((metric, index) => (
                    <View key={index} style={styles.metricCard}>
                        <MaterialIcons name={metric.icon as any} size={28} color={metric.color} />
                        <Text style={styles.metricLabel}>{metric.label}</Text>
                        <Text style={[styles.metricValue, { color: metric.color }]}>
                            {formatTime(metric.value)}
                        </Text>
                    </View>
                ))}
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
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    metricCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: colors.slate100,
        borderRadius: borderRadius.default,
        padding: spacing.base,
        alignItems: 'center',
        gap: spacing.sm,
    },
    metricLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
        textAlign: 'center',
    },
    metricValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
});
