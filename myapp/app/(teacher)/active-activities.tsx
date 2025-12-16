import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Platform,
    Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { LiveActivity, getActiveActivitiesList, endLiveActivity } from '@/services/api';

export default function ActiveActivitiesScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectId = params.subjectId as string;
    const subjectName = params.subjectName as string || 'Disciplina';

    const [activities, setActivities] = useState<LiveActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadActivities = async () => {
        if (!subjectId) return;
        try {
            const result = await getActiveActivitiesList(parseInt(subjectId));
            if (result.success) {
                setActivities(result.activities || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadActivities();
    }, [subjectId]);

    const onRefresh = () => {
        setRefreshing(true);
        loadActivities();
    };

    const handleEndActivity = async (activity: LiveActivity) => {
        const confirmEnd = () => {
            return new Promise((resolve) => {
                if (Platform.OS === 'web') {
                    resolve(window.confirm(`Deseja encerrar "${activity.title}"?`));
                } else {
                    Alert.alert(
                        "Encerrar Atividade",
                        `Deseja encerrar "${activity.title}"?`,
                        [
                            { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
                            { text: "Encerrar", style: "destructive", onPress: () => resolve(true) }
                        ]
                    );
                }
            });
        };

        if (await confirmEnd()) {
            try {
                const result = await endLiveActivity(activity.id);
                if (result.success) {
                    if (Platform.OS !== 'web') Alert.alert("Sucesso", "Atividade encerrada.");
                    loadActivities(); // Refresh list
                } else {
                    alert(result.error || "Falha ao encerrar atividade.");
                }
            } catch (error) {
                alert("Erro de conexão ao encerrar atividade.");
            }
        }
    };

    const renderItem = ({ item }: { item: LiveActivity }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <MaterialIcons
                        name={item.activity_type === 'quiz' ? 'quiz' : item.activity_type === 'summary' ? 'article' : 'help'}
                        size={24}
                        color={colors.primary}
                    />
                    <Text style={styles.cardTitle}>{item.title}</Text>
                </View>

                <Text style={styles.cardType}>
                    {item.activity_type === 'quiz' ? 'Quiz Interativo' :
                        item.activity_type === 'summary' ? 'Resumo de Aula' : 'Pergunta Aberta'}
                </Text>

                <Text style={styles.cardTime}>
                    Criada em: {new Date(item.starts_at || new Date()).toLocaleString()}
                </Text>
            </View>

            <TouchableOpacity
                style={styles.endButton}
                onPress={() => handleEndActivity(item)}
            >
                <MaterialIcons name="stop" size={20} color={colors.white} />
                <Text style={styles.endButtonText}>Encerrar</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Atividades Ativas</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.subHeader}>
                <Text style={styles.subjectName}>{subjectName}</Text>
                <Text style={styles.countText}>{activities.length} atividades em andamento</Text>
            </View>

            <FlatList
                data={activities}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="check-circle" size={64} color={colors.secondary} />
                            <Text style={styles.emptyText}>Nenhuma atividade ativa!</Text>
                            <Text style={styles.emptySubtext}>Tudo limpo por aqui.</Text>
                        </View>
                    ) : null
                }
            />
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
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    subHeader: {
        padding: spacing.md,
        backgroundColor: '#F0F9FF',
        borderBottomWidth: 1,
        borderBottomColor: '#BAE6FD',
    },
    subjectName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: '#0369A1',
    },
    countText: {
        fontSize: typography.fontSize.sm,
        color: '#0C4A6E',
        marginTop: 4,
    },
    listContent: {
        padding: spacing.md,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardContent: {
        flex: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        flex: 1,
    },
    cardType: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    cardTime: {
        fontSize: typography.fontSize.xs,
        color: colors.slate400,
    },
    endButton: {
        backgroundColor: colors.danger,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.default,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: spacing.sm,
    },
    endButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
        fontSize: typography.fontSize.sm,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing['4xl'],
    },
    emptyText: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
});
