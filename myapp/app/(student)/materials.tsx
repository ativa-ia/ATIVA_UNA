import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCard } from '@/components/cards/MaterialCard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { Material } from '@/types';

/**
 * MaterialsScreen - Materiais de Aula (Aluno)
 * Tela para o aluno visualizar materiais de aula
 */
export default function MaterialsScreen() {
    const params = useLocalSearchParams();
    const initialSubject = params.subject as string || 'all';
    const [selectedSubject, setSelectedSubject] = useState(initialSubject);

    const materials: Material[] = [
        {
            id: '1',
            title: 'Slides - Introdução ao Cálculo',
            subject: 'Cálculo I',
            type: 'pdf',
            uploadDate: '15 Nov',
            size: '2.5 MB',
        },
        {
            id: '2',
            title: 'Vídeo Aula - Derivadas',
            subject: 'Cálculo I',
            type: 'video',
            uploadDate: '14 Nov',
        },
        {
            id: '3',
            title: 'Lista de Exercícios 01',
            subject: 'Cálculo I',
            type: 'pdf',
            uploadDate: '13 Nov',
            size: '1.8 MB',
        },
        {
            id: '4',
            title: 'Apostila - Estruturas de Dados',
            subject: 'Algoritmos Avançados',
            type: 'pdf',
            uploadDate: '12 Nov',
            size: '5.2 MB',
        },
        {
            id: '5',
            title: 'Link - Documentação Python',
            subject: 'Algoritmos Avançados',
            type: 'link',
            uploadDate: '10 Nov',
        },
        {
            id: '6',
            title: 'Slides - Metodologias Ágeis',
            subject: 'Engenharia de Software',
            type: 'pdf',
            uploadDate: '08 Nov',
            size: '3.1 MB',
        },
        {
            id: '7',
            title: 'Apostila - Protocolos de Rede',
            subject: 'Redes de Computadores',
            type: 'pdf',
            uploadDate: '05 Nov',
            size: '4.7 MB',
        },
    ];

    const subjects = ['all', 'Cálculo I', 'Algoritmos Avançados', 'Engenharia de Software', 'Redes de Computadores'];

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

                {/* Subject Filter */}
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

                {/* Materials List */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.sectionTitle}>
                        {filteredMaterials.length} {filteredMaterials.length === 1 ? 'material' : 'materiais'}
                    </Text>

                    {filteredMaterials.map((material) => (
                        <MaterialCard
                            key={material.id}
                            material={material}
                            darkMode
                        />
                    ))}
                </ScrollView>
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
        borderBottomColor: colors.zinc800,
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
        borderColor: colors.zinc700,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc300,
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
        color: colors.zinc400,
        marginBottom: spacing.sm,
    },
});
