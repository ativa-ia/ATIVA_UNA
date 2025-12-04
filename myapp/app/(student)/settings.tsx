import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Switch,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { clearAuth } from '@/services/api';

/**
 * SettingsScreen - Configurações
 * Tela de configurações do aplicativo (MVP - apenas logout)
 */
export default function SettingsScreen() {
    const [darkMode, setDarkMode] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(false);

    const handleLogout = async () => {
        await clearAuth();
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Configurações</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Aparência */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Aparência</Text>

                        <View style={styles.settingItem}>
                            <View style={styles.settingInfo}>
                                <MaterialIcons name="dark-mode" size={24} color={colors.primary} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Modo Escuro</Text>
                                    <Text style={styles.settingDescription}>
                                        Ativar tema escuro
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={darkMode}
                                onValueChange={setDarkMode}
                                trackColor={{ false: colors.zinc700, true: colors.primary }}
                                thumbColor={colors.white}
                            />
                        </View>
                    </View>

                    {/* Notificações */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notificações</Text>

                        <View style={styles.settingItem}>
                            <View style={styles.settingInfo}>
                                <MaterialIcons name="notifications" size={24} color={colors.primary} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Notificações Push</Text>
                                    <Text style={styles.settingDescription}>
                                        Receber notificações no dispositivo
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                                trackColor={{ false: colors.zinc700, true: colors.primary }}
                                thumbColor={colors.white}
                            />
                        </View>

                        <View style={styles.settingItem}>
                            <View style={styles.settingInfo}>
                                <MaterialIcons name="email" size={24} color={colors.primary} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Notificações por E-mail</Text>
                                    <Text style={styles.settingDescription}>
                                        Receber atualizações por e-mail
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={emailNotifications}
                                onValueChange={setEmailNotifications}
                                trackColor={{ false: colors.zinc700, true: colors.primary }}
                                thumbColor={colors.white}
                            />
                        </View>
                    </View>

                    {/* Sobre */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Sobre</Text>

                        <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                            <View style={styles.settingInfo}>
                                <MaterialIcons name="info" size={24} color={colors.primary} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Sobre o App</Text>
                                    <Text style={styles.settingDescription}>
                                        Versão 1.0.0
                                    </Text>
                                </View>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.zinc500} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                            <View style={styles.settingInfo}>
                                <MaterialIcons name="description" size={24} color={colors.primary} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingLabel}>Termos de Uso</Text>
                                    <Text style={styles.settingDescription}>
                                        Ler termos e condições
                                    </Text>
                                </View>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.zinc500} />
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
            </View>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc800,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
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
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.md,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.base,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
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
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 2,
    },
    settingDescription: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.base,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#ef4444',
        marginTop: spacing.xl,
        gap: spacing.sm,
    },
    logoutText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: '#ef4444',
    },
});
