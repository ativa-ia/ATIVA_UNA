import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { segmentStudents, generateSupportContent, sendSupport, type StudentSegment, type SupportContent } from '@/services/api';

export default function SupportStudentsScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const quizId = parseInt(params.quizId as string);
    const activityId = parseInt(params.activityId as string);

    const [step, setStep] = useState<'select' | 'preview'>('select');
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<StudentSegment[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [generatedContent, setGeneratedContent] = useState<SupportContent | null>(null);
    const [message, setMessage] = useState('Material de reforço para ajudar no seu aprendizado! 💪');

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        setLoading(true);
        try {
            // Use quizId (original quiz) not activityId (live activity)
            const result = await segmentStudents(quizId);
            if (result.success) {
                const needsSupport = result.students.filter(
                    s => s.performance_level === 'critical' || s.performance_level === 'attention'
                );
                setStudents(needsSupport);
                setSelectedIds(needsSupport.map(s => s.id));
            }
        } catch (error) {
            Alert.alert('Erro', 'Não foi possível carregar os alunos');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (selectedIds.length === 0) {
            Alert.alert('Atenção', 'Selecione pelo menos um aluno');
            return;
        }

        setLoading(true);
        try {
            // Use quizId (original quiz) not activityId
            const result = await generateSupportContent(quizId, selectedIds);
            if (result.success && result.content) {
                setGeneratedContent(result.content);
                setStep('preview');
            } else {
                Alert.alert('Erro', result.error || 'Não foi possível gerar o conteúdo');
            }
        } catch (error) {
            Alert.alert('Erro', 'Erro ao gerar conteúdo');
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!generatedContent) return;

        setLoading(true);
        try {
            // Use quizId (original quiz) not activityId
            const result = await sendSupport(quizId, selectedIds, generatedContent, message);
            if (result.success) {
                Alert.alert(
                    'Sucesso!',
                    `Suporte enviado para ${selectedIds.length} aluno(s)`,
                    [{ text: 'OK', onPress: () => router.back() }]
                );
            } else {
                Alert.alert('Erro', result.error || 'Não foi possível enviar o suporte');
            }
        } catch (error) {
            Alert.alert('Erro', 'Erro ao enviar suporte');
        } finally {
            setLoading(false);
        }
    };

    const toggleStudent = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.slate900} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <MaterialIcons name="school" size={24} color={colors.primary} />
                    <Text style={styles.headerTitle}>Suporte Personalizado</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Steps Indicator */}
            <View style={styles.steps}>
                <View style={[styles.stepItem, step === 'select' && styles.stepActive]}>
                    <Text style={[styles.stepText, step === 'select' && styles.stepTextActive]}>
                        1. Selecionar
                    </Text>
                </View>
                <View style={[styles.stepItem, step === 'preview' && styles.stepActive]}>
                    <Text style={[styles.stepText, step === 'preview' && styles.stepTextActive]}>
                        2. Enviar
                    </Text>
                </View>
            </View>

            {/* Content */}
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>
                            {step === 'select' ? 'Carregando alunos...' : 'Gerando conteúdo com IA...'}
                        </Text>
                    </View>
                ) : step === 'select' ? (
                    <View>
                        <Text style={styles.sectionTitle}>
                            Selecione os alunos que receberão o suporte:
                        </Text>
                        {students.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="celebration" size={64} color={colors.primary} />
                                <Text style={styles.emptyText}>
                                    ✨ Todos os alunos estão bem!
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    Nenhum aluno precisa de suporte no momento
                                </Text>
                            </View>
                        ) : (
                            students.map(student => (
                                <TouchableOpacity
                                    key={student.id}
                                    style={styles.studentItem}
                                    onPress={() => toggleStudent(student.id)}
                                >
                                    <MaterialIcons
                                        name={selectedIds.includes(student.id) ? 'check-box' : 'check-box-outline-blank'}
                                        size={24}
                                        color={selectedIds.includes(student.id) ? colors.primary : colors.slate400}
                                    />
                                    <View style={styles.studentInfo}>
                                        <Text style={styles.studentName}>{student.name}</Text>
                                        <Text style={styles.studentScore}>
                                            {student.score}/{student.total} ({student.percentage.toFixed(0)}%)
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.badge,
                                        { backgroundColor: student.performance_level === 'critical' ? '#fee2e2' : '#fef3c7' }
                                    ]}>
                                        <Text style={[
                                            styles.badgeText,
                                            { color: student.performance_level === 'critical' ? '#dc2626' : '#d97706' }
                                        ]}>
                                            {student.performance_level === 'critical' ? 'Crítico' : 'Atenção'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                ) : step === 'preview' && generatedContent ? (
                    <View>
                        <Text style={styles.sectionTitle}>Preview do Conteúdo:</Text>
                        <View style={styles.previewCard}>
                            <Text style={styles.contentTitle}>{generatedContent.title}</Text>
                            <Text style={styles.questionCount}>
                                📝 {generatedContent.questions.length} questões de reforço
                            </Text>
                        </View>

                        <Text style={styles.sectionTitle}>Mensagem para os alunos:</Text>
                        <TextInput
                            style={styles.messageInput}
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            placeholder="Digite uma mensagem motivacional..."
                            placeholderTextColor={colors.slate400}
                        />
                    </View>
                ) : null}
            </ScrollView>

            {/* Footer */}
            {!loading && students.length > 0 && (
                <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.base }]}>
                    {step === 'select' && (
                        <TouchableOpacity
                            style={[styles.button, selectedIds.length === 0 && styles.buttonDisabled]}
                            onPress={handleGenerate}
                            disabled={selectedIds.length === 0}
                        >
                            <MaterialIcons name="auto-awesome" size={20} color="white" />
                            <Text style={styles.buttonText}>
                                Gerar Conteúdo ({selectedIds.length} aluno{selectedIds.length !== 1 ? 's' : ''})
                            </Text>
                        </TouchableOpacity>
                    )}
                    {step === 'preview' && (
                        <View style={styles.footerButtons}>
                            <TouchableOpacity
                                style={[styles.button, styles.buttonSecondary]}
                                onPress={() => setStep('select')}
                            >
                                <MaterialIcons name="arrow-back" size={20} color={colors.slate700} />
                                <Text style={styles.buttonSecondaryText}>Voltar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.buttonPrimary]}
                                onPress={handleSend}
                            >
                                <MaterialIcons name="send" size={20} color="white" />
                                <Text style={styles.buttonText}>Enviar Suporte</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.slate50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.base,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    backButton: {
        padding: spacing.sm,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
    },
    steps: {
        flexDirection: 'row',
        padding: spacing.base,
        gap: spacing.sm,
        backgroundColor: colors.white,
    },
    stepItem: {
        flex: 1,
        padding: spacing.sm,
        borderRadius: borderRadius.default,
        backgroundColor: colors.slate100,
        alignItems: 'center',
    },
    stepActive: {
        backgroundColor: colors.primary,
    },
    stepText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
    },
    stepTextActive: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: spacing.base,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.base,
    },
    loadingText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
    },
    sectionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
        marginBottom: spacing.sm,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.base,
    },
    emptyText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
        textAlign: 'center',
    },
    studentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base,
        backgroundColor: colors.white,
        borderRadius: borderRadius.default,
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
    },
    studentScore: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
    },
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    badgeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    previewCard: {
        backgroundColor: colors.white,
        padding: spacing.base,
        borderRadius: borderRadius.default,
        marginBottom: spacing.base,
    },
    contentTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
        marginBottom: spacing.sm,
    },
    questionCount: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.slate600,
    },
    messageInput: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.default,
        padding: spacing.base,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    footer: {
        padding: spacing.base,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
    },
    footerButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        padding: spacing.base,
        borderRadius: borderRadius.default,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    buttonPrimary: {
        backgroundColor: colors.primary,
    },
    buttonDisabled: {
        backgroundColor: colors.slate300,
    },
    buttonSecondary: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate300,
    },
    buttonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    buttonSecondaryText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate700,
    },
});
