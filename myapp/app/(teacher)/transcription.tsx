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
    saveGeneratedActivity,
    getPublicSettings
} from '@/services/api';
import { processText } from '@/services/n8n';
import {
    startPresentation,
    sendToPresentation,
    endPresentation,
    getActivePresentation,
    controlPresentationVideo
} from '@/services/presentation';
import PresentationControls from '@/components/presentation/PresentationControls';
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

    // Fred Command Overlay Component
    const FredCommandOverlay = () => {
        if (!fredCommand) return null;

        return (
            <Animated.View style={styles.fredOverlay}>
                <LinearGradient
                    colors={['#6366f1', '#a855f7']} // Indigo to Purple gradient
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.fredGradient}
                >
                    <View style={styles.fredContent}>
                        <View style={styles.fredIconContainer}>
                            <MaterialIcons name="smart-toy" size={28} color="#FFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.fredLabel}>Assistente Fred</Text>
                            <Text style={styles.fredText}>
                                {fredCommand === 'Ouvindo...' ? 'Ouvindo...' : fredCommand}
                            </Text>
                        </View>
                        {fredCommand === 'Ouvindo...' && (
                            <ActivityIndicator size="small" color="#FFF" />
                        )}
                    </View>
                </LinearGradient>
            </Animated.View>
        );
    };

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
    const [saveError, setSaveError] = useState<string | null>(null);
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
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [displayMode, setDisplayMode] = useState<'none' | 'summary' | 'quiz'>('none');

    // Estados de Apresentação
    const [presentationCode, setPresentationCode] = useState<string | null>(null);
    const [presentationActive, setPresentationActive] = useState(false);

    // Ref para garantir acesso ao código atualizado dentro de callbacks (Stale Closure fix)
    const presentationCodeRef = useRef<string | null>(null);

    useEffect(() => {
        presentationCodeRef.current = presentationCode;
    }, [presentationCode]);

    const [triggerWord, setTriggerWord] = useState('Fred'); // Default
    const [fredCommand, setFredCommand] = useState<string | null>(null); // State for Fred Popup

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

    // FIX: Ref para garantir acesso à versão mais recente do handleSendToAI dentro do callback do SpeechRecognition
    const handleSendToAIRef = useRef<any>(null);

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

    // Load System Settings (Trigger Word)
    useEffect(() => {
        const loadSettings = async () => {
            const { success, settings } = await getPublicSettings();
            if (success && settings['trigger_word']) {
                setTriggerWord(settings['trigger_word'].trim());
            }
        };
        loadSettings();
    }, []);

    // Carregar apresentação ativa ao montar componente
    useEffect(() => {
        loadActivePresentation();
    }, []);

    const loadActivePresentation = async () => {
        try {
            console.log('[PRESENTATION] Carregando apresentação ativa...');
            const response = await getActivePresentation();
            console.log('[PRESENTATION] Resposta de getActivePresentation:', response);

            if (response.active && response.session) {
                // Verificar se a sessão está realmente ativa (não ended)
                console.log('[PRESENTATION] Sessão encontrada, status:', response.session.status);
                if (response.session.status === 'active') {
                    setPresentationCode(response.session.code);
                    setPresentationActive(true);
                    console.log('[PRESENTATION] ✅ Apresentação ativa restaurada:', response.session.code);
                } else {
                    // Sessão existe mas está encerrada, limpar estado
                    setPresentationCode(null);
                    setPresentationActive(false);
                    console.log('[PRESENTATION] ⚠️ Apresentação encontrada mas está encerrada');
                }
            } else {
                // Nenhuma apresentação ativa
                setPresentationCode(null);
                setPresentationActive(false);
                console.log('[PRESENTATION] ℹ️ Nenhuma apresentação ativa');
            }
        } catch (error) {
            console.error('[PRESENTATION] ❌ Erro ao carregar apresentação ativa:', error);
            // Em caso de erro, limpar estado para evitar bugs
            setPresentationCode(null);
            setPresentationActive(false);
        }
    };


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
                    // HACK: Tocar áudio silencioso para evitar throttling do navegador em background
                    // WAV PCM linear 16-bit 8000Hz mono com silêncio (0x00)
                    const silentAudio = new Audio("data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
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
                        // Regex construído dinamicamente pelo triggerWord
                        // Escapa caracteres especiais se houver
                        const safeTrigger = triggerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                        // Dinâmico: Aceita a palavra exata + pontuação opcional
                        // Adicionamos 'e' opcional no final para casos como Fred/Frede se terminar em consoante muda comum (opcional, pode ser removido se causar confusão com outras palavras)
                        // Para simplicidade: apenas a palavra + variação com 'e' se a palavra for pequena (<5 chars) ou for "Fred" hardcoded logic
                        // Simplificação: apenas a palavra exata, case insensitive.
                        // Removemos a verificação complexa de pontuação rígida no início para ser mais permissivo
                        const pattern = `${safeTrigger}(?:e)?`;

                        // Regex Start: Começa com a palavra (aceita espaços antes se não for o início absoluto)
                        // (?:\b|^) garante que não pegue meio de palavra (ex: 'aluna' não ativa 'luna')
                        const fredStartRegex = new RegExp(`(?:\\b|^)${pattern}[\\s!?,.]*`, 'i');

                        // Regex Full: Palavra + qualquer coisa depois
                        const fredFullRegex = new RegExp(`(?:\\b|^)${pattern}[\\s!?,.]+(.+)`, 'i');


                        // OTIMIZAÇÃO CRÍTICA: event.resultIndex indica onde as mudanças começaram.
                        // Em vez de iterar de 0 até results.length (O(N^2) acumulado),
                        // iteramos apenas sobre os novos resultados (O(N) linear).
                        const startIndex = event.resultIndex !== undefined ? event.resultIndex : 0;

                        for (let i = startIndex; i < event.results.length; i++) {
                            const result = event.results[i];
                            const transcript = result[0].transcript.trim();

                            if (result.isFinal && transcript) {
                                if (!processedResultsRef.current.has(i) && transcript !== lastFinalTextRef.current) {
                                    processedResultsRef.current.add(i);
                                    lastFinalTextRef.current = transcript;

                                    // Checa se é um comando Fred
                                    const fredMatch = transcript.match(fredFullRegex);
                                    if (fredMatch) {
                                        // É um comando!
                                        const commandContent = fredMatch[1].trim();
                                        console.log('[ONRESULT] Fred command interceptado (Final):', commandContent);

                                        // Mostrar no Pop-up (Finalização)
                                        setFredCommand(commandContent);

                                        // Feedback Tátil
                                        if (Platform.OS === 'web') {
                                            // @ts-ignore
                                            try { window.navigator.vibrate(200); } catch (e) { }
                                        }

                                        // Enviar para IA e limpar popup depois
                                        setTimeout(() => {
                                            if (handleSendToAIRef.current) {
                                                handleSendToAIRef.current(commandContent);
                                            }
                                            // Limpar popup após um tempo se a IA não responder rápido
                                            setTimeout(() => setFredCommand(null), 4000);
                                        }, 100);

                                        // NÃO adiciona ao savedTextRef (interceptado)
                                    } else {
                                        // Texto normal
                                        // Mas cuidado se o Fred estiver no meio: "Olá Fred faça isso"
                                        // A implementação simples assume que o comando é uma sentença separada (pausa antes).
                                        // Para robustez, podemos fazer um split, mas vamos manter simples por enquanto conforme solicitado "direto no popup".

                                        // Verifica se tem Fred no meio (split simples se necessário, mas pode ser arriscado cortar fala normal)
                                        // Se o usuário disser "Fred" no meio, provavelmente haverá uma pausa antes separando os results,
                                        // ou será capturado aqui. Se for uma frase longa sem pausa "ola fred corre", será capturado como texto normal por enquanto,
                                        // a menos que refinemos o regex de start para contains. 
                                        // O pedido foi "ao inves de remover... a transcrição ser direta".
                                        // Vamos assumir comando inicia a frase (utterance).

                                        // Se NÃO for comando Fred no início, salva normal.
                                        const separator = savedTextRef.current ? ' ' : '';
                                        savedTextRef.current = savedTextRef.current + separator + transcript;
                                        setTranscribedText(savedTextRef.current);
                                        triggerAutoSave(savedTextRef.current);

                                        // Garantir que o popup limpe se não foi um comando válido
                                        setFredCommand(null);
                                    }
                                }
                            } else if (!result.isFinal) {
                                // Interceptação de Interim
                                const fredInterimMatch = transcript.match(fredFullRegex) || transcript.match(fredStartRegex);

                                if (fredInterimMatch) {
                                    // Se parece ser um comando Fred, mostra no popup e NÃO no interim text principal
                                    // Se já temos o comando parcial
                                    if (fredFullRegex.test(transcript)) {
                                        const cmd = transcript.match(fredFullRegex)![1];
                                        setFredCommand(cmd + '...'); // Feedback visual de que está ouvindo
                                    } else {
                                        setFredCommand('Ouvindo...');
                                    }
                                    // currentInterim fica vazio para não sujar a tela principal
                                } else {
                                    currentInterim = transcript;
                                    // Se tínhamos um comando Fred antes e agora não parece mais (estranho, mas possível), limpamos?
                                    // Melhor não limpar fredCommand aqui para não piscar.
                                }
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
    }, [triggerAutoSave, triggerWord]); // Dependencia de triggerWord para recriar se mudar

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

    /**
     * VOICE TRIGGER IMPLEMENTATION
     * Detects "Fred" followed by a command
     */
    // Efeito de detecção removido em favor da interceptação direta no onresult
    // useEffect(() => { ... }, [transcribedText...]);

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

    // Função para iniciar apresentação
    const handleStartPresentation = async () => {
        try {
            const response = await startPresentation();
            if (response.success && response.code) {
                setPresentationCode(response.code);
                setPresentationActive(true);

                // Copiar URL para clipboard (opcional)
                Alert.alert(
                    'Apresentação Iniciada',
                    `Código: ${response.code}\n\nURL: ${response.url}`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha ao iniciar apresentação');
        }
    };

    // Função para enviar resumo para apresentação
    const handleSendSummaryToPresentation = async () => {
        if (!presentationCode || !generatedSummary) return;

        try {
            await sendToPresentation(presentationCode, 'summary', {
                text: generatedSummary,
                title: 'Resumo da Aula'
            });
            Alert.alert('✅ Sucesso', 'Resumo enviado para a tela de apresentação');
        } catch (error) {
            Alert.alert('Erro', 'Falha ao enviar resumo');
        }
    };

    // Função para encerrar apresentação
    const handleEndPresentation = async () => {
        if (!presentationCode) {
            Alert.alert('Erro', 'Nenhuma apresentação ativa');
            return;
        }

        try {
            console.log('[PRESENTATION] Encerrando apresentação:', presentationCode);
            const response = await endPresentation(presentationCode);
            console.log('[PRESENTATION] Resposta:', response);

            if (response.success) {
                setPresentationActive(false);
                setPresentationCode(null);
                Alert.alert('✅ Sucesso', 'Apresentação encerrada!');
            } else {
                Alert.alert('Erro', response.error || 'Falha ao encerrar');
            }
        } catch (error) {
            console.error('[PRESENTATION] Erro ao encerrar:', error);
            Alert.alert('Erro', 'Falha ao encerrar apresentação');
        }
    };









    // --- SHARED FUNCTION: Enviar para tela (Botão e Voz) ---
    const handleSendToScreen = async (feedbackMode: 'alert' | 'fred' = 'alert') => {
        // FIX: Priorizar o que está VISÍVEL (generatedQuiz) sobre o salvo (currentActivity)
        let contentToSend = generatedQuiz;

        // Fallback para currentActivity se generatedQuiz for nulo (ex: refresh da página)
        if (!contentToSend && currentActivity) {
            contentToSend = currentActivity.content;
        }

        // Garantir que é objeto, não string
        if (typeof contentToSend === 'string') {
            try {
                contentToSend = JSON.parse(contentToSend);
            } catch (e) {
                console.error('Erro parse content to send', e);
            }
        }

        // Debug data
        const qCount = contentToSend?.questions?.length || 0;
        console.log(`[SEND TO SCREEN] Enviando quiz com ${qCount} questões (Mode: ${feedbackMode})`);

        try {
            // 1. Validar Sessão Ativa (Refresh Code)
            const sessionCheck = await getActivePresentation();
            const targetCode = sessionCheck.session?.code || presentationCodeRef.current;

            if (!targetCode) {
                const msg = 'Nenhuma apresentação ativa encontrada.';
                if (feedbackMode === 'alert') Alert.alert('Erro', msg);
                else {
                    setFredCommand(msg);
                    setTimeout(() => setFredCommand(null), 3000);
                }
                return;
            }

            // 2. Enviar para o código validado
            await sendToPresentation(
                targetCode,
                'quiz',
                contentToSend
            );

            const successMsg = `Quiz (${qCount} questões) enviado!`;
            if (feedbackMode === 'alert') Alert.alert('Sucesso', successMsg);
            else {
                setFredCommand(successMsg);
                setTimeout(() => setFredCommand(null), 3000);
            }

            // Atualizar ref se necessário
            presentationCodeRef.current = targetCode;

        } catch (error) {
            console.error('Erro envio:', error);
            const errorMsg = 'Falha ao enviar para apresentação';
            if (feedbackMode === 'alert') Alert.alert('Erro', errorMsg);
            else {
                setFredCommand(errorMsg);
                setTimeout(() => setFredCommand(null), 3000);
            }
        }
    };

    // Enviar para IA (Genérico)
    const handleSendToAI = async (command?: string) => {
        // Helper function to try extracting JSON (Robust enough for AI output)
        const tryParseJSON = (str: string) => {
            if (typeof str !== 'string') return null;

            // 1. Limpar comentários de linha (// ...) que a IA adora colocar
            // Cuidado para não remover // dentro de URLs (http://...)
            // Simplificação: remove // apenas se tiver espaço antes ou inicio de linha, até o fim da linha
            const cleanStr = str.replace(/(^|[^:])\/\/.*$/gm, '$1');

            try {
                // 1. Tentar parse direto
                return JSON.parse(cleanStr);
            } catch (e) { }

            try {
                // 2. Tentar encontrar blocos de código markdown (```json ... ``` ou ``` ... ```)
                const markdownMatch = cleanStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                if (markdownMatch && markdownMatch[1]) {
                    return JSON.parse(markdownMatch[1]);
                }
            } catch (e) { }

            try {
                // 3. Tentar encontrar o primeiro '{' e o último '}' (heuristic brute force)
                const firstBrace = cleanStr.indexOf('{');
                const lastBrace = cleanStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    const potentialJson = cleanStr.substring(firstBrace, lastBrace + 1);
                    return JSON.parse(potentialJson);
                }
            } catch (e) { }

            return null;
        };

        // Helper function to parse Quiz from formatted text (Fallback)
        const parseQuizFromText = (text: string) => {
            if (typeof text !== 'string') return null;

            // Regex para identificar questões (ex: "1. Pergunta...")
            const questionRegex = /(\d+)\.\s+(.+)/;
            // Regex para identificar opções (ex: "A) Opção..." ou "a) Opção...")
            const optionRegex = /^\s*([A-Da-d])[\)\.]\s+(.+)/;

            const lines = text.split('\n');
            const questions: any[] = [];
            let currentQuestion: any = null;

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                // Verifica se é uma nova pergunta
                const qMatch = trimmedLine.match(questionRegex);
                if (qMatch) {
                    if (currentQuestion) {
                        questions.push(currentQuestion);
                    }
                    currentQuestion = {
                        question: qMatch[2].trim(),
                        options: [],
                        correct: 0 // Default, pois texto geralmente não indica explicitamente pra máquina
                    };
                    continue;
                }

                // Verifica se é uma opção
                if (currentQuestion) {
                    const optMatch = trimmedLine.match(optionRegex);
                    if (optMatch) {
                        currentQuestion.options.push(optMatch[2].trim());
                    }
                }
            }
            // Adiciona a última questão encontrada
            if (currentQuestion) {
                questions.push(currentQuestion);
            }

            // Só considera válido se achou perguntas e opções
            if (questions.length > 0 && questions[0].options.length > 0) {
                return { questions };
            }
            return null;
        };

        if (!session) return;

        // Verificar se tem texto
        // Usar savedTextRef para evitar closure stale quando chamado via onresult
        const currentText = savedTextRef.current;
        if (!currentText || currentText.trim().length === 0) {
            if (Platform.OS === 'web') {
                window.alert('Grave ou digite algum conteúdo antes de enviar para a IA.');
            } else {
                Alert.alert('Sem Texto', 'Grave ou digite algum conteúdo antes de enviar para a IA.');
            }
            return;
        }

        setIsGenerating(true);
        // REMOVED EARLY RESET: setCurrentActivity(null); setGeneratedQuiz(null); -> Moved to after interceptors

        // *** INTERCEPTOR: Comando "ENVIAR" direto (sem gerar novo) ***
        // Se o usuário diz "Envie esse quiz", "Mande o resumo", etc.
        // E já temos uma atividade na tela (currentActivity)
        if (command) {
            const lowerCmd = command.toLowerCase();
            const isSendIntent = /(envi|mand|aplic|lanç|disponibiliz)/i.test(lowerCmd);
            const isGenerateIntent = /(ger|cri|faz|mont)/i.test(lowerCmd);

            // 0. Enviar para APRESENTAÇÃO (Tela/Projetor)
            if (/(apresent|projet|tel|mostr.*tel)/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Comando de apresentação detectado');

                if (!presentationCodeRef.current) {
                    setFredCommand('Inicie uma apresentação primeiro!');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }

                if (currentActivity && currentActivity.status !== 'ended') {
                    setFredCommand('Enviando para a tela...');
                    setIsGenerating(false);

                    setTimeout(() => {
                        handleSendToScreen('fred');
                    }, 500);
                    return;
                }
            }

            // 1. Alternar Respostas do Quiz
            if (/(mostr|exib|ver).*(respost|gabarit|correç)/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Mostrar respostas');
                setFredCommand('Exibindo respostas...');
                setShowAnswerKey(true);
                setIsGenerating(false);
                setTimeout(() => setFredCommand(null), 2000);
                return;
            }
            if (/(escond|ocult|tira).*(respost|gabarit|correç)/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Ocultar respostas');
                setFredCommand('Ocultando respostas...');
                setShowAnswerKey(false);
                setIsGenerating(false);
                setTimeout(() => setFredCommand(null), 2000);
                return;
            }

            // 2. Enviar Atividade Atual (Quiz ou Resumo)


            // Se quer enviar, MAS NÃO quer gerar, E temos atividade salva
            // 2. Enviar Atividade Atual (Quiz ou Resumo) (IMPLEMENTAÇÃO ATUALIZADA)
            if (isSendIntent && !isGenerateIntent && currentActivity && currentActivity.status !== 'ended') {
                console.log('[AI INTERCEPTOR] Comando de envio direto detectado:', command);
                console.log('[AI INTERCEPTOR] Atividade atual:', currentActivity.id, currentActivity.title, currentActivity.activity_type);

                const act = currentActivity;
                // Feedback visual
                setFredCommand(`Enviando ${act.activity_type === 'quiz' ? 'quiz' : 'resumo'}...`);

                // Simula delay de "processamento"
                setTimeout(() => {
                    if (act.activity_type === 'quiz') {
                        performStartActivity(act.id, act.title || 'Quiz');
                    } else if (act.activity_type === 'summary') {
                        performShareSummary(act.title || 'Resumo da Aula');
                    }
                    setIsGenerating(false);
                    setFredCommand(null);
                }, 1000);

                return; // INTERROMPE O FLUXO (Não chama N8N)
            }


        }

        // SE PASSOU PELOS INTERCEPTORES -> VAI GERAR NOVO CONTEÚDO
        setCurrentActivity(null); // RESET: Agora sim limpamos, pois vamos gerar algo novo
        setGeneratedQuiz(null);   // Limpa visualização anterior

        // Não definimos displayMode ainda, esperamos a resposta
        try {
            // Forçar salvamento antes de gerar
            await updateTranscription(session.id, currentText);

            console.log('[AI] Enviando texto para N8N...');
            // Envia APENAS o texto, sem instrução extra, conforme pedido
            // Agora enviando também classroom_id e comando
            const n8nResponse = await processText(currentText, undefined, {
                classroom_id: subjectName,
                comando: command || null
            });
            console.log('[AI] Resposta do N8N:', JSON.stringify(n8nResponse, null, 2));

            // Extrair conteúdo
            let content = n8nResponse.output || n8nResponse.text || n8nResponse;
            if (Array.isArray(n8nResponse) && n8nResponse[0]?.output) {
                content = n8nResponse[0].output;
            }
            // Suporte para n8n retornando { data: { output: "..." } }
            if (n8nResponse.data?.output) {
                content = n8nResponse.data.output;
            }

            // DETECÇÃO EXPLÍCITA DE TIPO (Solicitado pelo usuário)
            let parsedContent = content;
            let explicitType: 'quiz' | 'summary' | 'command' | 'document' | null = null;

            if (typeof content === 'string') {
                const cmdMatch = content.match(/^\[TYPE:CMD\]/i);
                // Detectar [TYPE:DOCUMENT]
                const documentMatch = content.match(/^\[TYPE:DOCUMENT\]/i);
                if (documentMatch) {
                    console.log('[AI] Documento detectado! Processando...');
                    console.log('[AI] Conteúdo completo:', content);

                    // Extrair DOCUMENT_ID
                    const docIdMatch = content.match(/DOCUMENT_ID:\s*([a-f0-9-]+)/i);
                    console.log('[AI] Regex match result:', docIdMatch);
                    console.log('[AI] Presentation code (REF):', presentationCodeRef.current);

                    if (docIdMatch && presentationCodeRef.current) {
                        const documentId = docIdMatch[1];
                        console.log(`[AI] ✅ Documento ID extraído: ${documentId}`);
                        console.log(`[AI] ✅ Código de apresentação: ${presentationCodeRef.current}`);
                        console.log(`[AI] 🚀 Enviando documento para apresentação...`);

                        try {
                            // Importar função do api.ts
                            const { sendDocumentToPresentation } = require('@/services/api');
                            const result = await sendDocumentToPresentation(documentId, presentationCodeRef.current);

                            console.log('[AI] 📦 Resposta do backend:', JSON.stringify(result, null, 2));

                            if (result.success) {
                                console.log('[AI] ✅ Documento enviado com sucesso!');
                                Alert.alert('✅ Sucesso', 'Documento enviado para apresentação!');
                            } else {
                                console.error('[AI] ❌ Erro ao enviar documento:', result.error);
                                Alert.alert('Erro', result.error || 'Falha ao enviar documento');
                            }
                        } catch (error) {
                            console.error('[AI] ❌ Exceção ao enviar documento:', error);
                            Alert.alert('Erro', 'Falha ao processar documento');
                        }
                    } else if (!presentationCodeRef.current) {
                        console.warn('[AI] ⚠️ Apresentação não está ativa (Ref is null)');
                        Alert.alert('Aviso', 'Inicie uma apresentação primeiro para exibir documentos');
                    } else {
                        console.error('[AI] ❌ DOCUMENT_ID não encontrado no conteúdo');
                        console.error('[AI] Conteúdo recebido:', content);
                        Alert.alert('Erro', 'ID do documento não encontrado na resposta');
                    }

                    // Limpar popup do Fred
                    setFredCommand(null);
                    setIsGenerating(false);
                    return; // Não processar mais nada
                }

                const typeMatch = content.match(/^\[TYPE:(QUIZ|SUMMARY)\]/i);

                if (cmdMatch) {
                    // *** NOVO: Fluxo de COMANDO ***
                    explicitType = 'command';
                    content = content.replace(/^\[TYPE:CMD\]/i, '').trim();
                    console.log(`[AI] Tipo explícito detectado: COMMAND`);

                    const commandJson = tryParseJSON(content);
                    if (commandJson && commandJson.action) {
                        // Executar comando imediatamente
                        processAICommand(commandJson);
                        setIsGenerating(false);
                        return; // Interrompe o fluxo (não salva como atividade normal)
                    }
                } else if (typeMatch) {
                    explicitType = typeMatch[1].toUpperCase() === 'QUIZ' ? 'quiz' : 'summary';
                    // Remove a tag para não atrapalhar o parse
                    content = content.replace(/^\[TYPE:(QUIZ|SUMMARY)\]/i, '').trim();
                    console.log(`[AI] Tipo explícito detectado: ${explicitType}`);
                }

                const extractedComp = tryParseJSON(content);
                // Se extraiu algo e parece ser um objeto significativo (tem questions ou é um resumo estruturado)
                if (extractedComp && (typeof extractedComp === 'object')) {
                    parsedContent = extractedComp;
                } else {
                    // Tenta o parser de texto (Fallback)
                    const textQuiz = parseQuizFromText(content);
                    if (textQuiz) {
                        console.log('[AI] Quiz detectado via Text Parser!');
                        parsedContent = textQuiz;
                    } else {
                        // Se falhar tudo, assume que é texto livre (Resumo/Resposta simples)
                        parsedContent = { text: content };
                    }
                }
            }

            // --- NORMALIZAÇÃO DE DADOS (Compatibilidade com formatos variados do N8N) ---
            if (parsedContent && typeof parsedContent === 'object') {
                // Algumas vezes o N8N retorna { "quiz": [questions...] } em vez de { "questions": [...] }
                // OU retorna { "quiz": { "questions": [...] } }
                if (parsedContent.quiz) {
                    if (Array.isArray(parsedContent.quiz)) {
                        parsedContent.questions = parsedContent.quiz;
                    } else if (parsedContent.quiz.questions && Array.isArray(parsedContent.quiz.questions)) {
                        parsedContent.questions = parsedContent.quiz.questions;
                    }
                }

                if (parsedContent.questions && Array.isArray(parsedContent.questions)) {
                    // Normalizar cada questão
                    parsedContent.questions = parsedContent.questions.map((q: any) => {
                        // Converter options { A: "...", B: "..." } para array ["...", "..."]
                        let normalizedOptions: string[] = [];
                        let normalizedCorrect = 0;

                        if (q.options && typeof q.options === 'object' && !Array.isArray(q.options)) {
                            // Mapear A,B,C,D,E para array
                            const keys = ['A', 'B', 'C', 'D', 'E'];
                            normalizedOptions = keys.map(k => q.options[k] || q.options[k.toLowerCase()] || '').filter(o => o !== '');

                            // Se a resposta vier como letra ("C"), converter para índice (2)
                            if (typeof q.answer === 'string') {
                                const answerLetter = q.answer.toUpperCase().trim();
                                const index = keys.indexOf(answerLetter);
                                if (index !== -1) normalizedCorrect = index;
                            } else if (typeof q.correct === 'number') {
                                normalizedCorrect = q.correct;
                            }
                        } else if (Array.isArray(q.options)) {
                            // Já é array, manter
                            normalizedOptions = q.options;
                            if (typeof q.correct === 'number') {
                                normalizedCorrect = q.correct;
                            } else if (typeof q.answer === 'string') {
                                // Tenta converter letra para index caso seja array mas resposta letra
                                const keys = ['A', 'B', 'C', 'D', 'E'];
                                const answerLetter = q.answer.toUpperCase().trim();
                                const index = keys.indexOf(answerLetter);
                                if (index !== -1) normalizedCorrect = index;
                            }
                        }

                        return {
                            question: q.question,
                            options: normalizedOptions.length > 0 ? normalizedOptions : (q.options || []),
                            correct: normalizedCorrect
                        };
                    });
                }
            }
            // ---------------------------------------------------------------------------


            // NORMALIZAÇÃO DE DADOS DO QUIZ (Mapping N8N -> Componente)
            // O N8N pode retornar variações:
            // 1. { questions: [...] } ou { quiz: [...] }
            // 2. alternatives como Objeto { A: "...", B: "..." } ou Array ["A) ...", "B) ..."]

            // Unificar entrada em 'questions'
            if (parsedContent && typeof parsedContent === 'object') {
                if (!parsedContent.questions && parsedContent.quiz && Array.isArray(parsedContent.quiz)) {
                    parsedContent.questions = parsedContent.quiz;
                }
            }

            if (parsedContent && typeof parsedContent === 'object' && parsedContent.questions && Array.isArray(parsedContent.questions)) {
                try {
                    const normalizedQuestions = parsedContent.questions.map((q: any) => {
                        // Tenta encontrar campos
                        const questionText = q.question_text || q.question;
                        const alternatives = q.alternatives || q.options; // as vezes vem options direto

                        if (questionText && alternatives) {
                            let options: string[] = [];

                            // Caso 1: Alternatives é Objeto
                            if (!Array.isArray(alternatives) && typeof alternatives === 'object') {
                                const keys = Object.keys(alternatives).sort();
                                console.log('[DEBUG-NORMALIZATION] Keys found:', JSON.stringify(keys));
                                for (const key of keys) {
                                    options.push(alternatives[key]);
                                }
                            }
                            // Caso 2: Alternatives é Array
                            else if (Array.isArray(alternatives)) {
                                options = alternatives.map((opt: string) => {
                                    // Remove prefixos como "A) ", "a. ", etc se existirem, pois o componente adiciona
                                    return opt.replace(/^[A-Ea-e][\)\.]\s*/, '').trim();
                                });
                            }

                            // Mapear correto (Letra -> Index)
                            let correctIndex = 0;
                            if (q.correct_answer) {
                                const correctLetter = q.correct_answer.toUpperCase().trim();
                                if (correctLetter.length === 1 && correctLetter >= 'A' && correctLetter <= 'E') {
                                    correctIndex = correctLetter.charCodeAt(0) - 65;
                                }
                            } else if (typeof q.correct === 'number') {
                                correctIndex = q.correct;
                            }

                            return {
                                question: questionText,
                                options: options,
                                correct: correctIndex
                            };
                        }
                        return q;
                    });
                    parsedContent.questions = normalizedQuestions;
                    console.log('[AI] Quiz Normalizado:', JSON.stringify(parsedContent, null, 2));
                } catch (normError) {
                    console.error('[AI] Erro na normalização do quiz:', normError);
                }
            }

            // Determinar tipo de atividade baseado EXCLUSIVAMENTE em tag explícita (pedido do usuário)
            // Garantir que não seja 'command' (embora o return acima já evite, o TS precisa de garantia)
            let activityType: 'quiz' | 'summary' = explicitType === 'quiz' ? 'quiz' : 'summary';
            let title = 'Resposta da IA';

            if (explicitType === 'quiz') {
                // Tenta pegar o título do quiz se disponível
                title = parsedContent.quiz_title || 'Quiz Gerado por IA';
                setGeneratedQuiz(parsedContent);
                setDisplayMode('quiz');
            } else {
                // Se for SUMMARY ou NULL (sem tag), trata como resumo/texto
                activityType = 'summary';
                title = 'Resumo / Resposta';
                const textContent = parsedContent.text || parsedContent.summary || (typeof parsedContent === 'string' ? parsedContent : JSON.stringify(parsedContent, null, 2));
                setGeneratedSummary(String(textContent));
                setDisplayMode('summary');
            }

            // Criar atividade mock para visualização

            // Salvar atividade no backend para obter ID real
            const generatedContentStr = typeof parsedContent === 'string' ? parsedContent : JSON.stringify(parsedContent);
            const calculatedTimeLimit = activityType === 'quiz' ? (parsedContent.questions?.length * 60 || 300) : 0;

            try {
                const saveResult = await saveGeneratedActivity(session.id, {
                    activity_type: activityType,
                    title: title,
                    content: parsedContent,
                    ai_generated_content: generatedContentStr,
                    time_limit: calculatedTimeLimit
                });

                if (saveResult.success && saveResult.activity) {
                    // ATUALIZAÇÃO CRÍTICA: Garantir que currentActivity seja o novo objeto salvo (Quiz ou Summary)
                    setCurrentActivity(saveResult.activity);
                    console.log(`[AI] Atividade atualizada: ${saveResult.activity.id} (${saveResult.activity.activity_type})`);

                    // *** NOVA LÓGICA: Auto-enviar quiz se o comando de voz pedir ***
                    if (command && activityType === 'quiz') {
                        const intentRegex = /(envi|mand|aplic|lanç|disponibiliz)/i;
                        if (intentRegex.test(command)) {
                            console.log('[AI AUTO-SEND] Intenção de envio detectada:', command);
                            setTimeout(() => {
                                performStartActivity(saveResult.activity!.id, title);
                                setFredCommand('Enviando Quiz...');
                                setTimeout(() => setFredCommand(null), 3000);
                            }, 500);
                        }
                    }

                } else {
                    console.error('[AI] Erro ao salvar atividade:', saveResult);
                    // Fallback visual (mas botões de edição falharão)
                    const mockActivity: LiveActivity = {
                        id: Date.now(),
                        session_id: session.id,
                        checkpoint_id: 0,
                        activity_type: activityType,
                        title: title,
                        content: parsedContent,
                        ai_generated_content: generatedContentStr,
                        shared_with_students: false,
                        status: 'waiting',
                        time_limit: calculatedTimeLimit,
                        time_remaining: null,
                        starts_at: null,
                        ends_at: null,
                        response_count: 0
                    };
                    setCurrentActivity(mockActivity);
                }
            } catch (error) {
                console.error('[AI] Exceção ao salvar atividade:', error);
                // Fallback visual
                const mockActivity: LiveActivity = {
                    id: Date.now(),
                    session_id: session.id,
                    checkpoint_id: 0,
                    activity_type: activityType,
                    title: title,
                    content: parsedContent,
                    ai_generated_content: generatedContentStr,
                    shared_with_students: false,
                    status: 'waiting',
                    time_limit: calculatedTimeLimit,
                    time_remaining: null,
                    starts_at: null,
                    ends_at: null,
                    response_count: 0
                };
                setCurrentActivity(mockActivity);
            }

            console.log(`[AI] Atividade gerada: ${activityType}`);



        } catch (error: any) {
            console.error('Erro ao enviar para IA:', error);
            Alert.alert('Erro', error?.message || 'Erro ao processar com IA.');
            setDisplayMode('none');
        }
        setIsGenerating(false);
        setIsGenerating(false);
    };

    // FIX: Manter handleSendToAIRef atualizado
    useEffect(() => {
        handleSendToAIRef.current = handleSendToAI;
    });

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

    // Processador de Comandos da IA
    const processAICommand = async (commandIn: any) => {
        console.log('[AI COMMAND] Processando:', commandIn);
        const { action, payload } = commandIn;

        if (action === 'send_content') {
            const url = payload.url;
            // Validação básica de URL para evitar placeholders da IA
            if (!url || url.includes('A_URL_') || (!url.startsWith('http') && !url.startsWith('www'))) {
                console.warn('[AI COMMAND] URL inválida ou placeholder detectado:', url);
                if (Platform.OS === 'web') {
                    // @ts-ignore
                    window.alert(`Fred tentou enviar um vídeo, mas não encontrou o link exato.\n(Debug: ${url})`);
                } else {
                    Alert.alert('Vídeo não encontrado', 'A IA não conseguiu encontrar um link válido para este conteúdo.');
                }
                return;
            }

            // Usar REF para evitar stale closure
            let targetCode = presentationCodeRef.current;

            if (!presentationActive || !targetCode) {
                // Tenta auto-iniciar se não estiver ativo
                console.log('[AI COMMAND] Iniciando apresentação automaticamente...');
                try {
                    const startRes = await startPresentation();
                    if (startRes.success && startRes.code) {
                        targetCode = startRes.code;
                        setPresentationCode(targetCode);
                        setPresentationActive(true);
                        // Pequeno delay para garantir que o socket conectou?
                        await new Promise(r => setTimeout(r, 1000));
                    } else {
                        Alert.alert('Erro', 'Não foi possível iniciar a apresentação para enviar o conteúdo.');
                        return;
                    }
                } catch (e) {
                    console.error('[AI COMMAND] Erro ao auto-iniciar:', e);
                    return;
                }
            }

            // Enviar conteúdo (Vídeo/Imagem)
            if (targetCode && (payload.type === 'video' || payload.type === 'image')) {
                console.log('[AI COMMAND] Enviando conteúdo para:', targetCode);
                // Usando a mesma função de envio de conteúdo multimídia
                const result = await sendToPresentation(targetCode, payload.type, {
                    url: payload.url,
                    caption: payload.caption || 'Enviado por Fred'
                });

                if (result.success) {
                    if (Platform.OS === 'web') {
                        // @ts-ignore
                        try { window.navigator.vibrate([100, 50, 100]); } catch (e) { }
                    }
                    setFredCommand('Conteúdo enviado!');
                } else {
                    Alert.alert('Erro', 'Falha ao enviar conteúdo para a TV: ' + (result.error || 'Erro desconhecido'));
                }
            }

        } else if (action === 'control_video') {
            const currentCode = presentationCodeRef.current;
            if (!currentCode) {
                console.log('[AI COMMAND] Comando ignorado: Nenhuma apresentação ativa (Ref is null).');
                return;
            }
            // payload: { command: 'play'|'pause'|'seek', value?: number }
            try {
                const result = await controlPresentationVideo(currentCode, payload.command, payload.value);
                console.log('[AI COMMAND] Resultado Controle:', result);
                setFredCommand(`Comando: ${payload.command}`);
            } catch (e) {
                console.error('[AI COMMAND] Erro ao enviar controle:', e);
            }
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



    // Sidebar Navigation Handler
    const handleSidebarNavigation = (route: string) => {
        setSidebarVisible(false);
        if (route === 'dashboard') {
            router.push('/(teacher)/dashboard');
        } else if (route === 'ai-assistant') {
            router.push({
                pathname: '/(teacher)/ai-assistant',
                params: { subject: subjectName, subjectId: session?.subject_id?.toString() || params.subjectId }
            });
        } else if (route === 'activities') {
            router.push({
                pathname: '/(teacher)/activities',
                params: { subjectId: session?.subject_id?.toString() || params.subjectId, subjectName: subjectName }
            });
        } else if (route === 'active-activities') {
            router.push({
                pathname: '/(teacher)/active-activities',
                params: { subjectId: session?.subject_id?.toString() || params.subjectId, subjectName: subjectName }
            });
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#4f46e5', '#8b5cf6']}
                style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.push('/(teacher)/dashboard')}
                >
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{subjectName || 'Transcrição'}</Text>
                    {/* <Text style={styles.headerSubtitle}>{isRecording ? 'Gravando...' : 'Pronto para ouvir'}</Text> */}
                </View>

                {/* Menu Button / Save Indicator */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.saveIndicator}>
                        {isSaving ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : saveError ? (
                            <MaterialIcons name="error-outline" size={24} color="#fca5a5" />
                        ) : (
                            <MaterialIcons name="cloud-done" size={24} color="rgba(255,255,255,0.6)" />
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => setSidebarVisible(true)}
                    >
                        <MaterialIcons name="menu" size={28} color={colors.white} />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Sidebar Modal */}
            <Modal
                visible={sidebarVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSidebarVisible(false)}
            >
                <TouchableOpacity
                    style={styles.sidebarOverlay}
                    activeOpacity={1}
                    onPress={() => setSidebarVisible(false)}
                >
                    <View style={styles.sidebarContainer}>
                        {/* Sidebar Header */}
                        <LinearGradient
                            colors={['#4f46e5', '#8b5cf6']}
                            style={styles.sidebarHeader}
                        >
                            <Text style={styles.sidebarTitle}>Menu da Disciplina</Text>
                            <TouchableOpacity onPress={() => setSidebarVisible(false)}>
                                <MaterialIcons name="close" size={24} color={colors.white} />
                            </TouchableOpacity>
                        </LinearGradient>

                        <View style={styles.sidebarContent}>
                            <Text style={styles.sidebarSectionTitle}>Navegação</Text>

                            <TouchableOpacity
                                style={styles.sidebarItem}
                                onPress={() => handleSidebarNavigation('ai-assistant')}
                            >
                                <View style={[styles.sidebarIcon, { backgroundColor: '#e0f2fe' }]}>
                                    <MaterialIcons name="auto-awesome" size={20} color="#0284c7" />
                                </View>
                                <Text style={styles.sidebarLabel}>Contexto para Fred</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.sidebarItem}
                                onPress={() => handleSidebarNavigation('activities')}
                            >
                                <View style={[styles.sidebarIcon, { backgroundColor: '#f3e8ff' }]}>
                                    <MaterialIcons name="assignment" size={20} color="#9333ea" />
                                </View>
                                <Text style={styles.sidebarLabel}>Atividades e Quizzes</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.sidebarItem}
                                onPress={() => handleSidebarNavigation('active-activities')}
                            >
                                <View style={[styles.sidebarIcon, { backgroundColor: '#fff7ed' }]}>
                                    <MaterialIcons name="bolt" size={20} color="#ea580c" />
                                </View>
                                <Text style={styles.sidebarLabel}>Em Andamento</Text>
                            </TouchableOpacity>

                            <View style={styles.sidebarDivider} />

                            <TouchableOpacity
                                style={styles.sidebarItem}
                                onPress={() => handleSidebarNavigation('dashboard')}
                            >
                                <View style={[styles.sidebarIcon, { backgroundColor: '#f1f5f9' }]}>
                                    <MaterialIcons name="dashboard" size={20} color="#475569" />
                                </View>
                                <Text style={styles.sidebarLabel}>Voltar ao Dashboard</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Status Banner */}
            {
                isRecording && (
                    <View style={styles.recordingBanner}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingText}>Gravando...</Text>
                    </View>
                )
            }

            {
                session?.status === 'paused' && (
                    <View style={styles.pausedBanner}>
                        <MaterialIcons name="pause-circle" size={16} color="#f59e0b" />
                        <Text style={styles.pausedText}>Sessão pausada</Text>
                    </View>
                )
            }

            {/* Seção de Apresentação */}
            <View style={styles.presentationSection}>
                {!presentationActive ? (
                    <TouchableOpacity
                        style={styles.startPresentationButton}
                        onPress={handleStartPresentation}
                    >
                        <MaterialIcons name="cast" size={20} color={colors.white} />
                        <Text style={styles.buttonText}>Iniciar Transmissão</Text>
                    </TouchableOpacity>
                ) : (
                    <>

                        <PresentationControls
                            code={presentationCode}
                            onEnd={handleEndPresentation}
                        />
                    </>
                )}
            </View>

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

                                                {/* Botão Enviar para Tela de Apresentação */}
                                                {presentationActive && (
                                                    <TouchableOpacity
                                                        style={styles.sendToScreenButton}
                                                        onPress={handleSendSummaryToPresentation}
                                                    >
                                                        <MaterialIcons name="tv" size={20} color={colors.white} />
                                                    </TouchableOpacity>
                                                )}
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
                                            {/* Botão Enviar para Tela de Apresentação */}
                                            {presentationActive && (
                                                <TouchableOpacity
                                                    style={styles.sendToScreenButton}
                                                    onPress={() => handleSendToScreen('alert')}
                                                >
                                                    <MaterialIcons name="tv" size={20} color={colors.white} />
                                                </TouchableOpacity>
                                            )}

                                            <View style={styles.sidebarDividerVertical} />

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


                    {/* Botão de Gravação (Centralizado e Maior) */}
                    <Animated.View style={[{ transform: [{ scale: pulseAnim }] }, styles.recordButtonWrapper]}>
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

                    {/* Espaço vazio para manter alinhamento se necessário, ou remover */}
                    <View style={{ width: 60 }} />

                </View>

                <Text style={styles.footerHint}>
                    {isGenerating ? 'Gerando com IA...' : isRecording ? 'Diga "Fred" para comandos...' : 'Toque para gravar'}
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
            <FredCommandOverlay />
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
    menuButton: {
        padding: 4,
    },
    saveIndicator: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Sidebar Styles
    sidebarOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    sidebarContainer: {
        width: '80%',
        maxWidth: 300,
        backgroundColor: colors.white,
        height: '100%',
        shadowColor: "#000",
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    sidebarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingTop: spacing.xl, // Safe area approx
    },
    sidebarTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.white,
    },
    sidebarContent: {
        flex: 1,
        padding: spacing.md,
    },
    sidebarSectionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: 'bold',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        marginTop: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xs,
    },
    sidebarIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    sidebarLabel: {
        fontSize: typography.fontSize.base,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    sidebarDivider: {
        height: 1,
        backgroundColor: colors.slate200,
        marginVertical: spacing.md,
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
    recordButtonWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
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

    // Fred Overlay Styles
    fredOverlay: {
        position: 'absolute',
        top: 100, // Slightly higher
        left: 20,
        right: 20,
        zIndex: 9999,
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
        borderRadius: 20,
    },
    fredGradient: {
        borderRadius: 20,
        padding: 4, // Border effect or padding
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    fredContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.15)', // Glassy feel inside
        borderRadius: 16,
        padding: 12,
        paddingHorizontal: 16,
    },
    fredIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fredLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    fredText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
    },
    presentationSection: {
        padding: spacing.md,
        backgroundColor: colors.slate50,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    startPresentationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.success,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
    },
    sendToScreenButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    buttonText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
    sidebarDividerVertical: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: spacing.xs,
    },
});
