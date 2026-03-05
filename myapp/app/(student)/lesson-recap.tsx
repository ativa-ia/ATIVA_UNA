import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
    Animated,
    LayoutAnimation,
    UIManager,
    Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getRecapById, LessonRecap } from '@/services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { BlurView } from 'expo-blur';

export default function LessonRecapScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [recap, setRecap] = useState<LessonRecap | null>(null);
    const [loading, setLoading] = useState(true);
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
                day: '2-digit', month: '2-digit', year: 'numeric'
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
                    Recap da Aula
                </Text>
            </View>
        </LinearGradient>
    );

    if (loading) {
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

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>

                {/* Cabeçalho do Recap */}
                <View style={styles.headerCard}>
                    <Text style={styles.courseName}>{recap.subject_name}</Text>
                    <Text style={styles.title}>{recap.title}</Text>

                    <View style={styles.metaRow}>
                        <View style={styles.metaBadge}>
                            <MaterialIcons name="event" size={16} color={colors.primary} />
                            <Text style={styles.metaText}>{formatDate(recap.created_at)}</Text>
                        </View>
                        {recap_data.duration_minutes && (
                            <View style={styles.metaBadge}>
                                <MaterialIcons name="schedule" size={16} color={colors.primary} />
                                <Text style={styles.metaText}>{recap_data.duration_minutes} min</Text>
                            </View>
                        )}
                        <View style={styles.metaBadge}>
                            <MaterialIcons name="person" size={16} color={colors.primary} />
                            <Text style={styles.metaText}>Prof. {recap.teacher_name}</Text>
                        </View>
                    </View>
                </View>

                {/* Resumo da IA */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="robot-outline" size={24} color={colors.primary} />
                        <Text style={styles.sectionTitle}>Resumo da Aula</Text>
                    </View>
                    <Text style={styles.aiSummaryText}>{recap.ai_summary}</Text>
                </View>

                {/* Conteúdos Exibidos */}
                {recap_data.contents_shown && recap_data.contents_shown.length > 0 && (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <MaterialIcons name="screen-share" size={24} color={colors.primary} />
                            <Text style={styles.sectionTitle}>Conteúdos Exibidos</Text>
                        </View>
                        <Text style={styles.sectionDesc}>Materiais que o professor mostrou no telão durante a aula:</Text>

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

                {/* Timeline */}
                {recap_data.timeline && recap_data.timeline.length > 0 && (
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
        backgroundColor: colors.backgroundLight || '#f8fafc',
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
