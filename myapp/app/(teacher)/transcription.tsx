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
    LayoutAnimation,
    UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    generateActivityAudio,
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

    controlPresentationVideo,
    pdfNextPage,
    pdfPreviousPage,
    pdfGotoPage,
    pdfZoom
} from '@/services/presentation';
import PresentationControls from '@/components/presentation/PresentationControls';
import MediaControlPanel from '@/components/presentation/MediaControlPanel';
// import { useAuth } from '@/context/AuthContext'; // Ajuste o caminho se necessário
import { useRouter } from 'expo-router';
import ConfirmationModal from '@/components/modals/ConfirmationModal';
import InputModal from '@/components/modals/InputModal';
import SummaryAudioOptionsModal, { SummaryAudioOptions } from '@/components/modals/SummaryAudioOptionsModal';
import VideoListModal, { VideoItem } from '@/components/modals/VideoListModal';
import DocumentListModal, { DocumentItem } from '@/components/modals/DocumentListModal';
import FredHelpModal from '@/components/help/FredHelpModal';
import { TutorialOverlay, TutorialStep } from '@/components/tutorial/TutorialOverlay';

/**
 * TranscriptionScreen - Tela de transcrição com sessões persistentes e atividades
 */
// Variável global fora do componente para garantir Singleton real
let globalRecognition: any = null;

export default function TranscriptionScreen() {
    const router = useRouter();
    // ... rest of component
    // const { user } = useAuth(); // Se precisar do user
    const { width, height } = useWindowDimensions();
    const isMobile = width < 768; // Breakpoint para mobile/tablet
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectId = parseInt(params.subjectId as string) || 1;
    const subjectName = params.subject as string || 'Disciplina';

    // Wrapper condicional para scroll no mobile
    const MainContentWrapper = isMobile ? ScrollView : View;

    // Fred Command Overlay Component
    const FredCommandOverlay = () => {
        // Show if there is a command OR if generating (loading)
        if (!fredCommand && !isGenerating) return null;

        const displayText = fredCommand || loadingTitle;
        const showSpinner = isGenerating || fredCommand === 'Ouvindo...';

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
                                {displayText}
                            </Text>
                        </View>
                        {showSpinner && (
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
            contentContainerStyle: { padding: 16, paddingBottom: 12, gap: 16, flexGrow: 1 },
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
    const [isTranscriptionCollapsed, setIsTranscriptionCollapsed] = useState(false);

    // Estado do modal de atividades
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Tutorial State
    const [showTutorial, setShowTutorial] = useState(false);
    const micButtonRef = useRef<View>(null);
    const helpButtonRef = useRef<View>(null);
    const presentationButtonRef = useRef<View>(null);

    const tutorialSteps: TutorialStep[] = [
        {
            targetRef: micButtonRef,
            title: 'Transcrição em Tempo Real',
            description: 'Toque neste botão para iniciar a transcrição. Tudo o que você falar será transformado em texto automaticamente.',
        },
        {
            targetRef: helpButtonRef,
            title: 'Assistente Fred',
            description: 'Toque aqui para ver exemplos de comandos. Você pode pedir: "Gere um resumo", "Crie um quiz com 5 perguntas" ou "Comece a apresentação".',
        },
        {
            targetRef: presentationButtonRef,
            title: 'Modo Apresentação',
            description: 'Transmita o conteúdo para uma tela externa (TV ou Projetor) para que seus alunos acompanhem a aula.',
        }
    ];

    useEffect(() => {
        checkTutorialStatus();
    }, []);

    const checkTutorialStatus = async () => {
        try {
            const hasSeen = await AsyncStorage.getItem('tutorial_transcription_seen');
            if (!hasSeen) {
                // Delay a bit to ensure layout is ready
                setTimeout(() => {
                    setShowTutorial(true);
                }, 1000);
            }
        } catch (e) {
            console.error('Erro ao verificar tutorial:', e);
        }
    };

    const handleFinishTutorial = async () => {
        setShowTutorial(false);
        try {
            await AsyncStorage.setItem('tutorial_transcription_seen', 'true');
        } catch (e) {
            console.error('Erro ao salvar tutorial status:', e);
        }
    };

    const handleOpenTutorial = () => {
        setSidebarVisible(false);
        setShowTutorial(true);
    };
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
    const [showMediaControls, setShowMediaControls] = useState(false);
    const [presentationContentType, setPresentationContentType] = useState<'video' | 'document' | null>(null);

    const mobileLeftPanelStyle = isMobile
        ? {
            width: '100%' as const,
            flex: isTranscriptionCollapsed ? 1 : 0,
            minHeight: isTranscriptionCollapsed ? Math.max(260, Math.floor(height * 0.45)) : 200,
        }
        : null;

    const leftPanelResponsiveStyle = [
        styles.leftPanel,
        mobileLeftPanelStyle,
    ];

    const mobileRightPanelStyle = isMobile
        ? { width: '100%' as const, flex: isTranscriptionCollapsed ? 0 : 1, minHeight: isTranscriptionCollapsed ? 92 : 250 }
        : null;
    const rightPanelResponsiveStyle = [
        styles.rightPanel,
        mobileRightPanelStyle,
        !isMobile && isTranscriptionCollapsed ? styles.rightPanelCollapsedDesktop : null,
    ];
    const transcriptionPreviewText = (transcribedText + (interimText ? ` ${interimText}` : '')).trim();
    const collapsedPreview = transcriptionPreviewText.length > 180
        ? `${transcriptionPreviewText.slice(0, 180)}...`
        : transcriptionPreviewText;

    // Loading State with Title
    const [loadingTitle, setLoadingTitle] = useState('Gerando com IA...');

    // Ref para garantir acesso ao código atualizado dentro de callbacks (Stale Closure fix)
    const presentationCodeRef = useRef<string | null>(null);

    useEffect(() => {
        presentationCodeRef.current = presentationCode;
    }, [presentationCode]);

    const [triggerWord, setTriggerWord] = useState('Fred'); // Default
    const [fredCommand, setFredCommand] = useState<string | null>(null); // State for Fred Popup

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    const animatePanels = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, []);

    const toggleTranscriptionCollapse = useCallback(() => {
        animatePanels();
        setIsTranscriptionCollapsed((prev) => !prev);
    }, [animatePanels]);

    const expandTranscription = useCallback(() => {
        if (!isTranscriptionCollapsed) return;
        animatePanels();
        setIsTranscriptionCollapsed(false);
    }, [animatePanels, isTranscriptionCollapsed]);

    // Tutorial removido - tutorialSteps

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

    // Exit Modal State (Custom for Web Compatibility)
    const [showExitModal, setShowExitModal] = useState(false);

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

    const [summaryAudioModalVisible, setSummaryAudioModalVisible] = useState(false);
    const [summaryAudioOptions, setSummaryAudioOptions] = useState<SummaryAudioOptions>({
        voice: 'pt_BR-jeff-medium',
        mode: 'summary',
        bg_id: 'lofi_calm',
        bg_volume: 0.10,
    });
    const [voiceSummaryConfirmModal, setVoiceSummaryConfirmModal] = useState<{
        visible: boolean;
        title: string;
        options: SummaryAudioOptions | null;
    }>({
        visible: false,
        title: '',
        options: null,
    });

    const normalizeVoiceCommandText = (value: string): string =>
        value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const levenshteinDistance = (a: string, b: string): number => {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;

        const matrix: number[][] = Array.from({ length: b.length + 1 }, () => []);

        for (let i = 0; i <= b.length; i += 1) matrix[i][0] = i;
        for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i += 1) {
            for (let j = 1; j <= a.length; j += 1) {
                const cost = b[i - 1] === a[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[b.length][a.length];
    };

    const fuzzyHasKeyword = (normalizedCommand: string, keywords: string[]): boolean => {
        if (!normalizedCommand) return false;
        const tokens = normalizedCommand.split(' ').filter(Boolean);

        for (const keyword of keywords) {
            const normalizedKeyword = normalizeVoiceCommandText(keyword);
            if (!normalizedKeyword) continue;

            if (normalizedCommand.includes(normalizedKeyword)) return true;

            const keywordTokens = normalizedKeyword.split(' ').filter(Boolean);
            if (keywordTokens.length > 1) {
                const phraseMaxDistance = normalizedKeyword.length <= 8 ? 1 : 2;
                const phraseWindow = keywordTokens.length;

                for (let i = 0; i <= tokens.length - phraseWindow; i += 1) {
                    const candidate = tokens.slice(i, i + phraseWindow).join(' ');
                    if (levenshteinDistance(candidate, normalizedKeyword) <= phraseMaxDistance) {
                        return true;
                    }
                }

                continue;
            }

            const maxDistance = normalizedKeyword.length <= 4 ? 1 : normalizedKeyword.length <= 8 ? 2 : 3;
            for (const token of tokens) {
                if (Math.abs(token.length - normalizedKeyword.length) > maxDistance) continue;
                if (levenshteinDistance(token, normalizedKeyword) <= maxDistance) {
                    return true;
                }
            }
        }

        return false;
    };

    const parseVoiceSummaryAudioOptions = (voiceCommand: string): SummaryAudioOptions => {
        const normalizedCmd = normalizeVoiceCommandText(voiceCommand);
        const parsed: SummaryAudioOptions = {
            ...summaryAudioOptions,
            voice: summaryAudioOptions.voice || 'pt_BR-jeff-medium',
            mode: summaryAudioOptions.mode || 'summary',
            bg_id: summaryAudioOptions.bg_id ?? 'lofi_calm',
            bg_volume: summaryAudioOptions.bg_volume ?? 0.10,
        };

        if (fuzzyHasKeyword(normalizedCmd, ['jeff', 'jef', 'geff', 'jefi', 'jefe'])) parsed.voice = 'pt_BR-jeff-medium';
        else if (fuzzyHasKeyword(normalizedCmd, ['faber', 'faberh', 'faberr'])) parsed.voice = 'pt_BR-faber-medium';
        else if (fuzzyHasKeyword(normalizedCmd, ['cadu', 'kadu', 'cado'])) parsed.voice = 'pt_BR-cadu-medium';
        else if (fuzzyHasKeyword(normalizedCmd, ['edresson', 'edreson', 'ederson'])) parsed.voice = 'pt_BR-edresson-low';

        if (fuzzyHasKeyword(normalizedCmd, ['summary', 'sumary', 'sumarry', 'resumo', 'resumir'])) parsed.mode = 'summary';
        else if (fuzzyHasKeyword(normalizedCmd, ['normal', 'padrao'])) parsed.mode = 'normal';
        else if (fuzzyHasKeyword(normalizedCmd, ['fast', 'rapido', 'rapida', 'veloz'])) parsed.mode = 'fast';

        if (fuzzyHasKeyword(normalizedCmd, ['sem musica', 'sem som', 'sem trilha', 'sem fundo'])) {
            parsed.bg_id = null;
        } else if (fuzzyHasKeyword(normalizedCmd, ['lofi calm', 'calm', 'calma', 'calmo'])) {
            parsed.bg_id = 'lofi_calm';
        } else if (fuzzyHasKeyword(normalizedCmd, ['lofi study', 'study', 'estudo', 'stadi'])) {
            parsed.bg_id = 'lofi_study';
        } else if (fuzzyHasKeyword(normalizedCmd, ['lofi jazz', 'jazz'])) {
            parsed.bg_id = 'lofi_jazz';
        } else if (fuzzyHasKeyword(normalizedCmd, ['lofi ambient', 'ambient', 'ambiente'])) {
            parsed.bg_id = 'lofi_ambient';
        } else if (fuzzyHasKeyword(normalizedCmd, ['lofi dreams', 'dreams', 'dream', 'sonho', 'sonhos'])) {
            parsed.bg_id = 'lofi_dreams';
        }

        return parsed;
    };

    const extractSummaryTitleFromVoiceCommand = (voiceCommand: string): string | null => {
        if (!voiceCommand) return null;

        const normalizedCmd = normalizeVoiceCommandText(voiceCommand);
        const titleRegexes = [
            /\btitulo\s*[:=-]?\s*(.+)$/i,
            /\bcom\s+titulo\s*[:=-]?\s*(.+)$/i,
            /\bnome\s*[:=-]?\s*(.+)$/i,
            /\bchama\s+de\s+(.+)$/i,
        ];

        let captured: string | null = null;
        for (const regex of titleRegexes) {
            const match = normalizedCmd.match(regex);
            if (match?.[1]) {
                captured = match[1];
                break;
            }
        }

        if (!captured) return null;

        const splitPattern = /\b(voz|modo|mode|musica|sem\s+musica|trilha|fundo)\b/i;
        const splitIndex = captured.search(splitPattern);
        let titleCandidate = splitIndex >= 0 ? captured.slice(0, splitIndex) : captured;

        titleCandidate = titleCandidate
            .replace(/^['"“”]+|['"“”]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (titleCandidate.length < 3) return null;

        return titleCandidate
            .split(' ')
            .map(word => (word ? word[0].toUpperCase() + word.slice(1) : word))
            .join(' ');
    };

    const openVoiceSummaryConfirmModal = (title: string, options: SummaryAudioOptions) => {
        setVoiceSummaryConfirmModal({
            visible: true,
            title,
            options,
        });
        setFredCommand('Revise o título e diga "confirmar envio" ou clique em confirmar.');
    };

    const closeVoiceSummaryConfirmModal = () => {
        setVoiceSummaryConfirmModal({ visible: false, title: '', options: null });
    };

    const confirmVoiceSummaryShare = async () => {
        const title = voiceSummaryConfirmModal.title?.trim();
        const options = voiceSummaryConfirmModal.options || undefined;
        closeVoiceSummaryConfirmModal();
        await performGenerateAudio(title || undefined, options);
    };

    const getVoiceLabel = (voiceId?: string) => {
        switch (voiceId) {
            case 'pt_BR-jeff-medium': return 'Jeff';
            case 'pt_BR-faber-medium': return 'Faber';
            case 'pt_BR-cadu-medium': return 'Cadu';
            case 'pt_BR-edresson-low': return 'Edresson';
            default: return voiceId || 'Jeff';
        }
    };

    const getModeLabel = (mode?: SummaryAudioOptions['mode']) => {
        switch (mode) {
            case 'summary': return 'Summary';
            case 'normal': return 'Normal';
            case 'fast': return 'Fast';
            default: return 'Summary';
        }
    };

    const getMusicLabel = (bgId?: string | null) => {
        switch (bgId) {
            case null:
            case undefined:
                return 'Sem música';
            case 'lofi_calm':
                return 'Lofi Calm';
            case 'lofi_study':
                return 'Lofi Study';
            case 'lofi_jazz':
                return 'Lofi Jazz';
            case 'lofi_ambient':
                return 'Lofi Ambient';
            case 'lofi_dreams':
                return 'Lofi Dreams';
            default:
                return bgId;
        }
    };

    const closeInputModal = () => setInputModal(prev => ({ ...prev, visible: false }));

    // Video List Modal State (for multiple videos from RAG)
    const [videoListModal, setVideoListModal] = useState<{
        visible: boolean;
        videos: VideoItem[];
    }>({ visible: false, videos: [] });

    // Document List Modal State
    const [documentListModal, setDocumentListModal] = useState<{
        visible: boolean;
        documents: DocumentItem[];
    }>({ visible: false, documents: [] });

    // Help Modal State
    const [showHelpModal, setShowHelpModal] = useState(false);

    // Helper function para limpar texto de resumo (remove tags e trata JSON)
    const cleanSummaryText = (rawText: string | null | undefined): string | null => {
        if (!rawText) return null;

        let text = String(rawText);

        // 1. Remover tags [TYPE:...] em qualquer posição (ex: [TYPE:SUMMARY], [TYPE:CMD], etc.)
        text = text
            .replace(/\[\s*TYPE\s*:\s*[A-Z_]+\s*\]/gi, ' ')
            .replace(/\s{2,}/g, ' ')
            .replace(/[ \t]*\n[ \t]*/g, '\n');

        // 2. Tentar parsear se for JSON com campo "text"
        if (text.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(text);
                if (parsed.text) {
                    text = parsed.text;
                } else if (parsed.summary) {
                    text = parsed.summary;
                }
            } catch (e) {
                // Não é JSON válido, manter como está
            }
        }

        return text.trim();
    };

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
                        setGeneratedSummary(cleanSummaryText(latestSummary.ai_generated_content));
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
                        useNativeDriver: false,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        easing: Easing.ease,
                        useNativeDriver: false,
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
                    recognition.maxAlternatives = 3; // Receber até 3 hipóteses para escolher a melhor

                    // ========== DICIONÁRIO DE CORREÇÕES AUTOMÁTICAS ==========
                    // Mapa de palavras/frases frequentemente mal transcritas → correção
                    const correctionMap: Record<string, string> = {
                        // ============================================================
                        // 1. TRIGGER WORD & VARIAÇÕES
                        // ============================================================
                        'fredi': 'Fred', 'frede': 'Fred', 'fredo': 'Fred',
                        'freed': 'Fred', 'fret': 'Fred', 'fred': 'Fred', 'frete': 'Fred',
                        'frad': 'Fred', 'prad': 'Fred', 'friend': 'Fred',

                        // ============================================================
                        // 2. COMANDOS DE VOZ (VIDEOS, PDF, ZOOM)
                        // ============================================================
                        // Vídeo
                        'vidio': 'vídeo', 'video': 'vídeo', 'videos': 'vídeos',
                        'paly': 'play', 'plei': 'play', 'pleia': 'play', 'toca': 'tocar', 'tocah': 'tocar',
                        'pouse': 'pause', 'pauze': 'pause', 'pausi': 'pause', 'pausa': 'pause',
                        'reniciar': 'reiniciar', 'renicia': 'reiniciar', 'reset': 'resetar',
                        'mute': 'mudo', 'mutar': 'mudo', 'sem som': 'sem som',

                        // PDF / Apresentação
                        'slid': 'slide', 'slaide': 'slide', 'islaide': 'slide', 'slides': 'slides',
                        'proxima': 'próxima', 'procima': 'próxima', 'passa': 'passar',
                        'anterior': 'anterior', 'anterio': 'anterior', 'voltar': 'voltar',
                        'pagina': 'página', 'pg': 'página', 'pag': 'página',
                        'apresentasão': 'apresentação', 'apresentacão': 'apresentação',
                        'documento': 'documento', 'doc': 'documento',

                        // Zoom / Visualização
                        'zom': 'zoom', 'zum': 'zoom', 'zon': 'zoom',
                        'aproxma': 'aproxima', 'aprosima': 'aproxima',
                        'afasta': 'afastar', 'longe': 'longe',
                        'fela': 'tela', 'tel': 'tela',

                        // Ações Gerais
                        'eviar': 'enviar', 'inviar': 'enviar', 'manda': 'enviar',
                        'mosta': 'mostra', 'mustra': 'mostra', 'exibi': 'exibir',
                        'ajuda': 'ajuda', 'help': 'ajuda', 'socorro': 'ajuda',
                        'fecha': 'fechar', 'fexa': 'fechar', 'sai': 'sair',

                        // ============================================================
                        // 3. TERMOS EDUCACIONAIS & CORREÇÕES GERAIS
                        // ============================================================
                        // Termos educacionais
                        'profesora': 'professora', 'profissora': 'professora',
                        'aula de jeje': 'aula de hoje',
                        'pra casa': 'para casa', 'procasa': 'para casa',

                        // Matemática
                        'piteagoras': 'Pitágoras', 'pitagora': 'Pitágoras',
                        'equassão': 'equação', 'equasão': 'equação',
                        'hipotenusa': 'hipotenusa', 'hipotenução': 'hipotenusa',
                        'frasão': 'fração', 'frassão': 'fração',
                        'divição': 'divisão', 'divisao': 'divisão',
                        'multiplição': 'multiplicação', 'multiplicasão': 'multiplicação',
                        'potenssia': 'potência',

                        // Ciências
                        'fotossinteze': 'fotossíntese', 'fotossintese': 'fotossíntese',
                        'molécola': 'molécula', 'molecula': 'molécula',
                        'celula': 'célula', 'celúla': 'célula',

                        // Português / Gramática
                        'substantibo': 'substantivo', 'subistantivo': 'substantivo',
                        'adjetibo': 'adjetivo', 'adgetivo': 'adjetivo',
                        'cunjunção': 'conjunção', 'conjunsão': 'conjunção',
                        'paragrafo': 'parágrafo', 'paragrafu': 'parágrafo',

                        // Palavras comuns mal transcritas
                        'tá bom': 'tá bom', 'tabom': 'tá bom',
                        'neh': 'né', 'ne': 'né',
                        'vamo la': 'vamos lá', 'vamolá': 'vamos lá',
                        'intão': 'então', 'intao': 'então', 'entao': 'então',
                        'voces': 'vocês', 'voçes': 'vocês',
                        'tambem': 'também', 'tanbem': 'também', 'tanbém': 'também',
                    };

                    // Aplicar correções num texto
                    const applyCorrections = (text: string): { corrected: string; corrections: number } => {
                        let corrected = text;
                        let corrections = 0;
                        for (const [wrong, right] of Object.entries(correctionMap)) {
                            // OTIMIZADO: Só cria regex se a palavra estiver no texto (check simples antes)
                            // Mesmo que regex seja rápido, criar milhares de RegExp objetos pode ser pesado em loops rápidos?
                            // Como correctionMap é pequeno (~50 items), não é crítico, mas a verificação de substring é mais barata.
                            if (corrected.toLowerCase().includes(wrong)) {
                                const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
                                const before = corrected;
                                corrected = corrected.replace(regex, right);
                                if (corrected !== before) corrections++;
                            }
                        }
                        return { corrected, corrections };
                    };

                    // Selecionar a melhor alternativa dentre as hipóteses
                    const pickBestAlternative = (result: any): string => {
                        // Se só tem 1 alternativa, corrigir e retornar
                        if (result.length <= 1) {
                            return applyCorrections(result[0].transcript.trim()).corrected;
                        }

                        let bestText = result[0].transcript.trim();
                        let bestScore = -1;

                        for (let a = 0; a < result.length; a++) {
                            const alt = result[a];
                            const text = alt.transcript.trim();
                            if (!text) continue;

                            const confidence = alt.confidence || 0;
                            const { corrected, corrections } = applyCorrections(text);

                            // Score = confiança base + bônus por correções aplicáveis
                            // Se temos correções, a alternativa provavelmente faz mais sentido
                            const score = confidence + (corrections * 0.05);

                            if (score > bestScore) {
                                bestScore = score;
                                bestText = corrected;
                            }
                        }

                        return bestText;
                    };

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
                            // Usar melhor alternativa em vez de sempre pegar a primeira
                            const transcript = result.isFinal
                                ? pickBestAlternative(result)
                                : result[0].transcript.trim();

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

    // Tutorial removido - handler functions

    const toggleRecording = async () => {
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

        const cleanedSummary = cleanSummaryText(generatedSummary);
        if (!cleanedSummary) {
            setFredCommand('Resumo vazio para envio');
            setTimeout(() => setFredCommand(null), 3000);
            return;
        }

        setFredCommand('Enviando resumo para a tela...');

        try {
            await sendToPresentation(presentationCode, 'summary', {
                text: cleanedSummary,
                title: 'Resumo da Aula'
            });
            setFredCommand('✅ Resumo enviado para apresentação!');
            setTimeout(() => setFredCommand(null), 3000);
        } catch (error) {
            setFredCommand('❌ Erro ao enviar resumo');
            setTimeout(() => setFredCommand(null), 3000);
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
                setPresentationContentType(null);
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
        const extractContentFromN8n = (raw: any): any => {
            const deepPick = (value: any): any => {
                if (value === null || value === undefined) return null;
                if (typeof value === 'string') return value;

                if (Array.isArray(value)) {
                    for (const item of value) {
                        const extracted = deepPick(item);
                        if (extracted !== null && extracted !== undefined) return extracted;
                    }
                    return null;
                }

                if (typeof value === 'object') {
                    const priorityKeys = ['output', 'text', 'response', 'result', 'message', 'data'];
                    for (const key of priorityKeys) {
                        if (Object.prototype.hasOwnProperty.call(value, key)) {
                            const extracted = deepPick(value[key]);
                            if (extracted !== null && extracted !== undefined) return extracted;
                        }
                    }

                    for (const key of Object.keys(value)) {
                        const extracted = deepPick(value[key]);
                        if (extracted !== null && extracted !== undefined) return extracted;
                    }
                }

                return null;
            };

            const extracted = deepPick(raw);
            return extracted !== null && extracted !== undefined ? extracted : raw;
        };

        const normalizeN8nText = (value: string) => {
            if (typeof value !== 'string') return value;

            let normalized = value.trim();

            // Handle logs like: [Object: {"output": "..."}]
            const objectWrapperMatch = normalized.match(/^\[Object:\s*([\s\S]+)\]$/i);
            if (objectWrapperMatch?.[1]) {
                try {
                    const parsed = JSON.parse(objectWrapperMatch[1]);
                    if (parsed?.output && typeof parsed.output === 'string') {
                        normalized = parsed.output;
                    }
                } catch { }
            }

            // Handle stringified payloads recursively
            for (let i = 0; i < 3; i++) {
                const candidate = normalized.trim();
                const looksLikeJson =
                    (candidate.startsWith('{') && candidate.endsWith('}')) ||
                    (candidate.startsWith('[') && candidate.endsWith(']'));

                if (!looksLikeJson) break;

                try {
                    const parsed = JSON.parse(candidate);
                    const extracted = extractContentFromN8n(parsed);

                    if (typeof extracted === 'string') {
                        normalized = extracted;
                        continue;
                    }

                    if (extracted && typeof extracted === 'object') {
                        normalized = JSON.stringify(extracted);
                        continue;
                    }

                    break;
                } catch {
                    break;
                }
            }

            normalized = normalized
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\s*\|\|\|\s*/g, '\n');

            if (/(youtube\.com\/watch\?v=|youtu\.be\/)/i.test(normalized)) {
                normalized = normalized
                    .replace(/((?:https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+))(?=[A-Za-zÀ-ÿ0-9])/g, '$1\n')
                    .replace(/[ \t]*\n[ \t]*/g, '\n');
            }

            return normalized.trim();
        };

        const parseQuizFromLooseJson = (raw: string) => {
            if (typeof raw !== 'string') return null;

            const text = raw.replace(/\[TYPE:QUIZ\]/i, '').trim();
            const questionRegex = /"question"\s*:\s*"([\s\S]*?)"\s*,\s*"options"\s*:\s*\[([\s\S]*?)\]\s*,\s*"correct"\s*:\s*([0-4])/g;
            const recoveredQuestions: any[] = [];

            let match: RegExpExecArray | null;
            while ((match = questionRegex.exec(text)) !== null) {
                const questionText = (match[1] || '')
                    .replace(/\\"/g, '"')
                    .replace(/\\n/g, ' ')
                    .trim();

                let optionsRaw = (match[2] || '').trim();
                if (optionsRaw.startsWith('"')) optionsRaw = optionsRaw.slice(1);
                if (optionsRaw.endsWith('"')) optionsRaw = optionsRaw.slice(0, -1);

                const options = optionsRaw
                    .split(/"\s*,\s*"/)
                    .map((option) => option.replace(/\\"/g, '"').replace(/\\n/g, ' ').trim())
                    .filter(Boolean);

                const correct = Number(match[3]);

                if (questionText && options.length >= 2 && Number.isInteger(correct)) {
                    recoveredQuestions.push({
                        question: questionText,
                        options,
                        correct,
                    });
                }
            }

            if (recoveredQuestions.length > 0) {
                return { questions: recoveredQuestions };
            }

            return null;
        };

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
        // Removed blocking check for empty text to allow voice commands with empty transcript


        // Determine Intent for Loading Title
        const promptText = (command || currentText || '').toLowerCase();
        if (/(v[ií]deo|assistir|ver|youtube|busca(r|ndo)|procur(a|ando))/.test(promptText)) {
            setLoadingTitle('Buscando vídeo...');
        } else {
            setLoadingTitle('Gerando com IA...');
        }

        setIsGenerating(true);
        // REMOVED EARLY RESET: setCurrentActivity(null); setGeneratedQuiz(null); -> Moved to after interceptors

        // *** INTERCEPTOR: Comando "ENVIAR" direto (sem gerar novo) ***
        // Se o usuário diz "Envie esse quiz", "Mande o resumo", etc.
        // E já temos uma atividade na tela (currentActivity)
        if (command) {
            const lowerCmd = command.toLowerCase();
            const normalizedCmd = normalizeVoiceCommandText(lowerCmd);
            const isSendIntent = /(envi|emvi|mand|manda|aplic|lanc|disponibiliz|liber|solt)/i.test(normalizedCmd)
                || fuzzyHasKeyword(normalizedCmd, ['enviar', 'manda', 'mandar', 'liberar', 'disponibilizar']);
            const isGenerateIntent = /(ger|cri|faz|mont)/i.test(lowerCmd);

            if (voiceSummaryConfirmModal.visible) {
                const isConfirmVoiceCmd = /(confirm|confirmar|confirma|pode enviar|enviar agora|confirmo|ok|okay|pode ir)/i.test(normalizedCmd)
                    || fuzzyHasKeyword(normalizedCmd, ['confirmar envio', 'pode enviar', 'enviar agora']);
                const isCancelVoiceCmd = /(cancel|cancela|cancelar|nao enviar|não enviar|fechar|voltar|desistir)/i.test(normalizedCmd)
                    || fuzzyHasKeyword(normalizedCmd, ['cancelar envio', 'nao enviar']);
                const voiceTitleEdit = extractSummaryTitleFromVoiceCommand(command);

                if (voiceTitleEdit) {
                    setVoiceSummaryConfirmModal(prev => ({ ...prev, title: voiceTitleEdit }));
                    setFredCommand(`Título atualizado: ${voiceTitleEdit}`);
                    setTimeout(() => setFredCommand(null), 2500);
                    setIsGenerating(false);
                    return;
                }

                if (isConfirmVoiceCmd) {
                    setIsGenerating(false);
                    await confirmVoiceSummaryShare();
                    return;
                }

                if (isCancelVoiceCmd) {
                    closeVoiceSummaryConfirmModal();
                    setFredCommand('Envio cancelado.');
                    setTimeout(() => setFredCommand(null), 2500);
                    setIsGenerating(false);
                    return;
                }

                setFredCommand('Diga "confirmar envio", "cancelar envio" ou "título ...".');
                setTimeout(() => setFredCommand(null), 3000);
                setIsGenerating(false);
                return;
            }

            // 0.1 Controle de Vídeo (Mute/Unmute/Restart) - Prioridade sobre Play/Pause
            // Regex melhorado para MUTE: sem som, mudo, silenciar, tira o som
            // Regex melhorado para MUTE: sem som, mudo, silenciar, tira o som
            if (/\b(sem som|mudo|mutar|silenciar|tira(r?|ndo)\s*(o\s*)?som|desliga(r?|ndo)\s*(o\s*)?som)\b/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Video Mute Command');
                if (presentationCodeRef.current) {
                    controlPresentationVideo(presentationCodeRef.current, 'mute');
                    setFredCommand('Vídeo no mudo...');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }
            }

            // Regex melhorado para UNMUTE: com som, ativar som, ligar som, volta o som, aumenta o som
            // Regex melhorado para UNMUTE: com som, ativar som, ligar som, volta o som, aumenta o som
            if (/\b(com som|desmutar|ativa(r?|ndo)\s*(o\s*)?som|liga(r?|ndo)\s*(o\s*)?som|volta(r?|ndo)\s*(o\s*)?som|aumenta(r?|ndo)\s*(o\s*)?som)\b/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Video Unmute Command');
                if (presentationCodeRef.current) {
                    controlPresentationVideo(presentationCodeRef.current, 'unmute');
                    setFredCommand('Ativando som...');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }
            }

            // SKIP FORWARD (Pular/Avançar)
            // Ex: "Pular 10 segundos", "Avançar 30 segundos", "Vai 15 pra frente"
            const skipMatch = lowerCmd.match(/(pular|avançar|frente|adiantar)\s+(\d+)/i);
            if (skipMatch) {
                const seconds = parseInt(skipMatch[2], 10);
                if (!isNaN(seconds)) {
                    console.log(`[AI INTERCEPTOR] Video Skip Command: +${seconds}s`);
                    if (presentationCodeRef.current) {
                        controlPresentationVideo(presentationCodeRef.current, 'seek_relative', seconds);
                        setFredCommand(`Avançando ${seconds}s...`);
                        setTimeout(() => setFredCommand(null), 3000);
                        setIsGenerating(false);
                        return;
                    }
                }
            }

            // REWIND (Voltar/Retroceder)
            // Ex: "Voltar 10 segundos", "Retroceder 20", "Volta 5"
            const rewindMatch = lowerCmd.match(/(voltar|retroceder|trás|atrás|recuar)\s+(\d+)/i);
            if (rewindMatch) {
                const seconds = parseInt(rewindMatch[2], 10);
                if (!isNaN(seconds)) {
                    console.log(`[AI INTERCEPTOR] Video Rewind Command: -${seconds}s`);
                    if (presentationCodeRef.current) {
                        controlPresentationVideo(presentationCodeRef.current, 'seek_relative', -seconds);
                        setFredCommand(`Voltando ${seconds}s...`);
                        setTimeout(() => setFredCommand(null), 3000);
                        setIsGenerating(false);
                        return;
                    }
                }
            }

            // Regex melhorado para RESTART: reiniciar, resetar, do inicio, voltar tudo, começar de novo
            // Regex melhorado para RESTART: reiniciar, resetar, do inicio, voltar tudo, começar de novo
            if (/\b(reinici(ar?|ando)|reset(ar?|ando)|recomeç(ar?|ando)|(começ(ar?|ando)|ir)\s*(do\s*)?in[íi]cio|volt(ar?|ando)\s*(tudo|ao\s*in[íi]cio))\b/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Video Restart Command');
                if (presentationCodeRef.current) {
                    controlPresentationVideo(presentationCodeRef.current, 'restart');

                    setFredCommand('Reiniciando vídeo...');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }
            }

            // 0.2 Controle de Vídeo (Play/Pause)
            // Regex melhorado para variações: continua/continuar/continue, inicia/iniciar, toca/tocar, video/vídeo
            if (/\b(play|tocar?|continu(ar?|e)|inici(ar?|e)|retom(ar?|e))\b.*\bv[íi]deo\b|\bplay\b/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Video Play Command');
                if (presentationCodeRef.current) {
                    controlPresentationVideo(presentationCodeRef.current, 'play');
                    setFredCommand('Iniciando vídeo...');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                } else {
                    setFredCommand('Sem apresentação ativa');
                    setTimeout(() => setFredCommand(null), 3000);
                    return;
                }
            }

            if (/\b(paus(ar?|e)|parar?|trav(ar?|e))\b.*\bv[íi]deo\b|\bpause\b/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Video Pause Command');
                if (presentationCodeRef.current) {
                    controlPresentationVideo(presentationCodeRef.current, 'pause');
                    setFredCommand('Pausando vídeo...');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                } else {
                    setFredCommand('Sem apresentação ativa');
                    setTimeout(() => setFredCommand(null), 3000);
                    return;
                }
            }


            // 0.3 Compartilhar documento da tela com os alunos
            // Exemplos: "enviar documento para alunos", "mandar arquivo para turma", "compartilhar documento"
            const isShareDocCmd =
                /\b(envi(ar|e)|mand(ar|e)|compartilh(ar|e)|disponibiliz(ar|e)|liber(ar|e)|solt(ar|e))\b.{0,20}\b(documento|arquivo|material|pdf|apostila|slide)\b(?:.{0,20}\b(alunos?|estudantes?|turma|classe)\b)?/i.test(lowerCmd) ||
                /\b(alunos?|estudantes?|turma|classe)\b.{0,20}\b(envi(ar|e)|mand(ar|e)|compartilh(ar|e)|disponibiliz(ar|e)|liber(ar|e)|solt(ar|e))\b.{0,20}\b(documento|arquivo|material|pdf|apostila|slide)\b/i.test(lowerCmd);

            if (isShareDocCmd) {
                console.log('[AI INTERCEPTOR] Comando: Compartilhar documento com alunos');

                if (!presentationCodeRef.current) {
                    setFredCommand('Inicie uma apresentação primeiro!');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }

                let hasDocumentOnScreen = presentationContentType === 'document';

                if (!hasDocumentOnScreen) {
                    try {
                        const { getPresentation } = require('@/services/presentation');
                        const pres = await getPresentation(presentationCodeRef.current);
                        if (pres?.success && pres.current_content?.type === 'document') {
                            hasDocumentOnScreen = true;
                            setPresentationContentType('document');
                        }
                    } catch (error) {
                        console.error('[AI] Erro ao validar documento na tela:', error);
                    }
                }

                if (!hasDocumentOnScreen) {
                    setFredCommand('Nenhum documento na tela');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }

                setFredCommand('Enviando documento para alunos...');

                try {
                    const { sharePresentationDocumentToStudents } = require('@/services/api');
                    const result = await sharePresentationDocumentToStudents(presentationCodeRef.current);

                    if (result.success) {
                        const countText = typeof result.count === 'number' ? ` (${result.count})` : '';
                        setFredCommand(`Documento enviado para alunos${countText}`);
                    } else {
                        setFredCommand(result.error || 'Erro ao compartilhar documento');
                    }
                } catch (error) {
                    console.error('[AI] Erro ao compartilhar documento:', error);
                    setFredCommand('Erro ao compartilhar documento');
                }

                setTimeout(() => setFredCommand(null), 3000);
                setIsGenerating(false);
                return;
            }

            // 0. Enviar para APRESENTAÇÃO (Tela/Projetor)
            // GUARD: Ignorar se mencionar "alunos", "turma", etc. (intento de envio para dispositivos, não tela)
            const isStudentIntent = /\b(alunos?|estudantes?|turma|classe|todos)\b/i.test(lowerCmd);

            if (/\b(apresent(ar?|ação)|projet(ar?|or)|na tela|mostr(ar?|e)\s*na\s*tela)\b/i.test(lowerCmd) && !isStudentIntent) {
                console.log('[AI INTERCEPTOR] Comando de apresentação detectado:', command);

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

            // ========== INTERCEPTOR: Listar Documentos Disponíveis ==========
            // Variações: "quais documentos tem", "lista os arquivos", "mostra os pdfs disponíveis",
            // "quais são os documentos", "me mostra os arquivos", "tem algum documento", "documentos que tem"
            const isListDocsCmd =
                // Padrão 1: verbo + documentos + disponíveis/tem
                /\b(quais?|list(ar?|e)?|mostr(ar?|e)?|ver|exib(ir?|e)?|vej(a|o))\b.{0,15}\b(documentos?|pdfs?|arquivos?|apresentaç(ão|ões)|materiais?)\b/i.test(lowerCmd) &&
                (/\b(dispon[íi]veis?|tem|temos|existem?|h[áa]|tiver)\b/i.test(lowerCmd) || /\bquais?\b/i.test(lowerCmd)) ||
                // Padrão 2: "documentos disponíveis" ou "arquivos que tem"
                /\b(documentos?|pdfs?|arquivos?)\b.{0,10}\b(dispon[íi]veis?|que\s*(tem|temos|existe))\b/i.test(lowerCmd) ||
                // Padrão 3: "quais são os documentos"
                /\bquais?\s*(s[ãa]o)?\s*(os?)?\s*(documentos?|pdfs?|arquivos?)\b/i.test(lowerCmd);

            if (isListDocsCmd) {
                console.log('[AI INTERCEPTOR] Comando: Listar documentos');

                setFredCommand('Buscando documentos...');

                try {
                    const { getSubjectDocuments } = require('@/services/api');

                    // 1. Buscar documentos da disciplina
                    const result = await getSubjectDocuments(subjectId);

                    if (result.success && result.documents && result.documents.length > 0) {
                        // 2. Mostrar modal na tela do professor
                        setDocumentListModal({
                            visible: true,
                            documents: result.documents
                        });

                        // Nota: Lista de documentos exibida apenas para o professor, não na apresentação

                        setFredCommand(`${result.documents.length} documento(s) encontrado(s)!`);
                        setTimeout(() => setFredCommand(null), 3000);
                    } else {
                        setFredCommand('Nenhum documento encontrado');
                        setTimeout(() => setFredCommand(null), 3000);
                    }
                } catch (error) {
                    console.error('[AI] Erro ao listar documentos:', error);
                    setFredCommand('Erro ao buscar documentos');
                    setTimeout(() => setFredCommand(null), 3000);
                }

                setIsGenerating(false);
                return;
            }

            // ========== INTERCEPTOR: Controle de PDF ==========

            // 1. Próxima Página
            // Variações: "próxima página", "passa pra próxima", "avança", "próximo slide",
            // "passa o slide", "vai pra frente", "seguinte", "próxima", "passa"
            const isNextPageCmd =
                // Evitar conflito com vídeo/música
                !/\b(v[íi]deo|m[úu]sica|som)\b/i.test(lowerCmd) && (
                    // "próxima página", "próximo slide"
                    /\b(pr[óo]xim[oa])\b/i.test(lowerCmd) ||
                    // "avançar", "avança", "avance"
                    /\b(avanç(ar?|e|a))\b/i.test(lowerCmd) ||
                    // "passa", "passar", "passe" (sem ser "passar vídeo")
                    /\b(pass(ar?|e|a))\b.{0,10}\b(p[áa]gina|slide|folha|pr[óo]xim)\b/i.test(lowerCmd) ||
                    // "passa" sozinho ou "passa aí"
                    /^\s*(pass(ar?|e|a)|p[áa]gina)\s*(a[íi])?\s*$/i.test(lowerCmd) ||
                    // "vai pra frente", "segue", "seguinte"
                    /\b(seguinte|segue|vai\s*(pra|para)?\s*frente)\b/i.test(lowerCmd)
                );

            if (isNextPageCmd) {
                console.log('[AI INTERCEPTOR] Comando: Próxima página PDF');
                if (presentationCodeRef.current) {
                    pdfNextPage(presentationCodeRef.current);
                    setFredCommand('PDF: Próxima Página');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }
            }

            // 2. Página Anterior
            // Variações: "página anterior", "volta", "voltar página", "volta uma",
            // "vai pra trás", "retrocede", "anterior", "volta aí"
            const isPrevPageCmd =
                // Evitar conflito com vídeo/música e com "voltar X segundos"
                !/\b(v[íi]deo|m[úu]sica|som|segundos?|seg)\b/i.test(lowerCmd) && (
                    // "página anterior", "anterior"
                    /\b(anterior)\b/i.test(lowerCmd) ||
                    // "volta", "voltar" (sem ser "voltar X segundos")
                    /\b(volt(ar?|e|a))\b/i.test(lowerCmd) && !/\d/.test(lowerCmd) ||
                    // "vai pra trás", "pra trás"
                    /\b(tr[áa]s|retrocede(r)?|recua(r)?)\b/i.test(lowerCmd)
                );

            if (isPrevPageCmd) {
                console.log('[AI INTERCEPTOR] Comando: Página anterior PDF');
                if (presentationCodeRef.current) {
                    pdfPreviousPage(presentationCodeRef.current);
                    setFredCommand('PDF: Página Anterior');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }
            }

            // 3. Ir para Página Específica
            // Variações: "vai pra página 5", "página 3", "vai pro slide 2",
            // "abre a página dois", "muda pra 10", "pula pra página 7"
            const gotoPageMatch = lowerCmd.match(
                /\b(ir\s*(pra|para)|vai\s*(pra|para)?|muda\s*(pra|para)?|pula\s*(pra|para)?|abre?\s*(a)?)?\s*(p[áa]gina|slide|folha)\s*(n[úu]mero)?\s*(\d+|uma?|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta)\b/i
            );
            if (gotoPageMatch) {
                console.log('[AI INTERCEPTOR] Comando: Ir para página PDF');
                if (presentationCodeRef.current) {
                    let pageNum = 1;
                    const numStr = gotoPageMatch[gotoPageMatch.length - 1]; // Ultimo grupo capturado

                    if (!isNaN(parseInt(numStr))) {
                        pageNum = parseInt(numStr);
                    } else {
                        // Conversão de texto para número (expandida)
                        const mapNums: { [key: string]: number } = {
                            'um': 1, 'uma': 1,
                            'dois': 2, 'duas': 2,
                            'três': 3, 'tres': 3,
                            'quatro': 4,
                            'cinco': 5,
                            'seis': 6,
                            'sete': 7,
                            'oito': 8,
                            'nove': 9,
                            'dez': 10,
                            'onze': 11, 'doze': 12, 'treze': 13, 'quatorze': 14, 'quinze': 15,
                            'dezesseis': 16, 'dezessete': 17, 'dezoito': 18, 'dezenove': 19,
                            'vinte': 20, 'trinta': 30, 'quarenta': 40, 'cinquenta': 50
                        };
                        pageNum = mapNums[numStr?.toLowerCase()] || 1;
                    }

                    pdfGotoPage(presentationCodeRef.current, pageNum);
                    setFredCommand(`PDF: Página ${pageNum}`);
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }
            }

            // 4. Zoom
            // Variações para AUMENTAR: "aumenta o zoom", "dá zoom", "aproxima", "amplia",
            // "letra maior", "aumenta a letra", "zoom in", "mais perto"
            const isZoomInCmd = /\b(aumenta(r)?|d[áa]|mais|bota(r)?|coloca(r)?)\s*(o\s*)?zoom\b/i.test(lowerCmd) ||
                /\b(aproxima(r)?|amplia(r)?)\b/i.test(lowerCmd) ||
                /\b(letra|fonte|texto)\s*(maior|grande)\b/i.test(lowerCmd) ||
                /\bzoom\s*in\b/i.test(lowerCmd) ||
                /\bmais\s*(perto|grande)\b/i.test(lowerCmd);

            if (isZoomInCmd) {
                if (presentationCodeRef.current) {
                    pdfZoom(presentationCodeRef.current, 'in');
                    setFredCommand('PDF: Aumentar Zoom');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false); return;
                }
            }

            // Variações para DIMINUIR: "diminui o zoom", "tira o zoom", "afasta",
            // "letra menor", "reduz", "zoom out", "mais longe"
            const isZoomOutCmd = /\b(diminu(ir?|i)|tira(r)?|menos|sai(r)?|volta(r)?)\s*(o\s*)?zoom\b/i.test(lowerCmd) ||
                /\b(afasta(r)?|reduz(ir)?)\b/i.test(lowerCmd) ||
                /\b(letra|fonte|texto)\s*(menor|pequen[oa])\b/i.test(lowerCmd) ||
                /\bzoom\s*out\b/i.test(lowerCmd) ||
                /\bmais\s*(longe|pequeno)\b/i.test(lowerCmd);

            if (isZoomOutCmd) {
                if (presentationCodeRef.current) {
                    pdfZoom(presentationCodeRef.current, 'out');
                    setFredCommand('PDF: Diminuir Zoom');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false); return;
                }
            }

            // Variações para ZOOM AUTO: "zoom automático", "ajusta na tela", "cabe na tela",
            // "visão geral", "encaixa", "fit"
            const isZoomAutoCmd = /\bzoom\s*(autom[áa]tico|auto)\b/i.test(lowerCmd) ||
                /\b(ajusta(r)?|cabe(r)?|encaixa(r)?)\s*(na\s*)?tela\b/i.test(lowerCmd) ||
                /\bvis[ãa]o\s*geral\b/i.test(lowerCmd) ||
                /\bfit\b/i.test(lowerCmd);

            if (isZoomAutoCmd) {
                if (presentationCodeRef.current) {
                    pdfZoom(presentationCodeRef.current, 'auto');
                    setFredCommand('PDF: Zoom Automático');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false); return;
                }
            }

            // Variações para TAMANHO REAL: "tamanho real", "100%", "cem por cento", "zoom original"
            if (/\b(tamanho\s*(real|original)|100\s*%|cem\s*por\s*cento|zoom\s*(original|normal))\b/i.test(lowerCmd)) {
                if (presentationCodeRef.current) {
                    pdfZoom(presentationCodeRef.current, 'page-actual');
                    setFredCommand('PDF: Tamanho Real');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false); return;
                }
            }

            // Variações para LARGURA: "ajusta à largura", "largura total", "largura da página"
            if (/\bajusta(r)?\s*(a|à|na)?\s*largura\b|\blargura\s*(total|da\s*p[áa]gina)\b/i.test(lowerCmd)) {
                if (presentationCodeRef.current) {
                    pdfZoom(presentationCodeRef.current, 'page-width');
                    setFredCommand('PDF: Ajustar à Largura');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false); return;
                }
            }

            // ========== INTERCEPTOR: Abrir Documento Específico ==========
            // Variações: "abre o documento 2", "mostra o pdf 1", "exibe o arquivo três",
            // "abre o primeiro documento", "mostra a apostila", "coloca o slide"
            const isOpenDocCmd = /\b(abr(ir?|e|a)|mostr(ar?|e|a)|exib(ir?|e|a)|coloca(r)?|acess(ar?|e|a)|carreg(ar?|ue|a))\b.{0,25}\b(documento|pdf|arquivo|apresentaç[ãa]o|apostila|slide|material)\b/i.test(lowerCmd);
            const isBareOpenDocCmd = /\b(abr(ir?|e|a)|mostr(ar?|e|a)|exib(ir?|e|a)|coloca(r)?|acess(ar?|e|a)|carreg(ar?|ue|a))\b.{0,25}\b(documento|pdf|arquivo|apresentaç[ãa]o|apostila|slide|material)\b\s*$/i.test(lowerCmd);

            if (isOpenDocCmd) {
                console.log('[AI INTERCEPTOR] Comando: Abrir documento');

                if (!presentationCodeRef.current) {
                    setFredCommand('Inicie uma apresentação primeiro!');
                    setTimeout(() => setFredCommand(null), 3000);
                    setIsGenerating(false);
                    return;
                }

                // Mapa de números por extenso (cardinais e ordinais)
                const numberWords: { [key: string]: number } = {
                    'um': 1, 'uma': 1,
                    'dois': 2, 'duas': 2,
                    'três': 3, 'tres': 3,
                    'quatro': 4,
                    'cinco': 5,
                    'seis': 6,
                    'sete': 7,
                    'oito': 8,
                    'nove': 9,
                    'dez': 10,
                    // Ordinais
                    'primeiro': 1, 'primeira': 1,
                    'segundo': 2, 'segunda': 2,
                    'terceiro': 3, 'terceira': 3,
                    'quarto': 4, 'quarta': 4,
                    'quinto': 5, 'quinta': 5,
                    'sexto': 6, 'sexta': 6,
                    'sétimo': 7, 'setimo': 7, 'sétima': 7, 'setima': 7,
                    'oitavo': 8, 'oitava': 8,
                    'nono': 9, 'nona': 9,
                    'décimo': 10, 'decimo': 10, 'décima': 10, 'decima': 10,
                };

                // Extrair número ou nome
                // Ex: "abrir documento 2" ou "abrir documento um" ou "abrir apostila matemática"
                let numberMatch = lowerCmd.match(/\b(documento|pdf|arquivo|apresentação)\s+(\d+)\b/i);

                // Se não encontrou número, tentar número por extenso (cardinal + ordinal após o substantivo)
                if (!numberMatch) {
                    const wordNumberMatch = lowerCmd.match(/\b(documento|pdf|arquivo|apresentação)\s+(um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez|primeiro|primeira|segundo|segunda|terceiro|terceira|quarto|quarta|quinto|quinta|sexto|sexta|s[ée]timo|s[ée]tima|oitavo|oitava|nono|nona|d[ée]cimo|d[ée]cima)\b/i);
                    if (wordNumberMatch) {
                        const wordNumber = wordNumberMatch[2].toLowerCase();
                        const digit = numberWords[wordNumber];
                        if (digit) {
                            // Criar um match fake no formato esperado
                            numberMatch = [wordNumberMatch[0], wordNumberMatch[1], digit.toString()] as any;
                        }
                    }
                }

                // Se não encontrou após o substantivo, tentar ordinal ANTES do substantivo
                // Ex: "abre o primeiro documento", "mostra a segunda apostila"
                if (!numberMatch) {
                    const ordinalBeforeMatch = lowerCmd.match(/\b(primeiro|primeira|segundo|segunda|terceiro|terceira|quarto|quarta|quinto|quinta|sexto|sexta|s[ée]timo|s[ée]tima|oitavo|oitava|nono|nona|d[ée]cimo|d[ée]cima)\s+(documento|pdf|arquivo|apresentaç[ãa]o|apostila|slide|material)\b/i);
                    if (ordinalBeforeMatch) {
                        const ordinalWord = ordinalBeforeMatch[1].toLowerCase();
                        const digit = numberWords[ordinalWord];
                        if (digit) {
                            numberMatch = [ordinalBeforeMatch[0], ordinalBeforeMatch[2], digit.toString()] as any;
                        }
                    }
                }

                const nameMatch = lowerCmd.match(/\b(documento|pdf|arquivo|apresentação)\s+(.+)/i);

                if (numberMatch || nameMatch || isBareOpenDocCmd) {
                    setFredCommand('Procurando documento...');

                    try {
                        const { getSubjectDocuments, sendDocumentToPresentation } = require('@/services/api');

                        // 1. Buscar lista de documentos
                        const result = await getSubjectDocuments(subjectId);

                        console.log('[AI] Documentos encontrados:', result.documents?.length);
                        console.log('[AI] numberMatch:', numberMatch);
                        console.log('[AI] nameMatch:', nameMatch);

                        if (result.success && result.documents && result.documents.length > 0) {
                            let selectedDoc = null;

                            // Buscar por número
                            if (numberMatch) {
                                const index = parseInt(numberMatch[2], 10) - 1; // 1-indexed
                                console.log('[AI] Buscando por índice:', index);
                                if (index >= 0 && index < result.documents.length) {
                                    selectedDoc = result.documents[index];
                                    console.log('[AI] Documento selecionado por número:', selectedDoc.filename);
                                }
                            }
                            // Buscar por nome (fuzzy)
                            else if (nameMatch) {
                                const searchTerm = nameMatch[2].trim().toLowerCase();
                                console.log('[AI] Buscando por nome:', searchTerm);
                                selectedDoc = result.documents.find((doc: any) =>
                                    doc.filename.toLowerCase().includes(searchTerm)
                                );
                                if (selectedDoc) {
                                    console.log('[AI] Documento selecionado por nome:', selectedDoc.filename);
                                }
                            }

                            if (!selectedDoc && isBareOpenDocCmd) {
                                selectedDoc = result.documents[0];
                                if (selectedDoc) {
                                    console.log('[AI] Documento selecionado (primeiro da lista):', selectedDoc.filename);
                                }
                            }

                            if (selectedDoc) {
                                // Close document list modal if open (voice command while viewing list)
                                setDocumentListModal({ visible: false, documents: [] });

                                setFredCommand(`Abrindo "${selectedDoc.filename}"...`);

                                // 2. Enviar documento para apresentação
                                const sendResult = await sendDocumentToPresentation(
                                    selectedDoc.id,
                                    presentationCodeRef.current
                                );

                                if (sendResult.success) {
                                    setPresentationContentType('document');
                                    setFredCommand(`✅ ${selectedDoc.filename} aberto!`);
                                    setTimeout(() => setFredCommand(null), 3000);
                                } else {
                                    setFredCommand('Erro ao abrir documento');
                                    setTimeout(() => setFredCommand(null), 3000);
                                }
                            } else {
                                console.log('[AI] Nenhum documento correspondente encontrado');
                                setFredCommand('Documento não encontrado');
                                setTimeout(() => setFredCommand(null), 3000);
                            }
                        } else {
                            setFredCommand('Nenhum documento disponível');
                            setTimeout(() => setFredCommand(null), 3000);
                        }
                    } catch (error) {
                        console.error('[AI] Erro ao abrir documento:', error);
                        setFredCommand('Erro ao processar comando');
                        setTimeout(() => setFredCommand(null), 3000);
                    }

                    setIsGenerating(false);
                    return;
                }
            }

            // 1. Alternar Respostas do Quiz
            if (/\b(mostr(ar?|e)|exib(ir?|a)|ver)\b.*\b(respostas?|gabarito|correç(ão|ões))\b/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Mostrar respostas');
                setFredCommand('Exibindo respostas...');
                setShowAnswerKey(true);
                setIsGenerating(false);
                setTimeout(() => setFredCommand(null), 2000);
                return;
            }
            if (/\b(escond(er?|e)|ocult(ar?|e)|tir(ar?|e))\b.*\b(respostas?|gabarito|correç(ão|ões))\b/i.test(lowerCmd)) {
                console.log('[AI INTERCEPTOR] Ocultar respostas');
                setFredCommand('Ocultando respostas...');
                setShowAnswerKey(false);
                setIsGenerating(false);
                setTimeout(() => setFredCommand(null), 2000);
                return;
            }

            // 2. Enviar Atividade Atual (Quiz ou Resumo)

            // Se quer enviar, MAS NÃO quer gerar, E temos atividade salva
            // 2. Enviar Atividade Atual (Quiz ou Resumo) (IMPLEMENTAÇÃO ATUALIZADA - SEM ÁUDIO)
            if (isSendIntent && !isGenerateIntent && currentActivity && currentActivity.status !== 'ended') {
                console.log('[AI INTERCEPTOR] Comando de envio direto detectado:', command);
                console.log('[AI INTERCEPTOR] Atividade atual:', currentActivity.id, currentActivity.title, currentActivity.activity_type);

                const act = currentActivity;
                setFredCommand(`Enviando ${act.activity_type === 'quiz' ? 'quiz' : 'resumo'}...`);

                setTimeout(() => {
                    if (act.activity_type === 'quiz') {
                        performStartActivity(act.id, act.title || 'Quiz');
                    } else if (act.activity_type === 'summary') {
                        // SEPARAÇÃO: Enviar SOMENTE texto, sem áudio
                        performShareSummary();
                    }
                    setIsGenerating(false);
                    setFredCommand(null);
                }, 1000);

                return;
            }

            // 2b. Comando de voz para GERAR ÁUDIO INTERATIVO (separado do envio de resumo)
            const matchesGenerateAudio = (normalizedCommand: string): boolean => {
                if (!normalizedCommand) return false;

                // tokens/targets (normalized: accents removed)
                const target = '(?:audio|som|voz|narracao|narracao|tts|podcast)';
                const verb = '(?:gerar|gera|criar|cria|fazer|faz|produzir|produz|gravar|grava|produzir|transformar|converter|quer|quero|gostaria|preciso)';

                const patterns: RegExp[] = [
                    // verb ... target (within ~40 chars)
                    new RegExp('\\b' + verb + '\\b.{0,40}\\b' + target + '\\b'),
                    // direct short command: "gerar audio" / "cria audio" etc
                    new RegExp('\\b(?:gerar|gera|criar|cria|gravar|grava)\\b\\s+\\b' + target + '\\b'),
                    // transform/convert resumo/texto into audio
                    new RegExp('\\b(?:transformar|converter)\\b.{0,40}\\b(?:resumo|texto)\\b.{0,40}\\b' + target + '\\b'),
                    // target near resumo/texto (e.g. "audio do resumo", "resumo em audio")
                    new RegExp('\\b' + target + '\\b.{0,20}\\b(?:resumo|texto)\\b'),
                    new RegExp('\\b(?:resumo|texto)\\b.{0,20}\\b' + target + '\\b'),
                    // desire phrases: "quero um audio", "gostaria de um audio"
                    new RegExp('\\b(?:quero|gostaria|preciso|quer|queria)\\b.{0,20}\\b' + target + '\\b'),
                ];

                for (const r of patterns) {
                    if (r.test(normalizedCommand)) return true;
                }

                return false;
            };

            const isAudioGenerateIntent = matchesGenerateAudio(normalizedCmd);

            if (isAudioGenerateIntent && currentActivity && currentActivity.activity_type === 'summary' && currentActivity.status !== 'ended') {
                console.log('[AI INTERCEPTOR] Comando de geração de áudio detectado:', command);

                const voiceOptions = parseVoiceSummaryAudioOptions(lowerCmd);
                const voiceTitle = extractSummaryTitleFromVoiceCommand(command || '');
                const defaultVoiceTitle = `${subjectName || 'Disciplina'} - resumo em audio`;
                const finalVoiceTitle = voiceTitle || defaultVoiceTitle;

                setFredCommand('Gerando áudio interativo...');
                setIsGenerating(false);

                // Chamar diretamente a geração de áudio (hands-free)
                performGenerateAudio(finalVoiceTitle, voiceOptions);
                return;
            }


        }

        // SE PASSOU PELOS INTERCEPTORES -> VAI GERAR NOVO CONTEÚDO
        setCurrentActivity(null); // RESET: Agora sim limpamos, pois vamos gerar algo novo
        setGeneratedQuiz(null);   // Limpa visualização anterior

        // Não definimos displayMode ainda, esperamos a resposta
        try {
            const buildContextSnippet = (
                text: string,
                headLen: number = 1000,
                midLen: number = 1500,
                tailLen: number = 3000
            ) => {
                if (!text) return '';
                const normalized = text.replace(/\s+/g, ' ').trim();
                const maxLen = headLen + midLen + tailLen + 80;
                if (normalized.length <= maxLen) return normalized;

                const head = normalized.slice(0, headLen);
                const midStart = Math.max(0, Math.floor((normalized.length - midLen) / 2));
                const middle = normalized.slice(midStart, midStart + midLen);
                const tail = normalized.slice(-tailLen);
                return `${head}\n...\n${middle}\n...\n${tail}`;
            };

            // Forçar salvamento antes de gerar
            await updateTranscription(session.id, currentText);

            console.log('[AI] Enviando texto para N8N...');
            // Envia APENAS o texto, sem instrução extra, conforme pedido
            // Agora enviando também classroom_id e comando
            const contextSnippet = buildContextSnippet(currentText || '');
            const n8nResponse = await processText(contextSnippet && contextSnippet.trim().length > 0 ? contextSnippet : null, undefined, {
                classroom_id: subjectName,
                comando: command || null,
                summary_mode: 'head_mid_tail',
                summary_head_len: 1000,
                summary_mid_len: 1500,
                summary_tail_len: 3000,
                full_length: currentText?.length || 0
            });
            console.log('[AI] Resposta do N8N:', JSON.stringify(n8nResponse, null, 2));

            // Extrair conteúdo
            let content = extractContentFromN8n(n8nResponse);
            if (typeof content === 'string') {
                content = normalizeN8nText(content);
            }

            // DETECÇÃO EXPLÍCITA DE TIPO (Solicitado pelo usuário)
            let parsedContent = content;
            let explicitType: 'quiz' | 'summary' | 'command' | 'document' | null = null;

            if (typeof content === 'string') {
                const extractVideoList = (text: string): VideoItem[] => {
                    const urlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+)/gi;
                    const normalizedText = String(text || '')
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n')
                        .replace(/\\n/g, '\n')
                        .replace(/\s*\|\|\|\s*/g, '\n')
                        .replace(/((?:https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+))(?=[A-Za-zÀ-ÿ0-9])/g, '$1\n');

                    const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
                    const videos: VideoItem[] = [];
                    const seen = new Set<string>();

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const matches = Array.from(line.matchAll(urlRegex));
                        if (!matches.length) continue;

                        for (const match of matches) {
                            const url = String(match[0] || '').trim();
                            if (!url || seen.has(url)) continue;

                            let caption = line.replace(urlRegex, '').trim();
                            if (!caption && lines[i - 1] && !urlRegex.test(lines[i - 1])) {
                                caption = lines[i - 1].trim();
                            }
                            if (!caption && lines[i + 1] && !urlRegex.test(lines[i + 1])) {
                                caption = lines[i + 1].trim();
                            }

                            seen.add(url);
                            videos.push({
                                url,
                                caption: caption || 'Video'
                            });
                        }
                    }

                    return videos;
                };

                const cmdMatch = content.match(/\[TYPE:CMD\]/i);
                const sanitizeCommand = (cmd: any) => {
                    if (!cmd || typeof cmd !== 'object') return cmd;

                    if (cmd.action === 'send_content' && cmd.payload?.type === 'video' && typeof cmd.payload?.url === 'string') {
                        return {
                            ...cmd,
                            payload: {
                                ...cmd.payload,
                                url: cmd.payload.url.replace(/\s+/g, '').trim(),
                            },
                        };
                    }

                    return cmd;
                };

                const tryParseCommandJson = (raw: string) => {
                    if (!raw || typeof raw !== 'string') return null;

                    const base = raw.replace(/^\s*\[TYPE:CMD\]\s*/i, '').trim();
                    const candidates: string[] = [base];

                    const firstBrace = base.indexOf('{');
                    const lastBrace = base.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        candidates.push(base.slice(firstBrace, lastBrace + 1));
                    }

                    const repairJson = (value: string) =>
                        value
                            .replace(/[“”]/g, '"')
                            .replace(/[‘’]/g, "'")
                            .replace(/,\s*([}\]])/g, '$1')
                            .replace(/("url"\s*:\s*")([\s\S]*?)(")/gi, (_m, p1, p2, p3) => {
                                const cleanedUrl = String(p2 || '').replace(/\s+/g, '');
                                return `${p1}${cleanedUrl}${p3}`;
                            });

                    for (const candidate of candidates) {
                        try {
                            const parsed = JSON.parse(candidate);
                            if (parsed && parsed.action) return sanitizeCommand(parsed);
                        } catch { }

                        try {
                            const parsed = JSON.parse(repairJson(candidate));
                            if (parsed && parsed.action) return sanitizeCommand(parsed);
                        } catch { }
                    }

                    return null;
                };
                // Detectar [TYPE:DOCUMENT]
                const documentMatch = content.match(/\[TYPE:DOCUMENT\]/i);
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
                                setPresentationContentType('document');
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

                const typeMatch = content.match(/\[TYPE:(QUIZ|SUMMARY)\]/i);

                if (!cmdMatch) {
                    const videos = extractVideoList(content);
                    if (videos.length >= 2) {
                        setVideoListModal({ visible: true, videos });
                        setFredCommand(null);
                        setIsGenerating(false);
                        return;
                    }

                    const directCommandJson = tryParseCommandJson(content) || tryParseJSON(content);
                    if (directCommandJson && directCommandJson.action) {
                        explicitType = 'command';
                        console.log('[AI] Tipo explícito detectado: COMMAND (json direto)');

                        setVideoListModal({ visible: false, videos: [] });
                        processAICommand(sanitizeCommand(directCommandJson));
                        setIsGenerating(false);
                        return;
                    }
                }

                if (cmdMatch) {
                    // *** MULTIPLE VIDEO DETECTION ***
                    // Split content by [TYPE:CMD] to get individual command blocks
                    const cmdBlocks = content.split(/\[TYPE:CMD\]/gi).filter(block => block.trim());
                    const commands: Array<{ action: string; payload: any }> = [];

                    for (const block of cmdBlocks) {
                        try {
                            // Find the JSON object in the block by looking for balanced braces
                            const trimmedBlock = block.trim();
                            const jsonStart = trimmedBlock.indexOf('{');
                            if (jsonStart === -1) continue;

                            // Find matching closing brace by counting braces
                            let braceCount = 0;
                            let jsonEnd = -1;
                            for (let i = jsonStart; i < trimmedBlock.length; i++) {
                                if (trimmedBlock[i] === '{') braceCount++;
                                if (trimmedBlock[i] === '}') braceCount--;
                                if (braceCount === 0) {
                                    jsonEnd = i + 1;
                                    break;
                                }
                            }

                            if (jsonEnd > jsonStart) {
                                const jsonStr = trimmedBlock.substring(jsonStart, jsonEnd);
                                const parsed = tryParseCommandJson(jsonStr);
                                if (parsed && parsed.action) {
                                    commands.push(sanitizeCommand(parsed));
                                }
                            }
                        } catch (e) {
                            console.log('[AI] Failed to parse command block:', block.substring(0, 100));
                        }
                    }

                    console.log(`[AI] Detected ${commands.length} command(s)`);

                    // Filter only video commands
                    const videoCommands = commands.filter(
                        cmd => cmd.action === 'send_content' && cmd.payload?.type === 'video'
                    );

                    // If we have 2+ videos, show selection modal instead of playing
                    if (videoCommands.length >= 2) {
                        console.log(`[AI] Multiple videos detected (${videoCommands.length}), showing selection modal`);

                        const videos: VideoItem[] = videoCommands.map((cmd, idx) => ({
                            url: cmd.payload.url,
                            caption: cmd.payload.caption || `Vídeo ${idx + 1}`
                        }));

                        setVideoListModal({ visible: true, videos });
                        setFredCommand(null);
                        setIsGenerating(false);
                        return; // Don't process further
                    }

                    // Single command: execute immediately (existing behavior)
                    if (commands.length === 1 && commands[0].action) {
                        explicitType = 'command';
                        console.log(`[AI] Tipo explícito detectado: COMMAND`);

                        // Close video list modal if open (voice command while viewing list)
                        setVideoListModal({ visible: false, videos: [] });

                        processAICommand(sanitizeCommand(commands[0]));
                        setIsGenerating(false);
                        return; // Interrompe o fluxo (não salva como atividade normal)
                    }

                    // Fallback: try old parsing method for backwards compatibility
                    explicitType = 'command';
                    content = content.replace(/^\[TYPE:CMD\]/i, '').trim();
                    console.log(`[AI] Tipo explícito detectado: COMMAND (fallback)`);

                    const commandJson = tryParseCommandJson(content) || tryParseJSON(content);
                    if (commandJson && commandJson.action) {
                        processAICommand(sanitizeCommand(commandJson));
                        setIsGenerating(false);
                        return;
                    }
                } else if (typeMatch) {
                    explicitType = typeMatch[1].toUpperCase() === 'QUIZ' ? 'quiz' : 'summary';
                    // Remove a tag para não atrapalhar o parse
                    content = content.replace(/^[\s\S]*?\[TYPE:(QUIZ|SUMMARY)\]/i, '').trim();
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

            // Fallback para payloads de quiz parcialmente inválidos (ex: aspas internas não escapadas)
            if (explicitType === 'quiz') {
                const hasValidQuestions =
                    parsedContent &&
                    typeof parsedContent === 'object' &&
                    Array.isArray(parsedContent.questions) &&
                    parsedContent.questions.length > 0;

                if (!hasValidQuestions && typeof content === 'string') {
                    const recoveredQuiz = parseQuizFromLooseJson(content);
                    if (recoveredQuiz) {
                        console.log('[AI] Quiz recuperado via parser tolerante');
                        parsedContent = recoveredQuiz;
                    }
                }

                const stillInvalidQuiz = !(
                    parsedContent &&
                    typeof parsedContent === 'object' &&
                    Array.isArray(parsedContent.questions) &&
                    parsedContent.questions.length > 0
                );

                if (stillInvalidQuiz) {
                    throw new Error('Quiz inválido retornado pela IA. Tente gerar novamente.');
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
                setGeneratedSummary(cleanSummaryText(textContent));
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
                            // Verificando se já não foi enviado
                            console.log('[AI AUTO-SEND] Triggering performStartActivity');
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
        // Ensure we are NOT calling sendToPresentation here
        console.log('[BROADCAST] This function should NOT trigger presentation display unless backend does so.');
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

    // Compartilhar resumo (somente texto, sem áudio)
    const handleShareSummary = async () => {
        if (!currentActivity) return;
        await performShareSummary();
    };

    // Abrir modal de opções de áudio
    const handleGenerateAudio = async () => {
        if (!currentActivity) return;
        setSummaryAudioModalVisible(true);
    };

    const performShareSummary = async (title?: string) => {
        setFredCommand('Enviando resumo aos alunos...');

        try {
            await shareSummary(currentActivity!.id, title);
            setFredCommand('✅ Resumo enviado aos alunos!');

            setTimeout(() => setFredCommand(null), 3000);
            setShowSummaryModal(false);
            // Retomar sessão
            if (session) {
                await resumeSession(session.id);
            }
        } catch (error) {
            setFredCommand('❌ Erro ao enviar resumo');
            setTimeout(() => setFredCommand(null), 3000);
        }
    };

    // Gerar áudio interativo (processamento IA + TTS)
    const performGenerateAudio = async (title?: string, audioOptions?: SummaryAudioOptions) => {
        setFredCommand('Gerando roteiro conversacional e áudio...');
        setLoadingTitle('Gerando áudio interativo...');
        setIsGenerating(true);

        try {
            const response = await generateActivityAudio(currentActivity!.id, title, {
                voice: audioOptions?.voice,
                mode: audioOptions?.mode,
                bg_id: audioOptions?.bg_id,
                bg_volume: audioOptions?.bg_volume,
            });

            if (response.success) {
                setFredCommand('✅ Áudio interativo gerado e enviado!');
            } else {
                setFredCommand(`⚠️ Erro ao gerar áudio: ${response.error || 'Erro desconhecido'}`);
                Alert.alert('Erro no Áudio', response.error || 'Não foi possível gerar o áudio.');
            }

            setTimeout(() => setFredCommand(null), 4000);
            setSummaryAudioModalVisible(false);
        } catch (error) {
            setFredCommand('❌ Erro ao gerar áudio');
            Alert.alert('Erro', 'Falha na comunicação com o servidor ao gerar áudio.');
            setTimeout(() => setFredCommand(null), 3000);
        } finally {
            setIsGenerating(false);
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
                    if (payload.type === 'video') setPresentationContentType('video');
                    if (Platform.OS === 'web') {
                        // @ts-ignore
                        try { window.navigator.vibrate([100, 50, 100]); } catch (e) { }
                    }
                    setFredCommand('Conteúdo enviado!');
                    setTimeout(() => setFredCommand(null), 3000);
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

    // Handler for selecting a video from the video list modal
    const handleVideoSelect = async (video: VideoItem) => {
        console.log('[VIDEO SELECT] Video chosen:', video.caption, video.url);
        setVideoListModal({ visible: false, videos: [] });
        setFredCommand(`Reproduzindo: ${video.caption}`);

        // Send selected video to presentation using existing processAICommand logic
        await processAICommand({
            action: 'send_content',
            payload: {
                type: 'video',
                url: video.url,
                caption: video.caption
            }
        });

        setTimeout(() => setFredCommand(null), 3000);
    };

    // Handler for selecting a document from the document list modal
    const handleDocumentSelect = async (document: DocumentItem) => {
        console.log('[DOCUMENT SELECT] Document chosen:', document.filename, document.id);
        setDocumentListModal({ visible: false, documents: [] });
        setFredCommand(`Abrindo: ${document.filename}...`);

        try {
            const { sendDocumentToPresentation } = require('@/services/api');

            if (!presentationCodeRef.current) {
                setFredCommand('Inicie uma apresentação primeiro!');
                setTimeout(() => setFredCommand(null), 3000);
                return;
            }

            // Send document to presentation
            const result = await sendDocumentToPresentation(
                document.id,
                presentationCodeRef.current
            );

            if (result.success) {
                setPresentationContentType('document');
                setFredCommand(`Documento "${document.filename}" na tela!`);
            } else {
                setFredCommand('Erro ao abrir documento');
            }
        } catch (error) {
            console.error('[DOCUMENT SELECT] Error:', error);
            setFredCommand('Erro ao abrir documento');
        }

        setTimeout(() => setFredCommand(null), 3000);
    };

    // Tutorial Logic
    // Tutorial removido - checkTutorialStatus functions and useEffect

    const wordCount = transcribedText.split(/\s+/).filter(w => w).length;
    const collapsedPreviewLines = isMobile
        ? 3
        : Math.min(10, Math.max(4, Math.ceil((collapsedPreview || '').length / 56)));

    if (isLoading) {
        return (
            <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Iniciando sessão...</Text>
            </View>
        );
    }

    // Back Button Handler
    const handleBackPress = () => {
        if (!session || session.status === 'ended') {
            // Se não tem sessão ativa, apenas volta
            router.push('/(teacher)/dashboard');
            return;
        }

        // Utiliza Modal customizado em vez de Alert.alert para melhor suporte Web
        setShowExitModal(true);
    };

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
        } else if (route === 'recaps') {
            router.push({
                pathname: '/(teacher)/recaps',
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
                    onPress={handleBackPress}
                >
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{subjectName || 'Transcrição'}</Text>
                    {/* <Text style={styles.headerSubtitle}>{isRecording ? 'Gravando...' : 'Pronto para ouvir'}</Text> */}
                </View>

                {/* Menu Button / Save Indicator / Help */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                        ref={helpButtonRef}
                        style={styles.helpButton}
                        onPress={() => setShowHelpModal(true)}
                    >
                        <MaterialIcons name="help-outline" size={24} color={colors.white} />
                    </TouchableOpacity>
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
                                onPress={() => handleSidebarNavigation('recaps')}
                            >
                                <View style={[styles.sidebarIcon, { backgroundColor: '#fce7f3' }]}>
                                    <MaterialIcons name="history-edu" size={20} color="#ec4899" />
                                </View>
                                <Text style={styles.sidebarLabel}>Recapitulando da Aula</Text>
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

                            {presentationActive && (
                                <TouchableOpacity
                                    style={[styles.sidebarItem, !presentationContentType && { opacity: 0.4 }]}
                                    disabled={!presentationContentType}
                                    onPress={() => {
                                        setSidebarVisible(false);
                                        setShowMediaControls(true);
                                    }}
                                >
                                    <View style={[styles.sidebarIcon, { backgroundColor: presentationContentType ? '#ede9fe' : '#f1f5f9' }]}>
                                        <MaterialIcons
                                            name={presentationContentType === 'video' ? 'play-circle-outline' : presentationContentType === 'document' ? 'description' : 'tune'}
                                            size={20}
                                            color={presentationContentType ? '#7c3aed' : '#94a3b8'}
                                        />
                                    </View>
                                    <View>
                                        <Text style={styles.sidebarLabel}>
                                            {presentationContentType === 'video' ? 'Controles do Vídeo'
                                                : presentationContentType === 'document' ? 'Controles do Documento'
                                                    : 'Controles da Tela'}
                                        </Text>
                                        {!presentationContentType && (
                                            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Nenhum conteúdo ativo</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            )}

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

                            <View style={styles.sidebarDivider} />

                            <TouchableOpacity
                                style={styles.sidebarItem}
                                onPress={handleOpenTutorial}
                            >
                                <View style={[styles.sidebarIcon, { backgroundColor: '#f0fdf4' }]}>
                                    <MaterialIcons name="school" size={20} color="#16a34a" />
                                </View>
                                <Text style={styles.sidebarLabel}>Como usar (Tutorial)</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Media Control Panel */}
            {presentationActive && presentationCode && presentationContentType && (
                <MediaControlPanel
                    code={presentationCode}
                    visible={showMediaControls}
                    contentType={presentationContentType}
                    onClose={() => setShowMediaControls(false)}
                />
            )}

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
                        ref={presentationButtonRef}
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
                {(displayMode !== 'none' || !isMobile || isTranscriptionCollapsed) && (
                    <View style={leftPanelResponsiveStyle}>
                        <View style={styles.panelHeader}>
                            <MaterialIcons
                                name={displayMode === 'quiz' ? 'quiz' : 'summarize'}
                                size={20}
                                color={displayMode === 'quiz' ? colors.primary : colors.secondary}
                            />
                            <Text style={styles.panelTitle}>
                                {displayMode === 'quiz' ? 'Quiz Gerado' : displayMode === 'summary' ? 'Conteúdo Gerado' : 'Aguardando...'}
                            </Text>
                        </View>

                        <ScrollView
                            style={styles.panelScroll}
                            contentContainerStyle={styles.panelScrollContent}
                        >
                            {displayMode === 'summary' && generatedSummary ? (
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
                                                        <Text style={styles.sendSummaryButtonText}>Enviar Resumo</Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.sendSummaryButton, { width: 48, height: 48, marginTop: 0, paddingHorizontal: 0 }]}
                                                    onPress={handleGenerateAudio}
                                                >
                                                    <LinearGradient
                                                        colors={['#8b5cf6', '#6d28d9']}
                                                        style={[styles.sendSummaryButtonGradient, { paddingHorizontal: 0, justifyContent: 'center' }]}
                                                    >
                                                        <MaterialIcons name="headphones" size={22} color={colors.white} />
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
                <View style={rightPanelResponsiveStyle}>
                    <View style={styles.panelHeader}>
                        <View style={styles.transcriptionHeaderLeft}>
                            <MaterialIcons name="mic" size={20} color={colors.primary} />
                            <Text style={styles.panelTitle}>Transcrição</Text>
                        </View>
                        <View style={styles.transcriptionHeaderRight}>
                            <Text
                                style={[
                                    styles.wordCount,
                                    isTranscriptionCollapsed && !isMobile ? styles.wordCountCompactDesktop : null,
                                ]}
                                numberOfLines={1}
                            >
                                {isTranscriptionCollapsed && !isMobile ? `${wordCount}p` : `${wordCount} palavras`}
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.compactButton,
                                    isTranscriptionCollapsed && !isMobile ? styles.compactButtonCollapsedDesktop : null,
                                ]}
                                onPress={toggleTranscriptionCollapse}
                            >
                                <MaterialIcons
                                    name={isTranscriptionCollapsed ? 'expand-more' : 'expand-less'}
                                    size={20}
                                    color={isTranscriptionCollapsed ? colors.primary : colors.slate500}
                                />
                                {!isMobile && !isTranscriptionCollapsed && (
                                    <Text style={[styles.compactButtonText, isTranscriptionCollapsed && styles.compactButtonTextActive]}>
                                        {isTranscriptionCollapsed ? 'Expandir' : 'Compactar'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            {transcribedText.length > 0 && (
                                <TouchableOpacity onPress={handleClearTranscription}>
                                    <MaterialIcons name="delete-outline" size={20} color={colors.slate400} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {isTranscriptionCollapsed ? (
                        <TouchableOpacity
                            style={[
                                styles.transcriptionCollapsedInfo,
                                !isMobile ? styles.transcriptionCollapsedInfoDesktop : null,
                            ]}
                            activeOpacity={0.8}
                            onPress={expandTranscription}
                        >
                            <View style={styles.collapsedHeaderRow}>
                                <View style={styles.collapsedBadge}>
                                    <MaterialIcons name={isRecording ? 'fiber-manual-record' : 'article'} size={14} color={isRecording ? '#ef4444' : colors.primary} />
                                    <Text style={styles.collapsedBadgeText}>{isRecording ? 'Gravando' : 'Transcrição'}</Text>
                                </View>
                            </View>

                            <View style={styles.collapsedPreviewContainer}>
                                <Text
                                    style={[
                                        styles.collapsedPreviewText,
                                        !isMobile ? styles.collapsedPreviewTextDesktop : null,
                                    ]}
                                    numberOfLines={collapsedPreviewLines}
                                >
                                    {collapsedPreview || 'Nenhum conteúdo transcrito ainda.'}
                                </Text>
                            </View>

                            <Text style={styles.collapsedMetaText}>
                                {wordCount} palavras • {isRecording ? '🎤 Ditando em tempo real' : '📝 Pronto para edição'}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <>
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
                        </>
                    )}
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

            <SummaryAudioOptionsModal
                visible={summaryAudioModalVisible}
                initialTitle={`${subjectName || 'Disciplina'} - resumo em audio`}
                initialValue={summaryAudioOptions}
                onCancel={() => {
                    setSummaryAudioModalVisible(false);
                }}
                onConfirm={({ title, options }) => {
                    setSummaryAudioOptions(options);
                    setSummaryAudioModalVisible(false);
                    performGenerateAudio(title || undefined, options);
                }}
            />

            <Modal
                visible={voiceSummaryConfirmModal.visible}
                transparent
                animationType="fade"
                onRequestClose={closeVoiceSummaryConfirmModal}
            >
                <View style={styles.voiceConfirmOverlay}>
                    <View style={styles.voiceConfirmContainer}>
                        <View style={styles.voiceConfirmHeader}>
                            <Text style={styles.voiceConfirmTitle}>Confirmar envio do resumo</Text>
                            <TouchableOpacity onPress={closeVoiceSummaryConfirmModal}>
                                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.voiceConfirmLabel}>Título final</Text>
                        <TextInput
                            value={voiceSummaryConfirmModal.title}
                            onChangeText={(value) => setVoiceSummaryConfirmModal(prev => ({ ...prev, title: value }))}
                            placeholder="Digite o título"
                            placeholderTextColor={colors.slate400}
                            style={styles.voiceConfirmInput}
                        />

                        <Text style={styles.voiceConfirmHint}>
                            Você também pode dizer: "título ..." e depois "confirmar envio".
                        </Text>

                        <Text style={styles.voiceConfirmAudioLine}>
                            Áudio final: voz {getVoiceLabel(voiceSummaryConfirmModal.options?.voice)} · modo {getModeLabel(voiceSummaryConfirmModal.options?.mode)} · música {getMusicLabel(voiceSummaryConfirmModal.options?.bg_id)}
                        </Text>

                        <View style={styles.voiceConfirmActions}>
                            <TouchableOpacity style={styles.voiceConfirmCancel} onPress={closeVoiceSummaryConfirmModal}>
                                <Text style={styles.voiceConfirmCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.voiceConfirmButton, !voiceSummaryConfirmModal.title.trim() && styles.voiceConfirmButtonDisabled]}
                                disabled={!voiceSummaryConfirmModal.title.trim()}
                                onPress={confirmVoiceSummaryShare}
                            >
                                <Text style={styles.voiceConfirmButtonText}>Confirmar envio</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Custom Exit Modal */}
            <Modal
                visible={showExitModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowExitModal(false)}
            >
                <View style={styles.overlay}>
                    <View style={styles.exitModalContainer}>
                        <View style={styles.exitModalHeader}>
                            <Text style={styles.exitModalTitle}>Sair da Aula</Text>
                            <TouchableOpacity onPress={() => setShowExitModal(false)}>
                                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.exitModalMessage}>Como você deseja sair desta aula?</Text>

                        <View style={styles.exitModalButtons}>
                            <TouchableOpacity
                                style={styles.exitModalButtonSecondary}
                                onPress={() => {
                                    setShowExitModal(false);
                                    router.push('/(teacher)/dashboard');
                                }}
                            >
                                <MaterialIcons name="logout" size={20} color={colors.textPrimary} />
                                <Text style={styles.exitModalButtonSecondaryText}>Apenas Sair</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.exitModalButtonPrimary}
                                onPress={async () => {
                                    setShowExitModal(false);
                                    try {
                                        setFredCommand('Encerrando sessão e gerando Recapitulando...');
                                        setIsGenerating(true);
                                        const result = await endTranscriptionSession(session?.id || 0);
                                        if (result.success) {
                                            setFredCommand('Sessão encerrada com sucesso!');
                                            setTimeout(() => {
                                                setFredCommand(null);
                                                setIsGenerating(false);

                                                // Redireciona diretamente para a tela de Recaps daquela disciplina
                                                router.replace({
                                                    pathname: '/(teacher)/recaps',
                                                    params: {
                                                        subjectId: session?.subject_id?.toString() || params.subjectId,
                                                        subjectName: subjectName
                                                    }
                                                });
                                            }, 2000);
                                        } else {
                                            throw new Error('Falha');
                                        }
                                    } catch (error) {
                                        setFredCommand(null);
                                        setIsGenerating(false);
                                        Alert.alert('Erro', 'Não foi possível encerrar a sessão neste momento.');
                                        router.push('/(teacher)/dashboard');
                                    }
                                }}
                            >
                                <MaterialIcons name="check-circle" size={20} color={colors.white} />
                                <Text style={styles.exitModalButtonPrimaryText}>Encerrar e Gerar síntese da aula</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xs }]}>


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
                            <MaterialIcons name="history" size={20} color={colors.white} />
                            <Text style={styles.buttonLabel}>Histórico</Text>
                        </LinearGradient>
                    </TouchableOpacity>


                    {/* Botão de Gravação (Centralizado e Maior) */}
                    <Animated.View style={[{ transform: [{ scale: pulseAnim }] }, styles.recordButtonWrapper]}>
                        <TouchableOpacity
                            ref={micButtonRef}
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
                                    size={26}
                                    color={colors.white}
                                />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Espaço vazio para manter alinhamento se necessário, ou remover */}
                    <View style={{ width: 48 }} />

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
            <VideoListModal
                visible={videoListModal.visible}
                videos={videoListModal.videos}
                onSelect={handleVideoSelect}
                onClose={() => setVideoListModal({ visible: false, videos: [] })}
            />
            <DocumentListModal
                visible={documentListModal.visible}
                documents={documentListModal.documents}
                onSelect={handleDocumentSelect}
                onClose={() => setDocumentListModal({ visible: false, documents: [] })}
            />
            <FredHelpModal
                visible={showHelpModal}
                onClose={() => setShowHelpModal(false)}
            />
            <FredCommandOverlay />
            <TutorialOverlay
                visible={showTutorial}
                steps={tutorialSteps}
                onClose={() => setShowTutorial(false)}
                onFinish={handleFinishTutorial}
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
    menuButton: {
        padding: 4,
    },
    helpButton: {
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
        flexShrink: 1,
    },
    wordCountCompactDesktop: {
        minWidth: 34,
        textAlign: 'right',
        fontSize: typography.fontSize.xs,
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
    rightPanelCollapsedDesktop: {
        flex: 0,
        width: 290,
        minWidth: 260,
        maxWidth: 320,
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
    transcriptionHeaderLeft: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    transcriptionHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    panelScroll: {
        flex: 1,
    },
    panelScrollContent: {
        padding: spacing.lg,
        flexGrow: 1,
    },
    compactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: colors.primaryOpacity20,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: colors.primaryOpacity30,
        minWidth: 38,
    },
    compactButtonCollapsedDesktop: {
        paddingHorizontal: 6,
    },
    compactButtonText: {
        fontSize: typography.fontSize.sm,
        color: colors.primary,
        fontWeight: typography.fontWeight.medium,
    },
    compactButtonTextActive: {
        color: colors.primary,
    },
    transcriptionInfo: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
        alignItems: 'center',
    },
    transcriptionCollapsedInfo: {
        flex: 1,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.base,
        gap: spacing.sm,
    },
    transcriptionCollapsedInfoDesktop: {
        paddingVertical: spacing.md,
        minHeight: 0,
    },
    collapsedHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    collapsedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.slate100,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
    },
    collapsedBadgeText: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        fontWeight: typography.fontWeight.semibold,
    },
    collapsedPreviewText: {
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        lineHeight: 20,
    },
    collapsedPreviewContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    collapsedPreviewTextDesktop: {
        fontSize: typography.fontSize.base,
        lineHeight: 22,
    },
    collapsedMetaText: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        marginTop: spacing.xs,
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
        paddingTop: spacing.sm,
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
        width: 56,
        height: 56,
        borderRadius: 28,
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
        width: 48,
        height: 48,
        borderRadius: 24,
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
        marginTop: spacing.xs,
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
    voiceConfirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    voiceConfirmContainer: {
        width: '100%',
        maxWidth: 560,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.sm,
    },
    voiceConfirmHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    voiceConfirmTitle: {
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.bold,
        fontSize: typography.fontSize.lg,
    },
    voiceConfirmLabel: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    voiceConfirmInput: {
        borderWidth: 1,
        borderColor: colors.slate300,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        color: colors.textPrimary,
        fontSize: typography.fontSize.base,
        minHeight: 44,
    },
    voiceConfirmHint: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs,
    },
    voiceConfirmAudioLine: {
        color: colors.textPrimary,
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs,
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    voiceConfirmActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    voiceConfirmCancel: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    voiceConfirmCancelText: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
    },
    voiceConfirmButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    voiceConfirmButtonDisabled: {
        opacity: 0.5,
    },
    voiceConfirmButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
        fontSize: typography.fontSize.base,
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
        padding: spacing.sm,
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

    // Exit Modal Styles
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9998,
    },
    exitModalContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        width: '90%',
        maxWidth: 400,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
            web: {
                boxShadow: '0px 10px 30px rgba(0,0,0,0.1)',
            }
        })
    },
    exitModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    exitModalTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    exitModalMessage: {
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    exitModalButtons: {
        gap: spacing.md,
    },
    exitModalButtonPrimary: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    exitModalButtonPrimaryText: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
    },
    exitModalButtonSecondary: {
        flexDirection: 'row',
        backgroundColor: colors.slate50,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.slate200,
        gap: spacing.sm,
    },
    exitModalButtonSecondaryText: {
        color: colors.textPrimary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
});
