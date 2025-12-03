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
import { forgotPassword } from '@/services/api';

/**
 * RecuperarSenhaScreen - Tela de Recuperação de Senha
 * Tela para solicitar redefinição de senha
 */

export default function RecuperarSenhaScreen() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSendInstructions = async () => {
        setIsLoading(true);
        try {
            const data = await forgotPassword(email);

            if (data.success) {
                alert('Instruções enviadas para seu email!');
                router.back();
            } else {
                alert(data.message || 'Erro ao enviar instruções');
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao conectar com o servidor');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRememberPassword = () => {
        router.back();
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <MaterialIcons name="lock-reset" size={60} color={colors.primary} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Recuperação de Senha</Text>
                    <Text style={styles.subtitle}>
                        Insira seu e-mail institucional para receber as instruções de redefinição.
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Input
                            iconName="email"
                            placeholder="E-mail Institucional"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                            darkMode
                        />
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <Button
                        title="Enviar Instruções"
                        onPress={handleSendInstructions}
                        variant="primary"
                        loading={isLoading}
                        disabled={isLoading}
                    />
                    <TouchableOpacity onPress={handleRememberPassword} style={styles.linkButton}>
                        <Text style={styles.linkText}>Lembrei minha senha</Text>
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
        paddingBottom: spacing['2xl'],
    },
    iconContainer: {
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
        textAlign: 'center',
    },
    form: {
        width: '100%',
        marginTop: 40,
    },
    inputContainer: {
        paddingHorizontal: spacing.base,
    },
    actions: {
        width: '100%',
        marginTop: 'auto',
        paddingTop: spacing['2xl'],
        paddingHorizontal: spacing.base,
        gap: spacing.md,
        alignItems: 'center',
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
