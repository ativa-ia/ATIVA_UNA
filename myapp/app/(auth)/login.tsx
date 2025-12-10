import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { quickAccess, saveAuth } from '@/services/api';

/**
 * LoginScreen - Tela de Acesso Rápido (Evento)
 * Acesso simplificado sem senha para facilitar a apresentação.
 */

export default function LoginScreen() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const isValidEmail = (email: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const handleAccess = async () => {
        // Validações Básicas
        if (!name.trim()) {
            alert('Por favor, digite seu nome.');
            return;
        }
        if (!isValidEmail(email)) {
            alert('Email inválido!');
            return;
        }

        setIsLoading(true);
        setStatusMessage('Entrando...');

        try {
            const response = await quickAccess({ name, email });

            if (response.success && response.user && response.token) {
                await handleSuccess(response.token, response.user.role);
            } else {
                alert(response.message || 'Erro ao acessar. Tente novamente.');
            }

        } catch (error) {
            console.error('Erro no acesso:', error);
            alert('Erro ao conectar com o servidor');
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    };

    const handleSuccess = async (token: string, role: string) => {
        await saveAuth(token, role);
        if (role === 'admin') {
            router.replace('/(admin)/dashboard');
        } else if (role === 'student') {
            router.replace('/(student)/dashboard');
        } else {
            router.replace('/(teacher)/dashboard');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <MaterialIcons name="school" size={60} color={colors.primary} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Ativa AI</Text>
                    <Text style={styles.subtitle}>
                        Acesso Rápido
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <Input
                        iconName="person"
                        placeholder="Seu Nome"
                        value={name}
                        onChangeText={setName}
                        darkMode
                    />
                    <Input
                        iconName="email"
                        placeholder="E-mail"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                        darkMode
                    />
                </View>

                {/* Status Message */}
                {statusMessage ? (
                    <Text style={styles.statusText}>{statusMessage}</Text>
                ) : null}

                {/* Actions */}
                <View style={styles.actions}>
                    <Button
                        title="Acessar"
                        onPress={handleAccess}
                        variant="primary"
                        loading={isLoading}
                        disabled={isLoading}
                    />
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Digite seu nome e email para acessar.{'\n'}
                        Se você já tem conta, será conectado automaticamente.{'\n'}
                        Caso contrário, uma conta será criada para você.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundDark,
    },
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        maxWidth: 448,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: spacing.base,
        paddingTop: spacing['3xl'],
        paddingBottom: spacing['4xl'],
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primaryOpacity30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        letterSpacing: typography.letterSpacing.tight,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.fontSize.lg,
        color: colors.primary,
        marginTop: spacing.xs,
        fontWeight: typography.fontWeight.medium,
    },
    form: {
        width: '100%',
        marginTop: spacing.lg,
        gap: spacing.base,
    },
    actions: {
        width: '100%',
        marginTop: spacing.xl,
    },
    statusText: {
        color: colors.slate400,
        marginTop: spacing.md,
        fontSize: typography.fontSize.sm,
    },
    footer: {
        marginTop: spacing['2xl'],
        paddingHorizontal: spacing.xl,
    },
    footerText: {
        color: colors.slate500,
        fontSize: typography.fontSize.xs,
        textAlign: 'center',
        lineHeight: 20,
    }
});
