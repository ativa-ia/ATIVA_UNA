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
import { SubjectCard } from '@/components/cards/SubjectCard';
import { Subject } from '@/types';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { getSubjects, Subject as APISubject, getTeacherClasses, TeacherClass, getMe } from '@/services/api';

/**
 * TeacherDashboardScreen - Dashboard do Professor
 * Tela principal do professor com disciplinas que leciona
 */
export default function TeacherDashboardScreen() {
    const [activeNavId, setActiveNavId] = useState('dashboard');
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userName, setUserName] = useState('Professor');


    // Formatar data atual
    const getCurrentDate = () => {
        const date = new Date();
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            day: 'numeric',
            month: 'short'
        };
        const formatted = date.toLocaleDateString('pt-BR', options);
        // Capitalizar primeira letra
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    // Buscar disciplinas da API
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar nome do usuário
            const meResponse = await getMe();
            if (meResponse.success && meResponse.user) {
                setUserName(meResponse.user.name);
            }

            // Buscar disciplinas
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

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                // Already on dashboard
                break;
        }
    };

    const handleSubjectPress = (subject: Subject) => {
        router.push({
            pathname: '/(teacher)/subject-details',
            params: { subject: subject.name, subjectId: subject.id.toString() }
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
                    {/* Header Customizado */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerTop}>
                            <View>
                                <Text style={styles.greeting}>Olá, {userName}</Text>
                                <Text style={styles.date}>{getCurrentDate()}</Text>
                            </View>
                            <View style={styles.headerButtons}>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => router.push('/(teacher)/settings')}
                                >
                                    <MaterialIcons name="settings" size={24} color={colors.white} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>



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
                                <TouchableOpacity style={styles.retryButton} onPress={loadData}>
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
        paddingBottom: spacing.base,
    },
    headerContainer: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        paddingBottom: spacing.base,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greeting: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    date: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
        color: colors.zinc400,
        marginTop: 4,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    section: {
        marginTop: spacing.base,
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
    subjectsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.base,
        gap: spacing.md,
    },
    subjectCard: {
        width: '47%',
        minWidth: 158,
    },

    loadingContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        color: colors.textSecondary,
    },
    errorContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        color: '#ef4444',
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: spacing.base,
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
        fontFamily: typography.fontFamily.body,
        color: colors.textSecondary,
        textAlign: 'center',
    },

});
