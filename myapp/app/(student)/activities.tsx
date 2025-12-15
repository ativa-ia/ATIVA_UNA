import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';

// ... (rest of imports)

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Conditional import for FileSystem to avoid web bundler errors
let FileSystem: any;
if (Platform.OS !== 'web') {
    try {
        FileSystem = require('expo-file-system');
    } catch (e) {
        console.warn('FileSystem package not available');
    }
}

import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getStudentHistory, getActivityDetails } from '@/services/api';

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

export default function ActivitiesScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectId = parseInt(params.subjectId as string) || 0;
    const subjectName = params.subjectName as string || 'Atividades';

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [exportingId, setExportingId] = useState<number | null>(null);
    const [history, setHistory] = useState<ActivityHistoryItem[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadHistory(1);
    }, [subjectId]);

    const loadHistory = async (pageNumber: number) => {
        try {
            if (pageNumber === 1) setLoading(true);
            else setLoadingMore(true);

            const res = await getStudentHistory(subjectId, pageNumber, 8);
            if (res.success) {
                if (pageNumber === 1) {
                    setHistory(res.history);
                } else {
                    setHistory(prev => {
                        const existingIds = new Set(prev.map(item => item.activity.id));
                        const newItems = res.history.filter((item: ActivityHistoryItem) => !existingIds.has(item.activity.id));
                        return [...prev, ...newItems];
                    });
                }
                setHasMore(res.has_next);
                setPage(pageNumber);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Erro', 'Não foi possível carregar o histórico.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };



    const renderExportButtons = (item: ActivityHistoryItem) => {
        const isExporting = exportingId === item.activity.id;

        return (
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.pdfButton, isExporting && { opacity: 0.7 }]}
                    onPress={() => !isExporting && handleExportPDF(item)}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <MaterialIcons name="picture-as-pdf" size={20} color={colors.white} />
                    )}
                    <Text style={styles.actionButtonText}>PDF</Text>
                </TouchableOpacity>


            </View>
        );
    };

    const handleLoadMore = () => {
        if (!loading && !loadingMore && hasMore) {
            loadHistory(page + 1);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        // Backend sends UTC string without Z (e.g. "2023-01-01T12:00:00").
        // We append 'Z' to treat it as UTC, so Date object converts to local time.
        const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // --- PDF GENERATION ---
    const generateHTML = (item: ActivityHistoryItem) => {
        const { activity, my_percentage } = item;
        const date = formatDate(activity.created_at);

        let contentHtml = '';

        if (activity.activity_type === 'summary') {
            const summaryText = activity.content?.summary_text || activity.ai_generated_content || 'Sem conteúdo.';
            // Convert simple markdown-like breaks to HTML (basic)
            const formattedText = summaryText.replace(/\n/g, '<br>');

            contentHtml = `
                <div class="summary-box">
                    <h2>Resumo</h2>
                    <p>${formattedText}</p>
                </div>
            `;
        } else if (activity.activity_type === 'quiz') {
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

            contentHtml = `
                <div class="score-card">
                    Nota obtida: <strong>${(my_percentage != null) ? Math.round(my_percentage) : 0}%</strong>
                </div>
                ${questionsHtml}
            `;
        } else {
            contentHtml = `<p>Tipo de atividade não suportado para visualização detalhada.</p>`;
        }

        return `
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                <style>
                    body { font-family: 'Helvetica', sans-serif; color: #333; padding: 20px; }
                    h1 { color: #4f46e5; margin-bottom: 5px; }
                    .meta { color: #666; font-size: 14px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                    .summary-box { line-height: 1.6; font-size: 16px; background: #f9fafb; padding: 15px; border-radius: 8px; }
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
                    <p>Tipo: ${activity.activity_type.toUpperCase()}</p>
                </div>
                ${contentHtml}
            </body>
            </html>
        `;
    };

    const handleExportPDF = async (item: ActivityHistoryItem) => {
        try {
            const html = generateHTML(item);

            if (Platform.OS === 'web') {
                const printWindow = window.open('', '', 'width=800,height=600');
                if (printWindow) {
                    printWindow.document.write(html);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
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
        }
    };




    return (
        <View style={styles.safeArea}>
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
                <Text style={styles.headerTitle}>Atividades e Quizzes</Text>
                <View style={styles.placeholder} />
            </LinearGradient>

            <FlatList
                data={history}
                keyExtractor={(item) => item.activity.id.toString()}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                ListEmptyComponent={!loading ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="assignment-late" size={64} color={colors.slate300} />
                        <Text style={styles.emptyStateText}>Nenhuma atividade encontrada.</Text>
                    </View>
                ) : null}
                renderItem={({ item }) => {
                    const isQuiz = item.activity.activity_type === 'quiz';
                    const accentColor = isQuiz ? colors.primary : '#F59E0B'; // Indigo for Quiz, Amber for Summary
                    const iconName = isQuiz ? 'quiz' : 'sticky-note-2';
                    const statusLabel = isQuiz ? 'Quiz' : 'Resumo';

                    return (
                        <View style={[styles.card, { borderLeftColor: accentColor }]}>
                            <View style={styles.cardHeader}>
                                <View style={styles.headerTopRow}>
                                    <View style={[styles.typeTag, { backgroundColor: isQuiz ? '#EEF2FF' : '#FFFBEB' }]}>
                                        <MaterialIcons name={iconName} size={16} color={accentColor} />
                                        <Text style={[styles.typeTagText, { color: accentColor }]}>{statusLabel}</Text>
                                    </View>
                                    <Text style={styles.cardDate}>{formatDate(item.activity.created_at)}</Text>
                                </View>

                                <Text style={styles.cardTitle}>{item.activity.title}</Text>

                                {isQuiz && (
                                    <View style={styles.scoreContainer}>
                                        <View style={[styles.scoreBadge, {
                                            backgroundColor: (item.my_percentage ?? 0) >= 70 ? '#DCFCE7' : '#FEE2E2',
                                            borderColor: (item.my_percentage ?? 0) >= 70 ? '#86EFAC' : '#FECACA',
                                            borderWidth: 1
                                        }]}>
                                            <Text style={[styles.scoreText, { color: (item.my_percentage ?? 0) >= 70 ? '#166534' : '#991B1B' }]}>
                                                Nota: {Math.round(item.my_percentage ?? 0)}%
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            <View style={styles.cardFooter}>
                                {renderExportButtons(item)}
                            </View>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC', // Slightly grayer background for contrast
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
        marginLeft: -8,
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        textAlign: 'center',
    },
    placeholder: {
        width: 32,
        height: 32,
    },
    content: {
        padding: spacing.base,
        paddingBottom: spacing.xl,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: spacing['2xl'],
        gap: spacing.md,
    },
    emptyStateText: {
        fontSize: typography.fontSize.lg,
        color: colors.textSecondary,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md, // Increased padding
        marginBottom: spacing.md,
        borderLeftWidth: 6, // The "Flag" effect
        // Shadow update for "Post-it" feel (lifted)
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 0, // Remove full border, rely on shadow + left border
    },
    cardHeader: {
        marginBottom: spacing.sm,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    typeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    typeTagText: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    cardTitle: {
        fontSize: 18, // Larger title
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 8,
        lineHeight: 24,
    },
    cardDate: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    scoreContainer: {
        flexDirection: 'row',
        marginTop: 4,
    },
    scoreBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
    },
    scoreText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    cardFooter: {
        marginTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: spacing.sm,
    },
    actionButtons: {
        flexDirection: 'row',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10, // Taller button
        borderRadius: borderRadius.default,
        gap: 8,
    },
    pdfButton: {
        backgroundColor: colors.danger,
    },
    txtButton: {
        backgroundColor: colors.slate100,
        borderWidth: 1,
        borderColor: colors.slate300,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.white,
    },
});
