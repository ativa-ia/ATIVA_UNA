import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

const screenWidth = Dimensions.get('window').width;

interface ScoreDistributionGraphProps {
    distribution: {
        ranges: Array<{
            min: number;
            max: number;
            count: number;
            percentage: number;
        }>;
    };
}

export default function ScoreDistributionGraph({ distribution }: ScoreDistributionGraphProps) {
    const chartData = {
        labels: distribution.ranges.map(r => `${r.min}-${r.max}`),
        datasets: [{
            data: distribution.ranges.map(r => r.count)
        }]
    };

    const maxCount = Math.max(...distribution.ranges.map(r => r.count), 1);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="insert-chart" size={24} color={colors.primary} />
                <Text style={styles.title}>Distribuição de Notas</Text>
            </View>

            <View style={styles.chartWrapper}>
                <BarChart
                    data={chartData}
                    width={screenWidth - (spacing.base * 4)}
                    height={220}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={{
                        backgroundColor: colors.white,
                        backgroundGradientFrom: colors.white,
                        backgroundGradientTo: colors.white,
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
                        style: {
                            borderRadius: borderRadius.lg,
                        },
                        propsForBackgroundLines: {
                            strokeDasharray: '',
                            stroke: colors.slate200,
                            strokeWidth: 1,
                        },
                    }}
                    style={{
                        borderRadius: borderRadius.lg,
                    }}
                    showValuesOnTopOfBars
                    fromZero
                />
            </View>

            <View style={styles.legend}>
                {distribution.ranges.map((range, index) => (
                    <View key={index} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                        <Text style={styles.legendText}>
                            {range.min}-{range.max}%: {range.count} ({range.percentage.toFixed(1)}%)
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
    chartWrapper: {
        alignItems: 'center',
        marginBottom: spacing.base,
    },
    legend: {
        gap: spacing.sm,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
    },
});
