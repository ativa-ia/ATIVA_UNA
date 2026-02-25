import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    const handleLogout = async () => {
        await clearAuth();
        router.replace('/(auth)/login');
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
});
