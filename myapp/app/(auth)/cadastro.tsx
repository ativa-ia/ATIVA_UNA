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

import { register, saveAuth } from '@/services/api';

/**
 * CadastroScreen - Tela de Cadastro
 * Tela para criar nova conta no Assistente 360
 */

export default function CadastroScreen() {
    const [selectedRole, setSelectedRole] = useState<'student' | 'teacher'>('student');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        // Validações
        if (password !== confirmPassword) {
            alert('As senhas não coincidem!');
            return;
        }
        if (!name.trim()) {
            alert('Nome é obrigatório!');
            return;
        }

        setIsLoading(true);
        try {
            const data = await register({
                email,
                password,
                role: selectedRole,
                name,
            });

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
                alert(data.message || 'Erro ao cadastrar');
            }
        } catch (error) {
            console.error('Erro no cadastro:', error);
            alert('Erro ao conectar com o servidor');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToLogin = () => {
        router.back();
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
                    <Text style={styles.title}>Crie sua conta</Text>
                    <Text style={styles.subtitle}>
                        É rápido e fácil. Vamos começar!
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputsContainer}>
                        <Input
                            iconName="person"
                            placeholder="Nome Completo"
                            value={name}
                            onChangeText={setName}
                            darkMode
                        />
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
                        <Input
                            iconName="lock-reset"
                            placeholder="Confirmar Senha"
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            darkMode
                        />
                    </View>

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
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <Button
                        title="Cadastrar"
                        onPress={handleRegister}
                        variant="primary"
                        loading={isLoading}
                        disabled={isLoading}
                    />
                    <Button
                        title="Voltar para o Login"
                        onPress={handleBackToLogin}
                        variant="secondary"
                    />
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
        gap: spacing.base,
    },
    inputsContainer: {
        paddingHorizontal: spacing.base,
        gap: spacing.base,
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
    actions: {
        width: '100%',
        marginTop: 'auto',
        paddingTop: spacing['2xl'],
        paddingHorizontal: spacing.base,
        gap: spacing.md,
        // alignItems: 'center', // Removed to allow full width buttons
    },
});
