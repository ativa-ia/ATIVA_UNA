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
    generateQuiz,
    generateSummary,
    createOpenQuestion,
    broadcastActivity,
    shareSummary,
    endActivity,
    resumeSession,
    getActivityRanking,
    TranscriptionSession,
    LiveActivity,
} from '@/services/api';

/**
 * TranscriptionScreen - Tela de transcrição com sessões persistentes e atividades
 */
export default function TranscriptionScreen() {
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

    // Estado do resumo gerado
    const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

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
            } catch (e) {
                console.error('Erro ao iniciar:', e);
                isRecordingRef.current = false;
                setIsRecording(false);
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
            console.log('[QUIZ] Erro: sem texto transcrito');
            Alert.alert(
                'Sem Texto',
                'Grave algum conteúdo antes de gerar um quiz.'
            );
            return;
        }

        console.log('[QUIZ] Iniciando geração de quiz...');
        console.log('[QUIZ] Session ID:', session.id);
        console.log('[QUIZ] Texto transcrito:', transcribedText.substring(0, 100), '...');
        console.log('[QUIZ] Comprimento do texto:', transcribedText.length, 'caracteres');

        setIsGenerating(true);
        try {
            // Forçar salvamento antes de gerar
            console.log('[QUIZ] Salvando transcrição no backend...');
            await updateTranscription(session.id, transcribedText);
            console.log('[QUIZ] Transcrição salva.');

            console.log('[QUIZ] Chamando API generateQuiz...');
            const result = await generateQuiz(session.id, numQuestions);
            console.log('[QUIZ] Resposta da API:', JSON.stringify(result, null, 2));

            if (result.success && result.activity) {
                console.log('[QUIZ] Quiz gerado com sucesso! ID:', result.activity.id);
                console.log('[QUIZ] Perguntas:', result.activity.content?.questions?.length || 0);
                setCurrentActivity(result.activity);
                setShowActivityModal(false);
                Alert.alert(
                    'Quiz Gerado!',
                    `${result.activity.content?.questions?.length || 0} perguntas criadas. Deseja iniciar agora?`,
                    [
                        { text: 'Revisar depois', style: 'cancel' },
                        {
                            text: 'Iniciar Quiz',
                            onPress: () => startActivity(result.activity!.id)
                        }
                    ]
                );
            } else {
                console.log('[QUIZ] Erro da API:', result.error);
                Alert.alert('Erro', result.error || 'Não foi possível gerar o quiz.');
            }
        } catch (error) {
            console.error('[QUIZ] Exceção ao gerar quiz:', error);
            Alert.alert('Erro', 'Erro ao gerar quiz. Verifique sua conexão.');
        }
        setIsGenerating(false);
    };

    // Gerar Resumo
    const handleGenerateSummary = async () => {
        if (!session) return;
        setIsGenerating(true);
        try {
            const result = await generateSummary(session.id);
            if (result.success) {
                setCurrentActivity(result.activity);
                setGeneratedSummary(result.activity.ai_generated_content || '');
                setShowActivityModal(false);
                setShowSummaryModal(true);
            } else {
                Alert.alert('Erro', 'Não foi possível gerar o resumo.');
            }
        } catch (error) {
            Alert.alert('Erro', 'Erro ao gerar resumo.');
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
        console.log('[BROADCAST] Iniciando atividade para alunos...');
        console.log('[BROADCAST] Activity ID:', activityId);
        try {
            const result = await broadcastActivity(activityId);
            console.log('[BROADCAST] Resposta da API:', JSON.stringify(result, null, 2));

            if (result.success) {
                console.log('[BROADCAST] Atividade iniciada com sucesso!');
                console.log('[BROADCAST] Alunos matriculados:', result.enrolled_students);
                setCurrentActivity(result.activity);
                Alert.alert('Atividade Iniciada!', `Enviada para ${result.enrolled_students || 0} alunos.`);
                // Se for quiz, abrir ranking
                if (result.activity?.activity_type === 'quiz') {
                    console.log('[BROADCAST] Tipo é quiz, abrindo modal de ranking...');
                    setShowRankingModal(true);
                    startRankingPolling(activityId);
                }
            } else {
                console.log('[BROADCAST] Erro no broadcast:', result);
                Alert.alert('Erro', 'Não foi possível iniciar a atividade.');
            }
        } catch (error) {
            console.error('[BROADCAST] Exceção ao iniciar atividade:', error);
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
        try {
            if (rankingIntervalRef.current) clearInterval(rankingIntervalRef.current);
            await endActivity(currentActivity.id);
            setShowRankingModal(false);
            setCurrentActivity(null);
            // Retomar sessão
            if (session) {
                await resumeSession(session.id);
            }
            Alert.alert('Atividade Encerrada', 'Você pode continuar a transcrição.');
        } catch (error) {
            Alert.alert('Erro', 'Erro ao encerrar atividade.');
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

            {/* Transcribed Text Area */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.textContainer}>
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
                </View>

                {/* Info */}
                <View style={styles.infoRow}>
                    <Text style={styles.wordCount}>{wordCount} palavras</Text>
                    <Text style={styles.infoText}>
                        {isRecording ? '🎤 Ditando...' : '📝 Pronto para editar'}
                    </Text>
                </View>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                <View style={styles.footerButtons}>
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

                    {/* Botão de Atividade */}
                    <TouchableOpacity
                        style={styles.activityButton}
                        onPress={handlePauseForActivity}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#f59e0b', '#d97706']}
                            style={styles.activityButtonGradient}
                        >
                            <MaterialIcons name="bolt" size={28} color={colors.white} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <Text style={styles.footerHint}>
                    {isRecording ? 'Toque para parar' : 'Gravar | Criar Atividade'}
                </Text>
            </View>

            {/* Modal de Atividades */}
            <Modal
                visible={showActivityModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowActivityModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Criar Atividade</Text>
                        <Text style={styles.modalSubtitle}>Escolha o tipo de atividade para os alunos</Text>

                        {isGenerating ? (
                            <View style={styles.generatingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.generatingText}>Gerando com IA...</Text>
                            </View>
                        ) : (
                            <>
                                {/* Quiz */}
                                <TouchableOpacity
                                    style={styles.activityOption}
                                    onPress={() => handleGenerateQuiz(5)}
                                >
                                    <View style={[styles.activityIcon, { backgroundColor: '#8b5cf6' }]}>
                                        <MaterialIcons name="quiz" size={24} color={colors.white} />
                                    </View>
                                    <View style={styles.activityInfo}>
                                        <Text style={styles.activityName}>Quiz Rápido</Text>
                                        <Text style={styles.activityDesc}>IA gera perguntas da aula</Text>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={24} color={colors.zinc500} />
                                </TouchableOpacity>

                                {/* Resumo */}
                                <TouchableOpacity
                                    style={styles.activityOption}
                                    onPress={handleGenerateSummary}
                                >
                                    <View style={[styles.activityIcon, { backgroundColor: '#22c55e' }]}>
                                        <MaterialIcons name="summarize" size={24} color={colors.white} />
                                    </View>
                                    <View style={styles.activityInfo}>
                                        <Text style={styles.activityName}>Resumo da Aula</Text>
                                        <Text style={styles.activityDesc}>IA resume o conteúdo</Text>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={24} color={colors.zinc500} />
                                </TouchableOpacity>

                                {/* Pergunta - Dúvidas */}
                                <TouchableOpacity
                                    style={styles.activityOption}
                                    onPress={() => handleCreateOpenQuestion('doubts')}
                                >
                                    <View style={[styles.activityIcon, { backgroundColor: '#3b82f6' }]}>
                                        <MaterialIcons name="help-outline" size={24} color={colors.white} />
                                    </View>
                                    <View style={styles.activityInfo}>
                                        <Text style={styles.activityName}>Coletar Dúvidas</Text>
                                        <Text style={styles.activityDesc}>"Qual sua maior dúvida?"</Text>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={24} color={colors.zinc500} />
                                </TouchableOpacity>

                                {/* Pergunta - Feedback */}
                                <TouchableOpacity
                                    style={styles.activityOption}
                                    onPress={() => handleCreateOpenQuestion('feedback')}
                                >
                                    <View style={[styles.activityIcon, { backgroundColor: '#ec4899' }]}>
                                        <MaterialIcons name="rate-review" size={24} color={colors.white} />
                                    </View>
                                    <View style={styles.activityInfo}>
                                        <Text style={styles.activityName}>Feedback da Aula</Text>
                                        <Text style={styles.activityDesc}>"O que poderia melhorar?"</Text>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={24} color={colors.zinc500} />
                                </TouchableOpacity>
                            </>
                        )}

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowActivityModal(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal de Resumo */}
            <Modal
                visible={showSummaryModal}
                transparent
                animationType="slide"
                onRequestClose={handleCloseSummary}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.summaryModalContent}>
                        <Text style={styles.modalTitle}>Resumo Gerado</Text>

                        <ScrollView style={styles.summaryScroll}>
                            <Text style={styles.summaryText}>{generatedSummary}</Text>
                        </ScrollView>

                        <View style={styles.summaryButtons}>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleCloseSummary}
                            >
                                <Text style={styles.secondaryButtonText}>Apenas Visualizar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={handleShareSummary}
                            >
                                <MaterialIcons name="send" size={18} color={colors.white} />
                                <Text style={styles.primaryButtonText}>Enviar para Alunos</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal de Ranking */}
            <Modal
                visible={showRankingModal}
                transparent
                animationType="slide"
                onRequestClose={handleEndActivity}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.rankingModalContent}>
                        <Text style={styles.modalTitle}>📊 Ranking em Tempo Real</Text>

                        <ScrollView style={styles.rankingScroll}>
                            {ranking.length === 0 ? (
                                <View style={styles.waitingContainer}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={styles.waitingText}>Aguardando respostas...</Text>
                                </View>
                            ) : (
                                ranking.map((item, index) => (
                                    <View key={item.student_id} style={styles.rankingItem}>
                                        <Text style={styles.rankingPosition}>#{item.position}</Text>
                                        <View style={styles.rankingInfo}>
                                            <Text style={styles.rankingName}>{item.student_name}</Text>
                                            <Text style={styles.rankingScore}>
                                                {item.score}/{item.total} ({item.percentage.toFixed(0)}%)
                                            </Text>
                                        </View>
                                        <MaterialIcons
                                            name={item.is_correct ? "check-circle" : "cancel"}
                                            size={24}
                                            color={item.is_correct ? "#22c55e" : "#ef4444"}
                                        />
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.endActivityButton}
                            onPress={handleEndActivity}
                        >
                            <Text style={styles.endActivityButtonText}>Encerrar e Voltar à Transcrição</Text>
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
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
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
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
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
    // Ranking Modal
    rankingModalContent: {
        backgroundColor: colors.zinc900,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '70%',
    },
    rankingScroll: {
        maxHeight: 350,
        marginVertical: spacing.md,
    },
    waitingContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    waitingText: {
        marginTop: spacing.md,
        color: colors.zinc400,
        fontSize: typography.fontSize.base,
    },
    rankingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    rankingPosition: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: '#f59e0b',
        width: 40,
    },
    rankingInfo: {
        flex: 1,
    },
    rankingName: {
        fontSize: typography.fontSize.base,
        color: colors.white,
        fontWeight: typography.fontWeight.medium,
    },
    rankingScore: {
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
});
