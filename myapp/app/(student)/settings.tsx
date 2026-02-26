import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { clearAuth, sendSupportMessage } from '@/services/api';

/**
 * SettingsScreen - Configurações
 * Tela de configurações do aplicativo (MVP - apenas logout)
 */
export default function SettingsScreen() {
    const [supportModalVisible, setSupportModalVisible] = React.useState(false);
    const [supportSubject, setSupportSubject] = React.useState('');
    const [supportText, setSupportText] = React.useState('');
    const [sendingSupport, setSendingSupport] = React.useState(false);

    const handleLogout = async () => {
        await clearAuth();
        router.replace('/(auth)/login');
    };

    const resetSupportForm = () => {
        setSupportSubject('');
        setSupportText('');
    };

    const handleContactSupport = async () => {
        if (!supportSubject.trim()) {
            Alert.alert('Suporte', 'Informe o assunto.');
            return;
        }

        if (!supportText.trim()) {
            Alert.alert('Suporte', 'Descreva sua dúvida ou problema.');
            return;
        }

        try {
            setSendingSupport(true);
            const response = await sendSupportMessage({
                subject: supportSubject.trim(),
                message: supportText.trim(),
            });

            if (!response.success) {
                Alert.alert('Suporte', response.message || 'Não foi possível enviar sua mensagem.');
                return;
            }

            Alert.alert('Suporte', 'Mensagem enviada para suporte1ativa@gmail.com com sucesso.');
            setSupportModalVisible(false);
            resetSupportForm();
        } catch {
            Alert.alert('Suporte', 'Erro ao enviar suporte. Tente novamente.');
        } finally {
            setSendingSupport(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#4f46e5', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.canGoBack() ? router.back() : router.push('/(student)/dashboard')}
                        >
                            <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Configurações</Text>
                        <View style={styles.headerSpacer} />
                    </View>
                </LinearGradient>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Conta */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Conta</Text>

                        <TouchableOpacity
                            style={styles.settingItem}
                            activeOpacity={0.7}
                            onPress={() => router.push('/profile-settings')}
                        >
                            <View style={styles.settingInfo}>
                                <MaterialIcons name="person" size={24} color={colors.primary} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Perfil e Segurança</Text>
                                    <Text style={styles.settingDescription}>
                                        Alterar dados da conta e senha
                                    </Text>
                                </View>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Suporte */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Suporte</Text>

                        <TouchableOpacity
                            style={styles.settingItem}
                            activeOpacity={0.7}
                            onPress={() => setSupportModalVisible(true)}
                        >
                            <View style={styles.settingInfo}>
                                <MaterialIcons name="support-agent" size={24} color={colors.primary} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Falar com o Suporte</Text>
                                    <Text style={styles.settingDescription}>
                                        Enviar dúvida ou problema da sua conta
                                    </Text>
                                </View>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Sobre */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Sobre</Text>

                        <TouchableOpacity
                            style={styles.settingItem}
                            activeOpacity={0.7}
                            onPress={() => router.push('/about')}
                        >
                            <View style={styles.settingInfo}>
                                <MaterialIcons name="info" size={24} color={colors.primary} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Sobre o App</Text>
                                    <Text style={styles.settingDescription}>
                                        Conheça o propósito do ATIVA IA
                                    </Text>
                                </View>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Logout */}
                    <TouchableOpacity
                        style={styles.logoutButton}
                        activeOpacity={0.7}
                        onPress={handleLogout}
                    >
                        <MaterialIcons name="logout" size={20} color="#ef4444" />
                        <Text style={styles.logoutText}>Sair da Conta</Text>
                    </TouchableOpacity>
                </ScrollView>

                <Modal
                    visible={supportModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setSupportModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Falar com o Suporte</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setSupportModalVisible(false);
                                        resetSupportForm();
                                    }}
                                    style={styles.modalClose}
                                >
                                    <MaterialIcons name="close" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.modalHint}>Destino: suporte1ativa@gmail.com</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Assunto"
                                value={supportSubject}
                                onChangeText={setSupportSubject}
                                editable={!sendingSupport}
                                maxLength={120}
                            />

                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Descreva sua dúvida ou problema"
                                value={supportText}
                                onChangeText={setSupportText}
                                editable={!sendingSupport}
                                multiline
                                textAlignVertical="top"
                                maxLength={4000}
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => {
                                        setSupportModalVisible(false);
                                        resetSupportForm();
                                    }}
                                    disabled={sendingSupport}
                                >
                                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={handleContactSupport}
                                    disabled={sendingSupport}
                                >
                                    {sendingSupport ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>Enviar</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

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
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
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
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.md,
        marginLeft: spacing.xs,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.base,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
    },
    settingText: {
        flex: 1,
    },
    settingLabel: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    settingDescription: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.base,
        backgroundColor: '#fee2e2',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#fca5a5',
        marginTop: spacing.xl,
        gap: spacing.sm,
    },
    logoutText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.danger,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: spacing.base,
    },
    modalCard: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    modalTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    modalClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHint: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        fontFamily: typography.fontFamily.display,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.slate300,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        fontFamily: typography.fontFamily.display,
    },
    textArea: {
        minHeight: 120,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    secondaryButton: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.default,
        borderWidth: 1,
        borderColor: colors.slate300,
    },
    secondaryButtonText: {
        color: colors.textSecondary,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.medium,
    },
    primaryButton: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.default,
        backgroundColor: colors.primary,
        minWidth: 86,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontWeight: typography.fontWeight.semibold,
    },
});
