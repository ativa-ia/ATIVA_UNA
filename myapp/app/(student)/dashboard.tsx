import React, { useState, useEffect } from 'react';
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
import { getSubjects, Subject as APISubject } from '@/services/api';

/**
 * StudentDashboardScreen - Dashboard do Aluno
 * Tela principal do aluno com avisos, disciplinas e atividades
 */
export default function StudentDashboardScreen() {
    const [activeNavId, setActiveNavId] = useState('dashboard');
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Buscar disciplinas da API
    useEffect(() => {
        loadSubjects();
    }, []);

    const loadSubjects = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getSubjects();

            // Converter para o formato esperado pelo componente
            const formattedSubjects: Subject[] = data.map((subject: APISubject) => ({
                id: subject.id.toString(),
                name: subject.name,
                imageUrl: subject.imageUrl || subject.image_url || 'https://via.placeholder.com/400'
            }));

            setSubjects(formattedSubjects);
        } catch (err) {
            console.error('Erro ao carregar disciplinas:', err);
            setError('Erro ao carregar disciplinas');
        } finally {
            setLoading(false);
        }
    };

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
        }
    };

    const handleSubjectPress = (subject: Subject) => {
        router.push({
            pathname: './subject-details',
            params: { subject: subject.name }
        });
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
                        onProfilePress={() => router.push('./settings')}
                    />



                    {/* Minhas Disciplinas Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Minhas Disciplinas</Text>

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <Text style={styles.loadingText}>Carregando disciplinas...</Text>
                            </View>
                        ) : error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                                <TouchableOpacity style={styles.retryButton} onPress={loadSubjects}>
                                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                                </TouchableOpacity>
                            </View>
                        ) : subjects.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>Nenhuma disciplina encontrada</Text>
                            </View>
                        ) : (
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
                        )}
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

    loadingContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    errorContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
    },
    errorText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: '#ef4444',
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    emptyContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        textAlign: 'center',
    },
});
