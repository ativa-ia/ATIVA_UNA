import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCard } from '@/components/cards/MaterialCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { Material } from '@/types';
import { getStudentMaterials } from '@/services/api';

/**
 * MaterialsScreen - Materiais de Aula (Aluno)
 * Tela para o aluno visualizar materiais de aula
 */
export default function MaterialsScreen() {
    const params = useLocalSearchParams();
    const initialSubject = params.subject as string || 'all';
    const [selectedSubject, setSelectedSubject] = useState(initialSubject);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadMaterials = async () => {
        try {
            const data = await getStudentMaterials();
            setMaterials(data);
        } catch (error) {
            console.error('Erro ao carregar materiais:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadMaterials();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadMaterials();
    };

    // Extract unique subjects
    const subjects = ['all', ...Array.from(new Set(materials.map(m => m.subject || 'Outros')))];

    const filteredMaterials = selectedSubject === 'all'
        ? materials
        : materials.filter(m => m.subject === selectedSubject);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Materiais de Aula</Text>
                    <TouchableOpacity style={styles.searchButton}>
                        <MaterialIcons name="search" size={24} color={colors.white} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Carregando materiais...</Text>
                    </View>
                ) : (
                    <>
                        {/* Subject Filter */}
                        <View style={{ height: 60 }}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filterScroll}
                            >
                                {subjects.map((subject) => (
                                    <TouchableOpacity
                                        key={subject}
                                        style={[
                                            styles.filterChip,
                                            selectedSubject === subject && styles.filterChipActive,
                                        ]}
                                        onPress={() => setSelectedSubject(subject)}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                selectedSubject === subject && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {subject === 'all' ? 'Todas' : subject}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Materials List */}
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                            }
                        >
                            <Text style={styles.sectionTitle}>
                                {filteredMaterials.length} {filteredMaterials.length === 1 ? 'material' : 'materiais'}
                            </Text>

                            {filteredMaterials.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <MaterialIcons name="folder-off" size={48} color={colors.slate600} />
                                    <Text style={styles.emptyText}>Nenhum material encontrado</Text>
                                </View>
                            ) : (
                                filteredMaterials.map((material) => (
                                    <MaterialCard
                                        key={material.id}
                                        material={material}
                                        darkMode
                                    />
                                ))
                            )}
                        </ScrollView>
                    </>
                )}
            </View>
        </SafeAreaView>
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
        borderBottomWidth: 1,
        borderBottomColor: colors.slate800,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    searchButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterScroll: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    filterChip: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.slate700,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.slate300,
    },
    filterChipTextActive: {
        color: colors.white,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        gap: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
        marginBottom: spacing.sm,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.slate400,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
    },
    emptyText: {
        marginTop: spacing.sm,
        color: colors.slate500,
    },
});
