import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { API_URL } from '@/services/api';

interface HealthStatus {
    status: 'ok' | 'degraded' | 'offline';
    services: {
        api: 'online' | 'offline';
        database: 'online' | 'offline';
    };
}

export const SystemHealth = () => {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [timestamp, setTimestamp] = useState<string>('');

    const checkHealth = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/health`); // Assuming API_URL points to backend-python port if configured, or need adjustment
            // If API_URL is localhost:3000 and flask is localhost:3000, it works.

            if (response.ok) {
                const data = await response.json();
                setHealth(data);
            } else {
                setHealth({
                    status: 'offline',
                    services: { api: 'offline', database: 'offline' }
                });
            }
        } catch (error) {
            setHealth({
                status: 'offline',
                services: { api: 'offline', database: 'offline' }
            });
        } finally {
            setLoading(false);
            const now = new Date();
            setTimestamp(now.toLocaleTimeString());
        }
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        return status === 'online' ? colors.secondary : colors.danger;
    };

    const StatusDot = ({ status }: { status: string }) => (
        <View style={[styles.dot, { backgroundColor: getStatusColor(status) }]} />
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Estado do Sistema</Text>
                <TouchableOpacity onPress={checkHealth} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <MaterialIcons name="refresh" size={20} color={colors.zinc500} />
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.statusRow}>
                <View style={styles.serviceItem}>
                    <Text style={styles.serviceName}>API Server</Text>
                    <View style={styles.statusContainer}>
                        <StatusDot status={health?.services.api || 'offline'} />
                        <Text style={styles.statusText}>
                            {health?.services.api === 'online' ? 'Online' : 'Offline'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.serviceItem, styles.borderLeft]}>
                    <Text style={styles.serviceName}>Banco de Dados</Text>
                    <View style={styles.statusContainer}>
                        <StatusDot status={health?.services.database || 'offline'} />
                        <Text style={styles.statusText}>
                            {health?.services.database === 'online' ? 'Conectado' : 'Erro'}
                        </Text>
                    </View>
                </View>
            </View>

            <Text style={styles.timestamp}>Última verificação: {timestamp}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.slate100, // Light background for contrast inside white card
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statusRow: {
        flexDirection: 'row',
    },
    serviceItem: {
        flex: 1,
        alignItems: 'center',
    },
    borderLeft: {
        borderLeftWidth: 1,
        borderLeftColor: colors.slate200,
    },
    serviceName: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    timestamp: {
        marginTop: spacing.sm,
        textAlign: 'right',
        fontSize: 10,
        color: colors.zinc400,
    }
});
