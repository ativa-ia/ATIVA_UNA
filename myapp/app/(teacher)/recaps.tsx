import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getSubjectRecaps, getSubjects, LessonRecap, Subject as APISubject } from '@/services/api';

interface SubjectOption {
    id: number;
    name: string;
}

export default function TeacherRecapsScreen() {
    const { subjectId, subjectName } = useLocalSearchParams();
    const parsedSubjectId = Number(subjectId as string);
    const hasValidSubjectId = Number.isFinite(parsedSubjectId) && parsedSubjectId > 0;
    const insets = useSafeAreaInsets();

    const [recaps, setRecaps] = useState<LessonRecap[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
    const [showSubjectPicker, setShowSubjectPicker] = useState(false);

    useEffect(() => {
        if (hasValidSubjectId) {
            loadRecaps();
        } else {
            initSubjectSelection();
        }
    }, [hasValidSubjectId, parsedSubjectId]);

    const initSubjectSelection = async () => {
        try {
            setLoading(true);
            setError(null);

            const subjects = await getSubjects();
            const options: SubjectOption[] = subjects.map((subject: APISubject) => ({
                id: subject.id,
                name: subject.name,
            }));

            if (options.length === 1) {
                const only = options[0];
                router.replace({
                    pathname: '/(teacher)/recaps',
                    params: { subjectId: String(only.id), subjectName: only.name },
                });
                return;
            }

            setSubjectOptions(options);
            setShowSubjectPicker(options.length > 1);

            if (options.length === 0) {
                setError('Nenhuma disciplina encontrada para abrir recaps.');
            }
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar disciplinas para recaps.');
        } finally {
            setLoading(false);
        }
    };

    const loadRecaps = async () => {
        if (!hasValidSubjectId) {
            await initSubjectSelection();
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await getSubjectRecaps(parsedSubjectId);
            if (data.success && data.recaps) {
                setRecaps(data.recaps);
            } else {
                setError(data.error || 'Erro ao carregar recaps');
            }
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar recaps');
        } finally {
            setLoading(false);
        }
    };

    const closeSubjectPicker = () => {
        setShowSubjectPicker(false);
        router.replace('/(teacher)/dashboard');
    };

    const handleSelectSubject = (subject: SubjectOption) => {
        setShowSubjectPicker(false);
        router.replace({
            pathname: '/(teacher)/recaps',
            params: { subjectId: String(subject.id), subjectName: subject.name },
        });
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
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
                    {hasValidSubjectId ? `Recaps - ${subjectName || 'Disciplina'}` : 'Recaps - selecionar disciplina'}
                </Text>
            </View>
            <TouchableOpacity onPress={loadRecaps} style={{ padding: spacing.xs }}>
                <MaterialIcons name="refresh" size={24} color={colors.white} />
            </TouchableOpacity>
        </LinearGradient>
    );

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <MaterialIcons name="inbox" size={48} color={colors.slate300} />
                <Text style={styles.emptyText}>Nenhum recap encontrado desta disciplina.</Text>
            </View>
        );
    };

    const renderItem = ({ item }: { item: LessonRecap }) => {
        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(`/(teacher)/teacher-lesson-recap?id=${item.id}`)}
            >
                <View style={styles.accentBar} />
                <View style={styles.cardBody}>
                    <View style={styles.headerRow}>
                        <View style={styles.iconWrap}>
                            <MaterialIcons name="history-edu" size={20} color="#ec4899" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                        </View>
                        {item.shared_with_students && (
                            <View style={styles.sharedBadge}>
                                <MaterialIcons name="public" size={12} color="#16a34a" />
                                <Text style={styles.sharedBadgeText}>Compartilhado</Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.preview} numberOfLines={2}>
                        {item.status === 'generating'
                            ? 'Gerando recap...'
                            : item.ai_summary
                                ? item.ai_summary.substring(0, 120) + '...'
                                : 'Sem resumo gerado.'}
                    </Text>

                    {item.status === 'generating' && (
                        <ActivityIndicator style={{ alignSelf: 'flex-start', marginTop: spacing.xs }} size="small" color="#ec4899" />
                    )}

                    <View style={styles.chips}>
                        <View style={[styles.chip, { backgroundColor: '#fef2f2' }]}>
                            <MaterialIcons name="screen-share" size={12} color="#ef4444" />
                            <Text style={[styles.chipText, { color: '#991b1b' }]}>{item.recap_data?.contents_shown?.length || 0} conteúdos</Text>
                        </View>
                        <View style={[styles.chip, { backgroundColor: '#fffbeb' }]}>
                            <MaterialIcons name="task-alt" size={12} color="#f59e0b" />
                            <Text style={[styles.chipText, { color: '#92400e' }]}>{item.recap_data?.activities_performed?.length || 0} atividades</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {renderHeader()}

            {loading && recaps.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ec4899" />
                    <Text style={styles.loadingText}>Carregando recaps...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={48} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadRecaps}>
                        <Text style={styles.retryButtonText}>Tentar Novamente</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={recaps}
                    renderItem={renderItem}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmpty}
                />
            )}

            <Modal
                visible={showSubjectPicker}
                transparent
                animationType="fade"
                onRequestClose={closeSubjectPicker}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <LinearGradient
                            colors={['#ec4899', '#db2777']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.modalHeader}
                        >
                            <View style={styles.modalHeaderIconWrap}>
                                <MaterialIcons name="history-edu" size={20} color={colors.white} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Escolha a disciplina do recap</Text>
                                <Text style={styles.modalSubtitle}>
                                    Selecione uma disciplina para abrir a timeline de recapitulação.
                                </Text>
                            </View>
                        </LinearGradient>

                        <View style={styles.modalList}>
                            {subjectOptions.map((subject) => (
                                <TouchableOpacity
                                    key={subject.id}
                                    style={styles.modalItem}
                                    activeOpacity={0.85}
                                    onPress={() => handleSelectSubject(subject)}
                                >
                                    <View style={styles.modalItemIcon}>
                                        <MaterialIcons name="school" size={18} color="#db2777" />
                                    </View>
                                    <Text style={styles.modalItemText}>{subject.name}</Text>
                                    <MaterialIcons name="chevron-right" size={20} color={colors.slate500} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelButton} onPress={closeSubjectPicker}>
                                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundLight || '#f9fafb',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.sm,
        color: colors.slate500,
        fontFamily: typography.fontFamily.body,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    errorText: {
        color: colors.danger,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        fontFamily: typography.fontFamily.body,
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
    },
    retryButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
    },
    emptyContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: colors.slate500,
        marginTop: spacing.md,
        fontFamily: typography.fontFamily.body,
        textAlign: 'center',
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: spacing['4xl'],
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.slate100,
        marginBottom: spacing.md,
        elevation: 2,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        flexDirection: 'row',
    },
    accentBar: {
        width: 4,
        backgroundColor: '#ec4899',
    },
    cardBody: {
        flex: 1,
        padding: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        backgroundColor: '#fce7f3',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    title: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate800,
    },
    date: {
        fontSize: typography.fontSize.xs,
        color: colors.slate500,
        marginTop: 2,
    },
    sharedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: spacing.sm,
    },
    sharedBadgeText: {
        fontSize: 10,
        fontWeight: typography.fontWeight.semibold,
        color: '#166534',
        marginLeft: 4,
    },
    preview: {
        fontSize: typography.fontSize.sm,
        color: colors.slate600,
        lineHeight: 20,
        marginBottom: spacing.sm,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.default,
        backgroundColor: colors.slate100,
    },
    chipText: {
        fontSize: 12,
        fontWeight: typography.fontWeight.medium,
        color: colors.slate700,
        marginLeft: 4,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        backgroundColor: 'rgba(15, 23, 42, 0.58)',
    },
    modalContainer: {
        width: '100%',
        maxWidth: 700,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: colors.white,
        elevation: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.24,
        shadowRadius: 22,
    },
    modalHeader: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.base,
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
    },
    modalHeaderIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
    },
    modalSubtitle: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.88)',
        fontFamily: typography.fontFamily.body,
        fontSize: typography.fontSize.sm,
    },
    modalList: {
        padding: spacing.base,
        gap: spacing.sm,
    },
    modalItem: {
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: 14,
        backgroundColor: colors.slate50,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.base,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    modalItemIcon: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: 'rgba(219, 39, 119, 0.14)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalItemText: {
        flex: 1,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.base,
    },
    modalFooter: {
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.base,
    },
    modalCancelButton: {
        backgroundColor: colors.slate100,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
    },
    modalCancelButtonText: {
        color: colors.slate700,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
});
