import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';



/**
 * SubjectDetailsScreen - Detalhes da Disciplina (Aluno)
 * Tela com informações detalhadas da disciplina, ações e avisos
 */
export default function SubjectDetailsScreen() {
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';

    // Mock data - será substituído por dados reais do backend
    const subjectData = {
        name: subjectName,
        professor: 'Prof. Dr. Arnaldo Silva',
        code: 'MAT342',
        imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwv2wIhDYaEEhq6ALucXryaJd3_iE7nIannnYITlQ2lT4teSVDHhII-lZMdLI_-CeXo1rbJXxndpoYHZylIzN8qP0LlpRVW3TI0DNiM62qX7CyEKrECZt8X5h66V60-kJIqF7KcP6FkAqDXWoatiu-GhzOfViSnNRoVmijyHVoiVRpI9dfDA8nAe_PQ0_0IPimNJQEd7ofvcge2wVlwZ6VesOKtIbWIWaavtCusp6dpAu3_BFKA1wfZ2EeO6eIaKzLiC1SdUbL81E',
        schedule: 'Terças e Quintas, 10:00 - 12:00',
        location: 'Sala B-204',
        pendingActivities: 3,
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
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Detalhes da Disciplina</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Subject Info Card */}
                    <View style={styles.subjectCard}>
                        <Image
                            source={{ uri: subjectData.imageUrl }}
                            style={styles.avatar}
                        />
                        <View style={styles.subjectInfo}>
                            <Text style={styles.subjectName} numberOfLines={1}>
                                {subjectData.name}
                            </Text>
                            <Text style={styles.professorInfo} numberOfLines={2}>
                                {subjectData.professor} - {subjectData.code}
                            </Text>
                        </View>
                    </View>

                    {/* Info Grid */}
                    <View style={styles.infoGrid}>
                        <View style={[styles.infoItem, styles.infoItemLeft]}>
                            <Text style={styles.infoLabel}>Horário</Text>
                            <Text style={styles.infoValue}>{subjectData.schedule}</Text>
                        </View>
                        <View style={[styles.infoItem, styles.infoItemRight]}>
                            <Text style={styles.infoLabel}>Local</Text>
                            <Text style={styles.infoValue}>{subjectData.location}</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            activeOpacity={0.8}
                            onPress={() => console.log('Registrar presença')}
                        >
                            <MaterialIcons name="how-to-reg" size={24} color={colors.white} />
                            <Text style={styles.primaryButtonText}>Registrar Minha Presença</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            activeOpacity={0.8}
                            onPress={() => console.log('Ver atividades')}
                        >
                            <MaterialIcons name="assignment" size={24} color={colors.white} />
                            <Text style={styles.secondaryButtonText}>Ver Atividades e Quizzes</Text>
                            {subjectData.pendingActivities > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{subjectData.pendingActivities}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            activeOpacity={0.8}
                            onPress={() => router.push({
                                pathname: './materials',
                                params: { subject: subjectName }
                            })}
                        >
                            <MaterialIcons name="folder" size={24} color={colors.white} />
                            <Text style={styles.secondaryButtonText}>Ver Materiais de Aula</Text>
                        </TouchableOpacity>
                    </View>
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
        backgroundColor: colors.backgroundDark,
    },
    backButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -12,
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    placeholder: {
        width: 48,
        height: 48,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.xl,
    },
    subjectCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.base,
        backgroundColor: colors.backgroundDark,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.base,
        minHeight: 72,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.zinc700,
    },
    subjectInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    subjectName: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 4,
    },
    professorInfo: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    infoGrid: {
        flexDirection: 'row',
        paddingHorizontal: spacing.base,
        paddingTop: spacing.base,
    },
    infoItem: {
        flex: 1,
        gap: 4,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
        paddingVertical: spacing.base,
    },
    infoItemLeft: {
        paddingRight: spacing.sm,
    },
    infoItemRight: {
        paddingLeft: spacing.sm,
    },
    infoLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    infoValue: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    buttonGroup: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        gap: spacing.md,
        maxWidth: 480,
        alignSelf: 'center',
        width: '100%',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.lg,
        borderRadius: 12,
        height: 56,
    },
    primaryButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.zinc800,
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.lg,
        borderRadius: 12,
        height: 56,
        position: 'relative',
    },
    secondaryButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    badge: {
        position: 'absolute',
        top: 12,
        right: 16,
        backgroundColor: '#ef4444',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },

});
