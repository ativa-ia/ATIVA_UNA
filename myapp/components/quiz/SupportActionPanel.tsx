import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface SupportActionPanelProps {
    quizId: number;
    activityId: number;
    performanceDistribution: {
        critical: number;
        attention: number;
        good: number;
        excellent: number;
    };
}

export default function SupportActionPanel({
    quizId,
    activityId,
    performanceDistribution
}: SupportActionPanelProps) {
    const criticalCount = performanceDistribution.critical;
    const attentionCount = performanceDistribution.attention;
    const needsSupportCount = criticalCount + attentionCount;

    if (needsSupportCount === 0) {
        return null;
    }

    const getSeverityLevel = () => {
        if (criticalCount > 0) return 'critical';
        if (attentionCount > 0) return 'attention';
        return 'none';
    };

    const severity = getSeverityLevel();
    const severityColors = {
        critical: {
            bg: '#fee2e2',
            border: '#ef4444',
            icon: '#dc2626',
            text: '#991b1b'
        },
        attention: {
            bg: '#fef3c7',
            border: '#f59e0b',
            icon: '#d97706',
            text: '#92400e'
        },
        none: {
            bg: colors.slate100,
            border: colors.slate300,
            icon: colors.slate500,
            text: colors.slate700
        }
    };

    const currentColors = severityColors[severity];

    const handleNavigate = () => {
        router.push({
            pathname: '/(teacher)/support-students',
            params: {
                quizId: quizId.toString(),
                activityId: activityId.toString()
            }
        });
    };

    return (
        <View style={[styles.container, {
            backgroundColor: currentColors.bg,
            borderColor: currentColors.border
        }]}>
            <View style={styles.header}>
                <MaterialIcons
                    name={severity === 'critical' ? 'warning' : 'info'}
                    size={24}
                    color={currentColors.icon}
                />
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: currentColors.text }]}>
                        {severity === 'critical' ? 'Atenção Necessária!' : 'Oportunidade de Suporte'}
                    </Text>
                    <Text style={[styles.subtitle, { color: currentColors.text }]}>
                        {needsSupportCount} aluno{needsSupportCount > 1 ? 's' : ''} com desempenho abaixo de 70%
                    </Text>
                </View>
            </View>

            <View style={styles.details}>
                {criticalCount > 0 && (
                    <View style={styles.detailRow}>
                        <MaterialIcons name="error" size={16} color="#ef4444" />
                        <Text style={styles.detailText}>
                            {criticalCount} aluno{criticalCount > 1 ? 's' : ''} com menos de 50% de acertos
                        </Text>
                    </View>
                )}
                {attentionCount > 0 && (
                    <View style={styles.detailRow}>
                        <MaterialIcons name="warning" size={16} color="#f59e0b" />
                        <Text style={styles.detailText}>
                            {attentionCount} aluno{attentionCount > 1 ? 's' : ''} entre 50-69% de acertos
                        </Text>
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={[styles.button, { backgroundColor: currentColors.icon }]}
                onPress={handleNavigate}
            >
                <MaterialIcons name="school" size={20} color="white" />
                <Text style={styles.buttonText}>
                    Enviar Suporte Personalizado
                </Text>
            </TouchableOpacity>

            <Text style={[styles.hint, { color: currentColors.text }]}>
                💡 Envie quizzes de reforço direcionados para ajudar esses alunos
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 2,
        marginBottom: spacing.base,
        gap: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    subtitle: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        marginTop: 2,
    },
    details: {
        gap: spacing.sm,
        paddingLeft: spacing.lg,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    detailText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate700,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.base,
        borderRadius: borderRadius.default,
        marginTop: spacing.sm,
    },
    buttonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: 'white',
    },
    hint: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        fontStyle: 'italic',
        textAlign: 'center',
    },
});
