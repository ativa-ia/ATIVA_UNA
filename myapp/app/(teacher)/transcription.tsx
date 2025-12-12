import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    Alert,
    Animated,
    Easing,
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
import {
    createTranscriptionSession,
    updateTranscription,
    shareSummary,
    getTranscriptionSession,
    getActivityRanking,
    TranscriptionSession,
    LiveActivity,
    resumeSession,
    endTranscriptionSession,
    generateQuiz,
    generateSummary,
    createOpenQuestion,
    broadcastActivity,
    endActivity,
    exportActivityPDF,
} from '@/services/api';
import RaceVisualization from '@/components/quiz/RaceVisualization';
import PodiumDisplay from '@/components/quiz/PodiumDisplay';
// import { useAuth } from '@/context/AuthContext'; // Ajuste o caminho se necessário
import { useRouter } from 'expo-router';

/**
 * TranscriptionScreen - Tela de transcrição com sessões persistentes e atividades
 */
export default function TranscriptionScreen() {
    const router = useRouter();
    // const { user } = useAuth(); // Se precisar do user
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectId = parseInt(params.subjectId as string) || 1;
    const subjectName = params.subject as string || 'Disciplina';

    // Estado da sessão
    const [session, setSession] = useState<TranscriptionSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Estado da transcrição
    const [transcribedText, setTranscribedText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [interimText, setInterimText] = useState('');

    // Estado do modal de atividades
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentActivity, setCurrentActivity] = useState<LiveActivity | null>(null);
    const [showRankingModal, setShowRankingModal] = useState(false);
    const [ranking, setRanking] = useState<any[]>([]);
    const [showPodium, setShowPodium] = useState(false); // Controla exibição do pódio
    const [showAnswerKey, setShowAnswerKey] = useState(false); // Controla exibição do gabarito
    const [visibleAnswers, setVisibleAnswers] = useState<Set<number>>(new Set()); // Controla quais questões mostram resposta
    const [numQuestions, setNumQuestions] = useState(5); // Quantidade de questões do quiz

    // Estado do conteúdo gerado (exibido no painel esquerdo)
    const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
    const [generatedQuiz, setGeneratedQuiz] = useState<any>(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [displayMode, setDisplayMode] = useState<'none' | 'summary' | 'quiz'>('none');

    // Refs
    const recognitionRef = useRef<any>(null);
    const isRecordingRef = useRef(false);
    const savedTextRef = useRef('');
    const processedResultsRef = useRef<Set<number>>(new Set());
    const lastFinalTextRef = useRef('');
    const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rankingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Animação
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);

    // Inicializar sessão
    useEffect(() => {
        initSession();
        return () => {
            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
            if (rankingIntervalRef.current) clearInterval(rankingIntervalRef.current);
        };
    }, []);

    const initSession = async () => {
        try {
            setIsLoading(true);
            const result = await createTranscriptionSession(subjectId, `Aula - ${subjectName}`);
            if (result.success && result.session) {
                setSession(result.session);
                setTranscribedText(result.session.full_transcript || '');
                savedTextRef.current = result.session.full_transcript || '';
            }
        } catch (error) {
            console.error('Erro ao iniciar sessão:', error);
            Alert.alert('Erro', 'Não foi possível iniciar a sessão de transcrição.');
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-save debounced (5 segundos)
    const triggerAutoSave = useCallback((text: string) => {
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(async () => {
            if (session && text !== session.full_transcript) {
                setIsSaving(true);
                try {
                    await updateTranscription(session.id, text);
                    setLastSaved(new Date());
                } catch (error) {
                    console.error('Erro ao salvar:', error);
                }
                setIsSaving(false);
            }
        }, 5000);
    }, [session]);

    // Animação quando gravando
    useEffect(() => {
        if (isRecording) {
            animationRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 500,
                        easing: Easing.ease,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        easing: Easing.ease,
                        useNativeDriver: true,
                    }),
                ])
            );
            animationRef.current.start();
        } else {
            if (animationRef.current) {
                animationRef.current.stop();
            }
            pulseAnim.setValue(1);
        }

        return () => {
            if (animationRef.current) {
                animationRef.current.stop();
            }
        };
    }, [isRecording]);

    // Inicializar speech recognition
    useEffect(() => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const recognition = new SpeechRecognition();
                recognition.continuous = !isMobile;
                recognition.interimResults = true;
                recognition.lang = 'pt-BR';

                recognition.onresult = (event: any) => {
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
                                triggerAutoSave(savedTextRef.current);
                            }
                        } else if (!result.isFinal) {
                            currentInterim = transcript;
                        }
                    }
                    setInterimText(currentInterim);
                };

                recognition.onerror = (event: any) => {
                    console.error('Speech error:', event.error);
                    if (event.error === 'not-allowed') {
                        Alert.alert('Permissão Negada', 'Permita o acesso ao microfone.');
                        setIsRecording(false);
                        isRecordingRef.current = false;
                    }
                };

                recognition.onend = () => {
                    if (isRecordingRef.current) {
                        processedResultsRef.current.clear();
                        setTimeout(() => {
                            try {
                                recognition.start();
                            } catch (e) {
                                console.log('Não foi possível reiniciar');
                            }
                        }, 100);
                    }
                };

                recognitionRef.current = recognition;
            }
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) { }
            }
        };
    }, [triggerAutoSave]);

    const toggleRecording = () => {
        if (Platform.OS !== 'web') {
            Alert.alert("Em breve", "Reconhecimento de voz no celular em breve.");
            return;
        }

        if (!recognitionRef.current) {
            Alert.alert("Não suportado", "Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        if (isRecording) {
            isRecordingRef.current = false;
            setIsRecording(false);
            setInterimText('');
            try {
                recognitionRef.current.stop();
            } catch (e) { }
        } else {
            savedTextRef.current = transcribedText;
            processedResultsRef.current.clear();
            lastFinalTextRef.current = '';
            setInterimText('');
            isRecordingRef.current = true;
            setIsRecording(true);
            try {
                recognitionRef.current.start();
            } catch (e: any) {
                console.error('Erro ao iniciar:', e);
                // Se já estiver iniciado, consideramos sucesso
                if (e?.name === 'InvalidStateError' || e?.message?.includes('already started')) {
                    console.log('Reconhecimento já estava iniciado');
                } else {
                    isRecordingRef.current = false;
                    setIsRecording(false);
                }
            }
        }
    };

    const handleTextChange = (text: string) => {
        setTranscribedText(text);
        savedTextRef.current = text;
        triggerAutoSave(text);
    };

    // Pausar e abrir menu de atividades
    const handlePauseForActivity = async () => {
        if (isRecording) {
            toggleRecording(); // Parar gravação primeiro
        }
        // Salvar antes de pausar
        if (session && transcribedText) {
            await updateTranscription(session.id, transcribedText);
        }
        setShowActivityModal(true);
    };

    // Gerar Quiz
    const handleGenerateQuiz = async (numQuestions: number) => {
        if (!session) return;

        // Verificar se tem texto
        if (!transcribedText || transcribedText.trim().length === 0) {
            Alert.alert(
                'Sem Texto',
                'Grave algum conteúdo antes de gerar um quiz.'
            );
            return;
        }

        setIsGenerating(true);
        setDisplayMode('quiz');
        setGeneratedQuiz(null); // Limpar quiz anterior
        try {
            // Forçar salvamento antes de gerar
            await updateTranscription(session.id, transcribedText);

            const result = await generateQuiz(session.id, numQuestions);
            if (result.success && result.activity) {
                setCurrentActivity(result.activity);
                // Backend agora retorna o conteúdo estruturado em 'content'
                const quizContent = result.activity.content || result.activity.ai_generated_content || '';
                setGeneratedQuiz(quizContent);
                console.log('Quiz gerado:', quizContent);
            } else {
                Alert.alert('Erro', result.error || 'Não foi possível gerar o quiz.');
                setDisplayMode('none');
            }
        } catch (error) {
            console.error('Erro ao gerar quiz:', error);
            Alert.alert('Erro', 'Erro ao gerar quiz. Verifique sua conexão.');
            setDisplayMode('none');
        }
        setIsGenerating(false);
    };

    // Gerar Resumo
    const handleGenerateSummary = async () => {
        if (!session) return;

        // Verificar se tem texto
        if (!transcribedText || transcribedText.trim().length === 0) {
            Alert.alert(
                'Sem Texto',
                'Grave algum conteúdo antes de gerar um resumo.'
            );
            return;
        }

        setIsGenerating(true);
        setDisplayMode('summary');
        setGeneratedSummary(null); // Limpar resumo anterior
        try {
            // Forçar salvamento antes de gerar
            await updateTranscription(session.id, transcribedText);

            const result = await generateSummary(session.id);
            if (result.success) {
                setCurrentActivity(result.activity);
                setGeneratedSummary(result.activity.ai_generated_content || '');
                console.log('Resumo gerado:', result.activity.ai_generated_content);
            } else {
                Alert.alert('Erro', result.error || 'Não foi possível gerar o resumo.');
                setDisplayMode('none');
            }
        } catch (error: any) {
            console.error('Erro ao gerar resumo:', error);
            Alert.alert('Erro', error?.message || 'Erro ao gerar resumo. Verifique sua conexão.');
            setDisplayMode('none');
        }
        setIsGenerating(false);
    };

    // Criar Pergunta Aberta
    const handleCreateOpenQuestion = async (type: 'doubts' | 'feedback') => {
        if (!session) return;
        setIsGenerating(true);
        try {
            const result = await createOpenQuestion(session.id, type, 120);
            if (result.success) {
                setCurrentActivity(result.activity);
                setShowActivityModal(false);
                Alert.alert(
                    'Pergunta Criada!',
                    'Deseja enviar para os alunos agora?',
                    [
                        { text: 'Depois', style: 'cancel' },
                        {
                            text: 'Enviar Agora',
                            onPress: () => startActivity(result.activity.id)
                        }
                    ]
                );
            }
        } catch (error) {
            Alert.alert('Erro', 'Erro ao criar pergunta.');
        }
        setIsGenerating(false);
    };

    // Iniciar atividade para alunos
    const startActivity = async (activityId: number) => {
        try {
            const result = await broadcastActivity(activityId);
            if (result.success) {
                setCurrentActivity(result.activity);
                Alert.alert('Atividade Iniciada!', `Enviada para ${result.enrolled_students || 0} alunos.`);
                // Se for quiz, abrir ranking
                if (result.activity.activity_type === 'quiz') {
                    setShowRankingModal(true);
                    startRankingPolling(activityId);
                }
            }
        } catch (error) {
            Alert.alert('Erro', 'Erro ao iniciar atividade.');
        }
    };

    // Polling do ranking
    const startRankingPolling = (activityId: number) => {
        if (rankingIntervalRef.current) clearInterval(rankingIntervalRef.current);

        const fetchRanking = async () => {
            try {
                const result = await getActivityRanking(activityId);
                if (result.success) {
                    setRanking(result.ranking || []);
                }
            } catch (error) {
                console.error('Erro ao buscar ranking:', error);
            }
        };

        fetchRanking(); // Primeira vez imediato
        rankingIntervalRef.current = setInterval(fetchRanking, 2000);
    };

    // Encerrar atividade
    const handleEndActivity = async () => {
        if (!currentActivity) return;

        // Se já está mostrando o pódio, fechar tudo
        if (showPodium) {
            try {
                const activityId = currentActivity.id;
                if (rankingIntervalRef.current) clearInterval(rankingIntervalRef.current);
                await endActivity(activityId);
                setShowRankingModal(false);
                setCurrentActivity(null);
                setShowPodium(false);

                // Retomar sessão
                if (session) {
                    await resumeSession(session.id);
                }
            } catch (error) {
                console.error('Erro ao encerrar:', error);
            }
            return;
        }

        // Primeira vez: mostrar pódio se houver pelo menos 1 resposta
        const submittedCount = ranking.filter((r: any) => r.status === 'submitted').length;
        if (submittedCount >= 1) {
            setShowPodium(true);
        } else {
            // Se não houver respostas, encerrar direto
            try {
                const activityId = currentActivity.id;
                if (rankingIntervalRef.current) clearInterval(rankingIntervalRef.current);
                await endActivity(activityId);
                setShowRankingModal(false);
                setCurrentActivity(null);

                if (session) {
                    await resumeSession(session.id);
                }
            } catch (error) {
                console.error('Erro ao encerrar:', error);
            }
        }
    };

    // Compartilhar resumo
    const handleShareSummary = async () => {
        if (!currentActivity) return;
        try {
            await shareSummary(currentActivity.id);
            Alert.alert('Sucesso', 'Resumo compartilhado com os alunos!');
            setShowSummaryModal(false);
            // Retomar sessão
            if (session) {
                await resumeSession(session.id);
            }
        } catch (error) {
            Alert.alert('Erro', 'Erro ao compartilhar resumo.');
        }
    };

    // Voltar à transcrição sem compartilhar
    const handleCloseSummary = async () => {
        setShowSummaryModal(false);
        if (session) {
            await resumeSession(session.id);
        }
    };

    // Exportar PDF do ranking
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    const handleExportPDF = async () => {
        if (!currentActivity) return;

        setIsExportingPDF(true);
        try {
            const blob = await exportActivityPDF(currentActivity.id);

            // Criar URL do blob e fazer download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `relatorio_atividade_${currentActivity.id}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            Alert.alert('Sucesso', 'Relatório PDF exportado com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            Alert.alert('Erro', 'Não foi possível exportar o relatório em PDF.');
        }
        setIsExportingPDF(false);
    };

    const wordCount = transcribedText.split(/\s+/).filter(w => w).length;

    if (isLoading) {
        return (
            <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Iniciando sessão...</Text>
            </View>
        );
    }

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
                <View style={styles.saveIndicator}>
                    {isSaving ? (
                        <ActivityIndicator size="small" color={colors.zinc400} />
                    ) : lastSaved ? (
                        <MaterialIcons name="cloud-done" size={20} color="#22c55e" />
                    ) : (
                        <MaterialIcons name="cloud-off" size={20} color={colors.zinc500} />
                    )}
                </View>
            </View>

            {/* Status Banner */}
            {isRecording && (
                <View style={styles.recordingBanner}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Gravando...</Text>
                </View>
            )}

            {session?.status === 'paused' && (
                <View style={styles.pausedBanner}>
                    <MaterialIcons name="pause-circle" size={16} color="#f59e0b" />
                    <Text style={styles.pausedText}>Sessão pausada</Text>
                </View>
            )}

            {/* Transcribed Text Area - Split Screen */}
            <View style={styles.contentContainer}>
                {/* Painel Esquerdo - Conteúdo Gerado */}
                <View style={styles.leftPanel}>
                    <View style={styles.panelHeader}>
                        <MaterialIcons
                            name={displayMode === 'quiz' ? 'quiz' : 'summarize'}
                            size={20}
                            color={displayMode === 'quiz' ? '#8b5cf6' : '#22c55e'}
                        />
                        <Text style={styles.panelTitle}>
                            {displayMode === 'quiz' ? 'Quiz Gerado' : displayMode === 'summary' ? 'Resumo Gerado' : 'Aguardando...'}
                        </Text>
                    </View>

                    <ScrollView
                        style={styles.panelScroll}
                        contentContainerStyle={styles.panelScrollContent}
                    >
                        {isGenerating && displayMode !== 'none' ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={displayMode === 'quiz' ? '#8b5cf6' : '#22c55e'} />
                                <Text style={styles.loadingText}>Gerando com IA...</Text>
                            </View>
                        ) : displayMode === 'summary' && generatedSummary ? (
                            <View style={styles.summaryContent}>
                                <Text style={styles.generatedText}>{generatedSummary}</Text>
                            </View>
                        ) : displayMode === 'quiz' && generatedQuiz ? (
                            <View style={styles.quizContent}>
                                {(() => {
                                    try {
                                        // Tentar parsear se for string, ou usar direto se já for objeto
                                        const content = typeof generatedQuiz === 'string'
                                            ? JSON.parse(generatedQuiz)
                                            : generatedQuiz;

                                        const questions = content.questions || [];

                                        if (!questions.length) {
                                            return <Text style={styles.generatedText}>{typeof generatedQuiz === 'string' ? generatedQuiz : JSON.stringify(generatedQuiz)}</Text>;
                                        }

                                        return (
                                            <View>
                                                {questions.map((q: any, i: number) => (
                                                    <View key={i} style={styles.previewQuestionCard}>
                                                        <View style={styles.questionHeader}>
                                                            <Text style={styles.previewQuestionTitle}>
                                                                {i + 1}. {q.question}
                                                            </Text>
                                                            <TouchableOpacity
                                                                style={styles.individualAnswerButton}
                                                                onPress={() => {
                                                                    const newVisible = new Set(visibleAnswers);
                                                                    if (newVisible.has(i)) {
                                                                        newVisible.delete(i);
                                                                    } else {
                                                                        newVisible.add(i);
                                                                    }
                                                                    setVisibleAnswers(newVisible);
                                                                }}
                                                            >
                                                                <MaterialIcons
                                                                    name={visibleAnswers.has(i) ? 'visibility-off' : 'visibility'}
                                                                    size={18}
                                                                    color={visibleAnswers.has(i) ? '#22c55e' : colors.zinc400}
                                                                />
                                                            </TouchableOpacity>
                                                        </View>
                                                        {q.options?.map((opt: string, idx: number) => (
                                                            <Text key={idx} style={[
                                                                styles.previewOption,
                                                                (showAnswerKey || visibleAnswers.has(i)) && idx === q.correct && styles.previewCorrectOption
                                                            ]}>
                                                                {String.fromCharCode(65 + idx)}) {opt}
                                                            </Text>
                                                        ))}
                                                    </View>
                                                ))}

                                                {/* Botão para mostrar/ocultar TODAS as respostas */}
                                                <TouchableOpacity
                                                    style={styles.toggleAnswerKeyButton}
                                                    onPress={() => {
                                                        const newState = !showAnswerKey;
                                                        setShowAnswerKey(newState);
                                                        // Se estiver mostrando todas, limpar individuais
                                                        if (newState) {
                                                            setVisibleAnswers(new Set());
                                                        }
                                                    }}
                                                >
                                                    <MaterialIcons
                                                        name={showAnswerKey ? 'visibility-off' : 'visibility'}
                                                        size={20}
                                                        color={colors.white}
                                                    />
                                                    <Text style={styles.toggleAnswerKeyText}>
                                                        {showAnswerKey ? 'Ocultar Todas' : 'Mostrar Todas'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    } catch (e) {
                                        // Fallback para texto simples se não for JSON válido
                                        return <Text style={styles.generatedText}>{String(generatedQuiz)}</Text>;
                                    }
                                })()}

                                {currentActivity && (
                                    <TouchableOpacity
                                        style={styles.sendButton}
                                        onPress={() => startActivity(currentActivity.id)}
                                    >
                                        <MaterialIcons name="send" size={18} color={colors.white} />
                                        <Text style={styles.sendButtonText}>Enviar Quiz para Alunos</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialIcons name="auto-awesome" size={48} color={colors.zinc600} />
                                <Text style={styles.emptyStateText}>
                                    Clique em "Resumo" ou "Quiz" para gerar conteúdo com IA
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* Painel Direito - Transcrição */}
                <View style={styles.rightPanel}>
                    <View style={styles.panelHeader}>
                        <MaterialIcons name="mic" size={20} color="#8b5cf6" />
                        <Text style={styles.panelTitle}>Transcrição</Text>
                        <Text style={styles.wordCount}>{wordCount} palavras</Text>
                    </View>

                    <ScrollView
                        style={styles.panelScroll}
                        contentContainerStyle={styles.panelScrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <TextInput
                            style={styles.textInput}
                            multiline
                            value={transcribedText + (interimText ? ' ' + interimText : '')}
                            onChangeText={handleTextChange}
                            placeholder="O texto transcrito aparecerá aqui...

Pressione o botão do microfone para começar a falar."
                            placeholderTextColor={colors.zinc500}
                            editable={!isRecording}
                        />
                    </ScrollView>

                    <View style={styles.transcriptionInfo}>
                        <Text style={styles.infoText}>
                            {isRecording ? '🎤 Ditando...' : '📝 Pronto para editar'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                {/* Seletor de Quantidade de Questões */}
                <View style={styles.questionCountSelector}>
                    <Text style={styles.questionCountLabel}>Questões:</Text>
                    <View style={styles.questionCountOptions}>
                        {[3, 5, 10].map((count) => (
                            <TouchableOpacity
                                key={count}
                                style={[
                                    styles.questionCountOption,
                                    numQuestions === count && styles.questionCountOptionActive
                                ]}
                                onPress={() => setNumQuestions(count)}
                            >
                                <Text style={[
                                    styles.questionCountOptionText,
                                    numQuestions === count && styles.questionCountOptionTextActive
                                ]}>
                                    {count}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.footerButtons}>
                    {/* Botão de Resumo */}
                    <TouchableOpacity
                        style={styles.summaryButton}
                        onPress={handleGenerateSummary}
                        activeOpacity={0.8}
                        disabled={isGenerating}
                    >
                        <LinearGradient
                            colors={['#22c55e', '#16a34a']}
                            style={styles.summaryButtonGradient}
                        >
                            <MaterialIcons name="summarize" size={24} color={colors.white} />
                            <Text style={styles.buttonLabel}>Resumo</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Botão de Gravação */}
                    <Animated.View style={isRecording ? { transform: [{ scale: pulseAnim }] } : undefined}>
                        <TouchableOpacity
                            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                            onPress={toggleRecording}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={isRecording ? ['#ef4444', '#dc2626'] : ['#8b5cf6', '#a855f7']}
                                style={styles.recordButtonGradient}
                            >
                                <MaterialIcons
                                    name={isRecording ? 'stop' : 'mic'}
                                    size={32}
                                    color={colors.white}
                                />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    <TouchableOpacity
                        style={styles.quizButton}
                        onPress={() => handleGenerateQuiz(numQuestions)}
                        activeOpacity={0.8}
                        disabled={isGenerating}
                    >
                        <LinearGradient
                            colors={['#f59e0b', '#d97706']}
                            style={styles.quizButtonGradient}
                        >
                            <MaterialIcons name="quiz" size={24} color={colors.white} />
                            <Text style={styles.buttonLabel}>Quiz</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <Text style={styles.footerHint}>
                    {isGenerating ? 'Gerando com IA...' : isRecording ? 'Gravando...' : 'Resumo | Gravar | Quiz'}
                </Text>
            </View>


            {/* Modal de Ranking - COM GAMIFICAÇÃO */}
            <Modal
                visible={showRankingModal}
                transparent
                animationType="slide"
                onRequestClose={handleEndActivity}
            >
                <View style={styles.modalOverlayFullScreen}>
                    <View style={styles.rankingModalContent}>
                        {/* Header */}
                        <View style={styles.rankingHeader}>
                            <Text style={styles.modalTitle}>
                                {currentActivity?.status === 'ended' ? '🏆 Pódio Final' : '🏁 Ranking ao Vivo'}
                            </Text>
                            <TouchableOpacity onPress={handleEndActivity} style={styles.closeIconButton}>
                                <MaterialIcons name="close" size={24} color={colors.white} />
                            </TouchableOpacity>
                        </View>

                        {/* Conteúdo com Gamificação */}
                        <View style={styles.gamificationContent}>
                            {showPodium && ranking.filter((r: any) => r.status === 'submitted').length >= 1 ? (
                                // Pódio quando encerrado (funciona com 1, 2 ou 3+ alunos)
                                <PodiumDisplay
                                    topStudents={ranking
                                        .filter((r: any) => r.status === 'submitted')
                                        .slice(0, 3)
                                        .map((student: any, index: number) => ({
                                            position: index + 1,
                                            student_name: student.student_name,
                                            points: student.points || (student.score * 100),
                                            percentage: student.percentage || 0,
                                            score: student.score || 0,
                                            total: student.total || 0,
                                        }))
                                    }
                                />
                            ) : ranking.length > 0 ? (
                                // Visualização de corrida em tempo real
                                <RaceVisualization
                                    ranking={ranking
                                        .filter((r: any) => r.status === 'submitted')
                                        .map((student: any, index: number) => ({
                                            position: index + 1,
                                            student_id: student.student_id,
                                            student_name: student.student_name,
                                            points: student.points || (student.score * 100),
                                            score: student.score || 0,
                                            total: student.total || 0,
                                            percentage: student.percentage || 0,
                                            time_taken: student.time_taken || 0,
                                        }))
                                    }
                                    enrolledCount={ranking.length}
                                />
                            ) : (
                                <View style={styles.emptyStateRanking}>
                                    <ActivityIndicator size="large" color="#8b5cf6" />
                                    <Text style={styles.emptyText}>Aguardando respostas...</Text>
                                </View>
                            )}
                        </View>

                        {/* Botões - lado a lado */}
                        <View style={styles.modalButtonsRow}>
                            {/* Botão Exportar PDF - apenas quando pódio estiver visível */}
                            {showPodium && (
                                <TouchableOpacity
                                    style={[styles.exportPdfButton, styles.buttonHalf]}
                                    onPress={handleExportPDF}
                                    disabled={isExportingPDF}
                                >
                                    {isExportingPDF ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <MaterialIcons name="picture-as-pdf" size={20} color={colors.white} />
                                    )}
                                    <Text style={styles.exportPdfButtonText}>
                                        {isExportingPDF ? 'Gerando...' : 'Exportar PDF'}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Botão Encerrar/Fechar */}
                            <TouchableOpacity
                                style={[styles.closeButton, showPodium && styles.buttonHalf]}
                                onPress={handleEndActivity}
                            >
                                <Text style={styles.closeButtonText}>
                                    {showPodium ? 'Fechar' : 'Encerrar e Ver Pódio'}
                                </Text>
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
        backgroundColor: colors.backgroundDark,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.zinc400,
        fontSize: typography.fontSize.base,
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
    saveIndicator: {
        width: 40,
        height: 40,
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
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
    },
    recordingText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: '#ef4444',
    },
    pausedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        paddingVertical: spacing.sm,
    },
    pausedText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: '#f59e0b',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        flexGrow: 1,
    },
    textContainer: {
        flex: 1,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        minHeight: 300,
    },
    textInput: {
        flex: 1,
        fontSize: typography.fontSize.base,
        color: colors.white,
        lineHeight: 28,
        textAlignVertical: 'top',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    wordCount: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc500,
    },
    infoText: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    // Split-screen layout
    contentContainer: {
        flex: 1,
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.base,
    },
    leftPanel: {
        flex: 1,
        backgroundColor: colors.zinc900,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
    },
    rightPanel: {
        flex: 1,
        backgroundColor: colors.zinc900,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.zinc800,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc700,
    },
    panelTitle: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    panelScroll: {
        flex: 1,
    },
    panelScrollContent: {
        padding: spacing.lg,
        flexGrow: 1,
    },
    transcriptionInfo: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
        alignItems: 'center',
    },
    // Generated content styles
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    emptyStateText: {
        fontSize: typography.fontSize.base,
        color: colors.zinc500,
        textAlign: 'center',
        maxWidth: 250,
    },
    summaryContent: {
        gap: spacing.lg,
    },
    generatedText: {
        fontSize: typography.fontSize.base,
        color: colors.white,
        lineHeight: 24,
    },
    quizContent: {
        gap: spacing.lg,
    },
    quizQuestion: {
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.sm,
    },
    questionNumber: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: '#8b5cf6',
        marginBottom: spacing.xs,
    },
    questionText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
        marginBottom: spacing.sm,
    },
    questionOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        backgroundColor: colors.zinc700,
        borderRadius: borderRadius.default,
        marginTop: spacing.xs,
    },
    correctOption: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 1,
        borderColor: '#22c55e',
    },
    optionLetter: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.zinc400,
        width: 20,
    },
    optionText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.white,
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#8b5cf6',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.lg,
        marginTop: spacing.md,
    },
    sendButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    footer: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
        alignItems: 'center',
    },
    footerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
    },
    recordButton: {
    },
    recordButtonActive: {
        shadowColor: '#ef4444',
    },
    recordButtonGradient: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryButton: {
    },
    summaryButtonGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
    },
    quizButton: {
    },
    quizButtonGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
    },
    buttonLabel: {
        fontSize: 10,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
        marginTop: -2,
    },
    questionCountSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.md,
    },
    questionCountLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    questionCountOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    questionCountOption: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.zinc800,
        borderWidth: 2,
        borderColor: colors.zinc700,
        minWidth: 40,
        alignItems: 'center',
    },
    questionCountOptionActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#a855f7',
    },
    questionCountOptionText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.zinc400,
    },
    questionCountOptionTextActive: {
        color: colors.white,
    },
    activityButton: {
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    activityButtonGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerHint: {
        marginTop: spacing.sm,
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalOverlayFullScreen: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIconButton: {
        padding: spacing.sm,
    },
    gamificationContent: {
        padding: spacing.lg,
        maxHeight: '75%',
    },
    modalContent: {
        backgroundColor: colors.zinc900,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        paddingBottom: spacing.xl,
    },
    modalTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    modalSubtitle: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    generatingContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    generatingText: {
        marginTop: spacing.md,
        color: colors.zinc400,
        fontSize: typography.fontSize.base,
    },
    activityOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    activityIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    activityName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    activityDesc: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    cancelButton: {
        marginTop: spacing.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: colors.zinc400,
        fontSize: typography.fontSize.base,
    },
    // Summary Modal
    summaryModalContent: {
        backgroundColor: colors.zinc900,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '80%',
    },
    summaryScroll: {
        maxHeight: 300,
        marginVertical: spacing.md,
    },
    summaryText: {
        fontSize: typography.fontSize.base,
        color: colors.white,
        lineHeight: 24,
    },
    summaryButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    secondaryButton: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.zinc600,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: colors.zinc300,
        fontSize: typography.fontSize.sm,
    },
    primaryButton: {
        flex: 1,
        flexDirection: 'row',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: '#8b5cf6',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    primaryButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    // Ranking Modal - Premium Dark Theme with Primary Accents
    rankingModalContent: {
        backgroundColor: colors.backgroundDark,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        width: '95%',
        height: '90%',
        borderWidth: 3,
        borderColor: colors.primary,
    },
    rankingScroll: {
        maxHeight: 400,
        marginVertical: spacing.md,
    },
    waitingContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        backgroundColor: 'rgba(19, 91, 236, 0.05)',
        borderRadius: borderRadius.lg,
        marginTop: spacing.md,
    },
    waitingText: {
        marginTop: spacing.md,
        color: colors.white,
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
    },
    rankingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    rankingPositionOld: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: '#f59e0b',
        width: 40,
    },
    rankingInfoOld: {
        flex: 1,
    },
    rankingNameOld: {
        fontSize: typography.fontSize.base,
        color: colors.white,
        fontWeight: typography.fontWeight.medium,
    },
    rankingScoreOld: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    endActivityButton: {
        backgroundColor: '#ef4444',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'center',
    },
    endActivityButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
    // Leaderboard Styles - Premium Design
    leaderboardContainer: {
        backgroundColor: 'rgba(19, 91, 236, 0.03)',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(19, 91, 236, 0.15)',
        height: 450,
    },
    leaderboardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    leaderboardStats: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    // Novo Modal de Ranking - Estilos Simples
    rankingHeader: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc700,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    statNumber: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: '#a78bfa',
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc400,
        marginTop: 4,
    },
    studentList: {
        flex: 1,
        padding: spacing.base,
    },
    studentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    studentRowWaiting: {
        opacity: 0.6,
        borderStyle: 'dashed',
    },
    positionBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.zinc700,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    positionText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    studentNameWaiting: {
        color: colors.zinc500,
    },
    studentScore: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc400,
        marginTop: 2,
    },
    resultBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    percentageText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    waitingTextSmall: {
        fontSize: typography.fontSize.xs,
        color: colors.zinc500,
        fontStyle: 'italic',
    },
    emptyStateRanking: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyText: {
        fontSize: typography.fontSize.base,
        color: colors.zinc400,
        marginTop: spacing.md,
    },
    closeButton: {
        backgroundColor: '#ef4444',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        margin: spacing.base,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    exportPdfButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#8b5cf6',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        margin: spacing.base,
        marginBottom: spacing.sm,
    },
    exportPdfButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    modalButtonsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.base,
        paddingTop: 0,
    },
    buttonHalf: {
        flex: 1,
        margin: 0,
    },
    leaderboardTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    leaderboardScroll: {
        flex: 1,
    },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    rank1: { backgroundColor: 'rgba(255, 215, 0, 0.1)', borderColor: 'rgba(255, 215, 0, 0.3)' },
    rank2: { backgroundColor: 'rgba(192, 192, 192, 0.1)', borderColor: 'rgba(192, 192, 192, 0.3)' },
    rank3: { backgroundColor: 'rgba(205, 127, 50, 0.1)', borderColor: 'rgba(205, 127, 50, 0.3)' },
    rankWaiting: { opacity: 0.5, borderStyle: 'dashed' },

    // rankText definitions
    rankText: {
        fontSize: typography.fontSize.base,
        fontWeight: 'bold',
        color: colors.zinc400,
    },
    rankTextTop: {
        fontSize: typography.fontSize.lg,
        color: colors.white,
    },

    rankingPosition: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(19, 91, 236, 0.15)',
        borderRadius: 22,
    },
    rankingInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    rankingName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    rankingNameWaiting: {
        color: colors.zinc500,
        fontStyle: 'italic',
    },
    statusWaiting: {
        fontSize: 11,
        color: colors.zinc500,
    },
    rankingScore: {
        alignItems: 'flex-end',
    },
    pointsBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        marginBottom: 2,
    },
    rankPoints: {
        fontSize: typography.fontSize.xs,
        fontWeight: 'bold',
        color: '#D97706', // Amber 600
    },
    rankPercentage: {
        fontSize: 10,
        color: colors.zinc500,
    },
    previewQuestionCard: {
        backgroundColor: colors.zinc800,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    individualAnswerButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.zinc700,
    },
    previewQuestionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.sm,
    },
    previewOption: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
        marginLeft: spacing.sm,
        marginBottom: 2,
    },
    previewCorrectOption: {
        color: '#22c55e',
        fontWeight: typography.fontWeight.bold,
    },
    toggleAnswerKeyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#f59e0b',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginTop: spacing.lg,
    },
    toggleAnswerKeyText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },

    listContainer: {
        backgroundColor: colors.zinc50,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
    },
    waitingSubtext: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
        marginTop: 4,
    },
    leaderboardRowWaiting: {
        opacity: 0.5,
    },
    rankPointsList: {
        fontSize: typography.fontSize.sm,
        fontWeight: 'bold',
        color: '#d97706',
        marginRight: 8,
    },
});
