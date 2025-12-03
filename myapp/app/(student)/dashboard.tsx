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
import { SubjectCard } from '@/components/cards/SubjectCard';
import { ActivityCard } from '@/components/cards/ActivityCard';
import { Subject, Notice, Activity } from '@/types';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { clearAuth } from '@/services/api';

/**
 * StudentDashboardScreen - Dashboard do Aluno
 * Tela principal do aluno com avisos, disciplinas e atividades
 */
export default function StudentDashboardScreen() {
    const [activeNavId, setActiveNavId] = useState('dashboard');

    // Mock data
    const notices: Notice[] = [
        {
            id: '1',
            title: 'Início do Período de Matrículas',
            description: 'As matrículas para o próximo semestre começam na segunda-feira.',
        },
        {
            id: '2',
            title: 'Palestra sobre Carreira',
            description: 'Não perca a palestra com especialistas do mercado nesta sexta.',
        },
        {
            id: '3',
            title: 'Atualização do Sistema',
            description: 'O portal do aluno estará em manutenção no domingo das 8h às 12h.',
        },
    ];

    const subjects: Subject[] = [
        {
            id: '1',
            name: 'Cálculo I',
            imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400',
        },
        {
            id: '2',
            name: 'Algoritmos Avançados',
            imageUrl: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400',
        },
        {
            id: '3',
            name: 'Engenharia de Software',
            imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400',
        },
        {
            id: '4',
            name: 'Redes de Computadores',
            imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400',
        },
    ];

    const activities: Activity[] = [
        {
            id: '1',
            title: 'Entrega do Projeto Final',
            subject: 'Engenharia de Software',
            dueDate: 'em 3 dias',
            type: 'assignment',
        },
        {
            id: '2',
            title: 'Prova P2',
            subject: 'Cálculo I',
            dueDate: 'em 5 dias',
            type: 'quiz',
        },
    ];

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'calendar', label: 'Calendário', iconName: 'calendar-today' },
        { id: 'grades', label: 'Notas', iconName: 'school' },
        { id: 'messages', label: 'Mensagens', iconName: 'chat-bubble' },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                // Already on dashboard, do nothing
                break;
            case 'calendar':
                router.push('./calendar');
                break;
            case 'grades':
                router.push('./grades');
                break;
            case 'messages':
                router.push('./messages');
                break;
        }
    };

    const handleSubjectPress = (subject: Subject) => {
        router.push({
            pathname: './materials',
            params: { subject: subject.name }
        });
    };

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
                    {/* Header */}
                    <Header
                        userName="Aluno"
                        avatarUri="https://i.pravatar.cc/150?img=12"
                        darkMode
                        onNotificationPress={() => console.log('Notifications')}
                    />

                    {/* Avisos Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Avisos</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.horizontalScroll}
                        >
                            {notices.map((notice) => (
                                <NoticeCard key={notice.id} notice={notice} darkMode />
                            ))}
                        </ScrollView>
                    </View>

                    {/* Minhas Disciplinas Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Minhas Disciplinas</Text>
                        <View style={styles.subjectsGrid}>
                            {subjects.map((subject) => (
                                <SubjectCard
                                    key={subject.id}
                                    subject={subject}
                                    style={styles.subjectCard}
                                    onPress={() => handleSubjectPress(subject)}
                                />
                            ))}
                        </View>
                    </View>

                    {/* Próximas Atividades Section */}
                    <View style={[styles.section, styles.lastSection]}>
                        <Text style={styles.sectionTitle}>Próximas Atividades</Text>
                        <View style={styles.activitiesList}>
                            {activities.map((activity) => (
                                <ActivityCard key={activity.id} activity={activity} darkMode />
                            ))}
                        </View>
                    </View>

                    {/* Logout Button */}
                    <View style={styles.logoutContainer}>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <MaterialIcons name="logout" size={20} color="#ef4444" />
                            <Text style={styles.logoutText}>Sair</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* Bottom Navigation */}
                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={handleNavPress}
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
        paddingBottom: 96, // Space for bottom nav
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
    subjectsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.base,
        gap: spacing.md,
    },
    subjectCard: {
        width: '47%', // Approximately 2 columns with gap
        minWidth: 158,
    },
    activitiesList: {
        paddingHorizontal: spacing.base,
        gap: spacing.md,
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
