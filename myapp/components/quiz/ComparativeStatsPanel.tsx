import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface ComparativeStatsPanelProps {
    stats: {
        class_median: number;
        class_mode: number;
        standard_deviation: number;
        participation_rate: number;
    };
}

export default function ComparativeStatsPanel({ stats }: ComparativeStatsPanelProps) {
    const metrics = [
        {
            label: 'Mediana da Turma',
            value: `${stats.class_median.toFixed(1)}%`,
            icon: 'trending-up',
            color: colors.primary,
            description: 'Valor central das notas',
        },
        {
            label: 'Moda',
            value: `${stats.class_mode}%`,
            icon: 'bar-chart',
            color: '#3B82F6',
            description: 'Nota mais frequente',
        },
        {
            label: 'Desvio Padrão',
            value: stats.standard_deviation.toFixed(1),
            icon: 'show-chart',
            color: '#f59e0b',
            description: 'Dispersão das notas',
        },
        {
            label: 'Taxa de Participação',
            value: `${stats.participation_rate.toFixed(1)}%`,
            icon: 'people',
            color: '#10b981',
            description: 'Alunos que responderam',
        },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="analytics" size={24} color={colors.primary} />
                <Text style={styles.title}>Estatísticas Comparativas</Text>
            </View>

            <View style={styles.statsGrid}>
                {metrics.map((metric, index) => (
                    <View key={index} style={styles.statCard}>
                        <View style={styles.statHeader}>
                            <MaterialIcons name={metric.icon as any} size={24} color={metric.color} />
                            <View style={styles.statTextContainer}>
                                <Text style={styles.statLabel}>{metric.label}</Text>
                                <Text style={styles.statDescription}>{metric.description}</Text>
                            </View>
                        </View>
                        <Text style={[styles.statValue, { color: metric.color }]}>
                            {metric.value}
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
    statsGrid: {
        gap: spacing.sm,
    },
    statCard: {
        backgroundColor: colors.slate100,
        borderRadius: borderRadius.default,
        padding: spacing.base,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    statTextContainer: {
        flex: 1,
    },
    statLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
    },
    statDescription: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
        marginTop: 2,
    },
    statValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
});
