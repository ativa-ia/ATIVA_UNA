import React, { useState, useEffect, useRef } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { checkActiveQuiz, Quiz } from '@/services/quiz';
import { getActiveActivity, LiveActivity } from '@/services/api';


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

    // Polling para verificar quiz E liveActivity ativos
    useEffect(() => {
        const checkForActivities = async () => {
            // Se já começou alguma atividade, não precisa verificar
            if (quizStarted || activityStarted) return;

            try {
                // 1. Verificar Quiz (sistema de Quiz)
                console.log(`[Activity Poll] Checking for activities in subject ${subjectId}...`);
                const quizResult = await checkActiveQuiz(subjectId);

                if (quizResult.success && quizResult.active && quizResult.quiz) {
                    console.log('[Activity Poll] Quiz ATIVO encontrado:', quizResult.quiz.title);
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

                // 2. Verificar LiveActivity (sistema de Transcrição)
                const activityResult = await getActiveActivity(subjectId);
                console.log('[Activity Poll] LiveActivity result:', JSON.stringify(activityResult, null, 2));

                if (activityResult.success && activityResult.active && activityResult.activity) {
                    console.log('[Activity Poll] LiveActivity ATIVA encontrada:', activityResult.activity.title);
                    setLiveActivity(activityResult.activity);
                    setShowActivityPopup(true);
                } else {
                    console.log('[Activity Poll] Nenhuma atividade ativa');
                    setLiveActivity(null);
                    setShowActivityPopup(false);
                }
            } catch (error) {
                console.log('[Activity Poll] Erro ao verificar atividades:', error);
            }
        };

        // Verificar imediatamente
        checkForActivities();

        // Polling a cada 5 segundos
        pollingRef.current = setInterval(checkForActivities, 5000);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [subjectId, quizStarted, activityStarted]);

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

    const handleStartActivity = () => {
        if (liveActivity) {
            setActivityStarted(true);
            setShowActivityPopup(false);
            if (pollingRef.current) clearInterval(pollingRef.current);

            router.push({
                pathname: './live-activity',
                params: { activity: JSON.stringify(liveActivity) }
            } as any);
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
        professor: 'Prof. Dr. Arnaldo Silva',
        code: 'MAT342',
        imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwv2wIhDYaEEhq6ALucXryaJd3_iE7nIannnYITlQ2lT4teSVDHhII-lZMdLI_-CeXo1rbJXxndpoYHZylIzN8qP0LlpRVW3TI0DNiM62qX7CyEKrECZt8X5h66V60-kJIqF7KcP6FkAqDXWoatiu-GhzOfViSnNRoVmijyHVoiVRpI9dfDA8nAe_PQ0_0IPimNJQEd7ofvcge2wVlwZ6VesOKtIbWIWaavtCusp6dpAu3_BFKA1wfZ2EeO6eIaKzLiC1SdUbL81E',
        schedule: 'Terças e Quintas, 10:00 - 12:00',
        location: 'Sala B-204',
        pendingActivities: 3,
    };


    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Detalhes da Disciplina</Text>
                    <View style={styles.placeholder} />
                </View>

                {/* Debug Info - Remover depois */}
                <View style={{ padding: 5, alignItems: 'center', backgroundColor: '#333' }}>
                    <Text style={{ color: '#fff', fontSize: 10 }}>
                        Poll: {quizStarted ? 'Started' : 'Checking'} |
                        ActiveQuiz: {activeQuiz ? 'Yes' : 'No'} |
                        LiveAct: {liveActivity ? liveActivity.status : 'None'} |
                        SubjID: {subjectId}
                    </Text>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
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
                            style={styles.primaryButton}
                            activeOpacity={0.8}
                            onPress={() => console.log('Registrar presença')}
                        >
                            <MaterialIcons name="how-to-reg" size={24} color={colors.white} />
                            <Text style={styles.primaryButtonText}>Registrar Minha Presença</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            activeOpacity={0.8}
                            onPress={() => console.log('Ver atividades')}
                        >
                            <MaterialIcons name="assignment" size={24} color={colors.white} />
                            <Text style={styles.secondaryButtonText}>Ver Atividades e Quizzes</Text>
                            {subjectData.pendingActivities > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{subjectData.pendingActivities}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            activeOpacity={0.8}
                            onPress={() => router.push({
                                pathname: './materials',
                                params: { subject: subjectName }
                            })}
                        >
                            <MaterialIcons name="folder" size={24} color={colors.white} />
                            <Text style={styles.secondaryButtonText}>Ver Materiais de Aula</Text>
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
                                <MaterialIcons name="quiz" size={20} color="#10b981" />
                                <Text style={styles.quizInfoText}>
                                    {activeQuiz?.question_count || 10} perguntas
                                </Text>
                            </View>
                            <View style={styles.quizInfoItem}>
                                <MaterialIcons name="timer" size={20} color="#f59e0b" />
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
                                    color="#10b981"
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
                            onPress={handleStartActivity}
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
                    <MaterialIcons name="check-circle" size={20} color="#10b981" />
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
        backgroundColor: colors.backgroundDark,
    },
    backButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -12,
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
    },
    subjectCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.base,
        backgroundColor: colors.backgroundDark,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.base,
        minHeight: 72,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.zinc700,
    },
    subjectInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    subjectName: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 4,
    },
    professorInfo: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
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
        borderTopColor: colors.zinc800,
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
        color: colors.zinc400,
    },
    infoValue: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
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
        backgroundColor: colors.zinc800,
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.lg,
        borderRadius: 12,
        height: 56,
        position: 'relative',
    },
    secondaryButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    badge: {
        position: 'absolute',
        top: 12,
        right: 16,
        backgroundColor: '#ef4444',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
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
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.base,
    },
    quizPopup: {
        backgroundColor: colors.zinc900,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 350,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#10b981',
    },
    quizPopupIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    quizPopupEmoji: {
        fontSize: 40,
    },
    quizPopupTitle: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: spacing.xs,
    },
    quizPopupSubtitle: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc300,
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
        color: colors.zinc300,
    },
    startQuizButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: '#10b981',
        borderRadius: borderRadius.lg,
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
        borderTopColor: 'rgba(16, 185, 129, 0.3)',
    },
    quizAnsweredText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: '#10b981',
    },
});
