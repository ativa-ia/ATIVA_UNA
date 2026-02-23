import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { API_URL } from '@/services/api';

interface HealthStatus {
    status: 'ok' | 'degraded' | 'critical' | 'offline';
    services: {
        api: 'online' | 'offline';
        database: 'online' | 'offline';
        openai: 'online' | 'offline' | 'no_key' | 'invalid_key' | 'unauthorized' | 'error';
    };
    uptime?: string;
    uptime_seconds?: number;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
    online: { color: '#10b981', label: 'Online', icon: 'check-circle' },
    offline: { color: '#ef4444', label: 'Offline', icon: 'cancel' },
    no_key: { color: '#f59e0b', label: 'Sem Chave', icon: 'vpn-key' },
    invalid_key: { color: '#f59e0b', label: 'Chave Inválida', icon: 'error' },
    unauthorized: { color: '#ef4444', label: 'Não Autorizado', icon: 'lock' },
    error: { color: '#ef4444', label: 'Erro', icon: 'error-outline' },
};

const OVERALL_CONFIG: Record<string, { color: string; label: string; bgColor: string }> = {
    ok: { color: '#10b981', label: 'Operacional', bgColor: '#10b98115' },
    degraded: { color: '#f59e0b', label: 'Degradado', bgColor: '#f59e0b15' },
    critical: { color: '#ef4444', label: 'Crítico', bgColor: '#ef444415' },
    offline: { color: '#6b7280', label: 'Offline', bgColor: '#6b728015' },
};

const getLatencyColor = (ms: number) => {
    if (ms < 100) return '#10b981';
    if (ms < 500) return '#f59e0b';
    return '#ef4444';
};

export const SystemHealth = () => {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [timestamp, setTimestamp] = useState<string>('');
    const [latency, setLatency] = useState<number | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const startPulse = (statusColor: string) => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    };

    const checkHealth = async () => {
        setLoading(true);
        const startTime = Date.now();
        try {
            const response = await fetch(`${API_URL}/health`);
            const endTime = Date.now();
            setLatency(endTime - startTime);

            if (response.ok) {
                const data = await response.json();
                setHealth(data);
            } else {
                setHealth({
                    status: 'offline',
                    services: { api: 'offline', database: 'offline', openai: 'offline' }
                });
            }
        } catch (error) {
            const endTime = Date.now();
            setLatency(endTime - startTime);
            setHealth({
                status: 'offline',
                services: { api: 'offline', database: 'offline', openai: 'offline' }
            });
        } finally {
            setLoading(false);
            const now = new Date();
            setTimestamp(now.toLocaleTimeString());
        }
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (health) startPulse(OVERALL_CONFIG[health.status]?.color || '#6b7280');
    }, [health?.status]);

    const overall = health ? OVERALL_CONFIG[health.status] || OVERALL_CONFIG.offline : OVERALL_CONFIG.offline;

    const ServiceRow = ({ name, icon, status }: { name: string; icon: string; status: string }) => {
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
        return (
            <View style={styles.serviceRow}>
                <View style={styles.serviceLeft}>
                    <MaterialIcons name={icon as any} size={18} color={colors.textSecondary} />
                    <Text style={styles.serviceName}>{name}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: cfg.color + '18' }]}>
                    <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                    <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={[styles.overallBadge, { backgroundColor: overall.bgColor }]}>
                        <Animated.View style={[styles.overallDot, { backgroundColor: overall.color, opacity: pulseAnim }]} />
                        <Text style={[styles.overallText, { color: overall.color }]}>{overall.label}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={checkHealth} disabled={loading} style={styles.refreshBtn}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <MaterialIcons name="refresh" size={18} color={colors.zinc500} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Metrics Row */}
            <View style={styles.metricsRow}>
                {/* Latency */}
                <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Latência</Text>
                    <Text style={[styles.metricValue, { color: latency ? getLatencyColor(latency) : colors.zinc400 }]}>
                        {latency !== null ? `${latency}ms` : '...'}
                    </Text>
                </View>
                {/* Uptime */}
                <View style={[styles.metricCard, styles.metricCardBorder]}>
                    <Text style={styles.metricLabel}>Uptime</Text>
                    <Text style={styles.metricValue}>
                        {health?.uptime || '...'}
                    </Text>
                </View>
            </View>

            {/* Services */}
            <View style={styles.servicesContainer}>
                <Text style={styles.servicesTitle}>SERVIÇOS</Text>
                <ServiceRow name="API Server" icon="dns" status={health?.services.api || 'offline'} />
                <ServiceRow name="Banco de Dados" icon="storage" status={health?.services.database || 'offline'} />
                <ServiceRow name="OpenAI" icon="psychology" status={health?.services.openai || 'offline'} />
            </View>

            {/* Timestamp */}
            <Text style={styles.timestamp}>Última verificação: {timestamp}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    overallBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 8,
    },
    overallDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    overallText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    refreshBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metricsRow: {
        flexDirection: 'row',
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate100,
    },
    metricCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
    },
    metricCardBorder: {
        borderLeftWidth: 1,
        borderLeftColor: colors.slate200,
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.zinc400,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    metricValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    servicesContainer: {
        gap: 6,
    },
    servicesTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.zinc400,
        letterSpacing: 1,
        marginBottom: 4,
    },
    serviceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    serviceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    serviceName: {
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    timestamp: {
        marginTop: spacing.sm,
        textAlign: 'right',
        fontSize: 10,
        color: colors.zinc400,
    },
});
