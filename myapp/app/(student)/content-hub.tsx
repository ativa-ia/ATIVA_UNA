import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    TextInput,
    Animated,
    LayoutAnimation,
    UIManager,
    Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Audio, AVPlaybackStatus } from 'expo-av';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getStudentHistory, getSubjectMaterials, getStudentMaterials, getAudioMaterialSignedUrl, getSubjectRecaps, LessonRecap } from '@/services/api';
import { FolderCard } from '@/components/cards/FolderCard';
import { Material } from '@/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============ TYPES ============

interface ActivityHistoryItem {
    activity: {
        id: number;
        title: string;
        activity_type: 'quiz' | 'summary' | 'open_question';
        created_at: string;
        content: any;
        ai_generated_content: string;
    };
    status: 'completed' | 'in_progress' | 'missed' | 'pending';
    my_score?: number;
    my_percentage?: number;
}

interface StructuredSummary {
    _format: 'structured';
    topic: string;
    essential_concept: string;
    key_points: string[];
    practical_example: string;
    common_mistakes?: string[];
    reflection: string;
}

type FolderType = 'quizzes' | 'resumos' | 'suporte' | 'audio' | 'recaps' | null;
type SearchableFolder = Exclude<FolderType, null>;

// ============ FOLDER CONFIG ============

const FOLDER_CONFIG = {
    quizzes: {
        title: 'Quizzes',
        icon: 'quiz' as keyof typeof MaterialIcons.glyphMap,
        color: '#4f46e5',
    },
    resumos: {
        title: 'Resumos',
        icon: 'sticky-note-2' as keyof typeof MaterialIcons.glyphMap,
        color: '#F59E0B',
    },
    suporte: {
        title: 'Material de Reforço',
        icon: 'menu-book' as keyof typeof MaterialIcons.glyphMap,
        color: '#10b981',
    },
    audio: {
        title: 'Áudio & Podcasts',
        icon: 'headphones' as keyof typeof MaterialIcons.glyphMap,
        color: '#8b5cf6',
    },
    recaps: {
        title: 'Recaps da Aula',
        icon: 'history-edu' as keyof typeof MaterialIcons.glyphMap,
        color: '#ec4899', // Pink
    },
};

// ============ MAIN COMPONENT ============

export default function ContentHubScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectId = parseInt(params.subjectId as string) || 0;
    const subjectName = params.subjectName as string || 'Disciplina';

    // Data state
    const [loading, setLoading] = useState(true);
    const [quizzes, setQuizzes] = useState<ActivityHistoryItem[]>([]);
    const [summaries, setSummaries] = useState<ActivityHistoryItem[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [audioMaterials, setAudioMaterials] = useState<Material[]>([]);
    const [recaps, setRecaps] = useState<LessonRecap[]>([]);

    // UI state
    const [openFolder, setOpenFolder] = useState<FolderType>(null);
    const [folderSearch, setFolderSearch] = useState<Record<SearchableFolder, string>>({
        quizzes: '',
        resumos: '',
        suporte: '',
        audio: '',
        recaps: '',
    });
    const [exportingId, setExportingId] = useState<number | null>(null);
    const [exportingMaterialId, setExportingMaterialId] = useState<number | string | null>(null);
    const [audioModalVisible, setAudioModalVisible] = useState(false);
    const [audioLoading, setAudioLoading] = useState(false);
    const [selectedAudio, setSelectedAudio] = useState<{ id: string; title: string; url: string } | null>(null);
    const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioPositionMs, setAudioPositionMs] = useState(0);
    const [audioDurationMs, setAudioDurationMs] = useState(0);
    const [summaryDetailItem, setSummaryDetailItem] = useState<ActivityHistoryItem | null>(null);
    const [quizDetailItem, setQuizDetailItem] = useState<ActivityHistoryItem | null>(null);
    const [showQuizAnswers, setShowQuizAnswers] = useState(false);
    const [supportViewerData, setSupportViewerData] = useState<{ title: string; content: string } | null>(null);
    const [supportViewerLoading, setSupportViewerLoading] = useState(false);

    // ============ DATA LOADING ============

    useEffect(() => {
        loadAllData();
    }, [subjectId]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Load history (quizzes + summaries) and materials in parallel
            const [historyRes, materialsRes, studentMaterialsRes, recapsRes] = await Promise.all([
                getStudentHistory(subjectId, 1, 50).catch(() => ({ success: false, history: [] })),
                getSubjectMaterials(subjectId).catch(() => []),
                getStudentMaterials().catch(() => []),
                getSubjectRecaps(subjectId).catch(() => ({ success: false, recaps: [] })),
            ]);

            if (historyRes.success && historyRes.history) {
                const items: ActivityHistoryItem[] = historyRes.history;
                setQuizzes(items.filter(i => i.activity.activity_type === 'quiz'));
                setSummaries(items.filter(i => i.activity.activity_type === 'summary'));
            }

            if (recapsRes && recapsRes.success && recapsRes.recaps) {
                setRecaps(recapsRes.recaps);
            }

            const studentMaterials = Array.isArray(studentMaterialsRes) ? studentMaterialsRes : [];

            const baseMaterials = (materialsRes as Material[]) || [];

            // Extract non-audio personal materials for this subject (e.g. low quiz score support)
            const personalSupportMaterials = studentMaterials.filter((item: any) => {
                const isCurrentSubject = (item.subjectId && subjectId) ? item.subjectId === subjectId : item.subject === subjectName;
                return isCurrentSubject && item.type !== 'audio' && item.source === 'personal';
            });

            // Add a unique source property to base materials if they don't have one to prevent key clashes
            const materialsWithSource = baseMaterials.map(m => ({ ...m, source: (m as any).source || 'class' }));

            setMaterials([...materialsWithSource, ...personalSupportMaterials]);

            const audioOnly = studentMaterials.filter((item) => {
                if (item.type !== 'audio') return false;
                if (item.subjectId && subjectId) return item.subjectId === subjectId;
                return item.subject === subjectName;
            });
            setAudioMaterials(audioOnly);
        } catch (error) {
            console.error('Erro ao carregar conteúdo:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============ FOLDER TOGGLE ============

    const toggleFolder = (folder: FolderType) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenFolder(prev => prev === folder ? null : folder);
    };

    // ============ DATE FORMATTING ============

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const normalizeSearchText = (value: string) =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

    const matchesSearch = (query: string, values: Array<string | number | null | undefined>) => {
        const normalizedQuery = normalizeSearchText(query);
        if (!normalizedQuery) return true;

        return values.some((value) => normalizeSearchText(String(value || '')).includes(normalizedQuery));
    };

    const sanitizeSummaryText = (rawText: any): string => {
        if (rawText == null) return 'Sem conteúdo';

        let text = String(rawText).trim();

        text = text
            .replace(/^\s*\[\s*TYPE\s*:\s*SUM\w*\s*\]\s*/i, '')
            .replace(/^\s*\[\s*TYPE\s*:\s*\w+\s*\]\s*/i, '')
            .trim();

        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                const parsed = JSON.parse(text);
                if (typeof parsed === 'string') {
                    text = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    text = String(
                        parsed.summary_text
                        || parsed.summary
                        || parsed.text
                        || parsed.output
                        || ''
                    );
                }
            } catch {
                text = text
                    .replace(/^\{\s*"text"\s*:\s*"?/i, '')
                    .replace(/"\s*\}\s*$/i, '')
                    .replace(/^"|"$/g, '');
            }
        }

        text = text.replace(/\\n/g, '\n').trim();
        return text || 'Sem conteúdo';
    };

    /** Tenta extrair dados estruturados do content de uma atividade de resumo */
    const parseStructuredSummary = (item: ActivityHistoryItem): StructuredSummary | null => {
        const content = item.activity.content;
        if (content && typeof content === 'object' && content._format === 'structured' && content.topic) {
            return content as StructuredSummary;
        }
        // Tenta parsear o ai_generated_content como JSON estruturado (fallback)
        try {
            const raw = item.activity.ai_generated_content;
            if (raw && raw.trim().startsWith('{')) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.topic) {
                    return { ...parsed, _format: 'structured' } as StructuredSummary;
                }
            }
        } catch { /* ignore */ }
        return null;
    };

    // ============ PDF GENERATION ============

    const generateQuizHTML = (item: ActivityHistoryItem) => {
        const { activity, my_percentage } = item;
        const date = formatDate(activity.created_at);
        const questions = activity.content?.questions || [];

        const questionsHtml = questions.map((q: any, index: number) => `
            <div class="question">
                <p class="q-title"><strong>Questão ${index + 1}:</strong> ${q.question}</p>
                <ul class="options">
                    ${q.options.map((opt: string, i: number) => `
                        <li class="${i === q.correct ? 'correct' : ''}">
                            ${String.fromCharCode(65 + i)}) ${opt}
                        </li>
                    `).join('')}
                </ul>
                <p class="answer"><em>Resposta correta: ${String.fromCharCode(65 + q.correct)}</em></p>
            </div>
        `).join('');

        return `
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    body { font-family: 'Helvetica', sans-serif; color: #333; padding: 20px; }
                    h1 { color: #4f46e5; margin-bottom: 5px; }
                    .meta { color: #666; font-size: 14px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                    .question { margin-bottom: 20px; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
                    .q-title { margin-top: 0; }
                    .options { list-style: none; padding-left: 0; }
                    .options li { padding: 5px 0; }
                    .options li.correct { color: #16a34a; font-weight: bold; }
                    .answer { color: #16a34a; font-size: 14px; margin-top: 5px; }
                    .score-card { background: #e0e7ff; padding: 10px; border-radius: 6px; text-align: center; margin-bottom: 20px; font-size: 18px; color: #3730a3; }
                </style>
            </head>
            <body>
                <h1>${activity.title}</h1>
                <div class="meta">
                    <p>Disciplina: ${subjectName}</p>
                    <p>Data: ${date}</p>
                </div>
                <div class="score-card">
                    Nota obtida: <strong>${(my_percentage != null) ? Math.round(my_percentage) : 0}%</strong>
                </div>
                ${questionsHtml}
            </body>
            </html>
        `;
    };

    const generateSummaryHTML = (item: ActivityHistoryItem) => {
        const { activity } = item;
        const date = formatDate(activity.created_at);
        const structured = parseStructuredSummary(item);

        if (structured) {
            const keyPointsHtml = (structured.key_points || []).map(p => `<li>${p}</li>`).join('');
            const mistakesHtml = (structured.common_mistakes || []).map(m => `<li>${m}</li>`).join('');
            return `
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 24px; line-height: 1.7; background: #f8fafc; }
                    h1 { color: #4f46e5; margin-bottom: 4px; font-size: 22px; }
                    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
                    .section { margin-bottom: 20px; padding: 16px; border-radius: 10px; }
                    .concept { background: linear-gradient(135deg, #eef2ff, #e0e7ff); border-left: 4px solid #4f46e5; }
                    .concept h2 { color: #4f46e5; font-size: 16px; margin: 0 0 8px 0; }
                    .concept p { font-size: 15px; margin: 0; }
                    .points { background: #f0fdf4; border-left: 4px solid #22c55e; }
                    .points h2 { color: #16a34a; font-size: 16px; margin: 0 0 8px 0; }
                    .points ul { margin: 0; padding-left: 20px; }
                    .points li { margin-bottom: 6px; font-size: 14px; }
                    .example { background: #fffbeb; border-left: 4px solid #f59e0b; }
                    .example h2 { color: #d97706; font-size: 16px; margin: 0 0 8px 0; }
                    .example p { font-size: 15px; margin: 0; }
                    .mistakes { background: #fef2f2; border-left: 4px solid #ef4444; }
                    .mistakes h2 { color: #dc2626; font-size: 16px; margin: 0 0 8px 0; }
                    .mistakes ul { margin: 0; padding-left: 20px; }
                    .mistakes li { margin-bottom: 6px; font-size: 14px; }
                    .reflection { background: #faf5ff; border-left: 4px solid #a855f7; }
                    .reflection h2 { color: #9333ea; font-size: 16px; margin: 0 0 8px 0; }
                    .reflection p { font-size: 15px; margin: 0; font-style: italic; }
                </style>
            </head>
            <body>
                <h1>${structured.topic}</h1>
                <div class="meta">
                    <p>Disciplina: ${subjectName} · Data: ${date}</p>
                </div>
                <div class="section concept">
                    <h2>📖 Conceito Essencial</h2>
                    <p>${structured.essential_concept.replace(/\n/g, '<br>')}</p>
                </div>
                ${keyPointsHtml ? `<div class="section points"><h2>✅ Pontos-Chave</h2><ul>${keyPointsHtml}</ul></div>` : ''}
                <div class="section example">
                    <h2>💡 Exemplo Prático</h2>
                    <p>${structured.practical_example.replace(/\n/g, '<br>')}</p>
                </div>
                ${mistakesHtml ? `<div class="section mistakes"><h2>⚠️ Erros Comuns</h2><ul>${mistakesHtml}</ul></div>` : ''}
                <div class="section reflection">
                    <h2>🤔 Para Refletir</h2>
                    <p>${structured.reflection}</p>
                </div>
            </body>
            </html>`;
        }

        // Fallback: formato legado
        const summaryText = sanitizeSummaryText(activity.content?.summary_text || activity.ai_generated_content);
        const formattedText = summaryText.replace(/\n/g, '<br>');
        return `
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    body { font-family: 'Helvetica', sans-serif; color: #333; padding: 20px; line-height: 1.6; }
                    h1 { color: #F59E0B; margin-bottom: 5px; }
                    .meta { color: #666; font-size: 14px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                    .summary-box { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 16px; }
                </style>
            </head>
            <body>
                <h1>${activity.title}</h1>
                <div class="meta">
                    <p>Disciplina: ${subjectName}</p>
                    <p>Data: ${date}</p>
                </div>
                <div class="summary-box">
                    ${formattedText}
                </div>
            </body>
            </html>
        `;
    };

    const handleExportPDF = async (item: ActivityHistoryItem) => {
        try {
            setExportingId(item.activity.id);
            const isQuiz = item.activity.activity_type === 'quiz';
            const html = isQuiz ? generateQuizHTML(item) : generateSummaryHTML(item);

            if (Platform.OS === 'web') {
                const printWindow = window.open('', '', 'width=800,height=600');
                if (printWindow) {
                    printWindow.document.write(html);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => printWindow.print(), 500);
                } else {
                    Alert.alert('Atenção', 'Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
                }
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
        } catch (error) {
            console.error('Erro PDF:', error);
            Alert.alert('Erro', 'Falha ao gerar PDF.');
        } finally {
            setExportingId(null);
        }
    };

    const handleMaterialExportPDF = async (material: Material) => {
        try {
            if (!material.url) return;
            setExportingMaterialId(material.id);
            const { API_URL } = require('@/services/api');
            let fullUrl = material.url;
            if (!material.url.startsWith('http')) {
                const baseUrl = API_URL.replace('/api', '');
                fullUrl = `${baseUrl}${material.url}`;
            }

            let textContent = '';
            try {
                const res = await fetch(fullUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                textContent = await res.text();
            } catch (fetchErr) {
                console.error('Erro ao buscar conteúdo para PDF:', fetchErr);
                Alert.alert('Erro', 'Não foi possível baixar o conteúdo do material.');
                return;
            }

            const formattedText = textContent
                .replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');

            const uploadDateStr = (material as any).uploadDate ? formatDate((material as any).uploadDate) : '';

            const html = `
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 24px; line-height: 1.7; background: #f8fafc; }
                    h1 { color: #10b981; margin-bottom: 4px; font-size: 22px; }
                    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
                    .content-box { background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 15px; }
                </style>
            </head>
            <body>
                <h1>${material.title}</h1>
                <div class="meta">
                    <p>Disciplina: ${subjectName} ${uploadDateStr ? '· Data: ' + uploadDateStr : ''}</p>
                </div>
                <div class="content-box">
                    ${formattedText}
                </div>
            </body>
            </html>
            `;

            if (Platform.OS === 'web') {
                const printWindow = window.open('', '', 'width=800,height=600');
                if (printWindow) {
                    printWindow.document.write(html);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => printWindow.print(), 500);
                } else {
                    Alert.alert('Atenção', 'Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
                }
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
        } catch (error) {
            console.error('Erro PDF Material:', error);
            Alert.alert('Erro', 'Falha ao gerar PDF do material.');
        } finally {
            setExportingMaterialId(null);
        }
    };

    // ============ MATERIAL HANDLING ============

    const handleMaterialPress = async (material: Material) => {
        if (!material.url) {
            Alert.alert('Erro', 'Link do material não disponível');
            return;
        }

        try {
            const { Linking } = require('react-native');
            const { API_URL } = require('@/services/api');

            if (material.type === 'audio') {
                setAudioLoading(true);
                const signed = await getAudioMaterialSignedUrl(material.id);
                if (!signed.success || !signed.audio_url) {
                    setAudioLoading(false);
                    Alert.alert('Erro', signed.error || 'Não foi possível gerar acesso ao áudio.');
                    return;
                }
                setSelectedAudio({
                    id: String(material.id),
                    title: material.title,
                    url: signed.audio_url,
                });
                setAudioModalVisible(true);
                setAudioLoading(false);
                return;
            }

            let fullUrl = material.url;
            if (!material.url.startsWith('http')) {
                const baseUrl = API_URL.replace('/api', '');
                fullUrl = `${baseUrl}${material.url}`;
            }

            // Para documentos de texto (.md, .txt), buscar e mostrar in-app
            const isTextDoc = material.type === 'document' || fullUrl.endsWith('.md') || fullUrl.endsWith('.txt');
            if (isTextDoc) {
                setSupportViewerLoading(true);
                try {
                    const res = await fetch(fullUrl);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const textContent = await res.text();
                    setSupportViewerData({
                        title: material.title,
                        content: textContent,
                    });
                } catch (fetchErr) {
                    console.error('Erro ao buscar conteúdo:', fetchErr);
                    // Fallback: abrir no navegador
                    await Linking.openURL(fullUrl);
                } finally {
                    setSupportViewerLoading(false);
                }
                return;
            }

            await Linking.openURL(fullUrl);
        } catch (error) {
            setAudioLoading(false);
            setSupportViewerLoading(false);
            console.error('Erro ao abrir material:', error);
            Alert.alert('Erro', 'Não foi possível abrir o material.');
        }
    };

    const formatMs = (ms: number) => {
        const totalSec = Math.floor((ms || 0) / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${String(sec).padStart(2, '0')}`;
    };

    React.useEffect(() => {
        let mounted = true;

        const loadAudio = async () => {
            if (!audioModalVisible || !selectedAudio?.url) return;

            try {
                const sound = new Audio.Sound();
                await sound.loadAsync(
                    { uri: selectedAudio.url },
                    { shouldPlay: true },
                    true
                );

                sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                    if (!status.isLoaded) return;
                    setIsPlayingAudio(status.isPlaying);
                    setAudioPositionMs(status.positionMillis || 0);
                    setAudioDurationMs(status.durationMillis || 0);
                });

                if (mounted) {
                    setAudioSound(sound);
                } else {
                    await sound.unloadAsync();
                }
            } catch (error) {
                Alert.alert('Erro', 'Não foi possível reproduzir o áudio neste momento.');
            }
        };

        loadAudio();

        return () => {
            mounted = false;
        };
    }, [audioModalVisible, selectedAudio?.url]);

    const closeAudioModal = async () => {
        setAudioModalVisible(false);
        setSelectedAudio(null);
        setIsPlayingAudio(false);
        setAudioPositionMs(0);
        setAudioDurationMs(0);

        if (audioSound) {
            try {
                await audioSound.unloadAsync();
            } catch (error) {
                // ignore
            }
        }
        setAudioSound(null);
    };

    const togglePlayPause = async () => {
        if (!audioSound) return;
        try {
            if (isPlayingAudio) {
                await audioSound.pauseAsync();
            } else {
                await audioSound.playAsync();
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha ao controlar reprodução do áudio.');
        }
    };

    // ============ RENDER HELPERS ============

    const renderQuizItem = (item: ActivityHistoryItem) => {
        const isExporting = exportingId === item.activity.id;
        const percentage = item.my_percentage ?? 0;
        const isGood = percentage >= 70;

        const handleRetakeQuiz = () => {
            router.push({
                pathname: '/(student)/live-activity',
                params: {
                    activity: JSON.stringify(item.activity),
                    practiceMode: '1',
                    source: 'content-hub',
                }
            });
        };

        const questionsCount = item.activity.content?.questions?.length || 0;

        return (
            <TouchableOpacity
                key={item.activity.id}
                style={quizCardStyles.card}
                onPress={() => {
                    setQuizDetailItem(item);
                    setShowQuizAnswers(false);
                }}
                activeOpacity={0.7}
            >
                <View style={quizCardStyles.accentBar} />

                <View style={quizCardStyles.cardBody}>
                    <View style={quizCardStyles.headerRow}>
                        <View style={quizCardStyles.iconWrap}>
                            <MaterialIcons name="quiz" size={20} color="#4f46e5" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={quizCardStyles.title} numberOfLines={2}>{item.activity.title}</Text>
                            <Text style={quizCardStyles.date}>{formatDate(item.activity.created_at)}</Text>
                        </View>

                        <View style={quizCardStyles.actions}>
                            <View style={[
                                quizCardStyles.scoreBadge,
                                { backgroundColor: isGood ? '#DCFCE7' : '#FEE2E2', borderColor: isGood ? '#86EFAC' : '#FECACA' }
                            ]}>
                                <Text style={[quizCardStyles.scoreText, { color: isGood ? '#166534' : '#991B1B' }]}>
                                    {Math.round(percentage)}%
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[quizCardStyles.actionBtn, quizCardStyles.pdfBtn, isExporting && { opacity: 0.6 }]}
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    !isExporting && handleExportPDF(item);
                                }}
                                disabled={isExporting}
                            >
                                {isExporting ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <MaterialIcons name="picture-as-pdf" size={14} color={colors.white} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={quizCardStyles.preview}>
                        {questionsCount} {questionsCount === 1 ? 'questão' : 'questões'} resolvidas neste quiz.
                    </Text>

                    <View style={quizCardStyles.tapHint}>
                        <Text style={quizCardStyles.tapHintText}>Toque para exibir</Text>
                        <MaterialIcons name="arrow-forward-ios" size={10} color="#94a3b8" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSummaryItem = (item: ActivityHistoryItem) => {
        const isExporting = exportingId === item.activity.id;
        const structured = parseStructuredSummary(item);
        const previewText = structured
            ? structured.essential_concept.substring(0, 120) + (structured.essential_concept.length > 120 ? '...' : '')
            : sanitizeSummaryText(item.activity.content?.summary_text || item.activity.ai_generated_content).substring(0, 120) + '...';

        return (
            <TouchableOpacity
                key={item.activity.id}
                style={summaryCardStyles.card}
                onPress={() => setSummaryDetailItem(item)}
                activeOpacity={0.7}
            >
                {/* Gradient accent bar */}
                <View style={summaryCardStyles.accentBar} />

                <View style={summaryCardStyles.cardBody}>
                    <View style={summaryCardStyles.headerRow}>
                        <View style={summaryCardStyles.iconWrap}>
                            <MaterialIcons name="auto-stories" size={20} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={summaryCardStyles.title} numberOfLines={2}>
                                {structured ? structured.topic : item.activity.title}
                            </Text>
                            <Text style={summaryCardStyles.date}>{formatDate(item.activity.created_at)}</Text>
                        </View>
                        <View style={summaryCardStyles.actions}>
                            <TouchableOpacity
                                style={[summaryCardStyles.pdfBtn, isExporting && { opacity: 0.5 }]}
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    !isExporting && handleExportPDF(item);
                                }}
                                disabled={isExporting}
                            >
                                {isExporting ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <MaterialIcons name="picture-as-pdf" size={14} color={colors.white} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={summaryCardStyles.preview} numberOfLines={2}>{previewText}</Text>

                    {structured && (
                        <View style={summaryCardStyles.chips}>
                            <View style={summaryCardStyles.chip}>
                                <MaterialIcons name="check-circle" size={12} color="#22c55e" />
                                <Text style={summaryCardStyles.chipText}>{structured.key_points?.length || 0} pontos</Text>
                            </View>
                            <View style={[summaryCardStyles.chip, { backgroundColor: '#fef3c7' }]}>
                                <MaterialIcons name="lightbulb" size={12} color="#d97706" />
                                <Text style={[summaryCardStyles.chipText, { color: '#92400e' }]}>Exemplo</Text>
                            </View>
                            <View style={[summaryCardStyles.chip, { backgroundColor: '#f3e8ff' }]}>
                                <MaterialIcons name="psychology" size={12} color="#9333ea" />
                                <Text style={[summaryCardStyles.chipText, { color: '#6b21a8' }]}>Reflexão</Text>
                            </View>
                        </View>
                    )}

                    <View style={summaryCardStyles.tapHint}>
                        <Text style={summaryCardStyles.tapHintText}>Toque para ver completo</Text>
                        <MaterialIcons name="arrow-forward-ios" size={10} color="#94a3b8" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // ===== SUMMARY DETAIL MODAL =====
    const renderSummaryDetailModal = () => {
        if (!summaryDetailItem) return null;
        const structured = parseStructuredSummary(summaryDetailItem);
        const legacyText = !structured
            ? sanitizeSummaryText(summaryDetailItem.activity.content?.summary_text || summaryDetailItem.activity.ai_generated_content)
            : null;

        return (
            <Modal
                visible={!!summaryDetailItem}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSummaryDetailItem(null)}
            >
                <View style={summaryModalStyles.container}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#f59e0b', '#d97706']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={summaryModalStyles.header}
                    >
                        <TouchableOpacity
                            onPress={() => setSummaryDetailItem(null)}
                            style={summaryModalStyles.closeBtn}
                        >
                            <MaterialIcons name="arrow-back" size={22} color="#fff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={summaryModalStyles.headerTitle} numberOfLines={2}>
                                {structured ? structured.topic : summaryDetailItem.activity.title}
                            </Text>
                            <Text style={summaryModalStyles.headerSub}>
                                {subjectName} · {formatDate(summaryDetailItem.activity.created_at)}
                            </Text>
                        </View>
                    </LinearGradient>

                    <ScrollView
                        style={summaryModalStyles.scroll}
                        contentContainerStyle={summaryModalStyles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {structured ? (
                            <>
                                {/* Conceito Essencial */}
                                <View style={[summaryModalStyles.section, { backgroundColor: '#eef2ff', borderLeftColor: '#4f46e5' }]}>
                                    <View style={summaryModalStyles.sectionHeader}>
                                        <MaterialIcons name="menu-book" size={20} color="#4f46e5" />
                                        <Text style={[summaryModalStyles.sectionTitle, { color: '#4f46e5' }]}>Conceito Essencial</Text>
                                    </View>
                                    <Text style={summaryModalStyles.sectionBody}>{structured.essential_concept}</Text>
                                </View>

                                {/* Pontos-Chave */}
                                <View style={[summaryModalStyles.section, { backgroundColor: '#f0fdf4', borderLeftColor: '#22c55e' }]}>
                                    <View style={summaryModalStyles.sectionHeader}>
                                        <MaterialIcons name="check-circle" size={20} color="#22c55e" />
                                        <Text style={[summaryModalStyles.sectionTitle, { color: '#16a34a' }]}>Pontos-Chave</Text>
                                    </View>
                                    {(structured.key_points || []).map((point, idx) => (
                                        <View key={idx} style={summaryModalStyles.listItem}>
                                            <View style={summaryModalStyles.bullet} />
                                            <Text style={summaryModalStyles.listText}>{point}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Exemplo Prático */}
                                <View style={[summaryModalStyles.section, { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b' }]}>
                                    <View style={summaryModalStyles.sectionHeader}>
                                        <MaterialIcons name="lightbulb" size={20} color="#f59e0b" />
                                        <Text style={[summaryModalStyles.sectionTitle, { color: '#d97706' }]}>Exemplo Prático</Text>
                                    </View>
                                    <Text style={summaryModalStyles.sectionBody}>{structured.practical_example}</Text>
                                </View>

                                {/* Erros Comuns */}
                                {structured.common_mistakes && structured.common_mistakes.length > 0 && (
                                    <View style={[summaryModalStyles.section, { backgroundColor: '#fef2f2', borderLeftColor: '#ef4444' }]}>
                                        <View style={summaryModalStyles.sectionHeader}>
                                            <MaterialIcons name="warning" size={20} color="#ef4444" />
                                            <Text style={[summaryModalStyles.sectionTitle, { color: '#dc2626' }]}>Erros Comuns</Text>
                                        </View>
                                        {structured.common_mistakes.map((mistake, idx) => (
                                            <View key={idx} style={summaryModalStyles.listItem}>
                                                <MaterialIcons name="close" size={14} color="#ef4444" style={{ marginTop: 2 }} />
                                                <Text style={summaryModalStyles.listText}>{mistake}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Reflexão */}
                                <View style={[summaryModalStyles.section, { backgroundColor: '#faf5ff', borderLeftColor: '#a855f7' }]}>
                                    <View style={summaryModalStyles.sectionHeader}>
                                        <MaterialIcons name="psychology" size={20} color="#a855f7" />
                                        <Text style={[summaryModalStyles.sectionTitle, { color: '#9333ea' }]}>Para Refletir</Text>
                                    </View>
                                    <Text style={[summaryModalStyles.sectionBody, { fontStyle: 'italic', fontSize: 16 }]}>
                                        {structured.reflection}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            /* Fallback para resumos legado */
                            <View style={[summaryModalStyles.section, { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b' }]}>
                                <Text style={summaryModalStyles.sectionBody}>{legacyText}</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    // ===== QUIZ DETAIL MODAL =====
    const renderQuizDetailModal = () => {
        if (!quizDetailItem) return null;

        const questions = quizDetailItem.activity.content?.questions || [];
        const percentage = quizDetailItem.my_percentage ?? 0;
        const isGood = percentage >= 70;

        const handleRetakeQuiz = () => {
            setQuizDetailItem(null);
            router.push({
                pathname: '/(student)/live-activity',
                params: {
                    activity: JSON.stringify(quizDetailItem.activity),
                    practiceMode: '1',
                    source: 'content-hub',
                }
            });
        };

        return (
            <Modal
                visible={!!quizDetailItem}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setQuizDetailItem(null)}
            >
                <View style={summaryModalStyles.container}>
                    {/* Header: indigo gradient for quizzes */}
                    <LinearGradient
                        colors={['#4f46e5', '#3730a3']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={summaryModalStyles.header}
                    >
                        <TouchableOpacity
                            onPress={() => setQuizDetailItem(null)}
                            style={summaryModalStyles.closeBtn}
                        >
                            <MaterialIcons name="arrow-back" size={22} color="#fff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={summaryModalStyles.headerTitle} numberOfLines={2}>
                                {quizDetailItem.activity.title}
                            </Text>
                            <Text style={summaryModalStyles.headerSub}>
                                {subjectName} · {formatDate(quizDetailItem.activity.created_at)}
                            </Text>
                        </View>
                        <View style={[
                            quizCardStyles.scoreBadge,
                            { backgroundColor: isGood ? '#DCFCE7' : '#FEE2E2', borderColor: isGood ? '#86EFAC' : '#FECACA', height: 36, paddingHorizontal: 12 }
                        ]}>
                            <Text style={[quizCardStyles.scoreText, { color: isGood ? '#166534' : '#991B1B', fontSize: 14 }]}>
                                {Math.round(percentage)}%
                            </Text>
                        </View>
                    </LinearGradient>

                    {/* Quiz Actions Header */}
                    <View style={quizDetailStyles.actionsHeader}>
                        <TouchableOpacity
                            style={quizDetailStyles.retakeButton}
                            onPress={handleRetakeQuiz}
                        >
                            <MaterialIcons name="replay" size={18} color="#fff" />
                            <Text style={quizDetailStyles.retakeButtonText}>Refazer Quiz</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[quizDetailStyles.toggleAnswersBtn, showQuizAnswers && quizDetailStyles.toggleAnswersBtnActive]}
                            onPress={() => setShowQuizAnswers(!showQuizAnswers)}
                        >
                            <MaterialIcons
                                name={showQuizAnswers ? "visibility-off" : "visibility"}
                                size={18}
                                color={showQuizAnswers ? "#4f46e5" : "#64748b"}
                            />
                            <Text style={[quizDetailStyles.toggleAnswersText, showQuizAnswers && quizDetailStyles.toggleAnswersTextActive]}>
                                {showQuizAnswers ? 'Ocultar Respostas' : 'Revelar Respostas'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={summaryModalStyles.scroll}
                        contentContainerStyle={[summaryModalStyles.scrollContent, { paddingTop: 8 }]}
                        showsVerticalScrollIndicator={false}
                    >
                        {questions.map((q: any, qIdx: number) => {
                            return (
                                <View key={qIdx} style={[summaryModalStyles.section, quizDetailStyles.questionCard]}>
                                    <View style={quizDetailStyles.questionHeader}>
                                        <View style={quizDetailStyles.questionNumberBadge}>
                                            <Text style={quizDetailStyles.questionNumberText}>{qIdx + 1}</Text>
                                        </View>
                                        <Text style={quizDetailStyles.questionText}>{q.question}</Text>
                                    </View>

                                    <View style={quizDetailStyles.optionsList}>
                                        {q.options.map((opt: string, optIdx: number) => {
                                            const isCorrect = optIdx === q.correct;
                                            const showAsCorrect = showQuizAnswers && isCorrect;

                                            return (
                                                <View
                                                    key={optIdx}
                                                    style={[
                                                        quizDetailStyles.optionItem,
                                                        showAsCorrect && quizDetailStyles.optionItemCorrect
                                                    ]}
                                                >
                                                    <View style={[
                                                        quizDetailStyles.optionLetterBadge,
                                                        showAsCorrect && quizDetailStyles.optionLetterBadgeCorrect
                                                    ]}>
                                                        <Text style={[
                                                            quizDetailStyles.optionLetterText,
                                                            showAsCorrect && quizDetailStyles.optionLetterTextCorrect
                                                        ]}>
                                                            {String.fromCharCode(65 + optIdx)}
                                                        </Text>
                                                    </View>
                                                    <Text style={[
                                                        quizDetailStyles.optionText,
                                                        showAsCorrect && quizDetailStyles.optionTextCorrect
                                                    ]}>
                                                        {opt}
                                                    </Text>
                                                    {showAsCorrect && (
                                                        <MaterialIcons name="check-circle" size={18} color="#22c55e" style={{ marginLeft: 'auto' }} />
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    const renderMaterialItem = (material: Material & { source?: string }, folderType: 'suporte' | 'audio' = 'suporte') => {
        const isExporting = exportingMaterialId === material.id;
        const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            pdf: 'picture-as-pdf',
            video: 'play-circle-outline',
            link: 'link',
            document: 'description',
            audio: 'headphones',
        };

        const uniqueKey = material.source ? `${material.source}-${material.id}` : `material-${material.id}`;

        const isTextDoc = material.type === 'document' || (material.url && (material.url.endsWith('.md') || material.url.endsWith('.txt')));

        const isAudio = folderType === 'audio';
        const cardColors = isAudio ? {
            border: '#ddd6fe',
            shadow: '#8b5cf6',
            accent: '#8b5cf6',
            iconBg: '#f3e8ff'
        } : {
            border: '#a7f3d0',
            shadow: '#10b981',
            accent: '#10b981',
            iconBg: '#d1fae5'
        };

        return (
            <TouchableOpacity
                key={uniqueKey}
                style={[materialCardStyles.card, { borderColor: cardColors.border, shadowColor: cardColors.shadow }]}
                onPress={() => handleMaterialPress(material)}
                activeOpacity={0.7}
            >
                <View style={[materialCardStyles.accentBar, { backgroundColor: cardColors.accent }]} />

                <View style={materialCardStyles.cardBody}>
                    <View style={materialCardStyles.headerRow}>
                        <View style={[materialCardStyles.iconWrap, { backgroundColor: cardColors.iconBg }]}>
                            <MaterialIcons
                                name={iconMap[material.type] || 'description'}
                                size={20}
                                color={cardColors.accent}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={materialCardStyles.title} numberOfLines={2}>{material.title}</Text>
                            <Text style={materialCardStyles.date}>
                                {(material as any).uploadDate ? formatDate((material as any).uploadDate) : (material.size || 'Material')}
                            </Text>
                        </View>
                        <View style={materialCardStyles.actions}>
                            {isTextDoc && (
                                <TouchableOpacity
                                    style={[materialCardStyles.actionBtn, { backgroundColor: cardColors.accent }, isExporting && { opacity: 0.5 }]}
                                    onPress={(e) => {
                                        e.stopPropagation?.();
                                        !isExporting && handleMaterialExportPDF(material);
                                    }}
                                    disabled={isExporting}
                                >
                                    {isExporting ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <MaterialIcons name="picture-as-pdf" size={14} color={colors.white} />
                                    )}
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[materialCardStyles.actionBtn, { backgroundColor: cardColors.accent }]}
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    handleMaterialPress(material);
                                }}
                            >
                                <MaterialIcons name={material.type === 'audio' ? 'play-arrow' : "open-in-new"} size={14} color={colors.white} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={materialCardStyles.preview} numberOfLines={2}>
                        {material.type === 'document' ? 'Documento de texto' :
                            material.type === 'pdf' ? 'Arquivo em PDF' :
                                material.type === 'audio' ? 'Faixa de áudio' :
                                    material.type === 'video' ? 'Vídeo externo' :
                                        'Link de material adicional'}
                    </Text>

                    <View style={materialCardStyles.tapHint}>
                        <Text style={materialCardStyles.tapHintText}>Toque para abrir</Text>
                        <MaterialIcons name="arrow-forward-ios" size={10} color="#94a3b8" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderRecapItem = (item: LessonRecap) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={summaryCardStyles.card}
                onPress={() => router.push(`/(student)/lesson-recap?id=${item.id}`)}
                activeOpacity={0.7}
            >
                <View style={[summaryCardStyles.accentBar, { backgroundColor: '#ec4899' }]} />
                <View style={summaryCardStyles.cardBody}>
                    <View style={summaryCardStyles.headerRow}>
                        <View style={[summaryCardStyles.iconWrap, { backgroundColor: '#fce7f3' }]}>
                            <MaterialIcons name="history-edu" size={20} color="#ec4899" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={summaryCardStyles.title} numberOfLines={2}>
                                {item.title}
                            </Text>
                            <Text style={summaryCardStyles.date}>{formatDate(item.created_at)}</Text>
                        </View>
                        {item.recap_data?.duration_minutes && (
                            <View style={[quizCardStyles.scoreBadge, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                                <Text style={[quizCardStyles.scoreText, { color: '#64748b' }]}>
                                    {item.recap_data.duration_minutes} min
                                </Text>
                            </View>
                        )}
                    </View>

                    <Text style={summaryCardStyles.preview} numberOfLines={2}>
                        {item.ai_summary ? item.ai_summary.substring(0, 120) + '...' : 'Sem resumo gerado.'}
                    </Text>

                    <View style={summaryCardStyles.chips}>
                        <View style={[summaryCardStyles.chip, { backgroundColor: '#fef2f2' }]}>
                            <MaterialIcons name="screen-share" size={12} color="#ef4444" />
                            <Text style={[summaryCardStyles.chipText, { color: '#991b1b' }]}>{item.recap_data?.contents_shown?.length || 0} conteúdos</Text>
                        </View>
                        <View style={[summaryCardStyles.chip, { backgroundColor: '#fffbeb' }]}>
                            <MaterialIcons name="task-alt" size={12} color="#f59e0b" />
                            <Text style={[summaryCardStyles.chipText, { color: '#92400e' }]}>{item.recap_data?.activities_performed?.length || 0} atividades</Text>
                        </View>
                    </View>

                    <View style={summaryCardStyles.tapHint}>
                        <Text style={summaryCardStyles.tapHintText}>Toque para ver detalhes da aula</Text>
                        <MaterialIcons name="arrow-forward-ios" size={10} color="#94a3b8" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderFolderContent = () => {
        if (!openFolder) return null;

        const config = FOLDER_CONFIG[openFolder];
        const searchValue = folderSearch[openFolder as SearchableFolder] || '';

        let content: React.ReactNode = null;
        let isEmpty = false;

        switch (openFolder) {
            case 'quizzes':
                const filteredQuizzes = quizzes.filter((item) =>
                    matchesSearch(searchValue, [
                        item.activity.title,
                        item.activity.created_at,
                        formatDate(item.activity.created_at),
                        item.status,
                    ])
                );
                isEmpty = filteredQuizzes.length === 0;
                content = filteredQuizzes.map(renderQuizItem);
                break;
            case 'resumos':
                const filteredSummaries = summaries.filter((item) =>
                    matchesSearch(searchValue, [
                        item.activity.title,
                        item.activity.created_at,
                        formatDate(item.activity.created_at),
                        item.activity.content?.summary_text,
                        item.activity.ai_generated_content,
                    ])
                );
                isEmpty = filteredSummaries.length === 0;
                content = filteredSummaries.map(renderSummaryItem);
                break;
            case 'suporte':
                const filteredMaterials = materials.filter((item) =>
                    matchesSearch(searchValue, [
                        item.title,
                        item.uploadDate,
                        formatDate(item.uploadDate),
                        item.type,
                    ])
                );
                isEmpty = filteredMaterials.length === 0;
                content = filteredMaterials.map(m => renderMaterialItem(m, 'suporte'));
                break;
            case 'audio':
                const filteredAudio = audioMaterials.filter((item) =>
                    matchesSearch(searchValue, [
                        item.title,
                        item.uploadDate,
                        formatDate(item.uploadDate),
                        item.type,
                    ])
                );
                isEmpty = filteredAudio.length === 0;
                content = filteredAudio.map(m => renderMaterialItem(m, 'audio'));
                break;
            case 'recaps':
                const filteredRecaps = recaps.filter((item) =>
                    matchesSearch(searchValue, [
                        item.title,
                        item.ai_summary,
                        item.created_at,
                        formatDate(item.created_at),
                        item.teacher_name,
                    ])
                );
                isEmpty = filteredRecaps.length === 0;
                content = filteredRecaps.map(renderRecapItem);
                break;
        }

        return (
            <View style={[sectionStyles.container, { borderColor: config.color + '40' }]}>
                <View style={sectionStyles.sectionHeader}>
                    <MaterialIcons name={config.icon} size={20} color={config.color} />
                    <Text style={[sectionStyles.sectionTitle, { color: config.color }]}>
                        {config.title}
                    </Text>
                </View>

                <View style={sectionStyles.searchWrap}>
                    <MaterialIcons name="search" size={18} color={colors.slate400} />
                    <TextInput
                        value={searchValue}
                        onChangeText={(text) =>
                            setFolderSearch(prev => ({
                                ...prev,
                                [openFolder]: text,
                            }))
                        }
                        placeholder={`Buscar em ${config.title} por nome ou data...`}
                        placeholderTextColor={colors.slate400}
                        style={sectionStyles.searchInput}
                    />
                    {!!searchValue && (
                        <TouchableOpacity
                            onPress={() =>
                                setFolderSearch(prev => ({
                                    ...prev,
                                    [openFolder]: '',
                                }))
                            }
                        >
                            <MaterialIcons name="close" size={18} color={colors.slate400} />
                        </TouchableOpacity>
                    )}
                </View>

                {isEmpty ? (
                    <View style={sectionStyles.emptyState}>
                        <MaterialIcons name="inbox" size={40} color={colors.slate300} />
                        <Text style={sectionStyles.emptyText}>
                            {searchValue ? 'Nenhum resultado para a busca' : 'Nenhum conteúdo encontrado'}
                        </Text>
                    </View>
                ) : (
                    <View style={sectionStyles.itemsList}>
                        {content}
                    </View>
                )}
            </View>
        );
    };

    // ============ MAIN RENDER ============

    return (
        <View style={styles.safeArea}>
            {/* Header */}
            <LinearGradient
                colors={['#4f46e5', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.canGoBack() ? router.back() : router.push('/(student)/dashboard')}
                >
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{subjectName}</Text>
                    <Text style={styles.headerSubtitle}>Central de Conteúdo</Text>
                </View>
                <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={loadAllData}
                >
                    <MaterialIcons name="refresh" size={22} color={colors.white} />
                </TouchableOpacity>
            </LinearGradient>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Carregando conteúdo...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Folder Grid */}
                    <View style={styles.foldersGrid}>
                        <FolderCard
                            title={FOLDER_CONFIG.quizzes.title}
                            iconName={FOLDER_CONFIG.quizzes.icon}
                            accentColor={FOLDER_CONFIG.quizzes.color}
                            itemCount={quizzes.length}
                            isOpen={openFolder === 'quizzes'}
                            onPress={() => toggleFolder('quizzes')}
                        />
                        <FolderCard
                            title={FOLDER_CONFIG.recaps.title}
                            iconName={FOLDER_CONFIG.recaps.icon}
                            accentColor={FOLDER_CONFIG.recaps.color}
                            itemCount={recaps.length}
                            isOpen={openFolder === 'recaps'}
                            onPress={() => toggleFolder('recaps')}
                        />
                        <FolderCard
                            title={FOLDER_CONFIG.resumos.title}
                            iconName={FOLDER_CONFIG.resumos.icon}
                            accentColor={FOLDER_CONFIG.resumos.color}
                            itemCount={summaries.length}
                            isOpen={openFolder === 'resumos'}
                            onPress={() => toggleFolder('resumos')}
                        />
                        <FolderCard
                            title={FOLDER_CONFIG.suporte.title}
                            iconName={FOLDER_CONFIG.suporte.icon}
                            accentColor={FOLDER_CONFIG.suporte.color}
                            itemCount={materials.length}
                            isOpen={openFolder === 'suporte'}
                            onPress={() => toggleFolder('suporte')}
                        />
                        <FolderCard
                            title={FOLDER_CONFIG.audio.title}
                            iconName={FOLDER_CONFIG.audio.icon}
                            accentColor={FOLDER_CONFIG.audio.color}
                            itemCount={audioMaterials.length}
                            isOpen={openFolder === 'audio'}
                            onPress={() => toggleFolder('audio')}
                        />
                    </View>

                    {/* Expanded Folder Content */}
                    {renderFolderContent()}
                </ScrollView>
            )}

            {/* Summary Detail Modal */}
            {renderSummaryDetailModal()}

            {/* Quiz Detail Modal */}
            {renderQuizDetailModal()}

            {/* Support Material Viewer Modal */}
            <Modal
                visible={!!supportViewerData}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSupportViewerData(null)}
            >
                <View style={supportViewerStyles.container}>
                    <LinearGradient
                        colors={['#10b981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={supportViewerStyles.header}
                    >
                        <TouchableOpacity
                            onPress={() => setSupportViewerData(null)}
                            style={supportViewerStyles.closeBtn}
                        >
                            <MaterialIcons name="arrow-back" size={22} color="#fff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={supportViewerStyles.headerTitle} numberOfLines={2}>
                                {supportViewerData?.title || 'Material de Reforço'}
                            </Text>
                            <Text style={supportViewerStyles.headerSub}>{subjectName}</Text>
                        </View>
                    </LinearGradient>

                    <ScrollView
                        style={supportViewerStyles.scroll}
                        contentContainerStyle={supportViewerStyles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={supportViewerStyles.contentCard}>
                            <Text style={supportViewerStyles.contentText}>
                                {supportViewerData?.content || ''}
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Loading overlay for support viewer */}
            {supportViewerLoading && (
                <View style={supportViewerStyles.loadingOverlay}>
                    <View style={supportViewerStyles.loadingCard}>
                        <ActivityIndicator size="large" color="#10b981" />
                        <Text style={supportViewerStyles.loadingText}>Carregando material...</Text>
                    </View>
                </View>
            )}

            <Modal
                visible={audioModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeAudioModal}
            >
                <View style={audioStyles.overlay}>
                    <View style={audioStyles.container}>
                        <View style={audioStyles.header}>
                            <Text style={audioStyles.title} numberOfLines={2}>
                                {selectedAudio?.title || 'Áudio'}
                            </Text>
                            <TouchableOpacity onPress={closeAudioModal}>
                                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {audioLoading ? (
                            <View style={audioStyles.loadingBox}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={audioStyles.loadingText}>Preparando áudio...</Text>
                            </View>
                        ) : selectedAudio?.url ? (
                            <View style={audioStyles.playerWrap}>
                                <View style={audioStyles.playerCard}>
                                    <MaterialIcons name="headphones" size={26} color={colors.primary} />
                                    <Text style={audioStyles.playerInfo}>Reprodução no app</Text>
                                    <Text style={audioStyles.timeText}>
                                        {formatMs(audioPositionMs)} / {formatMs(audioDurationMs)}
                                    </Text>

                                    <TouchableOpacity style={audioStyles.playButton} onPress={togglePlayPause}>
                                        <MaterialIcons
                                            name={isPlayingAudio ? 'pause' : 'play-arrow'}
                                            size={20}
                                            color={colors.white}
                                        />
                                        <Text style={audioStyles.playButtonText}>
                                            {isPlayingAudio ? 'Pausar' : 'Reproduzir'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={audioStyles.downloadButton}
                                    onPress={async () => {
                                        try {
                                            if (Platform.OS === 'web') {
                                                if (typeof document === 'undefined' || !selectedAudio?.id) {
                                                    throw new Error('Download indisponível neste ambiente');
                                                }

                                                const token = await AsyncStorage.getItem('authToken');
                                                if (!token) {
                                                    throw new Error('Sessão expirada. Faça login novamente.');
                                                }

                                                const { API_URL } = require('@/services/api');
                                                const response = await fetch(
                                                    `${API_URL}/transcription/materials/${selectedAudio.id}/audio-download`,
                                                    {
                                                        headers: {
                                                            'Authorization': `Bearer ${token}`,
                                                        },
                                                    }
                                                );

                                                if (!response.ok) {
                                                    throw new Error(`Falha no download (HTTP ${response.status})`);
                                                }

                                                const blob = await response.blob();
                                                const blobUrl = URL.createObjectURL(blob);

                                                const anchor = document.createElement('a');
                                                anchor.href = blobUrl;
                                                anchor.download = `${(selectedAudio.title || 'audio').replace(/\s+/g, '_')}.mp3`;
                                                document.body.appendChild(anchor);
                                                anchor.click();
                                                document.body.removeChild(anchor);
                                                URL.revokeObjectURL(blobUrl);
                                            } else {
                                                const { Linking } = require('react-native');
                                                await Linking.openURL(selectedAudio.url);
                                            }
                                        } catch (error) {
                                            Alert.alert('Erro', 'Não foi possível baixar o áudio.');
                                        }
                                    }}
                                >
                                    <MaterialIcons name="download" size={16} color={colors.white} />
                                    <Text style={audioStyles.downloadButtonText}>Baixar áudio</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={audioStyles.loadingBox}>
                                <Text style={audioStyles.loadingText}>Áudio indisponível</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ============ STYLES ============

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC',
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
        marginLeft: -4,
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
        fontSize: typography.fontSize.xs,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    refreshButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    loadingText: {
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        paddingBottom: spacing['2xl'],
    },
    foldersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        justifyContent: 'space-between',
    },
});

// Item card styles
const itemStyles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate100,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    cardTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        lineHeight: 22,
    },
    cardDate: {
        fontSize: typography.fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    scoreBadge: {
        height: 30,
        minWidth: 46,
        paddingHorizontal: 10,
        paddingVertical: 0,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreText: {
        fontWeight: 'bold' as const,
        fontSize: typography.fontSize.xs,
    },
    previewText: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginTop: spacing.sm,
    },
    pdfButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.danger,
        paddingVertical: 10,
        borderRadius: borderRadius.default,
        gap: 6,
        marginTop: 0,
    },
    pdfButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600' as const,
        color: colors.white,
    },
    quizHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    quizIconActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    quizIconButton: {
        width: 30,
        height: 30,
        borderRadius: 9,
        backgroundColor: colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quizPracticeIconButton: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    summaryIconButton: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    materialIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    materialActionButton: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#10b981',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

// Section/accordion styles
const sectionStyles = StyleSheet.create({
    container: {
        marginTop: spacing.lg,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        padding: spacing.md,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: colors.white,
        marginBottom: spacing.md,
        gap: spacing.xs,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        paddingVertical: 4,
    },
    sectionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    itemsList: {
        gap: spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.sm,
    },
    emptyText: {
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
    },
    comingSoon: {
        alignItems: 'center',
        paddingVertical: spacing['2xl'],
        gap: spacing.sm,
    },
    comingSoonTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    comingSoonText: {
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: spacing.lg,
    },
});

const audioStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    container: {
        width: '100%',
        maxWidth: 560,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    header: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    title: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
    },
    playerWrap: {
        padding: spacing.md,
        gap: spacing.md,
    },
    playerCard: {
        width: '100%',
        minHeight: 118,
        backgroundColor: '#f8fafc',
        borderRadius: borderRadius.default,
        borderWidth: 1,
        borderColor: colors.slate200,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        gap: spacing.xs,
    },
    playerInfo: {
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.semibold,
        fontSize: typography.fontSize.base,
    },
    timeText: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.sm,
    },
    playButton: {
        marginTop: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    playButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
        fontSize: typography.fontSize.sm,
    },
    loadingBox: {
        padding: spacing.lg,
        alignItems: 'center',
        gap: spacing.sm,
    },
    loadingText: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.sm,
    },
    downloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.default,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    downloadButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
        fontSize: typography.fontSize.sm,
    },
});

// ============ SUMMARY CARD STYLES ============
const summaryCardStyles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#fde68a',
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    accentBar: {
        height: 4,
        backgroundColor: '#f59e0b',
    },
    cardBody: {
        padding: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: 20,
    },
    date: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        gap: 6,
    },
    pdfBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    preview: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 19,
        marginTop: 10,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#166534',
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        marginTop: 10,
    },
    tapHintText: {
        fontSize: 11,
        color: '#94a3b8',
    },
});

// ============ SUMMARY DETAIL MODAL STYLES ============
const summaryModalStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        lineHeight: 24,
    },
    headerSub: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.75)',
        marginTop: 2,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
        gap: 14,
    },
    section: {
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        backgroundColor: '#fff',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    sectionBody: {
        fontSize: 14,
        lineHeight: 22,
        color: '#334155',
    },
    listItem: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
        alignItems: 'flex-start',
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22c55e',
        marginTop: 7,
    },
    listText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 21,
        color: '#334155',
    },
});

// ============ SUPPORT MATERIAL VIEWER STYLES ============
const supportViewerStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        lineHeight: 24,
    },
    headerSub: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.75)',
        marginTop: 2,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    contentCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    contentText: {
        fontSize: 15,
        lineHeight: 24,
        color: '#334155',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 28,
        paddingHorizontal: 36,
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    loadingText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
});

const quizCardStyles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#c7d2fe',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    accentBar: {
        height: 4,
        backgroundColor: '#4f46e5',
    },
    cardBody: {
        padding: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#e0e7ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: 20,
    },
    date: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    actionBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pdfBtn: {
        backgroundColor: '#ef4444',
    },
    practiceBtn: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: '#4f46e5',
    },
    scoreBadge: {
        height: 30,
        paddingHorizontal: 10,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    scoreText: {
        fontWeight: '700',
        fontSize: 12,
    },
    preview: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 19,
        marginTop: 10,
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        marginTop: 10,
    },
    tapHintText: {
        fontSize: 11,
        color: '#94a3b8',
    },
});

const quizDetailStyles = StyleSheet.create({
    actionsHeader: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        zIndex: 10,
    },
    retakeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#4f46e5',
        paddingVertical: 10,
        borderRadius: 8,
    },
    retakeButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    toggleAnswersBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingVertical: 10,
        borderRadius: 8,
    },
    toggleAnswersBtnActive: {
        borderColor: '#4f46e5',
        backgroundColor: '#e0e7ff',
    },
    toggleAnswersText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 14,
    },
    toggleAnswersTextActive: {
        color: '#4f46e5',
    },
    questionCard: {
        borderLeftColor: '#c7d2fe',
        borderLeftWidth: 4,
        marginBottom: 8,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    questionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
    },
    questionNumberBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#4f46e5',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    questionNumberText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    questionText: {
        flex: 1,
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '600',
        lineHeight: 24,
    },
    optionsList: {
        gap: 8,
        paddingLeft: 40,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        backgroundColor: '#f8fafc',
    },
    optionItemCorrect: {
        borderColor: '#bbf7d0',
        backgroundColor: '#f0fdf4',
    },
    optionLetterBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionLetterBadgeCorrect: {
        backgroundColor: '#22c55e',
    },
    optionLetterText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
    },
    optionLetterTextCorrect: {
        color: '#fff',
    },
    optionText: {
        flex: 1,
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
    },
    optionTextCorrect: {
        color: '#166534',
        fontWeight: '500',
    },
});

const materialCardStyles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
    },
    accentBar: {
        height: 4,
    },
    cardBody: {
        padding: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#d1fae5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: 20,
    },
    date: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        gap: 6,
    },
    actionBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    preview: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 19,
        marginTop: 10,
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        marginTop: 10,
    },
    tapHintText: {
        fontSize: 11,
        color: '#94a3b8',
    },
});
