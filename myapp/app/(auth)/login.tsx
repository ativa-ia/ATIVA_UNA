import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { login, saveAuth } from '@/services/api';

/**
 * LoginScreen - Tela de Login
 * Tela principal de boas-vindas e login do Assistente 360
 */

export default function LoginScreen() {
    const [selectedRole, setSelectedRole] = useState<'student' | 'teacher'>('student');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isValidEmail = (email: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const handleLogin = async () => {
        // Validações
        if (!isValidEmail(email)) {
            alert('Email inválido!');
            return;
        }
        if (password.length < 6) {
            alert('Senha deve ter no mínimo 6 caracteres!');
            return;
        }

        setIsLoading(true);
        try {
            const data = await login({ email, password });

            if (data.success && data.user && data.token) {
                // Salvar token e role
                await saveAuth(data.token, data.user.role);

                // Redirecionar baseado no role
                if (data.user.role === 'student') {
                    router.replace('/(student)/dashboard');
                } else {
                    router.replace('/(teacher)/dashboard');
                }
            } else {
                alert(data.message || 'Erro ao fazer login');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            alert('Erro ao conectar com o servidor');
        } finally {
            setIsLoading(false);
        }
    };



    const handleCreateAccount = () => {
        router.push('/(auth)/cadastro');
    };

    const handleForgotPassword = () => {
        router.push('/(auth)/recuperar-senha');
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
                    <Text style={styles.title}>Bem-vindo(a) ao Assistente 360</Text>
                    <Text style={styles.subtitle}>
                        Sua jornada acadêmica, mais conectada.
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Profile Selection Title */}
                    <Text style={styles.profileTitle}>
                        Para começar, selecione o seu perfil:
                    </Text>

                    {/* Role Selection */}
                    <View style={styles.roleSelectionContainer}>
                        <View style={styles.roleSelection}>
                            <TouchableOpacity
                                style={[
                                    styles.roleOption,
                                    selectedRole === 'student' && styles.roleOptionActive,
                                ]}
                                onPress={() => setSelectedRole('student')}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.roleOptionText,
                                        selectedRole === 'student' && styles.roleOptionTextActive,
                                    ]}
                                >
                                    Sou Aluno
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.roleOption,
                                    selectedRole === 'teacher' && styles.roleOptionActive,
                                ]}
                                onPress={() => setSelectedRole('teacher')}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.roleOptionText,
                                        selectedRole === 'teacher' && styles.roleOptionTextActive,
                                    ]}
                                >
                                    Sou Professor
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Input Fields */}
                    <View style={styles.inputsContainer}>
                        <Input
                            iconName="email"
                            placeholder="E-mail Institucional"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                            darkMode
                        />
                        <Input
                            iconName="lock"
                            placeholder="Senha"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            darkMode
                        />
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <Button
                        title="Entrar"
                        onPress={handleLogin}
                        variant="primary"
                        loading={isLoading}
                        disabled={isLoading}
                    />
                    <Button
                        title="Criar Conta"
                        onPress={handleCreateAccount}
                        variant="secondary"
                    />
                    <TouchableOpacity onPress={handleForgotPassword} style={styles.linkButton}>
                        <Text style={styles.linkText}>Esqueci minha senha</Text>
                    </TouchableOpacity>
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
        paddingBottom: spacing['4xl'], // Increased to lift buttons up
    },
    logoContainer: {
        width: 96,
        height: 96,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primaryOpacity30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    header: {
        alignItems: 'center',
    },
    title: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        letterSpacing: typography.letterSpacing.tight,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.normal,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
        marginTop: spacing.sm,
    },
    form: {
        width: '100%',
        marginTop: 40,
        gap: spacing['2xl'],
    },
    profileTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        letterSpacing: typography.letterSpacing.tight,
        textAlign: 'center',
    },
    roleSelectionContainer: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
    },
    roleSelection: {
        flexDirection: 'row',
        height: 48,
        backgroundColor: colors.backgroundDark,
        borderRadius: borderRadius.xl,
        padding: 4,
        gap: 4,
    },
    roleOption: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.sm,
    },
    roleOptionActive: {
        backgroundColor: colors.slate800,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    roleOptionText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
    },
    roleOptionTextActive: {
        color: colors.primary,
    },
    inputsContainer: {
        paddingHorizontal: spacing.base,
        gap: spacing.base,
    },
    actions: {
        width: '100%',
        marginTop: 'auto',
        paddingTop: spacing['2xl'],
        paddingHorizontal: spacing.base,
        gap: spacing.md,
    },
    linkButton: {
        paddingVertical: spacing.sm,
    },
    linkText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
        textAlign: 'center',
    },
});
