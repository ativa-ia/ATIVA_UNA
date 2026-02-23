import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getMyNotifications, deleteMyNotification, AppNotification } from '@/services/api';

const TYPE_CONFIG: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string; label: string }> = {
    quiz: { icon: 'quiz', color: '#6366F1', bg: '#EEF2FF', label: 'Quiz' },
    summary: { icon: 'description', color: '#059669', bg: '#ECFDF5', label: 'Resumo' },
    open_question: { icon: 'help-outline', color: '#D97706', bg: '#FFFBEB', label: 'Pergunta' },
    material: { icon: 'book', color: '#2563EB', bg: '#EFF6FF', label: 'Material' },
    notice: { icon: 'campaign', color: '#D97706', bg: '#FFFBEB', label: 'Aviso' },
    general: { icon: 'notifications', color: '#6B7280', bg: '#F3F4F6', label: 'Geral' },
};

export default function StudentNotificationsScreen() {
    const insets = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(true);

    const PER_PAGE = 15;

    const fetchNotifications = async (nextPage = 1, isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            if (nextPage > 1) setLoadingMore(true);

            const data = await getMyNotifications({ page: nextPage, per_page: PER_PAGE });
            if (data.success) {
                setNotifications(prev => (nextPage === 1 ? data.notifications : [...prev, ...data.notifications]));
                setPage(nextPage);
                setHasNext(Boolean(data.pagination?.has_next));
            }
        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    const handleDeleteNotification = async (notificationId: number) => {
        const result = await deleteMyNotification(notificationId);
        if (!result.success) return;
        setNotifications(prev => prev.filter(item => item.id !== notificationId));
    };

    const handleLoadMore = () => {
        if (loading || refreshing || loadingMore || !hasNext) return;
        fetchNotifications(page + 1);
    };

    // Refresh on focus
    useFocusEffect(
        useCallback(() => {
            fetchNotifications(1, true);
        }, [])
    );

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Agora';
        if (diffMin < 60) return `${diffMin}min atrás`;
        if (diffHours < 24) return `${diffHours}h atrás`;
        if (diffDays < 7) return `${diffDays}d atrás`;
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const renderItem = ({ item }: { item: AppNotification }) => {
        const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;

        return (
            <View style={styles.card}>
                <View style={styles.row}>
                    <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                        <MaterialIcons name={config.icon} size={20} color={config.color} />
                    </View>

                    <View style={styles.textArea}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.time}>{formatDate(item.created_at)}</Text>
                        </View>

                        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>

                        {item.subject_name && (
                            <View style={styles.badgeRow}>
                                <View style={[styles.badge, { backgroundColor: config.bg }]}>
                                    <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
                                </View>
                                <Text style={styles.subject}>· {item.subject_name}</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity style={styles.removeButton} onPress={() => handleDeleteNotification(item.id)}>
                        <MaterialIcons name="close" size={18} color={colors.zinc400} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[colors.primary, '#3B82F6']}
                style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notificações</Text>
                <View style={{ width: 40 }} />
            </LinearGradient>

            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={notifications}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.listContent}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.3}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(1, true)} />
                        }
                        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} /> : null}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="notifications-none" size={64} color={colors.zinc300} />
                                <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
                                <Text style={styles.emptySubtext}>
                                    Quando o professor enviar atividades, elas aparecerão aqui.
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.lg,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        fontFamily: typography.fontFamily.display,
    },
    content: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        marginTop: -spacing.md,
        paddingTop: spacing.md,
    },
    listContent: {
        padding: spacing.base,
        gap: spacing.sm,
    },
    // Card
    card: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        borderWidth: 1,
        borderColor: colors.zinc100,
    },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.zinc100,
    },
    textArea: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    title: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate800,
        fontFamily: typography.fontFamily.display,
        flex: 1,
        marginRight: spacing.sm,
    },
    time: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc400,
        fontFamily: typography.fontFamily.body,
    },
    message: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc600,
        fontFamily: typography.fontFamily.body,
        lineHeight: 19,
        marginBottom: spacing.xs,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        fontFamily: typography.fontFamily.body,
    },
    subject: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc500,
        fontFamily: typography.fontFamily.body,
    },
    // Empty state
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.zinc500,
        fontFamily: typography.fontFamily.display,
    },
    emptySubtext: {
        marginTop: spacing.xs,
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
        fontFamily: typography.fontFamily.body,
        textAlign: 'center',
        lineHeight: 20,
    },
});
