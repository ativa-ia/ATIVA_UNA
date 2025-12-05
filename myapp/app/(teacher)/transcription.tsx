import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    Alert,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { processContent, createQuiz, broadcastQuiz } from '@/services/quiz';

/**
 * TranscriptionScreen - Tela dedicada de transcrição de aula
 * Permite ao professor ditar conteúdo e gerar materiais
 */
export default function TranscriptionScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';
    const subjectId = parseInt(params.subjectId as string) || 1;

    const [transcribedText, setTranscribedText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [interimText, setInterimText] = useState('');
    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const [generatedQuiz, setGeneratedQuiz] = useState<any>(null);
    const [showQuizPreview, setShowQuizPreview] = useState(false);
    const [quizTimeLimit, setQuizTimeLimit] = useState(300);

    // Speech Recognition
    const recognitionRef = useRef<any>(null);
    const savedTextRef = useRef<string>('');
    const processedResultsRef = useRef<Set<number>>(new Set());
    const lastFinalTextRef = useRef<string>('');

    useEffect(() => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = !isMobile;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'pt-BR';

                recognitionRef.current.onresult = (event: any) => {
                    let currentInterim = '';

                    for (let i = 0; i < event.results.length; i++) {
                        const result = event.results[i];
                        const transcript = result[0].transcript.trim();

                        if (result.isFinal && transcript) {
                            if (!processedResultsRef.current.has(i) && transcript !== lastFinalTextRef.current) {
                                processedResultsRef.current.add(i);
                                lastFinalTextRef.current = transcript;
                                const separator = savedTextRef.current ? ' ' : '';
                                savedTextRef.current = savedTextRef.current + separator + transcript;
                                setTranscribedText(savedTextRef.current);
                            }
                        } else if (!result.isFinal) {
                            currentInterim = transcript;
                        }
                    }
                    setInterimText(currentInterim);
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('Erro no reconhecimento:', event.error);
                    if (event.error === 'not-allowed') {
                        Alert.alert('Permissão Negada', 'Permita o acesso ao microfone para usar a transcrição.');
                    }
                };

                recognitionRef.current.onend = () => {
                    if (isRecording) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {
                            console.log('Reconhecimento encerrado');
                        }
                    }
                };
            }
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) { }
            }
        };
    }, [isRecording]);

    const toggleRecording = () => {
        if (Platform.OS !== 'web') {
            Alert.alert("Em breve", "O reconhecimento de voz no celular estará disponível na versão final.");
            return;
        }

        if (!recognitionRef.current) {
            Alert.alert("Não suportado", "Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
            setInterimText('');
        } else {
            savedTextRef.current = transcribedText;
            processedResultsRef.current.clear();
            lastFinalTextRef.current = '';
            setInterimText('');
            try {
                recognitionRef.current.start();
                setIsRecording(true);
            } catch (e) {
                console.error('Erro ao iniciar:', e);
            }
        }
    };

    const handleGenerateQuiz = async () => {
        if (!transcribedText.trim()) {
            Alert.alert('Atenção', 'Transcreva algum conteúdo primeiro.');
            return;
        }

        setProcessingAction('quiz');
        try {
            const result = await processContent(transcribedText, 'quiz', subjectId);
            if (result.success && result.result?.questions) {
                setGeneratedQuiz(result.result);
                setShowQuizPreview(true);
            } else {
                Alert.alert('Erro', result.error || 'Falha ao gerar quiz');
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha ao processar conteúdo');
        } finally {
            setProcessingAction(null);
        }
    };

    const handleGenerateSummary = async () => {
        if (!transcribedText.trim()) {
            Alert.alert('Atenção', 'Transcreva algum conteúdo primeiro.');
            return;
        }

        setProcessingAction('summary');
        try {
            const result = await processContent(transcribedText, 'summary', subjectId);
            if (result.success && result.result?.text) {
                Alert.alert('📝 Resumo Gerado', result.result.text);
            } else {
                Alert.alert('Erro', result.error || 'Falha ao gerar resumo');
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha ao processar conteúdo');
        } finally {
            setProcessingAction(null);
        }
    };

    const handleBroadcastQuiz = async () => {
        if (!generatedQuiz?.questions) return;

        try {
            setProcessingAction('broadcasting');
            const createResult = await createQuiz(
                subjectId,
                `Quiz: ${subjectName}`,
                generatedQuiz.questions,
                quizTimeLimit,
                transcribedText.substring(0, 200)
            );

            if (!createResult.success || !createResult.quiz) {
                Alert.alert('Erro', createResult.error || 'Falha ao criar quiz');
                return;
            }

            const broadcastResult = await broadcastQuiz(createResult.quiz.id);

            if (!broadcastResult.success) {
                Alert.alert('Erro', broadcastResult.error || 'Falha ao enviar quiz');
                return;
            }

            Alert.alert(
                '🎉 Quiz Enviado!',
                `Quiz enviado para ${broadcastResult.enrolled_students} alunos!\n\nTempo: ${Math.floor(quizTimeLimit / 60)} minutos`,
                [{
                    text: 'Ver Resultados',
                    onPress: () => {
                        setShowQuizPreview(false);
                        router.push({
                            pathname: '/(teacher)/quiz-results',
                            params: { quizId: createResult.quiz!.id.toString(), subject: subjectName }
                        });
                    }
                }]
            );
        } catch (error) {
            Alert.alert('Erro', 'Falha ao enviar quiz');
        } finally {
            setProcessingAction(null);
        }
    };

    const clearText = () => {
        Alert.alert(
            'Limpar Transcrição',
            'Deseja apagar todo o texto transcrito?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Limpar', style: 'destructive', onPress: () => {
                        setTranscribedText('');
                        savedTextRef.current = '';
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Transcrever Aula</Text>
                    <Text style={styles.headerSubtitle}>{subjectName}</Text>
                </View>
                <TouchableOpacity style={styles.clearButton} onPress={clearText}>
                    <MaterialIcons name="delete-outline" size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
            </View>

            {/* Recording Status */}
            {isRecording && (
                <View style={styles.recordingBanner}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Gravando...</Text>
                </View>
            )}

            {/* Transcribed Text Area */}
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.textContainer}>
                    <TextInput
                        style={styles.textInput}
                        multiline
                        value={transcribedText + (interimText ? ' ' + interimText : '')}
                        onChangeText={setTranscribedText}
                        placeholder="O texto transcrito aparecerá aqui..."
                        placeholderTextColor={colors.zinc500}
                        editable={!isRecording}
                    />
                </View>

                {/* Word Count */}
                <Text style={styles.wordCount}>
                    {transcribedText.split(/\s+/).filter(w => w).length} palavras
                </Text>
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                {/* Recording Button */}
                <TouchableOpacity
                    style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                    onPress={toggleRecording}
                >
                    <LinearGradient
                        colors={isRecording ? ['#ef4444', '#dc2626'] : ['#8b5cf6', '#a855f7']}
                        style={styles.recordButtonGradient}
                    >
                        <MaterialIcons name={isRecording ? 'stop' : 'mic'} size={32} color={colors.white} />
                    </LinearGradient>
                </TouchableOpacity>

                {/* Action Buttons Row */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, processingAction === 'quiz' && styles.actionButtonDisabled]}
                        onPress={handleGenerateQuiz}
                        disabled={!!processingAction}
                    >
                        {processingAction === 'quiz' ? (
                            <ActivityIndicator size="small" color="#10b981" />
                        ) : (
                            <MaterialIcons name="quiz" size={24} color="#10b981" />
                        )}
                        <Text style={styles.actionButtonText}>Gerar Quiz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, processingAction === 'summary' && styles.actionButtonDisabled]}
                        onPress={handleGenerateSummary}
                        disabled={!!processingAction}
                    >
                        {processingAction === 'summary' ? (
                            <ActivityIndicator size="small" color="#3b82f6" />
                        ) : (
                            <MaterialIcons name="article" size={24} color="#3b82f6" />
                        )}
                        <Text style={styles.actionButtonText}>Resumo</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quiz Preview Modal */}
            <Modal visible={showQuizPreview} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Quiz Gerado</Text>
                            <TouchableOpacity onPress={() => setShowQuizPreview(false)}>
                                <MaterialIcons name="close" size={24} color={colors.white} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.quizPreviewScroll}>
                            {generatedQuiz?.questions?.map((q: any, i: number) => (
                                <View key={i} style={styles.questionPreview}>
                                    <Text style={styles.questionNumber}>Pergunta {i + 1}</Text>
                                    <Text style={styles.questionText}>{q.question}</Text>
                                    {q.options?.map((opt: string, j: number) => (
                                        <Text key={j} style={[
                                            styles.optionText,
                                            j === q.correct && styles.correctOption
                                        ]}>
                                            {String.fromCharCode(65 + j)}) {opt}
                                        </Text>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.timeLimitContainer}>
                            <Text style={styles.timeLimitLabel}>Tempo limite:</Text>
                            <View style={styles.timeLimitButtons}>
                                {[180, 300, 600].map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        style={[styles.timeLimitBtn, quizTimeLimit === t && styles.timeLimitBtnActive]}
                                        onPress={() => setQuizTimeLimit(t)}
                                    >
                                        <Text style={styles.timeLimitBtnText}>{t / 60}min</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.broadcastButton}
                            onPress={handleBroadcastQuiz}
                            disabled={processingAction === 'broadcasting'}
                        >
                            {processingAction === 'broadcasting' ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <>
                                    <MaterialIcons name="send" size={20} color={colors.white} />
                                    <Text style={styles.broadcastButtonText}>Enviar para Alunos</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        backgroundColor: colors.zinc900,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.zinc800,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    headerSubtitle: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    clearButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingVertical: spacing.sm,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },
    recordingText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: '#ef4444',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
    },
    textContainer: {
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        minHeight: 300,
    },
    textInput: {
        fontSize: typography.fontSize.base,
        color: colors.white,
        lineHeight: 26,
        textAlignVertical: 'top',
    },
    wordCount: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc500,
        textAlign: 'right',
        marginTop: spacing.sm,
    },
    footer: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
        alignItems: 'center',
    },
    recordButton: {
        marginBottom: spacing.md,
    },
    recordButtonActive: {},
    recordButtonGradient: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.zinc800,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.zinc900,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        maxHeight: '85%',
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    quizPreviewScroll: {
        maxHeight: 300,
    },
    questionPreview: {
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    questionNumber: {
        fontSize: typography.fontSize.xs,
        color: '#10b981',
        fontWeight: typography.fontWeight.semibold,
        marginBottom: spacing.xs,
    },
    questionText: {
        fontSize: typography.fontSize.base,
        color: colors.white,
        fontWeight: typography.fontWeight.medium,
        marginBottom: spacing.sm,
    },
    optionText: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc300,
        paddingVertical: 4,
    },
    correctOption: {
        color: '#10b981',
        fontWeight: typography.fontWeight.semibold,
    },
    timeLimitContainer: {
        marginTop: spacing.md,
        marginBottom: spacing.lg,
    },
    timeLimitLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
        marginBottom: spacing.sm,
    },
    timeLimitButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    timeLimitBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    timeLimitBtnActive: {
        backgroundColor: '#8b5cf6',
    },
    timeLimitBtnText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    broadcastButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#10b981',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
    },
    broadcastButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
});
