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
    useWindowDimensions,
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
    TranscriptionSession,
    LiveActivity,
    resumeSession,
    endTranscriptionSession,
    generateQuiz,
    generateSummary,
    createOpenQuestion,
    broadcastActivity,
    updateActivity,
} from '@/services/api';
// import { useAuth } from '@/context/AuthContext'; // Ajuste o caminho se necessário
import { useRouter } from 'expo-router';
import ConfirmationModal from '@/components/modals/ConfirmationModal';
import InputModal from '@/components/modals/InputModal';

/**
 * TranscriptionScreen - Tela de transcrição com sessões persistentes e atividades
 */
// Variável global fora do componente para garantir Singleton real
let globalRecognition: any = null;

export default function TranscriptionScreen() {
    const router = useRouter();
    // ... rest of component
    // const { user } = useAuth(); // Se precisar do user
    const { width } = useWindowDimensions();
    const isMobile = width < 768; // Breakpoint para mobile/tablet
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectId = parseInt(params.subjectId as string) || 1;
    const subjectName = params.subject as string || 'Disciplina';

    // Wrapper condicional para scroll no mobile
    const MainContentWrapper = isMobile ? ScrollView : View;
    const mainContentWrapperProps = isMobile
        ? {
            style: { flex: 1 },
            contentContainerStyle: { padding: 16, paddingBottom: 100, gap: 16 },
            keyboardShouldPersistTaps: 'handled' as 'handled'
        }
        : {
            style: styles.contentContainer
        };

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
    const [showAnswerKey, setShowAnswerKey] = useState(false); // Controla exibição do gabarito
    const [visibleAnswers, setVisibleAnswers] = useState<Set<number>>(new Set()); // Controla quais questões mostram resposta
    const [numQuestions, setNumQuestions] = useState(5); // Quantidade de questões do quiz

    // Estados para edição de questões
    const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
    const [editedQuestionData, setEditedQuestionData] = useState<any>(null);
    const [isRegenerating, setIsRegenerating] = useState<number | null>(null);

    // Estado do conteúdo gerado (exibido no painel esquerdo)
    const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
    const [generatedQuiz, setGeneratedQuiz] = useState<any>(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [displayMode, setDisplayMode] = useState<'none' | 'summary' | 'quiz'>('none');

    // History / Checkpoints
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: 'Confirmar',
        isDestructive: false
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, visible: false }));

    // Input Modal State
    const [inputModal, setInputModal] = useState({
        visible: false,
        title: '',
        message: '',
        placeholder: '',
        initialValue: '',
        onConfirm: (text: string) => { },
    });

    const closeInputModal = () => setInputModal(prev => ({ ...prev, visible: false }));

    // Refs
    const recognitionRef = useRef<any>(null);
    const isRecordingRef = useRef(false);
    const savedTextRef = useRef('');
    const processedResultsRef = useRef<Set<number>>(new Set());
    const lastFinalTextRef = useRef('');
    const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionRef = useRef<TranscriptionSession | null>(null); // Ref para acesso no cleanup

    // Animação
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);

    // Inicializar sessão
    useEffect(() => {
        initSession();
        return () => {
            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
            // Salvar ao sair (cleanup)
            // Salvar ao sair (cleanup)
            if (sessionRef.current && typeof savedTextRef.current === 'string') {
                console.log('Salvando transcrição ao sair...');
                // Usar sendBeacon ou fetch keepalive se fosse web puro, mas aqui é React Native/Expo
                // Garantir que a função de update seja chamada
                updateTranscription(sessionRef.current.id, savedTextRef.current).catch(err => {
                    console.error('Erro ao salvar no cleanup:', err);
                });
            }
        };
    }, []);

    // Atualizar ref da sessão sempre que session mudar
    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    const initSession = async () => {
        try {
            setIsLoading(true);
            const result = await createTranscriptionSession(subjectId, `Aula - ${subjectName}`);
            if (result.success && result.session) {
                console.log('Sessão carregada:', result.session.id, result.session.status);
                console.log('Texto recuperado:', (result.session.full_transcript || '').substring(0, 50) + '...');
                setSession(result.session);
                setTranscribedText(result.session.full_transcript || '');
                savedTextRef.current = result.session.full_transcript || '';

                // Restaurar atividades (Summary/Quiz)
                if (result.session.activities && result.session.activities.length > 0) {
                    // Filtrar apenas atividades não encerradas
                    const activeActivities = result.session.activities.filter((a: any) => a.status !== 'ended');

                    // Ordenar por ID decrescente (mais recente primeiro)
                    activeActivities.sort((a: any, b: any) => b.id - a.id);

                    const latestSummary = activeActivities.find((a: any) => a.activity_type === 'summary');
                    const latestQuiz = activeActivities.find((a: any) => a.activity_type === 'quiz');

                    // Restaurar estados
                    if (latestSummary) {
                        setGeneratedSummary(latestSummary.ai_generated_content || null);
                    }
                    if (latestQuiz) {
                        setGeneratedQuiz(latestQuiz.content || null);
                    }

                    // Definir qual mostrar (o mais recente)
                    const latestActivity = activeActivities[0];
                    if (latestActivity) {
                        setCurrentActivity(latestActivity);
                        if (latestActivity.activity_type === 'summary') {
                            setDisplayMode('summary');
                        } else if (latestActivity.activity_type === 'quiz') {
                            setDisplayMode('quiz');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao iniciar sessão:', error);
            Alert.alert('Erro', 'Não foi possível iniciar a sessão de transcrição.');
        } finally {
            setIsLoading(false);
        }
    };

    // Formatar data relativa
    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `${diffMins} min atrás`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h atrás`;
        return date.toLocaleDateString();
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

            if (Platform.OS === 'web') {
                // Tentar Wake Lock API para manter a tela ligada
                if ('wakeLock' in navigator) {
                    try {
                        // @ts-ignore
                        navigator.wakeLock.request('screen').then(lock => {
                            console.log('Wake Lock ativo');
                        }).catch(e => console.log('Wake Lock falhou', e));
                    } catch (e) { }
                }

                // HACK: Tocar áudio silencioso para evitar throttling do navegador em background
                try {
                    const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAGZGF0YQQAAAAAAA==");
                    silentAudio.loop = true;
                    silentAudio.play().catch(e => console.log('Audio autoplay falhou', e));
                    // @ts-ignore - Guardar referência para parar depois se necessário
                    window._silentAudio = silentAudio;
                } catch (e) {
                    console.log('Silent audio falhou', e);
                }
            }

        } else {
            if (animationRef.current) {
                animationRef.current.stop();
            }
            pulseAnim.setValue(1);

            if (Platform.OS === 'web') {
                // Parar áudio silencioso
                // @ts-ignore
                if (window._silentAudio) {
                    // @ts-ignore
                    window._silentAudio.pause();
                    // @ts-ignore
                    window._silentAudio = null;
                }
            }
        }

        return () => {
            // @ts-ignore
            if (Platform.OS === 'web' && window._silentAudio) {
                // @ts-ignore
                window._silentAudio.pause();
            }

            if (animationRef.current) {
                animationRef.current.stop();
            }
        };
    }, [isRecording]);

    // Animação quando gravando

    // Inicializar speech recognition
    useEffect(() => {
        let mounted = true;

        const cleanup = () => {
            if (globalRecognition) {
                try {
                    console.log('Parando reconhecimento anterior...');
                    globalRecognition.onend = null; // Remover listener para evitar loop
                    globalRecognition.stop();
                    globalRecognition.abort();
                } catch (e) { }
                globalRecognition = null;
            }
        };

        const initRecognition = () => {
            if (Platform.OS === 'web') {
                // @ts-ignore
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (SpeechRecognition) {
                    // Limpar instância anterior se existir
                    cleanup();

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
                        } else if (event.error === 'aborted') {
                            // Ignorar erro de aborto manual
                        }
                    };

                    recognition.onend = () => {
                        if (isRecordingRef.current && mounted) {
                            processedResultsRef.current.clear();
                            setTimeout(() => {
                                try {
                                    if (mounted && isRecordingRef.current) {
                                        recognition.start();
                                    }
                                } catch (e) {
                                    console.log('Não foi possível reiniciar');
                                }
                            }, 100);
                        }
                    };

                    recognitionRef.current = recognition;
                    globalRecognition = recognition;
                }
            }
        };

        // Pequeno delay para garantir que o cleanup anterior terminou
        const timeout = setTimeout(initRecognition, 200);

        return () => {
            mounted = false;
            clearTimeout(timeout);
            isRecordingRef.current = false;
            cleanup();
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

    const handleClearTranscription = () => {
        if (!transcribedText.trim()) return;

        setConfirmModal({
            visible: true,
            title: 'Limpar Transcrição',
            message: 'Tem certeza que deseja apagar todo o texto transcrito? Esta ação não pode ser desfeita, mas ficará salva no histórico de versões se houver checkpoints.',
            confirmText: 'Limpar Tudo',
            isDestructive: true,
            onConfirm: async () => {
                closeConfirmModal();
                setTranscribedText('');
                savedTextRef.current = '';
                if (session) {
                    await updateTranscription(session.id, '');
                }
            }
        });
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
        console.log('[QUIZ] Número de questões:', numQuestions);

        // Calcular tempo: 1 minuto (60 segundos) por questão
        const timeLimit = numQuestions * 60;
        console.log('[QUIZ] Tempo limite:', timeLimit, 'segundos (', numQuestions, 'minutos)');

        setIsGenerating(true);
        setDisplayMode('quiz');
        setGeneratedQuiz(null); // Limpar quiz anterior
        try {
            // Forçar salvamento antes de gerar
            console.log('[QUIZ] Salvando transcrição no backend...');
            await updateTranscription(session.id, transcribedText);
            console.log('[QUIZ] Transcrição salva.');

            console.log('[QUIZ] Chamando API generateQuiz...');
            const result = await generateQuiz(session.id, numQuestions, timeLimit);
            console.log('[QUIZ] Resposta da API:', JSON.stringify(result, null, 2));

            if (result.success && result.activity) {
                console.log('[QUIZ] Quiz gerado com sucesso! ID:', result.activity.id);
                console.log('[QUIZ] Perguntas:', result.activity.content?.questions?.length || 0);
                console.log('[QUIZ] Tempo limite:', result.activity.time_limit, 'segundos');
                setCurrentActivity(result.activity);
                // Backend agora retorna o conteúdo estruturado em 'content'
                const quizContent = result.activity.content || result.activity.ai_generated_content || '';
                setGeneratedQuiz(quizContent);
                console.log('Quiz gerado:', quizContent);
            } else {
                console.log('[QUIZ] Erro da API:', result.error);
                Alert.alert('Erro', result.error || 'Não foi possível gerar o quiz.');
                setDisplayMode('none');
            }
        } catch (error) {
            console.error('[QUIZ] Exceção ao gerar quiz:', error);
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

    // Excluir questão do quiz
    const handleDeleteQuestion = async (questionIndex: number) => {
        if (!currentActivity || !generatedQuiz) return;

        try {
            // Parsear conteúdo atual
            const content = typeof generatedQuiz === 'string'
                ? JSON.parse(generatedQuiz)
                : generatedQuiz;

            const questions = content.questions || [];

            // Validar: não pode excluir se só tiver 1 questão
            if (questions.length <= 1) {
                if (Platform.OS === 'web') {
                    window.alert('Não é possível excluir. Mantenha pelo menos 1 questão no quiz.');
                } else {
                    Alert.alert(
                        'Não é possível excluir',
                        'Mantenha pelo menos 1 questão no quiz.'
                    );
                }
                return;
            }

            // Remover questão do array (sem confirmação)

            const updatedQuestions = questions.filter((_: any, i: number) => i !== questionIndex);
            const updatedContent = { ...content, questions: updatedQuestions };

            // Recalcular tempo: 1 minuto por questão
            const newTimeLimit = updatedQuestions.length * 60;

            console.log('[DELETE QUESTION] Removendo questão', questionIndex);
            console.log('[DELETE QUESTION] Questões restantes:', updatedQuestions.length);
            console.log('[DELETE QUESTION] Novo tempo limite:', newTimeLimit, 'segundos');

            // Atualizar no backend
            // Atualizar no backend
            const result = await updateActivity(currentActivity.id, {
                content: updatedContent,
                time_limit: newTimeLimit
            });

            if (result.success && result.activity) {
                // Atualizar estados locais
                setGeneratedQuiz(updatedContent);
                setCurrentActivity(result.activity);

                // Limpar respostas visíveis que foram afetadas
                const newVisibleAnswers = new Set<number>();
                visibleAnswers.forEach(idx => {
                    if (idx < questionIndex) {
                        newVisibleAnswers.add(idx);
                    } else if (idx > questionIndex) {
                        newVisibleAnswers.add(idx - 1);
                    }
                });
                setVisibleAnswers(newVisibleAnswers);

                console.log('[DELETE QUESTION] Questão excluída com sucesso');
            } else {
                if (Platform.OS === 'web') {
                    window.alert('Erro: ' + (result.error || 'Não foi possível excluir a questão.'));
                } else {
                    Alert.alert('Erro', result.error || 'Não foi possível excluir a questão.');
                }
            }
        } catch (error) {
            console.error('[DELETE QUESTION] Erro ao excluir questão:', error);
            if (Platform.OS === 'web') {
                window.alert('Erro ao excluir questão.');
            } else {
                Alert.alert('Erro', 'Erro ao excluir questão.');
            }
        }
    };

    // Editar questão
    const handleEditQuestion = (questionIndex: number) => {
        if (!generatedQuiz) return;

        try {
            const content = typeof generatedQuiz === 'string'
                ? JSON.parse(generatedQuiz)
                : generatedQuiz;

            const question = content.questions[questionIndex];

            setEditedQuestionData({
                question: question.question || '',
                options: question.options || ['', '', '', ''],
                correct: question.correct || 0
            });
            setEditingQuestion(questionIndex);
        } catch (error) {
            console.error('[EDIT QUESTION] Erro ao carregar questão:', error);
        }
    };

    // Salvar questão editada
    const handleSaveEditedQuestion = async () => {
        if (editingQuestion === null || !editedQuestionData || !currentActivity || !generatedQuiz) return;

        try {
            // Validações
            if (!editedQuestionData.question.trim()) {
                if (Platform.OS === 'web') {
                    window.alert('A pergunta não pode estar vazia.');
                } else {
                    Alert.alert('Erro', 'A pergunta não pode estar vazia.');
                }
                return;
            }

            const hasEmptyOption = editedQuestionData.options.some((opt: string) => !opt.trim());
            if (hasEmptyOption) {
                if (Platform.OS === 'web') {
                    window.alert('Todas as opções devem ser preenchidas.');
                } else {
                    Alert.alert('Erro', 'Todas as opções devem ser preenchidas.');
                }
                return;
            }

            // Atualizar questão no array
            const content = typeof generatedQuiz === 'string'
                ? JSON.parse(generatedQuiz)
                : generatedQuiz;

            const updatedQuestions = [...content.questions];
            updatedQuestions[editingQuestion] = editedQuestionData;

            const updatedContent = { ...content, questions: updatedQuestions };

            console.log('[EDIT QUESTION] Salvando questão editada:', editingQuestion);

            // Atualizar no backend
            const result = await updateActivity(currentActivity.id, {
                content: updatedContent,
                time_limit: currentActivity.time_limit
            });

            if (result.success && result.activity) {
                setGeneratedQuiz(updatedContent);
                setCurrentActivity(result.activity);
                setEditingQuestion(null);
                setEditedQuestionData(null);
                console.log('[EDIT QUESTION] Questão salva com sucesso');
            } else {
                if (Platform.OS === 'web') {
                    window.alert('Erro: ' + (result.error || 'Não foi possível salvar a questão.'));
                } else {
                    Alert.alert('Erro', result.error || 'Não foi possível salvar a questão.');
                }
            }
        } catch (error) {
            console.error('[EDIT QUESTION] Erro ao salvar questão:', error);
            if (Platform.OS === 'web') {
                window.alert('Erro ao salvar questão.');
            } else {
                Alert.alert('Erro', 'Erro ao salvar questão.');
            }
        }
    };

    // Regenerar questão com IA
    const handleRegenerateQuestion = async (questionIndex: number) => {
        if (!session || !generatedQuiz || !currentActivity) return;

        try {
            setIsRegenerating(questionIndex);

            const content = typeof generatedQuiz === 'string'
                ? JSON.parse(generatedQuiz)
                : generatedQuiz;

            const currentQuestion = content.questions[questionIndex];

            console.log('[REGENERATE] Regenerando questão:', questionIndex);

            // Chamar IA para gerar nova questão
            const result = await generateQuiz(session.id, 1);

            if (result.success && result.activity) {
                const newQuizContent = typeof result.activity.content === 'string'
                    ? JSON.parse(result.activity.content)
                    : result.activity.content;

                if (newQuizContent.questions && newQuizContent.questions.length > 0) {
                    // Substituir questão antiga pela nova
                    const updatedQuestions = [...content.questions];
                    updatedQuestions[questionIndex] = newQuizContent.questions[0];

                    const updatedContent = { ...content, questions: updatedQuestions };

                    // Atualizar no backend
                    // Atualizar no backend
                    const updateResult = await updateActivity(currentActivity.id, {
                        content: updatedContent,
                        time_limit: currentActivity.time_limit
                    });

                    if (updateResult.success && updateResult.activity) {
                        setGeneratedQuiz(updatedContent);
                        setCurrentActivity(updateResult.activity);
                        console.log('[REGENERATE] Questão regenerada com sucesso');
                    }
                } else {
                    throw new Error('Nenhuma questão gerada');
                }
            } else {
                throw new Error(result.error || 'Erro ao regenerar questão');
            }
        } catch (error) {
            console.error('[REGENERATE] Erro ao regenerar questão:', error);
            if (Platform.OS === 'web') {
                window.alert('Erro ao regenerar questão. Tente novamente.');
            } else {
                Alert.alert('Erro', 'Erro ao regenerar questão. Tente novamente.');
            }
        } finally {
            setIsRegenerating(null);
        }
    };

    // Estados para edição de resumo
    const [isEditingSummary, setIsEditingSummary] = useState(false);
    const [editedSummaryText, setEditedSummaryText] = useState('');

    useEffect(() => {
        if (generatedSummary) {
            setEditedSummaryText(generatedSummary);
        }
    }, [generatedSummary]);

    const handleSaveSummaryEdit = async () => {
        if (!currentActivity || !editedSummaryText.trim()) return;

        try {
            console.log('[EDIT SUMMARY] Salvando resumo editado...');
            const result = await updateActivity(currentActivity.id, {
                ai_generated_content: editedSummaryText,
                content: { summary_text: editedSummaryText }
            });

            if (result.success && result.activity) {
                setGeneratedSummary(editedSummaryText);
                setCurrentActivity(result.activity);
                setIsEditingSummary(false);
                // Also update the ai_generated_content in currentActivity if implicit logic relies on it
                result.activity.ai_generated_content = editedSummaryText;
                console.log('[EDIT SUMMARY] Resumo salvo com sucesso');
            } else {
                Alert.alert('Erro', result.error || 'Não foi possível salvar o resumo.');
            }
        } catch (error) {
            console.error('[EDIT SUMMARY] Erro ao salvar:', error);
            Alert.alert('Erro', 'Erro ao salvar resumo.');
        }
    };


    const handleDeleteSummary = () => {
        setConfirmModal({
            visible: true,
            title: 'Excluir Resumo',
            message: 'Tem certeza que deseja excluir o resumo gerado? Esta ação não pode ser desfeita.',
            confirmText: 'Excluir',
            isDestructive: true,
            onConfirm: async () => {
                closeConfirmModal();
                if (currentActivity) {
                    try {
                        setGeneratedSummary(null);
                        setIsEditingSummary(false);
                        await updateActivity(currentActivity.id, {
                            ai_generated_content: '',
                            content: { summary_text: '' },
                            status: 'ended'
                        });
                        setCurrentActivity(null);
                    } catch (e) {
                        console.error('Erro', e);
                    }
                }
            }
        });
    };





    const handleDeleteQuiz = () => {
        setConfirmModal({
            visible: true,
            title: 'Excluir Quiz',
            message: 'Tem certeza que deseja excluir o quiz gerado?',
            confirmText: 'Excluir',
            isDestructive: true,
            onConfirm: async () => {
                closeConfirmModal();
                if (currentActivity) {
                    try {
                        setGeneratedQuiz(null);
                        await updateActivity(currentActivity.id, {
                            ai_generated_content: '',
                            content: null,
                            status: 'ended'
                        });
                        setCurrentActivity(null);
                    } catch (e) {
                        console.error('Erro ao excluir quiz:', e);
                    }
                }
            }
        });
    };

    // Restaurar Checkpoint
    const handleRestoreCheckpoint = (checkpoint: any) => {
        setConfirmModal({
            visible: true,
            title: 'Restaurar Versão',
            message: 'Deseja restaurar esta versão da transcrição? O texto atual será substituído.',
            confirmText: 'Restaurar',
            isDestructive: true,
            onConfirm: async () => {
                closeConfirmModal();
                // Restaurar texto localmente
                setTranscribedText(checkpoint.transcript_at_checkpoint);
                savedTextRef.current = checkpoint.transcript_at_checkpoint;

                // Atualizar no backend para persistir a restauração
                try {
                    await updateTranscription(session!.id, checkpoint.transcript_at_checkpoint);
                    console.log('Versão restaurada com sucesso');
                } catch (e) {
                    console.error('Erro ao salvar versão restaurada:', e);
                }

                setShowHistoryModal(false);
            }
        });
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
        // Solicitar título antes de iniciar
        setInputModal({
            visible: true,
            title: 'Título do Quiz',
            message: 'Defina um título para este quiz para que os alunos possam identificá-lo.',
            placeholder: 'Ex: Quiz sobre Equações',
            initialValue: currentActivity?.title || '',
            onConfirm: async (text) => {
                closeInputModal();
                performStartActivity(activityId, text);
            }
        });
    };

    const performStartActivity = async (activityId: number, title: string) => {
        console.log('[BROADCAST] Iniciando atividade para alunos...');
        console.log('[BROADCAST] Activity ID:', activityId);
        try {
            const result = await broadcastActivity(activityId, title);
            console.log('[BROADCAST] Resposta da API:', JSON.stringify(result, null, 2));

            if (result.success) {
                console.log('[BROADCAST] Atividade iniciada com sucesso!');
                console.log('[BROADCAST] Alunos matriculados:', result.enrolled_students);
                setCurrentActivity(result.activity);
                Alert.alert('Atividade Iniciada!', `Enviada para ${result.enrolled_students || 0} alunos.`);

                // Se for quiz, redirecionar para tela de resultados
                if (result.activity?.activity_type === 'quiz') {
                    console.log('[BROADCAST] Tipo é quiz, redirecionando para quiz-results...');
                    router.push({
                        pathname: '/(teacher)/quiz-results',
                        params: {
                            subjectId: subjectId,
                            activityId: activityId,
                            subject: subjectName
                        }
                    });
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

    // Compartilhar resumo
    const handleShareSummary = async () => {
        if (!currentActivity) return;

        setInputModal({
            visible: true,
            title: 'Título do Resumo',
            message: 'Defina um título para este resumo.',
            placeholder: 'Ex: Resumo da Aula 1',
            initialValue: currentActivity?.title || '',
            onConfirm: async (text) => {
                closeInputModal();
                performShareSummary(text);
            }
        });
    };

    const performShareSummary = async (title: string) => {
        try {
            await shareSummary(currentActivity!.id, title);
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
            <LinearGradient
                colors={['#4f46e5', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
            >
                <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}>
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Transcrever Aula</Text>
                    <Text style={styles.headerSubtitle}>{subjectName}</Text>
                </View>
                <View style={styles.saveIndicator}>
                    {isSaving ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : lastSaved ? (
                        <MaterialIcons name="cloud-done" size={20} color="#bef264" />
                    ) : (
                        <MaterialIcons name="cloud-off" size={20} color="rgba(255,255,255,0.7)" />
                    )}
                </View>
            </LinearGradient>

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
            <MainContentWrapper {...mainContentWrapperProps}>
                {/* Painel Esquerdo - Conteúdo Gerado */}
                {/* No mobile, se não tiver conteúdo gerado (modo 'none'), pode esconder esse painel ou deixá-lo menor */}
                {(displayMode !== 'none' || !isMobile) && (
                    <View style={[styles.leftPanel, isMobile && { width: '100%', flex: 0, minHeight: 300 }]}>
                        <View style={styles.panelHeader}>
                            <MaterialIcons
                                name={displayMode === 'quiz' ? 'quiz' : 'summarize'}
                                size={20}
                                color={displayMode === 'quiz' ? colors.primary : colors.secondary}
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
                                    <ActivityIndicator size="large" color={displayMode === 'quiz' ? colors.primary : colors.secondary} />
                                    <Text style={styles.loadingText}>Gerando com IA...</Text>
                                </View>
                            ) : displayMode === 'summary' && generatedSummary ? (
                                <View style={styles.summaryContent}>
                                    {isEditingSummary ? (
                                        <View>
                                            <TextInput
                                                style={styles.editSummaryInput}
                                                multiline
                                                value={editedSummaryText}
                                                onChangeText={setEditedSummaryText}
                                                textAlignVertical="top"
                                            />
                                            <View style={styles.editActions}>
                                                <TouchableOpacity
                                                    style={[styles.editButton, styles.editCancelButton]}
                                                    onPress={() => {
                                                        setIsEditingSummary(false);
                                                        setEditedSummaryText(generatedSummary || '');
                                                    }}
                                                >
                                                    <Text style={styles.editCancelButtonText}>Cancelar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.editButton, styles.editSaveButton]}
                                                    onPress={handleSaveSummaryEdit}
                                                >
                                                    <Text style={styles.editSaveButtonText}>Salvar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            <Text style={styles.generatedText}>{generatedSummary}</Text>
                                            <TouchableOpacity
                                                style={styles.editModeButton}
                                                onPress={() => setIsEditingSummary(true)}
                                            >
                                                <MaterialIcons name="edit" size={16} color={colors.secondary} />
                                                <Text style={styles.editModeButtonText}>Editar Resumo</Text>
                                            </TouchableOpacity>

                                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                                                <TouchableOpacity
                                                    style={[styles.deleteButton, { width: 48, height: 48, paddingHorizontal: 0, paddingVertical: 0 }]}
                                                    onPress={handleDeleteSummary}
                                                >
                                                    <MaterialIcons name="delete" size={24} color="#ef4444" />
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.sendSummaryButton, { flex: 1, marginTop: 0 }]}
                                                    onPress={handleShareSummary}
                                                >
                                                    <LinearGradient
                                                        colors={['#22c55e', '#16a34a']}
                                                        style={styles.sendSummaryButtonGradient}
                                                    >
                                                        <MaterialIcons name="send" size={20} color={colors.white} />
                                                        <Text style={styles.sendSummaryButtonText}>Enviar para Alunos</Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            </View>
                                        </>
                                    )}
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
                                                return (
                                                    <View style={styles.emptyState}>
                                                        <MaterialIcons name="error-outline" size={48} color={colors.slate400} />
                                                        <Text style={styles.emptyStateText}>
                                                            Não foi possível gerar questões. O texto pode ser muito curto ou não conter informações suficientes.
                                                        </Text>
                                                        <Text style={[styles.emptyStateText, { marginTop: 8, fontSize: 12 }]}>
                                                            Tente ditar mais conteúdo ou falar sobre tópicos específicos.
                                                        </Text>
                                                    </View>
                                                );
                                            }

                                            return (
                                                <View>
                                                    {/* Contador de questões */}
                                                    <View style={styles.questionCountBadge}>
                                                        <MaterialIcons name="quiz" size={16} color={colors.primary} />
                                                        <Text style={styles.questionCountText}>
                                                            {questions.length} {questions.length === 1 ? 'questão' : 'questões'}
                                                        </Text>
                                                    </View>

                                                    {questions.map((q: any, i: number) => (
                                                        <View key={i} style={styles.previewQuestionCard}>
                                                            <View style={styles.questionHeader}>
                                                                <Text style={styles.previewQuestionTitle}>
                                                                    {i + 1}. {q.question}
                                                                </Text>
                                                                {/* Botão de visibilidade no header */}
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
                                                                        color={visibleAnswers.has(i) ? colors.secondary : colors.slate400}
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

                                                            {/* Botões de ação */}
                                                            <View style={styles.questionActions}>
                                                                {/* Botão Editar */}
                                                                <TouchableOpacity
                                                                    style={styles.actionButton}
                                                                    onPress={() => handleEditQuestion(i)}
                                                                >
                                                                    <MaterialIcons
                                                                        name="edit"
                                                                        size={18}
                                                                        color={colors.primary}
                                                                    />
                                                                    <Text style={styles.actionButtonText}>Editar</Text>
                                                                </TouchableOpacity>

                                                                {/* Botão Regenerar */}
                                                                <TouchableOpacity
                                                                    style={styles.actionButton}
                                                                    onPress={() => handleRegenerateQuestion(i)}
                                                                    disabled={isRegenerating === i}
                                                                >
                                                                    {isRegenerating === i ? (
                                                                        <ActivityIndicator size="small" color={colors.secondary} />
                                                                    ) : (
                                                                        <>
                                                                            <MaterialIcons
                                                                                name="refresh"
                                                                                size={18}
                                                                                color={colors.secondary}
                                                                            />
                                                                            <Text style={[styles.actionButtonText, { color: colors.secondary }]}>
                                                                                Regenerar
                                                                            </Text>
                                                                        </>
                                                                    )}
                                                                </TouchableOpacity>

                                                                {/* Botão Excluir */}
                                                                <TouchableOpacity
                                                                    style={styles.actionButton}
                                                                    onPress={() => handleDeleteQuestion(i)}
                                                                >
                                                                    <MaterialIcons
                                                                        name="delete"
                                                                        size={18}
                                                                        color="#ef4444"
                                                                    />
                                                                    <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>
                                                                        Excluir
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            </View>
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
                                            return <Text style={styles.generatedText}>{typeof generatedQuiz === 'object' ? JSON.stringify(generatedQuiz, null, 2) : String(generatedQuiz)}</Text>;
                                        }
                                    })()}

                                    {currentActivity && (
                                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                                            <TouchableOpacity
                                                style={[styles.deleteButton, { width: 48, height: 48, paddingHorizontal: 0, paddingVertical: 0 }]}
                                                onPress={handleDeleteQuiz}
                                            >
                                                <MaterialIcons name="delete" size={24} color="#ef4444" />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.sendButton, { flex: 1, marginTop: 0 }]}
                                                onPress={() => startActivity(currentActivity.id)}
                                            >
                                                <MaterialIcons name="send" size={18} color={colors.white} />
                                                <Text style={styles.sendButtonText}>Enviar Quiz para Alunos</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.emptyState}>
                                    <MaterialIcons name="auto-awesome" size={48} color={colors.slate400} />
                                    <Text style={styles.emptyStateText}>
                                        Clique em "Resumo" ou "Quiz" para gerar conteúdo com IA
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                )}

                {/* Painel Direito - Transcrição */}
                <View style={[styles.rightPanel, isMobile && { width: '100%', flex: 1, minHeight: 400 }]}>
                    <View style={styles.panelHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <MaterialIcons name="mic" size={20} color={colors.primary} />
                            <Text style={styles.panelTitle}>Transcrição</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Text style={styles.wordCount}>{wordCount} palavras</Text>
                            {transcribedText.length > 0 && (
                                <TouchableOpacity onPress={handleClearTranscription}>
                                    <MaterialIcons name="delete-outline" size={20} color={colors.slate400} />
                                </TouchableOpacity>
                            )}
                        </View>
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
                            placeholderTextColor={colors.slate400}
                            editable={!isRecording}
                        />
                    </ScrollView>

                    <View style={styles.transcriptionInfo}>
                        <Text style={styles.infoText}>
                            {isRecording ? '🎤 Ditando...' : '📝 Pronto para editar'}
                        </Text>
                    </View>
                </View>
            </MainContentWrapper>

            {/* Modal de Histórico */}
            <Modal
                visible={showHistoryModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowHistoryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.editModalHeader}>
                            <Text style={styles.modalTitle}>Histórico de Versões</Text>
                            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.rankingScroll}>
                            {session?.checkpoints && session.checkpoints.length > 0 ? (
                                session.checkpoints
                                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                    .map((checkpoint: any, index: number) => (
                                        <TouchableOpacity
                                            key={checkpoint.id}
                                            style={styles.rankingItem}
                                            onPress={() => handleRestoreCheckpoint(checkpoint)}
                                        >
                                            <View style={styles.rankingPosition}>
                                                <MaterialIcons name="restore" size={24} color={colors.primary} />
                                            </View>
                                            <View style={styles.rankingInfo}>
                                                <Text style={styles.rankingName}>
                                                    Versão {session.checkpoints!.length - index}
                                                </Text>
                                                <Text style={styles.rankingScoreOld}>
                                                    {formatTimeAgo(checkpoint.created_at)} • {checkpoint.word_count} palavras
                                                </Text>
                                                <Text style={styles.statusWaiting}>
                                                    Gerado por: {checkpoint.reason === 'quiz' ? 'Quiz' : checkpoint.reason === 'summary' ? 'Resumo' : 'Manual'}
                                                </Text>
                                            </View>
                                            <MaterialIcons name="chevron-right" size={24} color={colors.slate300} />
                                        </TouchableOpacity>
                                    ))
                            ) : (
                                <View style={styles.emptyStateRanking}>
                                    <MaterialIcons name="history" size={48} color={colors.slate300} />
                                    <Text style={styles.emptyText}>Nenhuma versão anterior salva.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal de Edição de Questão */}
            <Modal
                visible={editingQuestion !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setEditingQuestion(null)}
            >
                <View style={styles.editModalOverlay}>
                    <View style={styles.editModal}>
                        <View style={styles.editModalHeader}>
                            <Text style={styles.editModalTitle}>Editar Questão</Text>
                            <TouchableOpacity onPress={() => setEditingQuestion(null)}>
                                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.editModalContent}>
                            {/* Pergunta */}
                            <Text style={styles.editLabel}>Pergunta:</Text>
                            <TextInput
                                style={styles.editInput}
                                value={editedQuestionData?.question || ''}
                                onChangeText={(text) => setEditedQuestionData({
                                    ...editedQuestionData,
                                    question: text
                                })}
                                multiline
                                placeholder="Digite a pergunta..."
                                placeholderTextColor={colors.slate400}
                            />

                            {/* Opções */}
                            {['A', 'B', 'C', 'D'].map((letter, idx) => (
                                <View key={idx}>
                                    <Text style={styles.editLabel}>Opção {letter}:</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={editedQuestionData?.options?.[idx] || ''}
                                        onChangeText={(text) => {
                                            const newOptions = [...(editedQuestionData?.options || ['', '', '', ''])];
                                            newOptions[idx] = text;
                                            setEditedQuestionData({
                                                ...editedQuestionData,
                                                options: newOptions
                                            });
                                        }}
                                        placeholder={`Digite a opção ${letter}...`}
                                        placeholderTextColor={colors.slate400}
                                    />
                                </View>
                            ))}

                            {/* Resposta Correta */}
                            <Text style={styles.editLabel}>Resposta Correta:</Text>
                            <View style={styles.correctAnswerOptions}>
                                {['A', 'B', 'C', 'D'].map((letter, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[
                                            styles.correctAnswerOption,
                                            editedQuestionData?.correct === idx && styles.correctAnswerOptionSelected
                                        ]}
                                        onPress={() => setEditedQuestionData({
                                            ...editedQuestionData,
                                            correct: idx
                                        })}
                                    >
                                        <Text style={[
                                            styles.correctAnswerOptionText,
                                            editedQuestionData?.correct === idx && styles.correctAnswerOptionTextSelected
                                        ]}>
                                            {letter}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={styles.editModalFooter}>
                            <TouchableOpacity
                                style={styles.editCancelButton}
                                onPress={() => setEditingQuestion(null)}
                            >
                                <Text style={styles.editCancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.editSaveButton}
                                onPress={handleSaveEditedQuestion}
                            >
                                <MaterialIcons name="check" size={20} color={colors.white} />
                                <Text style={styles.editSaveButtonText}>Salvar Questão</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Input Modal */}
            <InputModal
                visible={inputModal.visible}
                title={inputModal.title}
                message={inputModal.message}
                placeholder={inputModal.placeholder}
                initialValue={inputModal.initialValue}
                onConfirm={inputModal.onConfirm}
                onCancel={closeInputModal}
            />

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                {/* Seletor de Quantidade de Questões */}
                <View style={styles.questionCountSelector}>
                    <Text style={styles.questionCountLabel}>Questões:</Text>
                    <View style={styles.questionCountOptions}>
                        {[3, 5, 10, 15, 20].map((count) => (
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
                    {/* Botão de Histórico */}
                    <TouchableOpacity
                        style={styles.historyButton}
                        onPress={() => {
                            console.log('Abrindo histórico. Checkpoints:', session?.checkpoints?.length);
                            setShowHistoryModal(true);
                        }}
                    >
                        <LinearGradient
                            colors={['#64748b', '#475569']}
                            style={styles.historyButtonGradient}
                        >
                            <MaterialIcons name="history" size={24} color={colors.white} />
                            <Text style={styles.buttonLabel}>Histórico</Text>
                        </LinearGradient>
                    </TouchableOpacity>
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

            <ConfirmationModal
                visible={confirmModal.visible}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDestructive={confirmModal.isDestructive}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textSecondary,
        fontSize: typography.fontSize.base,
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
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
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
        color: 'rgba(255,255,255,0.8)',
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
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        minHeight: 300,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
    },
    textInput: {
        flex: 1,
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
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
        color: colors.textSecondary,
    },
    infoText: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
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
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
    },
    rightPanel: {
        flex: 1,
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.slate50,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    panelTitle: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
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
        borderTopColor: colors.slate100,
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
        color: colors.textSecondary,
        textAlign: 'center',
        maxWidth: 250,
    },
    summaryContent: {
        gap: spacing.lg,
    },
    generatedText: {
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        lineHeight: 24,
    },
    quizContent: {
        gap: spacing.lg,
    },
    quizQuestion: {
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    questionNumber: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    questionText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    questionOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        backgroundColor: colors.white,
        borderRadius: borderRadius.default,
        marginTop: spacing.xs,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    correctOption: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 1,
        borderColor: '#22c55e',
    },
    optionLetter: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.textSecondary,
        width: 20,
    },
    optionText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.lg,
        marginTop: spacing.md,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
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
        borderTopColor: colors.slate200,
        alignItems: 'center',
        backgroundColor: colors.backgroundLight,
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
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
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
        shadowColor: colors.secondary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
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
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    historyButton: {
        zIndex: 100,
        elevation: 10,
    },
    historyButtonGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        shadowColor: colors.slate400,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
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
        color: colors.textSecondary,
    },
    questionCountOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    questionCountOption: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
        minWidth: 40,
        alignItems: 'center',
    },
    questionCountOptionActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    questionCountOptionText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textSecondary,
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
        color: colors.textSecondary,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalOverlayFullScreen: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIconButton: {
        padding: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: borderRadius.full,
    },
    gamificationContent: {
        padding: spacing.lg,
        maxHeight: '75%',
    },
    modalContent: {
        backgroundColor: colors.white,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        paddingBottom: spacing.xl,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    modalTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    modalSubtitle: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    generatingContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    generatingText: {
        marginTop: spacing.md,
        color: colors.textSecondary,
        fontSize: typography.fontSize.base,
    },
    activityOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    activityIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.slate50,
    },
    activityInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    activityName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
    },
    activityDesc: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
    },
    cancelButton: {
        marginTop: spacing.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
    },
    // Summary Modal
    summaryModalContent: {
        backgroundColor: colors.white,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '80%',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    summaryScroll: {
        maxHeight: 300,
        marginVertical: spacing.md,
    },
    summaryText: {
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
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
        borderColor: colors.slate200,
        alignItems: 'center',
        backgroundColor: colors.white,
    },
    secondaryButtonText: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
    },
    primaryButton: {
        flex: 1,
        flexDirection: 'row',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    // Ranking Modal - Premium Light Theme with Primary Accents
    rankingModalContent: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        width: '95%',
        height: '90%',
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    rankingScroll: {
        maxHeight: 400,
        marginVertical: spacing.md,
    },
    waitingContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
        borderRadius: borderRadius.lg,
        marginTop: spacing.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.primary,
    },
    waitingText: {
        marginTop: spacing.md,
        color: colors.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
    },
    rankingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
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
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.medium,
    },
    rankingScoreOld: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
    },
    endActivityButton: {
        backgroundColor: colors.danger,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'center',
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    endActivityButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
    // Leaderboard Styles - Premium Design
    leaderboardContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
        height: 450,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    leaderboardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    leaderboardStats: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    // Novo Modal de Ranking - Estilos Simples
    rankingHeader: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.slate50,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    statNumber: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.primary,
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
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
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    studentRowWaiting: {
        opacity: 0.6,
        borderStyle: 'dashed',
        backgroundColor: colors.slate50,
    },
    positionBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    positionText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
    },
    studentNameWaiting: {
        color: colors.textSecondary,
    },
    studentScore: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    resultBadge: {
        backgroundColor: colors.secondary,
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
        color: colors.textSecondary,
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
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    closeButton: {
        backgroundColor: colors.danger,
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
        backgroundColor: colors.primary,
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
        color: colors.textPrimary,
    },
    leaderboardScroll: {
        flex: 1,
    },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    rank1: { backgroundColor: '#fffbeb', borderColor: '#fcd34d' },
    rank2: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
    rank3: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
    rankWaiting: { opacity: 0.6, borderStyle: 'dashed', backgroundColor: colors.slate50 },

    // rankText definitions
    rankText: {
        fontSize: typography.fontSize.base,
        fontWeight: 'bold',
        color: colors.textSecondary,
    },
    rankTextTop: {
        fontSize: typography.fontSize.lg,
        color: colors.textPrimary,
    },

    rankingPosition: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        borderRadius: 22,
    },
    rankingInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    rankingName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
    },
    rankingNameWaiting: {
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    statusWaiting: {
        fontSize: 11,
        color: colors.textSecondary,
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
        color: colors.white,
    },
    rankPercentage: {
        fontSize: 10,
        color: colors.textSecondary,
    },
    previewQuestionCard: {
        backgroundColor: colors.slate50,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        position: 'relative',  // Para posicionar o botão de exclusão
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    previewQuestionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    previewOption: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
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
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    toggleAnswerKeyText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    // Question counter badge
    questionCountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.default,
        marginBottom: spacing.md,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    questionCountText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: colors.primary,
    },
    // Question actions row (delete + visibility buttons)
    questionActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    deleteQuestionButton: {
        padding: spacing.xs,
        borderRadius: borderRadius.default,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    deleteQuestionButtonBottomRight: {
        position: 'absolute',
        bottom: spacing.sm,
        right: spacing.sm,
        padding: spacing.sm,
        borderRadius: borderRadius.default,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    individualAnswerButton: {
        padding: spacing.xs,
        borderRadius: borderRadius.default,
    },
    questionActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    actionButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        color: colors.primary,
    },
    // Modal de Edição
    editModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.base,
    },
    editModal: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        width: '100%',
        maxWidth: 600,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    editModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    editModalTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    editModalContent: {
        padding: spacing.lg,
        maxHeight: 500,
    },
    editLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
        marginTop: spacing.sm,
    },
    editInput: {
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        backgroundColor: colors.white,
        minHeight: 44,
    },
    correctAnswerOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    correctAnswerOption: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.slate200,
        alignItems: 'center',
        backgroundColor: colors.white,
    },
    correctAnswerOptionSelected: {
        borderColor: colors.secondary,
        backgroundColor: colors.secondary + '10',
    },
    correctAnswerOptionText: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    correctAnswerOptionTextSelected: {
        color: colors.secondary,
    },
    editModalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
    },
    editCancelButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate300,
    },
    editCancelButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    editSaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.secondary,
    },
    editSaveButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
        color: colors.white,
    },

    listContainer: {
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    waitingSubtext: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        marginTop: 4,
    },
    leaderboardRowWaiting: {
        opacity: 0.5,
        borderStyle: 'dashed',
        backgroundColor: colors.slate50,
    },
    rankPointsList: {
        fontSize: typography.fontSize.sm,
        fontWeight: 'bold',
        color: '#d97706',
        marginRight: 8,
    },
    sendSummaryButton: {
        marginTop: spacing.lg,
        borderRadius: borderRadius.default,
        overflow: 'hidden',
    },
    sendSummaryButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    sendSummaryButtonText: {
        color: colors.white,
        fontWeight: 'bold',
        fontSize: typography.fontSize.base,
    },
    editSummaryInput: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate300,
        borderRadius: borderRadius.default,
        padding: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        minHeight: 150,
        marginBottom: spacing.md,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
    },
    editButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.default,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.default,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: '#ef4444',
        zIndex: 100,
    },

    editModeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        padding: spacing.sm,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.secondary,
        borderRadius: borderRadius.default,
        alignSelf: 'flex-end',
    },
    editModeButtonText: {
        color: colors.secondary,
        fontWeight: 'bold',
        fontSize: typography.fontSize.sm,
    },

});
