import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { changePassword, getMe, updateProfile } from '@/services/api';

type FeedbackType = 'success' | 'error';

interface FeedbackState {
    type: FeedbackType;
    message: string;
}

export default function ProfileSettingsScreen() {
    const scrollRef = useRef<ScrollView>(null);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'student' | 'teacher' | 'admin' | ''>('');

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    const [feedback, setFeedback] = useState<FeedbackState | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        if (!feedback) return;

        const timeout = setTimeout(() => {
            setFeedback(null);
        }, feedback.type === 'success' ? 2500 : 4000);

        return () => clearTimeout(timeout);
    }, [feedback]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const response = await getMe();

            if (response.success && response.user) {
                setName(response.user.name || '');
                setEmail(response.user.email || '');
                setRole(response.user.role || '');
            } else {
                setFeedback({
                    type: 'error',
                    message: response.message || 'Não foi possível carregar os dados da conta.',
                });
            }
        } catch (error) {
            setFeedback({
                type: 'error',
                message: 'Erro ao carregar dados da conta.',
            });
        } finally {
            setLoading(false);
        }
    };

    const showFeedback = (type: FeedbackType, message: string, showPopup: boolean = false) => {
        setFeedback({ type, message });
        scrollRef.current?.scrollTo({ y: 0, animated: true });

        if (showPopup) {
            Alert.alert(type === 'success' ? 'Sucesso' : 'Erro', message);
        }

        if (type === 'success') {
            setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
            }));
        }
    };

    const handleSaveProfile = async () => {
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanName || !cleanEmail) {
            showFeedback('error', 'Preencha nome e e-mail para continuar.', true);
            return;
        }

        if (!cleanEmail.includes('@')) {
            showFeedback('error', 'Digite um e-mail válido.', true);
            return;
        }

        try {
            setSavingProfile(true);
            const response = await updateProfile({ name: cleanName, email: cleanEmail });

            if (response.success) {
                showFeedback('success', response.message || 'Perfil atualizado com sucesso.', true);
            } else {
                showFeedback('error', response.message || 'Não foi possível atualizar o perfil.', true);
            }
        } catch (error) {
            showFeedback('error', 'Erro de conexão ao atualizar perfil.', true);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            showFeedback('error', 'Preencha os 3 campos da senha.', true);
            return;
        }

        if (newPassword.length < 6) {
            showFeedback('error', 'A nova senha deve ter no mínimo 6 caracteres.', true);
            return;
        }

        if (newPassword !== confirmPassword) {
            showFeedback('error', 'A confirmação da nova senha não confere.', true);
            return;
        }

        try {
            setSavingPassword(true);
            const response = await changePassword({
                current_password: currentPassword,
                new_password: newPassword,
            });

            if (response.success) {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                showFeedback('success', response.message || 'Senha alterada com sucesso.', true);
            } else {
                showFeedback('error', response.message || 'Não foi possível alterar a senha.', true);
            }
        } catch (error) {
            showFeedback('error', 'Erro de conexão ao alterar senha.', true);
        } finally {
            setSavingPassword(false);
        }
    };

    const roleLabel = role === 'teacher'
        ? 'Professor'
        : role === 'student'
            ? 'Aluno'
            : role === 'admin'
                ? 'Administrador'
                : 'Usuário';

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <LinearGradient
                    colors={['#4f46e5', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')}
                        >
                            <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                        </TouchableOpacity>

                        <View style={styles.headerCenter}>
                            <Text style={styles.headerTitle}>Perfil e Segurança</Text>
                            <Text style={styles.headerSubtitle}>Configurações da sua conta</Text>
                        </View>

                        <View style={styles.headerSpacer} />
                    </View>
                </LinearGradient>

                <ScrollView
                    ref={scrollRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Carregando dados da conta...</Text>
                        </View>
                    ) : (
                        <>
                            {feedback && (
                                <View style={[
                                    styles.feedbackBanner,
                                    feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
                                ]}>
                                    <View style={styles.feedbackMainContent}>
                                        <MaterialIcons
                                            name={feedback.type === 'success' ? 'check-circle' : 'error'}
                                            size={20}
                                            color={feedback.type === 'success' ? '#166534' : '#991b1b'}
                                        />
                                        <Text style={[
                                            styles.feedbackText,
                                            feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError,
                                        ]}>
                                            {feedback.message}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setFeedback(null)}
                                        style={styles.feedbackCloseButton}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialIcons
                                            name="close"
                                            size={18}
                                            color={feedback.type === 'success' ? '#166534' : '#991b1b'}
                                        />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.profileHeroCard}>
                                <View style={styles.avatarCircle}>
                                    <Text style={styles.avatarLetter}>
                                        {name?.trim()?.charAt(0)?.toUpperCase() || 'U'}
                                    </Text>
                                </View>
                                <View style={styles.profileHeroTextWrap}>
                                    <Text style={styles.profileHeroName}>{name || 'Usuário'}</Text>
                                    <Text style={styles.profileHeroEmail}>{email || 'Sem e-mail'}</Text>
                                    <View style={styles.roleChip}>
                                        <MaterialIcons name="verified-user" size={14} color={colors.primary} />
                                        <Text style={styles.roleChipText}>{roleLabel}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <MaterialIcons name="person" size={20} color={colors.primary} />
                                    <Text style={styles.cardTitle}>Dados do Perfil</Text>
                                </View>

                                <Text style={styles.inputLabel}>Nome</Text>
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    style={styles.input}
                                    placeholder="Seu nome"
                                    placeholderTextColor={colors.slate400}
                                />

                                <Text style={styles.inputLabel}>E-mail</Text>
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    style={styles.input}
                                    placeholder="seuemail@dominio.com"
                                    placeholderTextColor={colors.slate400}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />

                                <TouchableOpacity
                                    style={[styles.primaryButton, savingProfile && styles.disabledButton]}
                                    onPress={handleSaveProfile}
                                    disabled={savingProfile}
                                    activeOpacity={0.85}
                                >
                                    {savingProfile ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <>
                                            <MaterialIcons name="save" size={20} color={colors.white} />
                                            <Text style={styles.primaryButtonText}>Salvar Perfil</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <MaterialIcons name="lock" size={20} color={colors.primary} />
                                    <Text style={styles.cardTitle}>Segurança da Conta</Text>
                                </View>

                                <Text style={styles.inputLabel}>Senha atual</Text>
                                <TextInput
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    style={styles.input}
                                    placeholder="Digite sua senha atual"
                                    placeholderTextColor={colors.slate400}
                                    secureTextEntry
                                />

                                <Text style={styles.inputLabel}>Nova senha</Text>
                                <TextInput
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    style={styles.input}
                                    placeholder="Mínimo de 6 caracteres"
                                    placeholderTextColor={colors.slate400}
                                    secureTextEntry
                                />

                                <Text style={styles.inputLabel}>Confirmar nova senha</Text>
                                <TextInput
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    style={styles.input}
                                    placeholder="Repita a nova senha"
                                    placeholderTextColor={colors.slate400}
                                    secureTextEntry
                                />

                                <TouchableOpacity
                                    style={[styles.primaryButton, savingPassword && styles.disabledButton]}
                                    onPress={handleChangePassword}
                                    disabled={savingPassword}
                                    activeOpacity={0.85}
                                >
                                    {savingPassword ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <>
                                            <MaterialIcons name="lock-reset" size={20} color={colors.white} />
                                            <Text style={styles.primaryButtonText}>Atualizar Senha</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {lastUpdatedAt && (
                                <Text style={styles.lastUpdatedText}>
                                    Última atualização às {lastUpdatedAt}
                                </Text>
                            )}
                        </>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
    },
    container: {
        flex: 1,
    },
    headerGradient: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        paddingBottom: spacing.base,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -8,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
        height: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
    },
    loadingWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.sm,
    },
    loadingText: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
    },
    feedbackBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: borderRadius.default,
        borderWidth: 1,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        marginBottom: spacing.md,
    },
    feedbackSuccess: {
        backgroundColor: '#dcfce7',
        borderColor: '#86efac',
    },
    feedbackError: {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
    },
    feedbackText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
    },
    feedbackMainContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    feedbackCloseButton: {
        marginLeft: spacing.sm,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedbackTextSuccess: {
        color: '#166534',
    },
    feedbackTextError: {
        color: '#991b1b',
    },
    profileHeroCard: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        padding: spacing.base,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLetter: {
        color: colors.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    profileHeroTextWrap: {
        flex: 1,
    },
    profileHeroName: {
        color: colors.textPrimary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    profileHeroEmail: {
        marginTop: 2,
        color: colors.textSecondary,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
    },
    roleChip: {
        marginTop: spacing.xs,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#eef2ff',
        borderColor: '#c7d2fe',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
    },
    roleChipText: {
        color: colors.primary,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        padding: spacing.lg,
        marginBottom: spacing.md,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    cardTitle: {
        color: colors.textPrimary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    inputLabel: {
        marginBottom: spacing.xs,
        color: colors.textPrimary,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.slate300,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        marginBottom: spacing.md,
        color: colors.textPrimary,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        backgroundColor: colors.white,
    },
    primaryButton: {
        marginTop: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.default,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.base,
    },
    disabledButton: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    lastUpdatedText: {
        textAlign: 'center',
        marginTop: spacing.xs,
        color: colors.textSecondary,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
    },
});
