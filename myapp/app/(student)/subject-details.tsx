import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { checkActiveQuiz, Quiz } from '@/services/quiz';
import { getActiveActivity, LiveActivity, isActivitySubmitted } from '@/services/api';

/**
 * SubjectDetailsScreen - Detalhes da Disciplina (Aluno)
 * Tela com informações detalhadas da disciplina, ações e avisos
 */
export default function SubjectDetailsScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';
    const subjectId = parseInt(params.subjectId as string) || 1;

    // Quiz ao vivo state (sistema de Quiz)
    const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
    const [showQuizPopup, setShowQuizPopup] = useState(false);
    const [alreadyAnswered, setAlreadyAnswered] = useState(false);
    const [quizStarted, setQuizStarted] = useState(false);

    // LiveActivity state (sistema de Transcrição)
    const [liveActivity, setLiveActivity] = useState<LiveActivity | null>(null);
    const [showActivityPopup, setShowActivityPopup] = useState(false);
    const [activityStarted, setActivityStarted] = useState(false);

    const pollingRef = useRef<any>(null);
    const liveActivityPollingRef = useRef<any>(null);

    // Polling para verificar quiz E liveActivity ativos
    // Função de verificação (agora acessível para botão de refresh)
    const checkForActivities = useCallback(async () => {
        // Se já começou alguma atividade, não precisa verificar automaticamente
        // (Mas se for chamado pelo botão manual, pode ser útil verificar mesmo assim?
        //  Melhor manter a proteção para não sobrescrever estado de quiz ativo)
        if (quizStarted || activityStarted) return;

        // 1. Verificar Quiz (sistema de Quiz)
        try {

            const quizResult = await checkActiveQuiz(subjectId);

            if (quizResult.success && quizResult.active && quizResult.quiz) {

                setActiveQuiz(quizResult.quiz);
                setAlreadyAnswered(quizResult.already_answered || false);
                if (!quizResult.already_answered) {
                    setShowQuizPopup(true);
                }
                return; // Quiz tem prioridade
            } else {
                setActiveQuiz(null);
                setShowQuizPopup(false);
            }
        } catch (error) {

        }

        // 2. Verificar LiveActivity (sistema de Transcrição)
        try {
            const activityResult = await getActiveActivity(subjectId);


            if (activityResult.success && activityResult.active && activityResult.activity) {

                setLiveActivity(activityResult.activity);
                setShowActivityPopup(true);
            } else {

                setLiveActivity(null);
                setShowActivityPopup(false);
            }
        } catch (error) {

        }
    }, [subjectId, quizStarted, activityStarted]);

    // Polling effect
    useEffect(() => {
        checkForActivities();
        pollingRef.current = setInterval(checkForActivities, 5000);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [subjectId, quizStarted]);

    // Polling para verificar Live Activity (Transcrição)
    useFocusEffect(
        useCallback(() => {
            const checkLiveActivity = async () => {
                try {
                    const result = await getActiveActivity(subjectId);
                    if (result.success && result.active && result.activity) {
                        setLiveActivity(result.activity);
                    } else {
                        setLiveActivity(null);
                    }
                } catch (error) {
                    console.error('Erro ao verificar live activity:', error);
                }
            };

            checkLiveActivity();
            const interval = setInterval(checkLiveActivity, 5000);

            return () => {
                clearInterval(interval);
            };
        }, [subjectId])
    );

    const handleStartQuiz = () => {
        if (activeQuiz) {
            setQuizStarted(true);
            setShowQuizPopup(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
            router.push({
                pathname: '/(student)/live-quiz',
                params: { quiz: JSON.stringify(activeQuiz) }
            });
        }
    };

    const handleStartLiveActivity = () => {
        if (liveActivity) {
            router.push({
                pathname: '/(student)/live-activity',
                params: { activity: JSON.stringify(liveActivity) }
            });
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Mock data - será substituído por dados reais do backend
    const subjectData = {
        name: subjectName,
        professor: 'Prof. Wendel Castro',
        code: 'SER360',
        imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwv2wIhDYaEEhq6ALucXryaJd3_iE7nIannnYITlQ2lT4teSVDHhII-lZMdLI_-CeXo1rbJXxndpoYHZylIzN8qP0LlpRVW3TI0DNiM62qX7CyEKrECZt8X5h66V60-kJIqF7KcP6FkAqDXWoatiu-GhzOfViSnNRoVmijyHVoiVRpI9dfDA8nAe_PQ0_0IPimNJQEd7ofvcge2wVlwZ6VesOKtIbWIWaavtCusp6dpAu3_BFKA1wfZ2EeO6eIaKzLiC1SdUbL81E',
        schedule: 'Quartas e Quintas, 10:00 - 12:00',
        location: 'Sala l-102',
        pendingActivities: 3
    };


    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#4f46e5', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Detalhes da Disciplina</Text>
                    <View style={styles.placeholder} />
                </LinearGradient>



                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Live Activity Banner (New) */}
                    {liveActivity && !isActivitySubmitted(liveActivity.id) && (
                        <TouchableOpacity
                            style={styles.liveActivityBanner}
                            onPress={handleStartLiveActivity}
                            activeOpacity={0.9}
                        >
                            <View style={styles.liveActivityIcon}>
                                <MaterialIcons
                                    name={liveActivity.activity_type === 'quiz' ? 'quiz' :
                                        liveActivity.activity_type === 'summary' ? 'summarize' : 'help-outline'}
                                    size={24}
                                    color={colors.white}
                                />
                            </View>
                            <View style={styles.liveActivityInfo}>
                                <Text style={styles.liveActivityTitle}>
                                    {liveActivity.activity_type === 'quiz' ? '🎯 Quiz em Andamento!' :
                                        liveActivity.activity_type === 'summary' ? '📝 Resumo Disponível!' : '💬 Pergunta Disponível!'}
                                </Text>
                                <Text style={styles.liveActivityDesc}>
                                    Toque para participar agora
                                </Text>
                            </View>
                            <MaterialIcons name="arrow-forward-ios" size={18} color={colors.white} />
                        </TouchableOpacity>
                    )}

                    {/* Subject Info Card */}
                    <View style={styles.subjectCard}>
                        <View style={styles.subjectInfo}>
                            <Text style={styles.subjectName} numberOfLines={1}>
                                {subjectData.name}
                            </Text>
                            <Text style={styles.professorInfo} numberOfLines={2}>
                                {subjectData.professor} - {subjectData.code}
                            </Text>
                        </View>
                    </View>



                    {/* Action Buttons */}
                    <View style={styles.buttonGroup}>


                        <TouchableOpacity
                            style={styles.secondaryButton}
                            activeOpacity={0.8}
                            onPress={() => console.log('Ver atividades')}
                        >
                            <MaterialIcons name="assignment" size={24} color={colors.textPrimary} />
                            <Text style={styles.secondaryButtonText}>Ver Atividades e Quizzes</Text>
                            {subjectData.pendingActivities > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{subjectData.pendingActivities}</Text>
                                </View>
                            )}
                        </TouchableOpacity>


                    </View>
                </ScrollView>
            </View>

            {/* Quiz ao Vivo Popup */}
            <Modal
                visible={showQuizPopup && !alreadyAnswered}
                transparent
                animationType="fade"
                onRequestClose={() => setShowQuizPopup(false)}
            >
                <View style={styles.quizModalOverlay}>
                    <View style={styles.quizPopup}>
                        <View style={styles.quizPopupIcon}>
                            <Text style={styles.quizPopupEmoji}>🎯</Text>
                        </View>

                        <Text style={styles.quizPopupTitle}>Quiz ao Vivo!</Text>
                        <Text style={styles.quizPopupSubtitle}>
                            {activeQuiz?.title}
                        </Text>

                        <View style={styles.quizInfo}>
                            <View style={styles.quizInfoItem}>
                                <MaterialIcons name="quiz" size={20} color={colors.secondary} />
                                <Text style={styles.quizInfoText}>
                                    {activeQuiz?.question_count || 10} perguntas
                                </Text>
                            </View>
                            <View style={styles.quizInfoItem}>
                                <MaterialIcons name="timer" size={20} color={colors.warning} />
                                <Text style={styles.quizInfoText}>
                                    {formatTime(activeQuiz?.time_remaining || 300)} restantes
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.startQuizButton}
                            onPress={handleStartQuiz}
                        >
                            <Text style={styles.startQuizButtonText}>Começar Quiz</Text>
                            <MaterialIcons name="arrow-forward" size={24} color={colors.white} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* LiveActivity Popup (sistema de Transcrição) */}
            <Modal
                visible={showActivityPopup}
                transparent
                animationType="fade"
                onRequestClose={() => setShowActivityPopup(false)}
            >
                <View style={styles.quizModalOverlay}>
                    <View style={styles.quizPopup}>
                        <View style={styles.quizPopupIcon}>
                            <Text style={styles.quizPopupEmoji}>
                                {liveActivity?.activity_type === 'quiz' ? '🎯' :
                                    liveActivity?.activity_type === 'summary' ? '📝' : '💬'}
                            </Text>
                        </View>

                        <Text style={styles.quizPopupTitle}>
                            {liveActivity?.activity_type === 'quiz' ? 'Quiz ao Vivo!' :
                                liveActivity?.activity_type === 'summary' ? 'Resumo Disponível!' : 'Atividade ao Vivo!'}
                        </Text>
                        <Text style={styles.quizPopupSubtitle}>
                            {liveActivity?.title}
                        </Text>

                        <View style={styles.quizInfo}>
                            <View style={styles.quizInfoItem}>
                                <MaterialIcons
                                    name={liveActivity?.activity_type === 'quiz' ? 'quiz' : 'assignment'}
                                    size={20}
                                    color={colors.secondary}
                                />
                                <Text style={styles.quizInfoText}>
                                    {liveActivity?.activity_type === 'quiz'
                                        ? `${liveActivity?.content?.questions?.length || 0} perguntas`
                                        : 'Clique para ver'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.startQuizButton}
                            onPress={handleStartLiveActivity}
                        >
                            <Text style={styles.startQuizButtonText}>
                                {liveActivity?.activity_type === 'quiz' ? 'Começar Quiz' : 'Ver Atividade'}
                            </Text>
                            <MaterialIcons name="arrow-forward" size={24} color={colors.white} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Indicador de quiz já respondido */}
            {activeQuiz && alreadyAnswered && (
                <View style={styles.quizAnsweredBanner}>
                    <MaterialIcons name="check-circle" size={20} color={colors.secondary} />
                    <Text style={styles.quizAnsweredText}>
                        Você já respondeu o quiz atual
                    </Text>
                </View>
            )}
        </View>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        // Background handled by LinearGradient
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
    placeholder: {
        width: 48,
        height: 48,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.xl,
        paddingTop: spacing.base,
    },
    subjectCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.base,
        backgroundColor: colors.white,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.base,
        minHeight: 72,
        marginHorizontal: spacing.base,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: spacing.md,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.slate100,
    },
    subjectInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    subjectName: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginBottom: 4,
    },
    professorInfo: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
    },
    infoGrid: {
        flexDirection: 'row',
        paddingHorizontal: spacing.base,
        paddingTop: spacing.base,
    },
    infoItem: {
        flex: 1,
        gap: 4,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        paddingVertical: spacing.base,
    },
    infoItemLeft: {
        paddingRight: spacing.sm,
    },
    infoItemRight: {
        paddingLeft: spacing.sm,
    },
    infoLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
    },
    infoValue: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    buttonGroup: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        gap: spacing.md,
        maxWidth: 480,
        alignSelf: 'center',
        width: '100%',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.lg,
        borderRadius: 12,
        height: 56,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.white,
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.lg,
        borderRadius: 16,
        height: 56,
        position: 'relative',
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    secondaryButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    badge: {
        position: 'absolute',
        top: 12,
        right: 16,
        backgroundColor: colors.danger,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.white,
    },
    badgeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    // Quiz popup styles
    quizModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.base,
    },
    quizPopup: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 350,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    quizPopupIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.slate50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    quizPopupEmoji: {
        fontSize: 40,
    },
    quizPopupTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    quizPopupSubtitle: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    quizInfo: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginBottom: spacing.lg,
    },
    quizInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    quizInfoText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
    },
    startQuizButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.lg,
        shadowColor: colors.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    startQuizButtonText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    quizAnsweredBanner: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderTopWidth: 1,
        borderTopColor: colors.secondary,
    },
    quizAnsweredText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.secondary,
        fontWeight: '600',
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
