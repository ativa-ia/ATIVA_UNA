import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getSubjects, getSubjectMaterials, Material } from '@/services/api';

/**
 * MaterialsScreen - Meus Materiais (Professor)
 * Tela de gerenciamento de materiais do professor
 */

interface MaterialWithSubject extends Material {
    subject_name?: string;
}

export default function MaterialsScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const [materials, setMaterials] = useState<MaterialWithSubject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeNavId, setActiveNavId] = useState('materials');

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'materials', label: 'Materiais', iconName: 'folder' },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);
        switch (id) {
            case 'dashboard':
                router.replace('/(teacher)/dashboard');
                break;
            case 'materials':
                break;
            case 'reports':
                router.replace('/(teacher)/reports');
                break;
        }
    };

    // Buscar materiais do backend
    useEffect(() => {
        const fetchMaterials = async () => {
            try {
                // Buscar todas as disciplinas do professor
                const subjects = await getSubjects();

                // Buscar materiais de cada disciplina
                const allMaterials: MaterialWithSubject[] = [];
                for (const subject of subjects) {
                    try {
                        const materials = await getSubjectMaterials(subject.id);
                        materials.forEach((material: any) => {
                            allMaterials.push({
                                ...material,
                                subject_name: subject.name,
                            });
                        });
                    } catch (error) {
                        console.error(`Erro ao buscar materiais de ${subject.name}:`, error);
                    }
                }

                // Ordenar por data (mais recente primeiro)
                allMaterials.sort((a, b) => {
                    const dateA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
                    const dateB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
                    return dateB - dateA;
                });

                setMaterials(allMaterials);
            } catch (error) {
                console.error('Erro ao buscar materiais:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMaterials();
    }, []);

    const getIconForType = (type: string): keyof typeof MaterialIcons.glyphMap => {
        switch (type) {
            case 'pdf':
                return 'picture-as-pdf';
            case 'video':
                return 'videocam';
            case 'link':
                return 'link';
            default:
                return 'description';
        }
    };

    const formatDate = (dateString?: string): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const filteredMaterials = materials.filter(material =>
        material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (material.subject_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back-ios-new" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Meus Materiais</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <MaterialIcons name="search" size={24} color={colors.zinc400} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar por título ou turma..."
                            placeholderTextColor={colors.zinc400}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {/* Filter Chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipsContainer}
                    >
                        <TouchableOpacity style={styles.chip}>
                            <Text style={styles.chipText}>Ordenar por Data</Text>
                            <MaterialIcons name="expand-more" size={18} color={colors.zinc400} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chip}>
                            <Text style={styles.chipText}>Turma</Text>
                            <MaterialIcons name="expand-more" size={18} color={colors.zinc400} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chip}>
                            <Text style={styles.chipText}>Tipo</Text>
                            <MaterialIcons name="expand-more" size={18} color={colors.zinc400} />
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Materials List */}
                    <View style={styles.materialsList}>
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.loadingText}>Carregando materiais...</Text>
                            </View>
                        ) : filteredMaterials.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="folder-open" size={48} color={colors.zinc600} />
                                <Text style={styles.emptyText}>Nenhum material encontrado</Text>
                            </View>
                        ) : (
                            filteredMaterials.map((material) => (
                                <View key={material.id} style={styles.materialCard}>
                                    <View style={styles.materialIcon}>
                                        <MaterialIcons
                                            name={getIconForType(material.type)}
                                            size={24}
                                            color={colors.primary}
                                        />
                                    </View>
                                    <View style={styles.materialInfo}>
                                        <Text style={styles.materialTitle} numberOfLines={1}>
                                            {material.title}
                                        </Text>
                                        <Text style={styles.materialMeta} numberOfLines={1}>
                                            {material.subject_name || material.subject} • {material.upload_date || formatDate(material.uploaded_at)}
                                        </Text>
                                    </View>
                                    <View style={styles.materialActions}>
                                        <TouchableOpacity style={styles.actionButton}>
                                            <MaterialIcons name="edit" size={20} color={colors.zinc400} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionButton}>
                                            <MaterialIcons name="share" size={20} color={colors.zinc400} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]}>
                                            <MaterialIcons name="delete" size={20} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>

                {/* Floating Action Button */}
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => router.push('/(teacher)/upload-material')}
                >
                    <MaterialIcons name="add" size={28} color={colors.white} />
                </TouchableOpacity>

                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={handleNavPress}
                    darkMode
                />
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
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    placeholder: {
        width: 40,
        height: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.base,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        marginHorizontal: spacing.base,
        marginVertical: spacing.md,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.base,
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    chipsContainer: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
        paddingLeft: spacing.base,
        paddingRight: spacing.md,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
        marginRight: spacing.sm,
    },
    chipText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc200,
    },
    materialsList: {
        paddingHorizontal: spacing.base,
        gap: spacing.base,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: spacing['2xl'],
        gap: spacing.md,
    },
    loadingText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing['2xl'],
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    materialCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.zinc900,
        borderRadius: borderRadius.xl,
        padding: spacing.base,
        gap: spacing.base,
    },
    materialIcon: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.primaryOpacity20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    materialInfo: {
        flex: 1,
        minWidth: 0,
    },
    materialTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    materialMeta: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        marginTop: 2,
    },
    materialActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButton: {
        // Additional styling for delete button if needed
    },
    fab: {
        position: 'absolute',
        bottom: 130, // Above the navbar
        right: spacing.base,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
});
