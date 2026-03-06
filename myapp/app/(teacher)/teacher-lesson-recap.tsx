import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getRecapById, generateRecap, shareRecap, LessonRecap } from '@/services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

export default function TeacherLessonRecapScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [recap, setRecap] = useState<LessonRecap | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadRecap();
    }, [id]);

    const loadRecap = async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const response = await getRecapById(parseInt(id, 10));
            if (response.success && response.recap) {
                setRecap(response.recap);
            } else {
                setError(response.error || 'Não foi possível carregar o recap da aula.');
            }
        } catch (err) {
            setError('Erro de conexão ao carregar recap.');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateRecap = async () => {
        if (!recap) return;

        Alert.alert(
            'Regerar Recap',
            'Deseja gerar um novo resumo usando IA? O resumo atual será substituído.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Regerar',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            const response = await generateRecap(recap.session_id);
                            if (response.success && response.recap) {
                                setRecap(response.recap);
                                Alert.alert('Sucesso', 'Recap está sendo recriado. Atualize a tela em instantes.');
                                loadRecap();
                            } else {
                                Alert.alert('Erro', response.error || 'Erro ao regerar recap');
                            }
                        } catch (e) {
                            Alert.alert('Erro', 'Erro de conexão ao regerar recap.');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleShareRecap = async () => {
        if (!recap || recap.shared_with_students) return;

        setActionLoading(true);
        try {
            const response = await shareRecap(recap.id);
            if (response.success && response.recap) {
                setRecap(response.recap);
                Alert.alert('Sucesso', 'O recap foi disponibilizado para os alunos e notificado.');
            } else {
                Alert.alert('Erro', response.error || 'Erro ao compartilhar recap');
            }
        } catch (e) {
            Alert.alert('Erro', 'Erro de conexão ao compartilhar recap.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenContent = async (url: string) => {
        if (!url) return;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            }
        } catch (error) {
            console.error('Error opening URL:', error);
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch (e) {
            return dateString;
        }
    };

    const getEventIcon = (type: string): keyof typeof MaterialCommunityIcons.glyphMap => {
        if (type.includes('quiz')) return 'help-circle-outline';
        if (type.includes('summary')) return 'file-document-outline';
        if (type.includes('transcription')) return 'microphone-outline';
        if (type.includes('video')) return 'play-circle-outline';
        if (type.includes('document')) return 'file-pdf-box';
        if (type.includes('content')) return 'monitor-dashboard';
        return 'record-circle-outline';
    };

    const getEventColor = (type: string) => {
        if (type.includes('quiz')) return '#f59e0b'; // Amber
        if (type.includes('summary')) return '#10b981'; // Emerald
        if (type.includes('transcription')) return '#6366f1'; // Indigo
        return colors.primary;
    }

    const sanitizeSummaryText = (value?: string) => {
        const text = String(value || '').trim();
        if (!text) return '';
        return text
            .replace(/^\s*\[\s*TYPE\s*:\s*SUM\w*\s*\]\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const renderActivitiesPerformed = () => {
        const activities = recap?.recap_data?.activities_performed || [];
        if (!activities.length) return null;

        return (
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <MaterialIcons name="task-alt" size={24} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Atividades Enviadas</Text>
                </View>
                <Text style={styles.sectionDesc}>Quiz e resumo enviados com participação e desempenho.</Text>

                <View style={styles.activitiesList}>
                    {activities.map((activity, index) => {
                        const isQuiz = (activity.type || '').includes('quiz');
                        const participants = activity.participants || [];
                        const top = activity.top_performers || [];
                        const attention = activity.needs_attention || [];
                        const deliveredCount = activity.delivered_count ?? activity.enrolled_count ?? 0;

                        return (
                            <View key={`${activity.activity_id || index}`} style={styles.activityCard}>
                                <View style={styles.activityHeader}>
                                    <View style={styles.activityBadge}>
                                        <MaterialIcons
                                            name={isQuiz ? 'quiz' : 'description'}
                                            size={14}
                                            color={isQuiz ? '#92400e' : '#166534'}
                                        />
                                        <Text style={[styles.activityBadgeText, { color: isQuiz ? '#92400e' : '#166534' }]}>
                                            {isQuiz ? 'Quiz' : 'Resumo'}
                                        </Text>
                                    </View>
                                    <Text style={styles.activityTitle}>{activity.title || 'Atividade sem título'}</Text>
                                </View>

                                <View style={styles.metricsRow}>
                                    {isQuiz ? (
                                        <>
                                            <Text style={styles.metricText}>Participação: {activity.participation_rate ?? 0}%</Text>
                                            <Text style={styles.metricText}>Respostas: {activity.response_count ?? 0}/{activity.enrolled_count ?? 0}</Text>
                                            <Text style={styles.metricText}>Média: {activity.average_score ?? 0}%</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.metricText}>Distribuído para: {deliveredCount} aluno(s)</Text>
                                        </>
                                    )}
                                    {isQuiz && activity.best_score !== undefined && activity.worst_score !== undefined && (
                                        <Text style={styles.metricText}>Faixa: {activity.worst_score}% - {activity.best_score}%</Text>
                                    )}
                                </View>

                                {isQuiz && activity.quiz?.questions && activity.quiz.questions.length > 0 && (
                                    <View style={styles.blockWrap}>
                                        <Text style={styles.blockTitle}>Perguntas enviadas ({activity.quiz.question_count || activity.quiz.questions.length})</Text>
                                        {activity.quiz.questions.map((q, qIndex) => {
                                            const optionLetters = ['A', 'B', 'C', 'D', 'E'];
                                            const correctIndex = typeof q.correct === 'number' ? q.correct : -1;
                                            return (
                                                <View key={qIndex} style={styles.questionCard}>
                                                    <Text style={styles.questionTitle}>{qIndex + 1}. {q.question || 'Pergunta sem texto'}</Text>
                                                    {(q.options || []).map((opt, optIndex) => (
                                                        <Text
                                                            key={optIndex}
                                                            style={[
                                                                styles.optionText,
                                                                correctIndex === optIndex && styles.correctOptionText
                                                            ]}
                                                        >
                                                            {optionLetters[optIndex] || '?'} ) {opt}
                                                        </Text>
                                                    ))}
                                                    {correctIndex >= 0 && (
                                                        <Text style={styles.correctHint}>Resposta correta: {optionLetters[correctIndex] || correctIndex + 1}</Text>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}

                                {!isQuiz && activity.summary?.text && (
                                    <View style={styles.blockWrap}>
                                        <Text style={styles.blockTitle}>Resumo enviado</Text>
                                        <Text style={styles.summaryPreview}>{sanitizeSummaryText(activity.summary.text)}</Text>
                                    </View>
                                )}

                                {isQuiz && top.length > 0 && (
                                    <View style={styles.blockWrap}>
                                        <Text style={styles.blockTitle}>Destaques da turma</Text>
                                        {top.slice(0, 5).map((p, pIndex) => (
                                            <Text key={pIndex} style={styles.blockItem}>• {p.student_name || 'Aluno'} - {Math.round(p.percentage ?? 0)}%</Text>
                                        ))}
                                    </View>
                                )}

                                {isQuiz && attention.length > 0 && (
                                    <View style={styles.blockWrap}>
                                        <Text style={styles.blockTitle}>Pontos de atenção</Text>
                                        {attention.slice(0, 5).map((p, pIndex) => (
                                            <Text key={pIndex} style={styles.blockItem}>• {p.student_name || 'Aluno'} - {Math.round(p.percentage ?? 0)}%</Text>
                                        ))}
                                    </View>
                                )}

                                {isQuiz && participants.length === 0 && (
                                    <Text style={styles.blockHint}>Sem respostas registradas para esta atividade.</Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderHeader = () => (
        <LinearGradient
            colors={['#ec4899', '#db2777']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
                paddingTop: insets.top + spacing.sm,
                paddingBottom: spacing.md,
                paddingHorizontal: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            <TouchableOpacity onPress={() => router.back()} style={{ padding: spacing.xs }}>
                <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={{ color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>
                    Gerenciar Recap
                </Text>
            </View>
            <TouchableOpacity
                onPress={handleGenerateRecap}
                style={{ padding: spacing.xs, opacity: recap ? 1 : 0.5 }}
                disabled={!recap || actionLoading}
            >
                <MaterialIcons name="autorenew" size={24} color={colors.white} />
            </TouchableOpacity>
        </LinearGradient>
    );

    if (loading && !recap) {
        return (
            <View style={styles.container}>
                {renderHeader()}
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Carregando resumo da aula...</Text>
                </View>
            </View>
        );
    }

    if (error || !recap) {
        return (
            <View style={styles.container}>
                {renderHeader()}
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={48} color={colors.danger} />
                    <Text style={styles.errorText}>{error || 'Recap não encontrado'}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadRecap}>
                        <Text style={styles.retryButtonText}>Tentar Novamente</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const { recap_data } = recap;

    return (
        <View style={styles.container}>
            {renderHeader()}

            {/* Barra de Ações Rápidas Fixa no Topo */}
            <View style={styles.actionBar}>
                <View style={styles.statusIndicator}>
                    <View style={[styles.statusDot, { backgroundColor: recap.shared_with_students ? '#10b981' : '#f59e0b' }]} />
                    <Text style={styles.statusText}>
                        {recap.shared_with_students ? 'Compartilhado com alunos' : 'Aguardando envio aos alunos'}
                    </Text>
                </View>
                {!recap.shared_with_students && (
                    <TouchableOpacity
                        style={styles.shareButton}
                        onPress={handleShareRecap}
                        disabled={actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <>
                                <MaterialIcons name="send" size={16} color={colors.white} />
                                <Text style={styles.shareButtonText}>Compartilhar</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>

                {/* Cabeçalho do Recap */}
                <View style={[styles.headerCard, recap.status === 'generating' && { opacity: 0.6 }]}>
                    <Text style={styles.courseName}>{recap.subject_name}</Text>
                    <Text style={styles.title}>{recap.title}</Text>

                    <View style={styles.metaRow}>
                        <View style={styles.metaBadge}>
                            <MaterialIcons name="event" size={16} color={colors.primary} />
                            <Text style={styles.metaText}>{formatDate(recap.created_at)}</Text>
                        </View>
                        {recap_data?.duration_minutes && (
                            <View style={styles.metaBadge}>
                                <MaterialIcons name="schedule" size={16} color={colors.primary} />
                                <Text style={styles.metaText}>{recap_data.duration_minutes} min</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Resumo da IA */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="robot-outline" size={24} color={colors.primary} />
                        <Text style={styles.sectionTitle}>Resumo da Aula</Text>
                        {recap.status === 'generating' && (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
                        )}
                    </View>
                    <Text style={styles.aiSummaryText}>
                        {recap.status === 'generating' ? 'O resumo está sendo recriado pela IA, por favor atualize em instantes...' : recap.ai_summary}
                    </Text>
                </View>

                {/* Conteúdos Exibidos */}
                {recap_data?.contents_shown && recap_data.contents_shown.length > 0 && (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <MaterialIcons name="screen-share" size={24} color={colors.primary} />
                            <Text style={styles.sectionTitle}>Conteúdos Exibidos</Text>
                        </View>
                        <Text style={styles.sectionDesc}>Materiais que você mostrou no telão durante a aula:</Text>

                        <View style={styles.contentsGrid}>
                            {recap_data.contents_shown.map((content, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.contentItem}
                                    onPress={() => content.url ? handleOpenContent(content.url) : null}
                                    disabled={!content.url}
                                >
                                    <View style={[styles.contentIconContainer, { backgroundColor: getEventColor(content.type) + '20' }]}>
                                        <MaterialCommunityIcons
                                            name={getEventIcon(content.type)}
                                            size={24}
                                            color={getEventColor(content.type)}
                                        />
                                    </View>
                                    <View style={styles.contentInfo}>
                                        <Text style={styles.contentItemTitle} numberOfLines={2}>{content.title}</Text>
                                        <Text style={styles.contentItemTime}>Exibido às {content.shown_at}</Text>
                                    </View>
                                    {content.url && (
                                        <MaterialIcons name="open-in-new" size={20} color={colors.textSecondary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {renderActivitiesPerformed()}

                {/* Timeline */}
                {recap_data?.timeline && recap_data.timeline.length > 0 && (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <MaterialIcons name="timeline" size={24} color={colors.primary} />
                            <Text style={styles.sectionTitle}>Linha do Tempo</Text>
                        </View>

                        <View style={styles.timeline}>
                            {recap_data.timeline.map((event, index) => (
                                <View key={index} style={styles.timelineItem}>
                                    <View style={styles.timelineTimeLine}>
                                        <View style={[styles.timelineDot, { backgroundColor: getEventColor(event.type) }]} />
                                        {index < recap_data.timeline.length - 1 && <View style={styles.timelineLine} />}
                                    </View>
                                    <View style={styles.timelineContent}>
                                        <Text style={styles.timelineTime}>{event.time}</Text>
                                        <Text style={styles.timelineDesc}>{event.description}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundLight || '#f9fafb',
    },
    actionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.white,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
        elevation: 2,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.sm,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: spacing.sm,
    },
    statusText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: colors.slate700,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    shareButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    errorText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.danger,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: spacing.xl,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
    },
    retryButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing['4xl'],
        gap: spacing.lg,
    },
    headerCard: {
        backgroundColor: colors.white,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    courseName: {
        fontSize: typography.fontSize.sm,
        color: colors.primary,
        fontWeight: typography.fontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.xs,
    },
    title: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.slate900,
        marginBottom: spacing.md,
        lineHeight: 32,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.slate50,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.slate200,
        gap: spacing.xs,
    },
    metaText: {
        fontSize: typography.fontSize.xs,
        color: colors.slate700,
        fontWeight: typography.fontWeight.medium,
    },
    sectionCard: {
        backgroundColor: colors.white,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate900,
    },
    sectionDesc: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    aiSummaryText: {
        fontSize: typography.fontSize.base,
        lineHeight: 24,
        color: colors.slate700,
    },
    contentsGrid: {
        gap: spacing.sm,
    },
    contentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        gap: spacing.md,
    },
    contentIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentInfo: {
        flex: 1,
    },
    contentItemTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: colors.slate900,
        marginBottom: 2,
    },
    contentItemTime: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
    },
    activitiesList: {
        gap: spacing.md,
    },
    activityCard: {
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.sm,
    },
    activityHeader: {
        gap: spacing.xs,
    },
    activityBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    activityBadgeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
    },
    activityTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate900,
    },
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    metricText: {
        fontSize: typography.fontSize.xs,
        color: colors.slate700,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    blockWrap: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        gap: 4,
    },
    blockTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate800,
    },
    blockItem: {
        fontSize: typography.fontSize.sm,
        color: colors.slate700,
    },
    blockHint: {
        fontSize: typography.fontSize.xs,
        color: colors.slate500,
    },
    summaryPreview: {
        fontSize: typography.fontSize.sm,
        color: colors.slate700,
        lineHeight: 20,
    },
    questionCard: {
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        gap: 4,
    },
    questionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate900,
        marginBottom: 2,
    },
    optionText: {
        fontSize: typography.fontSize.sm,
        color: colors.slate700,
    },
    correctOptionText: {
        color: '#166534',
        fontWeight: typography.fontWeight.semibold,
    },
    correctHint: {
        fontSize: typography.fontSize.xs,
        color: '#166534',
        marginTop: 2,
    },
    timeline: {
        marginTop: spacing.sm,
    },
    timelineItem: {
        flexDirection: 'row',
        minHeight: 60,
    },
    timelineTimeLine: {
        alignItems: 'center',
        width: 24,
        marginRight: spacing.md,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: colors.slate200,
        marginTop: 4,
        marginBottom: -4, // Connect to next dot
    },
    timelineContent: {
        flex: 1,
        paddingBottom: spacing.lg,
    },
    timelineTime: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        color: colors.primary,
        marginBottom: 2,
    },
    timelineDesc: {
        fontSize: typography.fontSize.sm,
        color: colors.slate700,
    },
});
