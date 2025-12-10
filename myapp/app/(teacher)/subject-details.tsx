import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

/**
 * TeacherSubjectDetailsScreen - Detalhes da Disciplina (Professor)
 * Tela com informações da disciplina e ações do professor
 */
export default function TeacherSubjectDetailsScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';
    const subjectId = params.subjectId as string || '1';

    // Mock data - será substituído por dados reais do backend
    const subjectData = {
        name: subjectName,
        code: 'MAT342',
        imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwv2wIhDYaEEhq6ALucXryaJd3_iE7nIannnYITlQ2lT4teSVDHhII-lZMdLI_-CeXo1rbJXxndpoYHZylIzN8qP0LlpRVW3TI0DNiM62qX7CyEKrECZt8X5h66V60-kJIqF7KcP6FkAqDXWoatiu-GhzOfViSnNRoVmijyHVoiVRpI9dfDA8nAe_PQ0_0IPimNJQEd7ofvcge2wVlwZ6VesOKtIbWIWaavtCusp6dpAu3_BFKA1wfZ2EeO6eIaKzLiC1SdUbL81E',
        schedule: 'Terças e Quintas, 10:00 - 12:00',
        location: 'Sala B-204',
        totalStudents: 35,
        presentToday: 28,
    };

    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
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
                        <View style={styles.subjectInfo}>
                            <Text style={styles.subjectName} numberOfLines={1}>
                                {subjectData.name}
                            </Text>
                            <Text style={styles.codeInfo} numberOfLines={1}>
                                Código: {subjectData.code}
                            </Text>
                        </View>
                    </View>





                    {/* Action Buttons - Two Column Layout on Web */}
                    <View style={styles.buttonGroup}>
                        {Platform.OS === 'web' ? (
                            // Web: Two columns
                            <View style={styles.twoColumnContainer}>
                                {/* Left Column - AI Features */}
                                <View style={styles.leftColumn}>
                                    <TouchableOpacity
                                        style={styles.aiButton}
                                        activeOpacity={0.8}
                                        onPress={() => router.push({
                                            pathname: '/(teacher)/ai-assistant',
                                            params: { subject: subjectName, subjectId: subjectId }
                                        })}
                                    >
                                        <LinearGradient
                                            colors={['#10b981', '#14b8a6', '#3B82F6']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.aiButtonGradient}
                                        >
                                            <MaterialIcons name="auto-awesome" size={24} color={colors.white} />
                                            <View style={styles.aiTextContainer}>
                                                <Text style={styles.aiButtonText}>Assistente de IA</Text>
                                                <Text style={styles.aiButtonSubtext}>Gerar conteúdo, quizzes e mais</Text>
                                            </View>
                                            <MaterialIcons name="arrow-forward-ios" size={18} color="rgba(255,255,255,0.7)" />
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.transcriptionButton}
                                        activeOpacity={0.8}
                                        onPress={() => router.push({
                                            pathname: '/(teacher)/transcription',
                                            params: { subject: subjectName, subjectId: subjectId }
                                        })}
                                    >
                                        <LinearGradient
                                            colors={['#8b5cf6', '#a855f7', '#c084fc']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.aiButtonGradient}
                                        >
                                            <MaterialIcons name="mic" size={24} color={colors.white} />
                                            <View style={styles.aiTextContainer}>
                                                <Text style={styles.aiButtonText}>Transcrever Aula</Text>
                                                <Text style={styles.aiButtonSubtext}>Ditar conteúdo e gerar material</Text>
                                            </View>
                                            <MaterialIcons name="arrow-forward-ios" size={18} color="rgba(255,255,255,0.7)" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                {/* Right Column - Other Actions */}
                                <View style={styles.rightColumn}>
                                    <TouchableOpacity
                                        style={styles.primaryButton}
                                        activeOpacity={0.8}
                                        onPress={() => router.push({
                                            pathname: '/(teacher)/attendance',
                                            params: { subject: subjectName }
                                        })}
                                    >
                                        <MaterialIcons name="how-to-reg" size={24} color={colors.white} />
                                        <Text style={styles.primaryButtonText}>Fazer Chamada</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.secondaryButton}
                                        activeOpacity={0.8}
                                        onPress={() => router.push({
                                            pathname: '/(teacher)/materials',
                                            params: { subject: subjectName }
                                        })}
                                    >
                                        <MaterialIcons name="folder" size={24} color={colors.white} />
                                        <Text style={styles.secondaryButtonText}>Materiais de Aula</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.secondaryButton}
                                        activeOpacity={0.8}
                                        onPress={() => console.log('Atividades')}
                                    >
                                        <MaterialIcons name="assignment" size={24} color={colors.white} />
                                        <Text style={styles.secondaryButtonText}>Atividades e Quizzes</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.secondaryButton}
                                        activeOpacity={0.8}
                                        onPress={() => console.log('Notas')}
                                    >
                                        <MaterialIcons name="grade" size={24} color={colors.white} />
                                        <Text style={styles.secondaryButtonText}>Lançar Notas</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.secondaryButton}
                                        activeOpacity={0.8}
                                        onPress={() => router.push({
                                            pathname: '/(teacher)/class-report',
                                            params: { subject: subjectName, subjectId: subjectId }
                                        })}
                                    >
                                        <MaterialIcons name="assessment" size={24} color={colors.white} />
                                        <Text style={styles.secondaryButtonText}>Relatórios da Turma</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            // Mobile: Single column (original layout)
                            <>
                                <TouchableOpacity
                                    style={styles.aiButton}
                                    activeOpacity={0.8}
                                    onPress={() => router.push({
                                        pathname: '/(teacher)/ai-assistant',
                                        params: { subject: subjectName, subjectId: subjectId }
                                    })}
                                >
                                    <LinearGradient
                                        colors={['#10b981', '#14b8a6', '#3B82F6']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.aiButtonGradient}
                                    >
                                        <MaterialIcons name="auto-awesome" size={24} color={colors.white} />
                                        <View style={styles.aiTextContainer}>
                                            <Text style={styles.aiButtonText}>Assistente de IA</Text>
                                            <Text style={styles.aiButtonSubtext}>Gerar conteúdo, quizzes e mais</Text>
                                        </View>
                                        <MaterialIcons name="arrow-forward-ios" size={18} color="rgba(255,255,255,0.7)" />
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.transcriptionButton}
                                    activeOpacity={0.8}
                                    onPress={() => router.push({
                                        pathname: '/(teacher)/transcription',
                                        params: { subject: subjectName, subjectId: subjectId }
                                    })}
                                >
                                    <LinearGradient
                                        colors={['#8b5cf6', '#a855f7', '#c084fc']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.aiButtonGradient}
                                    >
                                        <MaterialIcons name="mic" size={24} color={colors.white} />
                                        <View style={styles.aiTextContainer}>
                                            <Text style={styles.aiButtonText}>Transcrever Aula</Text>
                                            <Text style={styles.aiButtonSubtext}>Ditar conteúdo e gerar material</Text>
                                        </View>
                                        <MaterialIcons name="arrow-forward-ios" size={18} color="rgba(255,255,255,0.7)" />
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    activeOpacity={0.8}
                                    onPress={() => router.push({
                                        pathname: '/(teacher)/attendance',
                                        params: { subject: subjectName }
                                    })}
                                >
                                    <MaterialIcons name="how-to-reg" size={24} color={colors.white} />
                                    <Text style={styles.primaryButtonText}>Fazer Chamada</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    activeOpacity={0.8}
                                    onPress={() => router.push({
                                        pathname: '/(teacher)/materials',
                                        params: { subject: subjectName }
                                    })}
                                >
                                    <MaterialIcons name="folder" size={24} color={colors.white} />
                                    <Text style={styles.secondaryButtonText}>Materiais de Aula</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    activeOpacity={0.8}
                                    onPress={() => console.log('Atividades')}
                                >
                                    <MaterialIcons name="assignment" size={24} color={colors.white} />
                                    <Text style={styles.secondaryButtonText}>Atividades e Quizzes</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    activeOpacity={0.8}
                                    onPress={() => console.log('Notas')}
                                >
                                    <MaterialIcons name="grade" size={24} color={colors.white} />
                                    <Text style={styles.secondaryButtonText}>Lançar Notas</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    activeOpacity={0.8}
                                    onPress={() => router.push({
                                        pathname: '/(teacher)/class-report',
                                        params: { subject: subjectName, subjectId: subjectId }
                                    })}
                                >
                                    <MaterialIcons name="assessment" size={24} color={colors.white} />
                                    <Text style={styles.secondaryButtonText}>Relatórios da Turma</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </ScrollView>
            </View>
        </View>
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
        paddingBottom: spacing['3xl'],
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
    codeInfo: {
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
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.lg,
        marginHorizontal: spacing.base,
        marginTop: spacing.sm,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.lg,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    statValueGreen: {
        color: '#10b981',
    },
    statLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: colors.zinc700,
    },
    buttonGroup: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        gap: spacing.md,
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    twoColumnContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'flex-start',
    },
    leftColumn: {
        flex: 1,
        gap: spacing.md,
    },
    rightColumn: {
        flex: 1,
        gap: spacing.md,
    },
    aiButton: {
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    transcriptionButton: {
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    aiButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
    },
    aiTextContainer: {
        flex: 1,
    },
    aiButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    aiButtonSubtext: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.display,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
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
        backgroundColor: colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
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
