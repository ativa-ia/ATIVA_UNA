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
    Linking,
    Alert,
    Platform,
} from 'react-native';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialCard } from '@/components/cards/MaterialCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { Material } from '@/types';
import { getStudentMaterials, API_URL } from '@/services/api';

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
    const [activeNavId, setActiveNavId] = useState('materials');

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'materials', label: 'Materiais', iconName: 'folder-open' },
        { id: 'calendar', label: 'Calendário', iconName: 'calendar-today' },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                router.push('./dashboard');
                break;
            case 'materials':
                // Already here
                break;
            case 'calendar':
                router.push('./calendar');
                break;
            case 'grades':
                router.push('./grades');
                break;
        }
    };

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

    const handleMaterialPress = async (material: Material) => {
        if (!material.url) {
            Alert.alert('Erro', 'Link do material não disponível');
            return;
        }

        try {
            // Construir URL completa
            // Construir URL completa
            // Se já for absoluta (http/https), usar direto
            let fullUrl = material.url;
            if (!material.url.startsWith('http')) {
                const baseUrl = API_URL.replace('/api', '');
                fullUrl = `${baseUrl}${material.url}`;
            }

            // Se for arquivo Markdown ou resumo IA, gerar PDF
            const isMarkdown = material.url.toLowerCase().endsWith('.md') || material.title.toLowerCase().includes('resumo');

            if (isMarkdown) {
                // 1. Fetch content
                const response = await fetch(fullUrl);
                const text = await response.text();

                // 2. Wrap in HTML
                const formattedText = text.replace(/\n/g, '<br>');
                const html = `
                    <html>
                    <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                        <style>
                            body { font-family: 'Helvetica', sans-serif; color: #333; padding: 20px; line-height: 1.6; }
                            h1 { color: #4f46e5; margin-bottom: 20px; }
                            .content { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
                        </style>
                    </head>
                    <body>
                        <h1>${material.title}</h1>
                        <div class="content">
                            ${formattedText}
                        </div>
                    </body>
                    </html>
                `;

                // 3. Print/Share
                if (Platform.OS === 'web') {
                    const printWindow = window.open('', '', 'width=800,height=600');
                    if (printWindow) {
                        printWindow.document.write(html);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => printWindow.print(), 500);
                    }
                } else {
                    const { uri } = await Print.printToFileAsync({ html });
                    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
                }

            } else {
                // Outros arquivos (PDF link direto)
                await Linking.openURL(fullUrl);
            }
        } catch (error) {
            console.error('Erro ao abrir material:', error);
            Alert.alert('Erro', 'Não foi possível abrir o material.');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Materiais de Aula</Text>
                    <TouchableOpacity style={styles.searchButton}>
                        <MaterialIcons name="search" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Carregando materiais...</Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
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
                                    <MaterialIcons name="folder-off" size={48} color={colors.slate400} />
                                    <Text style={styles.emptyText}>Nenhum material encontrado</Text>
                                </View>
                            ) : (
                                filteredMaterials.map((material) => (
                                    <TouchableOpacity
                                        key={material.id}
                                        onPress={() => handleMaterialPress(material)}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCard
                                            material={material}
                                        />
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                )}

                {/* Bottom Navigation */}
                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={handleNavPress}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.slate50,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
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
        color: colors.textPrimary,
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
        backgroundColor: colors.white,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
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
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textSecondary,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
    },
    emptyText: {
        marginTop: spacing.sm,
        color: colors.textSecondary,
    },
});
