import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Modal,
    TextInput,
    Alert, // Import Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { getQuizReport, endQuiz, QuizReport } from '@/services/quiz';
import { getLiveActivityReport, endLiveActivity, exportActivityPDF, distributeActivityMaterial, generateActivitySummary } from '@/services/api';
import RaceVisualization from '@/components/quiz/RaceVisualization';
import PodiumDisplay from '@/components/quiz/PodiumDisplay';
import PerformanceDistributionChart from '@/components/quiz/PerformanceDistributionChart';
import ScoreDistributionGraph from '@/components/quiz/ScoreDistributionGraph';
import TimeAnalysisDashboard from '@/components/quiz/TimeAnalysisDashboard';
import QuestionDifficultyChart from '@/components/quiz/QuestionDifficultyChart';
import ComparativeStatsPanel from '@/components/quiz/ComparativeStatsPanel';
import SupportActionPanel from '@/components/quiz/SupportActionPanel';
import { useWebSocket } from '@/hooks/useWebSocket';

/**
 * QuizResultsScreen - Resultados do Quiz em Tempo Real (Professor)
 * Mostra respostas dos alunos enquanto o quiz está ativo
 */
export default function QuizResultsScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const quizId = parseInt(params.quizId as string) || 0;
    const activityId = parseInt(params.activityId as string) || 0;
    const subjectName = params.subject as string || 'Disciplina';

    const [report, setReport] = useState<QuizReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [ending, setEnding] = useState(false);
    const [showPodium, setShowPodium] = useState(false);
    const [ranking, setRanking] = useState<any[]>([]);
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    const [aiSummary, setAiSummary] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [isDistributing, setIsDistributing] = useState(false);

    // WebSocket para atualizações em tempo real
    const { isConnected, ranking: wsRanking } = useWebSocket({
        quizId: activityId > 0 ? activityId : quizId,
        enabled: true
    });

    // Log connection status
    useEffect(() => {
        console.log('[QUIZ-RESULTS] ========================================');
        console.log('[QUIZ-RESULTS] WebSocket Status:', isConnected ? 'CONECTADO ✅' : 'DESCONECTADO ❌');
        console.log('[QUIZ-RESULTS] Quiz ID:', activityId > 0 ? activityId : quizId);
        console.log('[QUIZ-RESULTS] ========================================');
    }, [isConnected]);

    // Atualizar ranking quando receber dados do WebSocket
    useEffect(() => {
        console.log('[QUIZ-RESULTS] ========================================');
        console.log('[QUIZ-RESULTS] wsRanking mudou!');
        console.log('[QUIZ-RESULTS] wsRanking:', wsRanking);

        if (wsRanking && wsRanking.ranking) {
            console.log('[QUIZ-RESULTS] ✅ Ranking recebido do WebSocket!');
            console.log('[QUIZ-RESULTS] Número de alunos:', wsRanking.ranking.length);
            console.log('[QUIZ-RESULTS] Dados:', wsRanking.ranking);

            const updatedRanking = wsRanking.ranking.map((r: any) => ({
                ...r,
                status: 'submitted'
            }));

            console.log('[QUIZ-RESULTS] Atualizando state do ranking...');
            setRanking(updatedRanking);
        } else {
            console.log('[QUIZ-RESULTS] ⚠️ wsRanking vazio ou sem ranking');
        }
        console.log('[QUIZ-RESULTS] ========================================');
    }, [wsRanking]);

    // Fallback: Polling a cada 5s caso WebSocket não esteja funcionando
    useEffect(() => {
        const pollingRef = setInterval(async () => {
            if (!showPodium) {
                console.log('[FALLBACK POLLING] Buscando ranking...');
                try {
                    let result;
                    if (activityId > 0) {
                        result = await getLiveActivityReport(activityId);
                    } else {
                        result = await getQuizReport(quizId);
                    }

                    if (result.success && result.report) {
                        setReport(result.report);
                        if (result.report.all_responses) {
                            const transformedRanking = result.report.all_responses.map((r: any, index: number) => ({
                                position: index + 1,
                                student_id: r.student_id || r.id,
                                student_name: r.student_name || 'Aluno',
                                points: r.score * 100,
                                score: r.score,
                                total: r.total,
                                percentage: r.percentage || 0,
                                time_taken: r.time_taken || 0,
                                status: 'submitted'
                            }));
                            console.log('[FALLBACK POLLING] Ranking atualizado:', transformedRanking.length, 'alunos');
                            setRanking(transformedRanking);
                        }
                    }
                } catch (error) {
                    console.log('[FALLBACK POLLING] Erro:', error);
                }
            }
        }, 5000);

        return () => clearInterval(pollingRef);
    }, [quizId, activityId, showPodium]);

    // Buscar relatório inicial
    useEffect(() => {
        const fetchInitialReport = async () => {
            try {
                let result;
                if (activityId > 0) {
                    result = await getLiveActivityReport(activityId);
                } else {
                    result = await getQuizReport(quizId);
                }

                if (result.success && result.report) {
                    setReport(result.report);
                    // Atualizar ranking inicial
                    if (result.report.all_responses) {
                        console.log('[INITIAL] Raw responses:', result.report.all_responses);
                        const transformedRanking = result.report.all_responses.map((r: any, index: number) => ({
                            position: index + 1,
                            student_id: r.student_id || r.id,
                            student_name: r.student_name || 'Aluno',
                            points: r.score * 100,
                            score: r.score,
                            total: r.total,
                            percentage: r.percentage || 0,
                            time_taken: r.time_taken || 0,
                            status: 'submitted'
                        }));
                        console.log('[INITIAL] Transformed ranking:', transformedRanking);
                        setRanking(transformedRanking);
                    }
                }
            } catch (error) {
                console.log('Erro ao buscar relatório inicial:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialReport();
    }, [quizId, activityId]);

    const handleEndQuiz = async () => {
        // Se já está mostrando o pódio, voltar para a tela anterior
        if (showPodium) {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.push('/(teacher)/dashboard');
            }
            return;
        }

        // Primeira vez: verificar se há respostas submetidas
        const submittedCount = ranking.filter((r: any) => r.status === 'submitted').length;

        console.log('[END QUIZ] Respostas submetidas:', submittedCount);
        console.log('[END QUIZ] Ranking completo:', ranking);

        if (submittedCount >= 1) {
            setEnding(true);
            try {
                // Encerrar a atividade no backend
                if (activityId > 0) {
                    await endLiveActivity(activityId);
                } else {
                    await endQuiz(quizId);
                }



                // Busca relatório final
                let result;
                if (activityId > 0) {
                    result = await getLiveActivityReport(activityId);
                } else {
                    result = await getQuizReport(quizId);
                }

                if (result.success && result.report) {
                    setReport(result.report);
                    // Atualizar ranking final
                    if (result.report.all_responses) {
                        setRanking(result.report.all_responses.map((r: any, index: number) => ({
                            position: index + 1,
                            student_id: r.student_id || r.id,
                            student_name: r.student_name || 'Aluno',
                            points: r.score * 100,
                            score: r.score,
                            total: r.total,
                            percentage: r.percentage || 0,
                            time_taken: r.time_taken || 0,
                            status: 'submitted'
                        })));
                    }
                }

                // Mostrar pódio
                setShowPodium(true);
                console.log('[END QUIZ] Mostrando pódio');
            } catch (error) {
                console.log('Erro ao encerrar quiz:', error);
            } finally {
                setEnding(false);
            }
        } else {
            // Se não houver respostas, voltar direto
            console.log('[END QUIZ] Sem respostas, voltando direto');
            router.back();
        }
    };

    const handleExportPDF = async () => {
        if (!activityId && !quizId) return;

        setIsExportingPDF(true);
        try {
            const id = activityId > 0 ? activityId : quizId;
            const blob = await exportActivityPDF(id);

            // Criar URL do blob e fazer download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `relatorio_quiz_${id}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
        }
        setIsExportingPDF(false);
    };

    // Material Distribution Logic


    const handleGenerateSummary = async () => {
        const id = activityId > 0 ? activityId : quizId;
        if (!id) return;

        setAiSummary(''); // Clear previous summary to show loading state (switching to empty view)
        setIsGeneratingAI(true);
        try {
            const res = await generateActivitySummary(id);
            if (res.success && res.summary) {
                setAiSummary(res.summary);
            } else {
                Alert.alert("Erro", "Falha ao gerar resumo: " + (res.error || 'Erro desconhecido'));
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Erro", "Falha na comunicação com IA");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleSendAI = async () => {
        const id = activityId > 0 ? activityId : quizId;
        if (!id) return;
        if (!aiSummary.trim()) {
            Alert.alert("Atenção", "O resumo está vazio.");
            return;
        }

        const titleToSend = customTitle.trim() || 'Conteúdo extra para melhor desempenho';

        setIsDistributing(true);
        try {
            // Pass NULL for file, and aiSummary for textContent
            const response = await distributeActivityMaterial(id, null, titleToSend, aiSummary);

            if (response.success) {
                Alert.alert("Sucesso", response.message || "Material enviado!");
            } else {
                Alert.alert("Erro", response.error || "Erro ao enviar.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Erro", "Falha ao enviar material.");
        } finally {
            setIsDistributing(false);
        }
    };



    const isActive = report?.quiz?.status === 'active';

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Carregando resultados...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}>
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Resultados ao Vivo</Text>
                {showPodium ? (
                    <TouchableOpacity
                        style={styles.pdfButton}
                        onPress={handleExportPDF}
                        disabled={isExportingPDF}
                    >
                        {isExportingPDF ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <MaterialIcons name="picture-as-pdf" size={24} color={colors.primary} />
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={styles.placeholder} />
                )}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Status Card */}
                <View style={[styles.statusCard, isActive ? styles.activeCard : styles.endedCard]}>
                    <View style={styles.statusHeader}>
                        <MaterialIcons
                            name={isActive ? "live-tv" : "check-circle"}
                            size={32}
                            color={isActive ? "#10b981" : colors.slate400}
                        />
                        <View style={styles.statusInfo}>
                            <Text style={styles.statusTitle}>
                                {isActive ? "Quiz em Andamento" : "Quiz Encerrado"}
                            </Text>
                            <Text style={styles.quizTitle}>{report?.quiz?.title}</Text>
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{report?.response_count || 0}</Text>
                            <Text style={styles.statLabel}>Respostas</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{report?.enrolled_count || 0}</Text>
                            <Text style={styles.statLabel}>Matriculados</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{Math.round(report?.response_rate || 0)}%</Text>
                            <Text style={styles.statLabel}>Participação</Text>
                        </View>
                    </View>

                    {/* End Quiz Button */}
                    {(isActive || showPodium) && (
                        <View style={{ gap: spacing.sm }}>
                            <TouchableOpacity
                                style={styles.endButton}
                                onPress={handleEndQuiz}
                                disabled={ending}
                            >
                                {ending ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <>
                                        <MaterialIcons name={showPodium ? "close" : "stop"} size={20} color={colors.white} />
                                        <Text style={styles.endButtonText}>
                                            {showPodium ? 'Fechar' : 'Encerrar e Ver Pódio'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Podium Display - FIRST after quiz ends */}
                {showPodium && ranking.filter((r: any) => r.status === 'submitted').length >= 1 ? (
                    <View style={styles.section}>
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
                                }))}
                        />
                    </View>
                ) : null}

                {/* Enhanced Analytics - Only show after quiz ends */}
                {showPodium && report?.performance_distribution && (
                    <>
                        {/* Performance Distribution */}
                        <PerformanceDistributionChart
                            distribution={report.performance_distribution}
                            total={report.response_count}
                        />

                        {/* Score Distribution */}
                        {report.score_distribution && (
                            <ScoreDistributionGraph
                                distribution={report.score_distribution}
                            />
                        )}

                        {/* Time Analytics */}
                        {report.time_analytics && (
                            <TimeAnalysisDashboard
                                timeAnalytics={report.time_analytics}
                            />
                        )}

                        {/* Question Difficulty Analysis */}
                        {report.question_analytics && report.question_analytics.length > 0 && (
                            <QuestionDifficultyChart
                                questionAnalytics={report.question_analytics}
                            />
                        )}

                        {/* Comparative Statistics */}
                        {report.comparative_stats && (
                            <ComparativeStatsPanel
                                stats={report.comparative_stats}
                            />
                        )}

                        {/* Support Action Panel */}
                        {(report.performance_distribution.below_average > 0 ||
                            report.performance_distribution.average > 0) && (
                                <SupportActionPanel
                                    quizId={quizId}
                                    activityId={activityId || quizId}
                                    performanceDistribution={{
                                        critical: report.performance_distribution.below_average,
                                        attention: report.performance_distribution.average,
                                        good: report.performance_distribution.good,
                                        excellent: report.performance_distribution.excellent
                                    }}
                                />
                            )}
                    </>
                )}

                {/* Average Score - Show during active quiz */}
                {!showPodium && (
                    <View style={styles.averageCard}>
                        <Text style={styles.sectionTitle}>Média da Turma</Text>
                        <View style={styles.averageCircle}>
                            <Text style={styles.averageValue}>{report?.average_score?.toFixed(1) || 0}%</Text>
                        </View>
                    </View>
                )}

                {/* Live Ranking - Show during active quiz */}
                {!showPodium && ranking.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🏁 Ranking ao Vivo</Text>
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
                                }))}
                            enrolledCount={report?.enrolled_count || ranking.length}
                        />
                    </View>
                ) : null}

                {/* Best and Worst Questions - Only show after quiz ends */}
                {showPodium && (
                    <>
                        {report?.best_question && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>✅ Pergunta Mais Fácil</Text>
                                <View style={styles.bestCard}>
                                    <Text style={styles.bestQuestion}>{report.best_question.question}</Text>
                                    <Text style={styles.bestRate}>
                                        {report.best_question.correct_rate?.toFixed(0)}% acertaram
                                    </Text>
                                </View>
                            </View>
                        )}
                        {report?.worst_question && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>⚠️ Pergunta Mais Difícil</Text>
                                <View style={styles.worstCard}>
                                    <Text style={styles.worstQuestion}>{report.worst_question.question}</Text>
                                    <Text style={styles.worstRate}>
                                        Apenas {report.worst_question.correct_rate?.toFixed(0)}% acertaram
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}

                {/* AI Reinforcement Card - New Location */}
                {showPodium && report?.average_score && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>✨ Material de Reforço</Text>
                        <View style={styles.aiCard}>
                            <View style={styles.aiHeader}>
                                <View style={styles.aiIconContainer}>
                                    <MaterialIcons name="auto-awesome" size={24} color={colors.white} />
                                </View>
                                <View style={styles.aiInfo}>
                                    <Text style={styles.aiTitle}>Conteúdo Personalizado</Text>
                                    <Text style={styles.aiDescription}>
                                        Gere um resumo automático para ajudar os alunos com desempenho abaixo da média ({report?.average_score?.toFixed(1) || 0}%).
                                    </Text>
                                </View>
                            </View>

                            {!aiSummary ? (
                                <TouchableOpacity
                                    style={[styles.generateButton, { backgroundColor: '#059669' }]} // Emerald-600
                                    onPress={handleGenerateSummary}
                                    disabled={isGeneratingAI}
                                >
                                    {isGeneratingAI ? (
                                        <ActivityIndicator color={colors.white} />
                                    ) : (
                                        <>
                                            <MaterialIcons name="bolt" size={24} color={colors.white} />
                                            <Text style={styles.generateButtonText}>Gerar Resumo</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.aiContentContainer}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Título do Material:</Text>
                                        <TextInput
                                            style={styles.titleInput}
                                            value={customTitle}
                                            onChangeText={setCustomTitle}
                                            placeholder="Ex: Resumo sobre..."
                                            placeholderTextColor={colors.slate400}
                                        />
                                    </View>

                                    <View style={styles.summaryContainer}>
                                        <Text style={styles.summaryLabel}>Resumo Gerado:</Text>
                                        <TextInput
                                            style={styles.summaryInput}
                                            multiline
                                            value={aiSummary}
                                            onChangeText={setAiSummary}
                                            placeholder="O resumo aparecerá aqui..."
                                            placeholderTextColor={colors.slate400}
                                        />
                                    </View>

                                    <View style={styles.aiActionRow}>
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={() => setAiSummary('')}
                                        >
                                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.sendButton, isDistributing && { opacity: 0.7 }]}
                                            onPress={handleSendAI}
                                            disabled={isDistributing}
                                        >
                                            {isDistributing ? (
                                                <ActivityIndicator color={colors.white} size="small" />
                                            ) : (
                                                <>
                                                    <Text style={styles.sendButtonText}>Enviar</Text>
                                                    <MaterialIcons name="send" size={20} color={colors.white} />
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* All Responses */}
                {report?.all_responses && report.all_responses.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Todas as Respostas</Text>
                        {report.all_responses.map((response) => (
                            <View key={response.id} style={styles.responseRow}>
                                <Text style={styles.responseName}>{response.student_name || 'Aluno'}</Text>
                                <View style={styles.responseScore}>
                                    <Text style={styles.responseScoreText}>
                                        {response.score}/{response.total}
                                    </Text>
                                    <Text style={[
                                        styles.responsePercent,
                                        response.percentage >= 70 ? styles.goodScore :
                                            response.percentage >= 50 ? styles.mediumScore : styles.badScore
                                    ]}>
                                        {response.percentage?.toFixed(0)}%
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.slate50,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.md,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    placeholder: {
        width: 40,
    },
    pdfButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        paddingBottom: spacing.xl,
    },
    statusCard: {
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: colors.white,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    activeCard: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: '#10b981',
    },
    endedCard: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    statusInfo: {
        marginLeft: spacing.md,
        flex: 1,
    },
    statusTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: colors.slate500,
    },
    quizTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
        marginBottom: spacing.md,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: colors.slate200,
    },
    endButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.danger,
        paddingVertical: 12,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.lg,
        gap: 8,
    },
    endButtonText: {
        color: colors.white,
        fontWeight: 'bold',
        fontSize: 14,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        marginLeft: 4,
    },
    averageCard: {
        backgroundColor: colors.white,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    averageCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.slate50,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 8,
        borderColor: colors.primary,
        marginTop: spacing.sm,
    },
    averageValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.primary,
    },
    bestCard: {
        backgroundColor: '#DCFCE7',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    bestQuestion: {
        fontSize: 14,
        color: '#166534',
        marginBottom: 4,
        fontWeight: '500',
    },
    bestRate: {
        fontSize: 12,
        color: '#15803D',
        fontWeight: 'bold',
    },
    worstCard: {
        backgroundColor: '#FEE2E2',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    worstQuestion: {
        fontSize: 14,
        color: '#991B1B',
        marginBottom: 4,
        fontWeight: '500',
    },
    worstRate: {
        fontSize: 12,
        color: '#B91C1C',
        fontWeight: 'bold',
    },
    responseRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.white,
        marginBottom: 8,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate100,
    },
    responseName: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    responseScore: {
        alignItems: 'flex-end',
    },
    responseScoreText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    responsePercent: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    goodScore: { color: '#16a34a' },
    mediumScore: { color: '#ca8a04' },
    badScore: { color: '#dc2626' },

    // AI Card Styles
    aiCard: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: '#E0E7FF',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
    },
    aiHeader: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    aiIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    aiTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    aiDescription: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: borderRadius.lg,
        gap: 8,
    },
    generateButtonText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: 'bold',
    },
    aiContentContainer: {
        gap: spacing.md,
    },
    inputGroup: {
        marginBottom: spacing.xs,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.slate500,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    titleInput: {
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: 14,
        color: colors.textPrimary,
        backgroundColor: colors.slate50,
    },
    summaryContainer: {
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.slate500,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    summaryInput: {
        fontSize: 14,
        color: colors.textPrimary,
        lineHeight: 22,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    aiActionRow: {
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'center',
    },
    cancelButton: {
        paddingVertical: 12,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.slate100,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    cancelButtonText: {
        color: colors.slate600,
        fontSize: 13,
        fontWeight: '600',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
        gap: 6,
        flex: 1,
    },
    secondaryButtonText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.primary,
        gap: 6,
        flex: 2,
    },
    sendButtonText: {
        color: colors.white,
        fontSize: 13,
        fontWeight: 'bold',
    },
});
