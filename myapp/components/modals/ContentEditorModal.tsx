import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { convertContent } from '@/services/api';

interface ContentEditorModalProps {
    visible: boolean;
    onClose: () => void;
    onSend: (title: string, content: string | object, type: 'quiz' | 'summary') => Promise<void>;
    initialContent: string | object;
    type: 'quiz' | 'summary';
}

export default function ContentEditorModal({
    visible,
    onClose,
    onSend,
    initialContent,
    type
}: ContentEditorModalProps) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedType, setSelectedType] = useState<'quiz' | 'summary'>(type);
    const [isSending, setIsSending] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    // Track which questions have visible answers (indices)
    const [visibleQuestions, setVisibleQuestions] = useState<number[]>([]);

    useEffect(() => {
        if (visible) {
            setSelectedType(type);
            setTitle(type === 'quiz' ? 'Quiz de Revisão' : 'Resumo da Aula');
            setVisibleQuestions([]); // Reset visibility on open

            if (typeof initialContent === 'object') {
                setContent(JSON.stringify(initialContent, null, 2));
            } else {
                setContent(initialContent);
            }
        }
    }, [visible, initialContent, type]);

    const handleConvert = async () => {
        setIsConverting(true);
        try {
            const result = await convertContent(content, selectedType);
            if (result.success) {
                setContent(typeof result.result === 'object' ? JSON.stringify(result.result, null, 2) : result.result);
                setTitle(selectedType === 'quiz' ? 'Quiz Gerado pela IA' : 'Resumo Gerado pela IA');
            } else {
                alert('Erro ao converter: ' + result.error);
            }
        } catch (error) {
            alert('Erro ao converter conteúdo.');
        } finally {
            setIsConverting(false);
        }
    };

    const handleSend = async () => {
        console.log('[Modal] handleSend called', { title, contentLength: content.length, selectedType });
        if (!title.trim() || !content.trim()) {
            console.log('[Modal] Validation failed: empty title or content');
            return;
        }

        setIsSending(true);
        try {
            // Se for quiz, tentar parsear de volta para garantir que o usuário não quebrou o JSON
            let finalContent = content;
            if (selectedType === 'quiz') {
                console.log('[Modal] Validating Quiz JSON...');
                try {
                    // Remove markdown code blocks if present
                    const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
                    finalContent = JSON.parse(cleanContent);
                    console.log('[Modal] JSON valid.');
                } catch (e) {
                    console.log('[Modal] JSON invalid:', e);
                    // Show alert and allow conversion
                    Alert.alert(
                        'Formato Inválido',
                        'O conteúdo atual não é um Quiz válido (JSON). Deseja converter automaticamente com IA?',
                        [
                            { text: 'Cancelar', style: 'cancel', onPress: () => setIsSending(false) },
                            {
                                text: 'Converter com IA',
                                onPress: () => {
                                    setIsSending(false);
                                    handleConvert();
                                }
                            }
                        ]
                    );
                    return;
                }
            }

            console.log('[Modal] Calling onSend...');
            await onSend(title, finalContent, selectedType);
            console.log('[Modal] onSend completed.');
            onClose();
        } catch (error) {
            console.error('[Modal] Error in handleSend:', error);
            alert('Erro ao enviar conteúdo.');
        } finally {
            setIsSending(false);
        }
    };

    // Helper to try parsing quiz with markdown cleanup
    const getQuizData = () => {
        if (selectedType !== 'quiz') return null;
        try {
            const clean = content.replace(/```json\s*|\s*```/g, '').trim();
            const data = JSON.parse(clean);
            // Basic validation
            if (data && data.questions && Array.isArray(data.questions)) return data;
        } catch (e) {
            return null;
        }
        return null;
    };

    const quizData = getQuizData();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}
                >
                    <View style={styles.header}>
                        <View style={styles.headerTitleContainer}>
                            <MaterialIcons
                                name="edit"
                                size={24}
                                color={colors.primary}
                            />
                            <Text style={styles.headerTitle}>
                                Editar Conteúdo
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} disabled={isSending}>
                            <MaterialIcons name="close" size={24} color={colors.slate400} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                style={[styles.typeButton, selectedType === 'summary' && styles.typeButtonSelected]}
                                onPress={() => setSelectedType('summary')}
                            >
                                <MaterialIcons
                                    name="summarize"
                                    size={20}
                                    color={selectedType === 'summary' ? colors.primary : colors.textSecondary}
                                />
                                <Text style={[styles.typeButtonText, selectedType === 'summary' && styles.typeButtonTextSelected]}>
                                    Resumo
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeButton, selectedType === 'quiz' && styles.typeButtonSelected]}
                                onPress={() => setSelectedType('quiz')}
                            >
                                <MaterialIcons
                                    name="quiz"
                                    size={20}
                                    color={selectedType === 'quiz' ? colors.primary : colors.textSecondary}
                                />
                                <Text style={[styles.typeButtonText, selectedType === 'quiz' && styles.typeButtonTextSelected]}>
                                    Quiz
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.label}>Título da Atividade</Text>
                        <TextInput
                            style={styles.titleInput}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Ex: Quiz sobre Revolução Francesa"
                            placeholderTextColor={colors.slate400}
                        />


                        {/* Visual Quiz Editor */}
                        {quizData && (
                            <View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <Text style={styles.label}>Questões do Quiz</Text>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity onPress={() => {
                                            if (!quizData?.questions) return;
                                            const allIndices = quizData.questions.map((_: any, i: number) => i);
                                            const isAllVisible = visibleQuestions.length === quizData.questions.length;
                                            setVisibleQuestions(isAllVisible ? [] : allIndices);
                                        }}>
                                            <MaterialIcons
                                                name={visibleQuestions.length === quizData?.questions?.length && quizData?.questions?.length > 0 ? "visibility" : "visibility-off"}
                                                size={20}
                                                color={colors.slate400}
                                            />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => {
                                            // Add new empty question
                                            const newQuestions = [...quizData.questions, {
                                                question: "Nova Pergunta",
                                                options: ["Opção A", "Opção B", "Opção C", "Opção D"],
                                                correct: 0
                                            }];
                                            // Update content string
                                            setContent(JSON.stringify({ ...quizData, questions: newQuestions }, null, 2));
                                        }}>
                                            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>+ Adicionar Questão</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {quizData.questions.map((q: any, index: number) => {
                                    const isVisible = visibleQuestions.includes(index);
                                    return (
                                        <View key={index} style={styles.questionCard}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={styles.questionLabel}>Questão {index + 1}</Text>
                                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                                    <TouchableOpacity onPress={() => {
                                                        if (isVisible) {
                                                            setVisibleQuestions(prev => prev.filter(i => i !== index));
                                                        } else {
                                                            setVisibleQuestions(prev => [...prev, index]);
                                                        }
                                                    }}>
                                                        <MaterialIcons name={isVisible ? "visibility" : "visibility-off"} size={20} color={colors.slate400} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => {
                                                        const newQuestions = quizData.questions.filter((_: any, i: number) => i !== index);
                                                        setContent(JSON.stringify({ ...quizData, questions: newQuestions }, null, 2));
                                                    }}>
                                                        <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <TextInput
                                                style={styles.questionInput}
                                                value={q.question}
                                                onChangeText={(text) => {
                                                    const newQuestions = [...quizData.questions];
                                                    newQuestions[index].question = text;
                                                    setContent(JSON.stringify({ ...quizData, questions: newQuestions }, null, 2));
                                                }}
                                                placeholder="Digite a pergunta..."
                                            />

                                            <Text style={[styles.label, { marginTop: 8 }]}>Opções {isVisible ? '(Toque na correta)' : '(Respostas Ocultas)'}</Text>
                                            {q.options.map((opt: string, optIndex: number) => (
                                                <View key={optIndex} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            const newQuestions = [...quizData.questions];
                                                            newQuestions[index].correct = optIndex;
                                                            setContent(JSON.stringify({ ...quizData, questions: newQuestions }, null, 2));
                                                        }}
                                                        disabled={!isVisible}
                                                    >
                                                        <MaterialIcons
                                                            name={isVisible && q.correct === optIndex ? "radio-button-checked" : "radio-button-unchecked"}
                                                            size={20}
                                                            color={isVisible && q.correct === optIndex ? colors.secondary : colors.slate400}
                                                        />
                                                    </TouchableOpacity>
                                                    <TextInput
                                                        style={[
                                                            styles.optionInput,
                                                            isVisible && q.correct === optIndex && { borderColor: colors.secondary, backgroundColor: '#F0FDF4' }
                                                        ]}
                                                        value={opt}
                                                        onChangeText={(text) => {
                                                            const newQuestions = [...quizData.questions];
                                                            newQuestions[index].options[optIndex] = text;
                                                            setContent(JSON.stringify({ ...quizData, questions: newQuestions }, null, 2));
                                                        }}
                                                        placeholder={`Opção ${optIndex + 1}`}
                                                    />
                                                </View>
                                            ))}
                                        </View>
                                    );
                                })}

                                <TouchableOpacity
                                    style={{ marginTop: 10, alignSelf: 'center' }}
                                    onPress={() => {
                                        Alert.alert("Modo Texto", "Deseja editar o JSON manualmente?", [
                                            { text: "Não", style: "cancel" },
                                            { text: "Sim", onPress: () => setContent(" " + content) }
                                        ])
                                    }}
                                >
                                    <Text style={{ color: colors.slate400, fontSize: 12 }}>Editar JSON Puro</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Raw Editor (Fallback or for Summary) */}
                        {(!quizData || selectedType === 'summary') && (
                            <>
                                <Text style={styles.label}>Conteúdo ({selectedType === 'quiz' ? 'Texto - Necessário Converter' : 'Texto'})</Text>

                                {/* Conversion Toolbar */}
                                {selectedType === 'quiz' && !quizData && (
                                    <TouchableOpacity
                                        style={styles.convertButton}
                                        onPress={handleConvert}
                                        disabled={isConverting}
                                    >
                                        {isConverting ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <>
                                                <MaterialIcons name="auto-fix-high" size={16} color={colors.primary} />
                                                <Text style={styles.convertButtonText}>Converter Texto para Quiz (IA)</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}

                                <View style={styles.editorContainer}>
                                    <TextInput
                                        style={styles.editorInput}
                                        value={content}
                                        onChangeText={setContent}
                                        multiline
                                        textAlignVertical="top"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        placeholder="Conteúdo..."
                                    />
                                </View>
                            </>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                            disabled={isSending}
                        >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                isSending && styles.sendButtonDisabled
                            ]}
                            onPress={handleSend}
                            disabled={isSending}
                        >
                            {isSending ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <>
                                    <MaterialIcons name="send" size={20} color={colors.white} />
                                    <Text style={styles.sendButtonText}>Enviar para Turma</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: colors.white,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        height: '90%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    content: {
        flex: 1,
        padding: spacing.md,
    },
    label: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginTop: spacing.sm,
        fontFamily: typography.fontFamily.display,
    },
    titleInput: {
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.default,
        padding: spacing.sm,
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    editorContainer: {
        flex: 1,
        minHeight: 200,
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.default,
        marginBottom: spacing.xl,
    },
    editorInput: {
        flex: 1,
        padding: spacing.sm,
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    footer: {
        flexDirection: 'row',
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
        gap: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 40 : spacing.md,
    },
    cancelButton: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.default,
        borderWidth: 1,
        borderColor: colors.slate200,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontWeight: typography.fontWeight.semibold,
    },
    sendButton: {
        flex: 2,
        flexDirection: 'row',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.default,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.slate300,
    },
    sendButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: borderRadius.default,
        borderWidth: 1,
        borderColor: colors.slate200,
        backgroundColor: colors.slate50,
    },
    typeButtonSelected: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: colors.primary,
    },
    typeButtonText: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        fontWeight: typography.fontWeight.semibold,
    },
    typeButtonTextSelected: {
        color: colors.primary,
        fontWeight: typography.fontWeight.bold,
    },
    convertButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: borderRadius.default,
        marginBottom: spacing.sm,
        alignSelf: 'flex-start',
    },
    convertButtonText: {
        fontSize: typography.fontSize.sm,
        color: colors.primary,
        fontWeight: typography.fontWeight.semibold,
    },
    // Visual Quiz Editor Styles
    questionCard: {
        backgroundColor: colors.backgroundLight,
        borderRadius: borderRadius.default,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
        position: 'relative'
    },
    questionLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    questionInput: {
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
        paddingVertical: spacing.xs,
        marginBottom: spacing.sm,
    },
    optionInput: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
    }
});
