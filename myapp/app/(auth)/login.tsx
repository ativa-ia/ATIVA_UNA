import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { quickAccess, login, saveAuth, getPublicSettings } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * LoginScreen - Tela de Autenticação
 * Alterna entre Quick Access e Login Tradicional conforme configuração do sistema.
 */

type LoginMode = 'quick_access' | 'traditional';

export default function LoginScreen() {
    // Quick Access fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    // Traditional fields
    const [tradEmail, setTradEmail] = useState('');
    const [tradPassword, setTradPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [loginMode, setLoginMode] = useState<LoginMode>('quick_access');
    const [modeLoading, setModeLoading] = useState(true);

    useEffect(() => {
        loadLoginMode();
    }, []);

    const loadLoginMode = async () => {
        try {
            const result = await getPublicSettings();
            if (result.success && result.settings?.DEFAULT_LOGIN_MODE) {
                setLoginMode(result.settings.DEFAULT_LOGIN_MODE as LoginMode);
            }
        } catch (error) {
            console.log('Usando modo padrão: quick_access');
        } finally {
            setModeLoading(false);
        }
    };

    const isValidEmail = (email: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const handleSuccess = async (token: string, role: string, userName?: string) => {
        await saveAuth(token, role);
        if (userName) {
            await AsyncStorage.setItem('userName', userName);
        }
        if (role === 'admin' || role === 'super_admin') {
            router.replace('/(admin)/dashboard');
        } else if (role === 'student') {
            router.replace('/(student)/dashboard');
        } else {
            router.replace('/(teacher)/dashboard');
        }
    };

    // ========== QUICK ACCESS ==========
    const handleQuickAccess = async () => {
        if (!name.trim()) { alert('Por favor, digite seu nome.'); return; }
        if (!isValidEmail(email)) { alert('Email inválido!'); return; }

        setIsLoading(true);
        setStatusMessage('Entrando...');

        try {
            const response = await quickAccess({ name, email });
            if (response.success && response.user && response.token) {
                await handleSuccess(response.token, response.user.role, response.user.name);
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

    // ========== TRADITIONAL LOGIN ==========
    const handleTraditionalLogin = async () => {
        if (!isValidEmail(tradEmail)) { alert('Email inválido!'); return; }
        if (!tradPassword.trim()) { alert('Por favor, digite sua senha.'); return; }

        setIsLoading(true);
        setStatusMessage('Entrando...');

        try {
            const response = await login({ email: tradEmail, password: tradPassword });
            if (response.success && response.user && response.token) {
                await handleSuccess(response.token, response.user.role, response.user.name);
            } else {
                alert(response.message || 'Email ou senha incorretos.');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            alert('Erro ao conectar com o servidor');
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    };

    if (modeLoading) {
        return (
            <View style={[styles.mainContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <LinearGradient
                    colors={['#312e81', '#6366f1', '#a78bfa']}
                    style={[styles.backgroundGradient, { justifyContent: 'center', alignItems: 'center' }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <ActivityIndicator size="large" color={colors.white} />
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            <LinearGradient
                colors={['#312e81', '#6366f1', '#a78bfa']}
                style={styles.backgroundGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <SafeAreaView style={styles.safeArea}>
                    <TouchableOpacity
                        style={styles.castButton}
                        onPress={() => router.push('/presentation')}
                    >
                        <MaterialIcons name="cast" size={24} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
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
                            <Text style={styles.appTagline}>
                                {loginMode === 'quick_access' ? 'Acesso Rápido' : 'Login'}
                            </Text>
                        </View>

                        {/* Glassmorphism Card */}
                        <View style={styles.glassCard}>
                            {loginMode === 'quick_access' ? (
                                <>
                                    {/* ===== QUICK ACCESS FORM ===== */}
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
                                            onPress={handleQuickAccess}
                                            variant="primary"
                                            loading={isLoading}
                                            disabled={isLoading}
                                        />
                                    </View>
                                </>
                            ) : (
                                <>
                                    {/* ===== TRADITIONAL LOGIN FORM ===== */}
                                    <View style={styles.form}>
                                        <Input
                                            iconName="email"
                                            placeholder="Email"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            value={tradEmail}
                                            onChangeText={setTradEmail}
                                        />
                                        <Input
                                            iconName="lock"
                                            placeholder="Senha"
                                            secureTextEntry
                                            value={tradPassword}
                                            onChangeText={setTradPassword}
                                        />
                                    </View>

                                    {statusMessage ? (
                                        <Text style={styles.statusText}>{statusMessage}</Text>
                                    ) : null}

                                    <View style={styles.actions}>
                                        <Button
                                            title="Entrar"
                                            onPress={handleTraditionalLogin}
                                            variant="primary"
                                            loading={isLoading}
                                            disabled={isLoading}
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={styles.registerLink}
                                        onPress={() => router.push('/(auth)/register')}
                                    >
                                        <Text style={styles.registerLinkText}>
                                            Não tem conta? <Text style={styles.registerLinkBold}>Criar Conta</Text>
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
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
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    form: {
        gap: spacing.md,
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
    },
    castButton: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        padding: spacing.sm,
        zIndex: 10,
    },
    registerLink: {
        marginTop: spacing.lg,
        alignItems: 'center',
    },
    registerLinkText: {
        fontSize: 14,
        color: colors.slate500,
    },
    registerLinkBold: {
        fontWeight: '700',
        color: '#6366f1',
    },
});
