import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { API_URL } from '@/services/api';

export default function MaintenanceScreen() {
    const router = useRouter();
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeIn = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Fade in on mount
        Animated.timing(fadeIn, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();

        // Gear pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const handleRetry = async () => {
        try {
            const res = await fetch(`${API_URL}/health`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok' || data.status === 'degraded') {
                    router.replace('/');
                }
            }
        } catch {
            // still offline – nothing to do, user sees same screen
        }
    };

    return (
        <Animated.View style={[styles.container, { opacity: fadeIn }]}>
            {/* Decorative background circles */}
            <View style={styles.bgCircle1} />
            <View style={styles.bgCircle2} />

            <View style={styles.card}>
                {/* Icon area */}
                <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
                    <Text style={styles.iconEmoji}>🔧</Text>
                </Animated.View>

                {/* Title */}
                <Text style={styles.title}>Estamos em Manutenção</Text>
                <Text style={styles.subtitle}>
                    Nossa equipe está trabalhando em melhorias importantes.{'\n'}
                    Em breve você terá acesso novamente! 🚀
                </Text>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Status badge */}
                <View style={styles.badge}>
                    <View style={styles.badgeDot} />
                    <Text style={styles.badgeText}>Sistema temporariamente indisponível</Text>
                </View>

                {/* Retry button */}
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
                    <Text style={styles.retryText}>Tentar Novamente</Text>
                </TouchableOpacity>
            </View>

            {/* Footer */}
            <Text style={styles.footer}>Ativa IA © {new Date().getFullYear()}</Text>
        </Animated.View>
    );
}

const BRAND = '#3B82F6'; // primary-500

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A', // slate-900
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    bgCircle1: {
        position: 'absolute',
        width: 360,
        height: 360,
        borderRadius: 180,
        backgroundColor: 'rgba(59,130,246,0.07)',
        top: -80,
        right: -80,
    },
    bgCircle2: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(99,102,241,0.06)',
        bottom: -60,
        left: -60,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1E293B', // slate-800
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    iconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(59,130,246,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: 'rgba(59,130,246,0.25)',
    },
    iconEmoji: {
        fontSize: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#F1F5F9', // slate-100
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        color: '#94A3B8', // slate-400
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.07)',
        marginBottom: 20,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 100,
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginBottom: 28,
        gap: 8,
    },
    badgeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
    },
    badgeText: {
        fontSize: 13,
        color: '#FCA5A5',
        fontWeight: '500',
    },
    retryBtn: {
        backgroundColor: BRAND,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 36,
        width: '100%',
        alignItems: 'center',
        shadowColor: BRAND,
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
    },
    retryText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.2,
    },
    footer: {
        marginTop: 32,
        color: '#475569',
        fontSize: 13,
    },
});
