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
import { Header } from '@/components/navigation/Header';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { NoticeCard } from '@/components/cards/NoticeCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { Notice } from '@/types';
import { clearAuth } from '@/services/api';

/**
 * TeacherDashboardScreen - Dashboard do Professor
 * Tela principal do professor com turmas e atividades
 */
export default function TeacherDashboardScreen() {
    const [activeNavId, setActiveNavId] = useState('dashboard');

    const announcements: Notice[] = [
        {
            id: '1',
            title: 'Reunião Pedagógica',
            description: 'Reunião de planejamento do semestre na próxima terça-feira às 14h.',
        },
        {
            id: '2',
            title: 'Prazo de Notas',
            description: 'Lembrete: prazo para lançamento de notas termina em 5 dias.',
        },
    ];

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'classes', label: 'Turmas', iconName: 'groups' },
        { id: 'materials', label: 'Materiais', iconName: 'folder' },
        { id: 'reports', label: 'Relatórios', iconName: 'assessment' },
    ];

    const handleLogout = async () => {
        await clearAuth();
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Header
                        userName="Professor"
                        avatarUri="https://i.pravatar.cc/150?img=33"
                        darkMode
                        onNotificationPress={() => console.log('Notifications')}
                    />

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Avisos Importantes</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.horizontalScroll}
                        >
                            {announcements.map((notice) => (
                                <NoticeCard key={notice.id} notice={notice} darkMode />
                            ))}
                        </ScrollView>
                    </View>

                    <View style={[styles.section, styles.lastSection]}>
                        <Text style={styles.sectionTitle}>Minhas Turmas</Text>
                        <Text style={styles.placeholder}>
                            Conteúdo das turmas será exibido aqui
                        </Text>
                    </View>

                    {/* Logout Button */}
                    <View style={styles.logoutContainer}>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <MaterialIcons name="logout" size={20} color="#ef4444" />
                            <Text style={styles.logoutText}>Sair</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={setActiveNavId}
                    darkMode
                />
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 96,
    },
    section: {
        marginTop: spacing.base,
    },
    lastSection: {
        marginBottom: spacing.base,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        letterSpacing: typography.letterSpacing.tight,
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.sm,
        paddingTop: spacing.base,
    },
    horizontalScroll: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        gap: spacing.md,
    },
    placeholder: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.xl,
        textAlign: 'center',
    },
    logoutContainer: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.xl,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.base,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    logoutText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: '#ef4444',
    },
});
