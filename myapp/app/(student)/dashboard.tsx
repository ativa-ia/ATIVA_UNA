import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '@/components/navigation/Header';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { SubjectCard } from '@/components/cards/SubjectCard';
import { Subject, Activity } from '@/types';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getSubjects, Subject as APISubject, getMe, getActiveActivity, LiveActivity, isActivitySubmitted } from '@/services/api';
import { useCallback } from 'react';

/**
 * StudentDashboardScreen - Dashboard do Aluno
 * Tela principal do aluno com avisos, disciplinas e atividades
 */
export default function StudentDashboardScreen() {
    const [activeNavId, setActiveNavId] = useState('dashboard');
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userName, setUserName] = useState('Aluno');

    // Estado para atividade ao vivo
    const [liveActivity, setLiveActivity] = useState<LiveActivity | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

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
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Polling para atividades ativas (atualiza ao focar)
    useFocusEffect(
        useCallback(() => {
            if (subjects.length === 0) return;

            const checkActivities = async () => {
                for (const subject of subjects) {
                    try {
                        const result = await getActiveActivity(parseInt(subject.id));
                        if (result.success && result.active && result.activity) {
                            setLiveActivity(result.activity);
                            return; // Encontrou uma atividade ativa
                        }
                    } catch (error) {
                        console.error('Erro ao verificar atividade:', error);
                    }
                }
                setLiveActivity(null);
            };

            checkActivities(); // Check imediato ao focar
            const interval = setInterval(checkActivities, 5000); // Continua polling

            return () => {
                clearInterval(interval);
            };
        }, [subjects])
    );

    // Animação do banner de atividade
    useEffect(() => {
        if (liveActivity) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [liveActivity]);

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
                imageUrl: subject.imageUrl || subject.image_url || 'https://via.placeholder.com/400',
                professor: subject.professor
            }));

            setSubjects(formattedSubjects);
        } catch (err) {
            console.error('Erro ao carregar disciplinas:', err);
            setError('Erro ao carregar disciplinas');
        } finally {
            setLoading(false);
        }
    };

    const handleActivityPress = () => {
        if (liveActivity) {
            router.push({
                pathname: './live-activity',
                params: { activity: JSON.stringify(liveActivity) }
            } as any);
        }
    };

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'materials', label: 'Materiais', iconName: 'folder-open' }, // Added Materials
        { id: 'calendar', label: 'Calendário', iconName: 'calendar-today' },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                break;
            case 'materials': // Handle Materials
                router.push('/(student)/materials');
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
            pathname: '/(student)/activities',
            params: { subjectName: subject.name, subjectId: subject.id }
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
                    {/* Header Customizado com Botões */}
                    <LinearGradient
                        colors={['#4f46e5', '#7c3aed']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.headerGradient}
                    >
                        <View style={styles.headerTop}>
                            <View>
                                <Text style={styles.greeting}>Olá, {userName}</Text>
                                <Text style={styles.date}>{getCurrentDate()}</Text>
                            </View>
                            <View style={styles.headerButtons}>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => router.push('/(student)/notifications')}
                                >
                                    <MaterialIcons name="notifications-none" size={24} color={colors.white} />
                                    <View style={styles.badge} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => router.push('/(student)/settings')}
                                >
                                    <MaterialIcons name="settings" size={24} color={colors.white} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Banner de Atividade Ao Vivo */}
                    {liveActivity && !isActivitySubmitted(liveActivity.id) && (
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <TouchableOpacity
                                style={styles.liveActivityBanner}
                                onPress={handleActivityPress}
                                activeOpacity={0.9}
                            >
                                <View style={styles.liveActivityIcon}>
                                    <MaterialIcons
                                        name={liveActivity.activity_type === 'quiz' ? 'quiz' : 'help-outline'}
                                        size={24}
                                        color={colors.white}
                                    />
                                </View>
                                <View style={styles.liveActivityInfo}>
                                    <Text style={styles.liveActivityTitle}>
                                        {liveActivity.activity_type === 'quiz'
                                            ? `🎯 Quiz: ${liveActivity.subject_name || 'Nova Atividade'}`
                                            : liveActivity.activity_type === 'summary'
                                                ? '📝 Resumo da Aula Disponível'
                                                : '💬 Pergunta do Professor!'}
                                    </Text>
                                    <Text style={styles.liveActivityDesc}>
                                        Toque para responder agora
                                    </Text>
                                </View>
                                <MaterialIcons name="arrow-forward-ios" size={18} color={colors.white} />
                            </TouchableOpacity>
                        </Animated.View>
                    )}

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
                />
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.base,
    },
    headerGradient: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
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
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    notificationButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    headerButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative', // For badge positioning
    },
    badge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.danger,
        borderWidth: 1,
        borderColor: colors.white,
    },
    section: {
        marginTop: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        letterSpacing: typography.letterSpacing.tight,
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.md,
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
        // Shadow and bg handled by SubjectCard component
    },
    loadingContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
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
        color: colors.danger,
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
        color: colors.textSecondary,
        textAlign: 'center',
    },
    // Live Activity Banner
    liveActivityBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.base,
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.xl,
        gap: spacing.md,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    liveActivityIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    liveActivityInfo: {
        flex: 1,
    },
    liveActivityTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    liveActivityDesc: {
        fontSize: typography.fontSize.sm,
        color: 'rgba(255,255,255,0.9)',
    },
});
