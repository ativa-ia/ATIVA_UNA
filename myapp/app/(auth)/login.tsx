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
import { LinearGradient } from 'expo-linear-gradient';
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
        <View style={styles.mainContainer}>
            {/* Header com Gradiente */}
            <LinearGradient
                colors={['#4f46e5', '#8b5cf6']}
                style={styles.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <SafeAreaView style={styles.safeAreaHeader}>
                    <View style={styles.logoContainer}>
                        <MaterialIcons name="school" size={48} color={colors.white} />
                    </View>
                    <Text style={styles.title}>Ativa AI</Text>
                    <Text style={styles.subtitle}>Acesso Rápido</Text>
                </SafeAreaView>
            </LinearGradient>

            <SafeAreaView style={styles.safeAreaContent}>
                <ScrollView
                    style={styles.container}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        {/* Form */}
                        <View style={styles.form}>
                            <Input
                                iconName="person"
                                placeholder="Seu Nome"
                                value={name}
                                onChangeText={setName}
                            />
                            <Input
                                iconName="email"
                                placeholder="E-mail"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
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
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: colors.slate50,
    },
    headerGradient: {
        width: '100%',
        paddingBottom: spacing.lg,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    safeAreaHeader: {
        alignItems: 'center',
        paddingTop: spacing.md,
    },
    safeAreaContent: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing['4xl'],
    },
    logoContainer: {
        marginBottom: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        letterSpacing: typography.letterSpacing.tight,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.fontSize.sm,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 0,
        fontWeight: typography.fontWeight.medium,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        marginTop: spacing.lg, // Add space between header and card
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    form: {
        width: '100%',
        gap: spacing.base,
    },
    actions: {
        width: '100%',
        marginTop: spacing.xl,
    },
    statusText: {
        color: colors.textSecondary,
        marginTop: spacing.md,
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
    },
    footer: {
        marginTop: spacing['2xl'],
        paddingHorizontal: spacing.xl,
    },
    footerText: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.xs,
        textAlign: 'center',
        lineHeight: 20,
    }
});
