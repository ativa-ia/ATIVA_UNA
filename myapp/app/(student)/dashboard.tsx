import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Animated,
    Modal,
    TouchableWithoutFeedback,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '@/components/navigation/Header';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { SubjectCard } from '@/components/cards/SubjectCard';
import SummaryToast from '@/components/notifications/SummaryToast';
import { Subject, Activity, CourseEnrollment } from '@/types';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getSubjects, Subject as APISubject, getMe, getActiveActivity, LiveActivity, isActivitySubmitted, submitActivityResponse, getMyCourses } from '@/services/api';
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
    
    // Múltiplos cursos
    const [courses, setCourses] = useState<CourseEnrollment[]>([]);
    const [activeCourseId, setActiveCourseId] = useState<number | null>(null);
    const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

    // Estado para atividade ao vivo
    const [liveActivity, setLiveActivity] = useState<LiveActivity | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Estado para toast de resumo (notificação sutil)
    const [summaryToast, setSummaryToast] = useState<{ visible: boolean; title: string; subjectName: string; subjectId: string } | null>(null);
    const handledSummariesRef = useRef<Set<number>>(new Set());
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

    useFocusEffect(
        useCallback(() => {
            setActiveNavId('dashboard');
        }, [])
    );

    // Polling para atividades ativas (atualiza ao focar)
    useFocusEffect(
        useCallback(() => {
            if (subjects.length === 0) return;

            const checkActivities = async () => {
                let foundActivity = false;

                for (const subject of subjects) {
                    try {
                        const result = await getActiveActivity(parseInt(subject.id));

                        if (!result.success) continue;

                        // Detectar resumo — pode vir como activity principal OU como campo summary
                        const summaryData = (result.active && result.activity?.activity_type === 'summary')
                            ? result.activity
                            : (result.has_summary && result.summary)
                                ? result.summary
                                : null;

                        if (summaryData) {
                            const summaryId = summaryData.id;

                            // Evitar toast repetido para o mesmo resumo
                            if (!handledSummariesRef.current.has(summaryId) && !isActivitySubmitted(summaryId)) {
                                handledSummariesRef.current.add(summaryId);

                                // Mostrar toast sutil
                                setSummaryToast({
                                    visible: true,
                                    title: summaryData.title || 'Resumo da Aula',
                                    subjectName: summaryData.subject_name || subject.name,
                                    subjectId: subject.id,
                                });

                                // Auto-marcar como lido silenciosamente
                                submitActivityResponse(summaryId, { read: true }).catch((err) =>
                                    console.log('Auto-read summary error (silent):', err)
                                );
                            }
                            continue; // Resumo não é atividade interativa
                        }

                        // Atividade interativa (quiz ou pergunta aberta) → banner pulsante
                        if (result.active && result.activity) {
                            setLiveActivity(result.activity);
                            foundActivity = true;
                        }
                    } catch (error) {
                        console.error('Erro ao verificar atividade:', error);
                    }
                }

                if (!foundActivity) {
                    setLiveActivity(null);
                }
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
                        useNativeDriver: false,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: false,
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

            // Buscar cursos do aluno
            const coursesRes = await getMyCourses();
            let currentCourseId = activeCourseId;
            
            if (coursesRes.success && coursesRes.courses && coursesRes.courses.length > 0) {
                setCourses(coursesRes.courses);
                // Se não tem curso ativo, seleciona o primeiro
                if (!currentCourseId) {
                    currentCourseId = coursesRes.courses[0].course_id;
                    setActiveCourseId(currentCourseId);
                }
            }

            // Buscar disciplinas baseadas no curso selecionado
            const data = await getSubjects(currentCourseId || undefined);

            // Converter para o formato esperado pelo componente
            const formattedSubjects: Subject[] = data.map((subject: APISubject) => ({
                id: subject.id.toString(),
                name: subject.name,
                imageUrl: subject.image_url || subject.imageUrl || 'https://via.placeholder.com/400'
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
        { id: 'socratic', label: 'Sócrates', iconName: 'psychology' },
        { id: 'calendar', label: 'Calendário', iconName: 'calendar-today' },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                break;
            case 'socratic':
                router.push('/(student)/socratic');
                break;
            case 'calendar':
                router.push('./calendar');
                break;
        }
    };

    const handleSubjectPress = (subject: Subject) => {
        router.push({
            pathname: '/(student)/content-hub',
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
                                
                                {/* Seletor de Curso (só exibe se tiver mais de um) */}
                                {courses.length > 1 && (
                                    <TouchableOpacity 
                                        style={styles.courseSelector}
                                        onPress={() => setIsCourseDropdownOpen(true)}
                                    >
                                        <Text style={styles.courseSelectorText} numberOfLines={1}>
                                            {courses.find(c => c.course_id === activeCourseId)?.course_name || 'Selecionar Curso'}
                                        </Text>
                                        <MaterialIcons name="arrow-drop-down" size={20} color={colors.white} />
                                    </TouchableOpacity>
                                )}
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

                    {/* Banner de Atividade Ao Vivo (apenas quiz e perguntas abertas) */}
                    {liveActivity && !isActivitySubmitted(liveActivity.id) && liveActivity.activity_type !== 'summary' && (
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

                {/* Toast sutil para resumos */}
                <SummaryToast
                    visible={summaryToast?.visible || false}
                    title={summaryToast?.title || ''}
                    subjectName={summaryToast?.subjectName}
                    onPress={() => {
                        if (summaryToast) {
                            router.push({
                                pathname: '/(student)/content-hub',
                                params: {
                                    subjectName: summaryToast.subjectName,
                                    subjectId: summaryToast.subjectId
                                }
                            });
                        }
                    }}
                    onDismiss={() => setSummaryToast(null)}
                />

                {/* Bottom Navigation */}
                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={handleNavPress}
                />
            </View>

            {/* Modal de Seleção de Curso */}
            <Modal
                visible={isCourseDropdownOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsCourseDropdownOpen(false)}
            >
                <TouchableWithoutFeedback onPress={() => setIsCourseDropdownOpen(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.dropdownModalContainer}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Selecionar Curso</Text>
                                    <TouchableOpacity onPress={() => setIsCourseDropdownOpen(false)}>
                                        <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView style={styles.modalScroll}>
                                    {courses.map((course) => (
                                        <TouchableOpacity
                                            key={course.id}
                                            style={[styles.modalOption, activeCourseId === course.course_id && styles.modalOptionActive]}
                                            onPress={() => {
                                                setActiveCourseId(course.course_id);
                                                setIsCourseDropdownOpen(false);
                                                // Fetch subjects specifically for this selected course
                                                getSubjects(course.course_id).then(data => {
                                                    const formattedSubjects: Subject[] = data.map((subject: APISubject) => ({
                                                        id: subject.id.toString(),
                                                        name: subject.name,
                                                        imageUrl: subject.image_url || subject.imageUrl || 'https://via.placeholder.com/400'
                                                    }));
                                                    setSubjects(formattedSubjects);
                                                });
                                            }}
                                        >
                                            <MaterialIcons 
                                                name="school" 
                                                size={20} 
                                                color={activeCourseId === course.course_id ? colors.primary : colors.textSecondary} 
                                            />
                                            <Text style={[styles.modalOptionText, activeCourseId === course.course_id && styles.modalOptionTextActive]}>
                                                {course.course_name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
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
    courseSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
        paddingVertical: 2,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: borderRadius.sm,
        alignSelf: 'flex-start',
    },
    courseSelectorText: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginRight: 2,
        maxWidth: 150,
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
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    dropdownModalContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        width: '100%',
        maxHeight: '80%',
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0', // colors.border
        marginBottom: spacing.sm,
    },
    modalTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    modalScroll: {
        maxHeight: 400,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9', // colors.borderLight
        gap: spacing.sm,
    },
    modalOptionActive: {
        backgroundColor: `${colors.primary}10`,
        borderRadius: borderRadius.md,
        borderBottomWidth: 0,
    },
    modalOptionText: {
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.body,
        flex: 1,
    },
    modalOptionTextActive: {
        color: colors.primary,
        fontWeight: typography.fontWeight.bold,
    },
});
