import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface SummaryToastProps {
    visible: boolean;
    title: string;
    subjectName?: string;
    onPress?: () => void;
    onDismiss?: () => void;
    duration?: number; // ms before auto-dismiss (default 5000)
}

/**
 * SummaryToast — Notificação sutil e minimalista para resumos recebidos.
 * Faz slide-in do topo, mostra brevemente e desaparece sozinho.
 */
export default function SummaryToast({
    visible,
    title,
    subjectName,
    onPress,
    onDismiss,
    duration = 5000,
}: SummaryToastProps) {
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) {
            // Slide in
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: false,
                    tension: 80,
                    friction: 12,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: false,
                }),
            ]).start();

            // Auto-dismiss
            timerRef.current = setTimeout(() => {
                dismiss();
            }, duration);
        } else {
            // Reset position immediately when hidden externally
            translateY.setValue(-120);
            opacity.setValue(0);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [visible]);

    const dismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -120,
                duration: 300,
                useNativeDriver: false,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }),
        ]).start(() => {
            onDismiss?.();
        });
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
        >
            <TouchableOpacity
                style={styles.toast}
                onPress={() => {
                    if (timerRef.current) clearTimeout(timerRef.current);
                    dismiss();
                    onPress?.();
                }}
                activeOpacity={0.85}
            >
                <View style={styles.iconContainer}>
                    <MaterialIcons name="description" size={20} color={colors.white} />
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                        📝 Novo Resumo
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {subjectName ? `${subjectName} · ` : ''}{title}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => {
                        if (timerRef.current) clearTimeout(timerRef.current);
                        dismiss();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.closeButton}
                >
                    <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : 36,
        left: spacing.base,
        right: spacing.base,
        zIndex: 9999,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#475569', // slate600 — discreto, escuro mas não preto
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.base,
        gap: spacing.md,
        // Sombra sutil
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    subtitle: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
        color: 'rgba(255,255,255,0.75)',
        marginTop: 2,
    },
    closeButton: {
        padding: spacing.xs,
    },
});
