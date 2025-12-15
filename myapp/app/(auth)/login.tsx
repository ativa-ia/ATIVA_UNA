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
            <LinearGradient
                colors={['#312e81', '#6366f1', '#a78bfa']} // Deep Indigo -> Indigo -> Soft Purple
                style={styles.backgroundGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <SafeAreaView style={styles.safeArea}>
                    <ScrollView
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Logo / Brand Section */}
                        <View style={styles.logoSection}>
                            <View style={styles.logoBackground}>
                                <MaterialIcons name="school" size={40} color={colors.white} />
                            </View>
                            <Text style={styles.appTitle}>ATIVA IA</Text>
                            <Text style={styles.appTagline}>Acesso Rápido</Text>
                        </View>

                        {/* Glassmorphism Card */}
                        <View style={styles.glassCard}>


                            <View style={styles.form}>
                                <Input
                                    iconName="person"
                                    placeholder="Seu Nome"
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />

                                <Input
                                    iconName="email"
                                    placeholder="Email"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            {statusMessage ? (
                                <Text style={styles.statusText}>{statusMessage}</Text>
                            ) : null}

                            <View style={styles.actions}>
                                <Button
                                    title="Entrar"
                                    onPress={handleAccess}
                                    variant="primary"
                                    loading={isLoading}
                                    disabled={isLoading}
                                />
                            </View>
                        </View>

                        <Text style={styles.footerText}>
                            Acesso seguro e simplificado.{'\n'}
                            Seus dados estão protegidos.
                        </Text>
                    </ScrollView>
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    backgroundGradient: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    safeArea: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: spacing.lg,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    logoBackground: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    appTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        marginBottom: 8,
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    appTagline: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: typography.fontFamily.body,
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // High opacity for readability
        borderRadius: 32,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.2,
        shadowRadius: 30,
        elevation: 10,
    },
    welcomeText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    form: {
        gap: spacing.md,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.slate600,
        marginBottom: 4,
        marginLeft: 4,
    },
    actions: {
        marginTop: spacing.xl,
    },
    statusText: {
        textAlign: 'center',
        marginTop: spacing.md,
        color: colors.primary,
        fontWeight: '500',
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        marginTop: spacing.xl,
        fontSize: 12,
        lineHeight: 18,
    }
});
