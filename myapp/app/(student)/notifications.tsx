import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { API_URL } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Notification {
    id: number;
    title: string;
    message: string;
    type: 'quiz' | 'material' | 'general';
    created_at: string;
    subject_id: number;
}

export default function StudentNotificationsScreen() {
    const insets = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [userId, setUserId] = useState<number | null>(null);

    const fetchNotifications = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');

            // Primeiro, buscar o ID do usuário logado
            const meResponse = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const meData = await meResponse.json();

            if (!meData.success || !meData.user) {
                console.error('Usuário não encontrado');
                setLoading(false);
                return;
            }

            const studentId = meData.user.id;
            setUserId(studentId);

            // Buscar notificações do aluno
            const response = await fetch(`${API_URL}/notifications/student/${studentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setNotifications(data.notifications);
            }
        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'quiz': return 'quiz';
            case 'material': return 'book';
            default: return 'notifications';
        }
    };

    const renderItem = ({ item }: { item: Notification }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: item.type === 'quiz' ? colors.primaryOpacity20 : colors.zinc100 }]}>
                    <MaterialIcons
                        name={getIconForType(item.type)}
                        size={24}
                        color={item.type === 'quiz' ? colors.primary : colors.zinc600}
                    />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardDate}>
                        {new Date(item.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                    </Text>
                </View>
            </View>
            <Text style={styles.cardMessage}>{item.message}</Text>
        </View>
    );

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
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="notifications-none" size={64} color={colors.zinc300} />
                                <Text style={styles.emptyText}>Nenhuma notificação ainda</Text>
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
        gap: spacing.md,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.zinc100,
    },
    cardHeader: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate800,
        fontFamily: typography.fontFamily.display,
    },
    cardDate: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc500,
        fontFamily: typography.fontFamily.body,
    },
    cardMessage: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc600,
        fontFamily: typography.fontFamily.body,
        lineHeight: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.zinc500,
        fontFamily: typography.fontFamily.body,
    },
});
