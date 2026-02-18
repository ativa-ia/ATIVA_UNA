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
    Animated,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getStudentHistory, getSubjectMaterials } from '@/services/api';
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

type FolderType = 'quizzes' | 'resumos' | 'suporte' | 'audio' | null;

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
        title: 'Material de Suporte',
        icon: 'menu-book' as keyof typeof MaterialIcons.glyphMap,
        color: '#10b981',
    },
    audio: {
        title: 'Áudio & Podcasts',
        icon: 'headphones' as keyof typeof MaterialIcons.glyphMap,
        color: '#8b5cf6',
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

    // UI state
    const [openFolder, setOpenFolder] = useState<FolderType>(null);
    const [exportingId, setExportingId] = useState<number | null>(null);

    // ============ DATA LOADING ============

    useEffect(() => {
        loadAllData();
    }, [subjectId]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Load history (quizzes + summaries) and materials in parallel
            const [historyRes, materialsRes] = await Promise.all([
                getStudentHistory(subjectId, 1, 50).catch(() => ({ success: false, history: [] })),
                getSubjectMaterials(subjectId).catch(() => []),
            ]);

            if (historyRes.success && historyRes.history) {
                const items: ActivityHistoryItem[] = historyRes.history;
                setQuizzes(items.filter(i => i.activity.activity_type === 'quiz'));
                setSummaries(items.filter(i => i.activity.activity_type === 'summary'));
            }

            setMaterials(materialsRes || []);
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
        const summaryText = activity.content?.summary_text || activity.ai_generated_content || 'Sem conteúdo.';
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

    // ============ MATERIAL HANDLING ============

    const handleMaterialPress = async (material: Material) => {
        if (!material.url) {
            Alert.alert('Erro', 'Link do material não disponível');
            return;
        }

        try {
            const { Linking } = require('react-native');
            const { API_URL } = require('@/services/api');
            let fullUrl = material.url;
            if (!material.url.startsWith('http')) {
                const baseUrl = API_URL.replace('/api', '');
                fullUrl = `${baseUrl}${material.url}`;
            }
            await Linking.openURL(fullUrl);
        } catch (error) {
            console.error('Erro ao abrir material:', error);
            Alert.alert('Erro', 'Não foi possível abrir o material.');
        }
    };

    // ============ RENDER HELPERS ============

    const renderQuizItem = (item: ActivityHistoryItem) => {
        const isExporting = exportingId === item.activity.id;
        const percentage = item.my_percentage ?? 0;
        const isGood = percentage >= 70;

        return (
            <View key={item.activity.id} style={itemStyles.card}>
                <View style={itemStyles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={itemStyles.cardTitle} numberOfLines={2}>{item.activity.title}</Text>
                        <Text style={itemStyles.cardDate}>{formatDate(item.activity.created_at)}</Text>
                    </View>
                    <View style={[
                        itemStyles.scoreBadge,
                        { backgroundColor: isGood ? '#DCFCE7' : '#FEE2E2', borderColor: isGood ? '#86EFAC' : '#FECACA' }
                    ]}>
                        <Text style={[itemStyles.scoreText, { color: isGood ? '#166534' : '#991B1B' }]}>
                            {Math.round(percentage)}%
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[itemStyles.pdfButton, isExporting && { opacity: 0.6 }]}
                    onPress={() => !isExporting && handleExportPDF(item)}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <MaterialIcons name="picture-as-pdf" size={16} color={colors.white} />
                    )}
                    <Text style={itemStyles.pdfButtonText}>Exportar PDF</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderSummaryItem = (item: ActivityHistoryItem) => {
        const isExporting = exportingId === item.activity.id;
        const previewText = item.activity.content?.summary_text
            || item.activity.ai_generated_content
            || 'Sem conteúdo';

        return (
            <View key={item.activity.id} style={itemStyles.card}>
                <View style={itemStyles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={itemStyles.cardTitle} numberOfLines={2}>{item.activity.title}</Text>
                        <Text style={itemStyles.cardDate}>{formatDate(item.activity.created_at)}</Text>
                    </View>
                </View>

                <Text style={itemStyles.previewText} numberOfLines={3}>
                    {previewText}
                </Text>

                <TouchableOpacity
                    style={[itemStyles.pdfButton, { backgroundColor: '#F59E0B' }, isExporting && { opacity: 0.6 }]}
                    onPress={() => !isExporting && handleExportPDF(item)}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <MaterialIcons name="picture-as-pdf" size={16} color={colors.white} />
                    )}
                    <Text style={itemStyles.pdfButtonText}>Exportar PDF</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderMaterialItem = (material: Material) => {
        const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            pdf: 'picture-as-pdf',
            video: 'play-circle-outline',
            link: 'link',
            document: 'description',
        };

        return (
            <TouchableOpacity
                key={material.id}
                style={itemStyles.card}
                onPress={() => handleMaterialPress(material)}
                activeOpacity={0.7}
            >
                <View style={itemStyles.cardHeader}>
                    <View style={[itemStyles.materialIcon, { backgroundColor: '#10b98120' }]}>
                        <MaterialIcons
                            name={iconMap[material.type] || 'description'}
                            size={22}
                            color="#10b981"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={itemStyles.cardTitle} numberOfLines={2}>{material.title}</Text>
                        {material.size && (
                            <Text style={itemStyles.cardDate}>{material.size}</Text>
                        )}
                    </View>
                    <MaterialIcons name="open-in-new" size={18} color={colors.textSecondary} />
                </View>
            </TouchableOpacity>
        );
    };

    const renderFolderContent = () => {
        if (!openFolder) return null;

        const config = FOLDER_CONFIG[openFolder];

        let content: React.ReactNode = null;
        let isEmpty = false;

        switch (openFolder) {
            case 'quizzes':
                isEmpty = quizzes.length === 0;
                content = quizzes.map(renderQuizItem);
                break;
            case 'resumos':
                isEmpty = summaries.length === 0;
                content = summaries.map(renderSummaryItem);
                break;
            case 'suporte':
                isEmpty = materials.length === 0;
                content = materials.map(renderMaterialItem);
                break;
            case 'audio':
                isEmpty = true;
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

                {openFolder === 'audio' ? (
                    <View style={sectionStyles.comingSoon}>
                        <MaterialIcons name="headphones" size={48} color={colors.slate300} />
                        <Text style={sectionStyles.comingSoonTitle}>Em Breve</Text>
                        <Text style={sectionStyles.comingSoonText}>
                            Áudios e podcasts gerados por IA estarão disponíveis aqui em breve!
                        </Text>
                    </View>
                ) : isEmpty ? (
                    <View style={sectionStyles.emptyState}>
                        <MaterialIcons name="inbox" size={40} color={colors.slate300} />
                        <Text style={sectionStyles.emptyText}>Nenhum conteúdo encontrado</Text>
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
                    onPress={() => router.back()}
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
                            itemCount={0}
                            isOpen={openFolder === 'audio'}
                            onPress={() => toggleFolder('audio')}
                            subtitle="Em breve"
                        />
                    </View>

                    {/* Expanded Folder Content */}
                    {renderFolderContent()}
                </ScrollView>
            )}
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
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    scoreText: {
        fontWeight: 'bold' as const,
        fontSize: typography.fontSize.sm,
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
        paddingVertical: 8,
        borderRadius: borderRadius.default,
        gap: 6,
        marginTop: spacing.sm,
    },
    pdfButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600' as const,
        color: colors.white,
    },
    materialIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
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
