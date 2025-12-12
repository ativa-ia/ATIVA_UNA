/**
 * Exemplo de integração dos componentes de gamificação
 * Use este componente como referência para integrar no modal do professor
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useWebSocket } from '@/hooks/useWebSocket';
import RaceVisualization from '@/components/quiz/RaceVisualization';
import PodiumDisplay from '@/components/quiz/PodiumDisplay';
import { getQuizLiveRanking } from '@/services/quiz';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { MaterialIcons } from '@expo/vector-icons';

interface QuizGamificationModalProps {
    visible: boolean;
    quizId: number | null;
    quizStatus: 'waiting' | 'active' | 'ended';
    onClose: () => void;
}

export default function QuizGamificationModal({
    visible,
    quizId,
    quizStatus,
    onClose,
}: QuizGamificationModalProps) {
    const [showPodium, setShowPodium] = useState(false);
    const [rankingData, setRankingData] = useState<any>(null);

    // Conectar ao WebSocket quando o quiz está ativo
    const { isConnected, ranking } = useWebSocket({
        quizId,
        enabled: visible && quizStatus === 'active',
    });

    // Buscar ranking inicial
    useEffect(() => {
        if (visible && quizId) {
            fetchRanking();
        }
    }, [visible, quizId]);

    // Atualizar com dados do WebSocket
    useEffect(() => {
        if (ranking) {
            setRankingData(ranking);
        }
    }, [ranking]);

    // Mostrar pódio quando quiz encerrar
    useEffect(() => {
        if (quizStatus === 'ended' && rankingData?.ranking?.length > 0) {
            setTimeout(() => setShowPodium(true), 1000);
        }
    }, [quizStatus, rankingData]);

    const fetchRanking = async () => {
        if (!quizId) return;
        try {
            const data = await getQuizLiveRanking(quizId);
            if (data.success) {
                setRankingData(data);
            }
        } catch (error) {
            console.error('Erro ao buscar ranking:', error);
        }
    };

    const handleExportPDF = () => {
        // Implementar download de PDF
        console.log('Exportar PDF do quiz', quizId);
    };

    if (!visible || !quizId) return null;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>
                        {showPodium ? '🏆 Pódio Final' : '🏁 Ranking ao Vivo'}
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialIcons name="close" size={24} color={colors.white} />
                    </TouchableOpacity>
                </View>

                {/* Status do WebSocket */}
                {quizStatus === 'active' && (
                    <View style={styles.statusBar}>
                        <View style={[styles.statusDot, isConnected && styles.statusDotConnected]} />
                        <Text style={styles.statusText}>
                            {isConnected ? 'Conectado - Tempo Real' : 'Reconectando...'}
                        </Text>
                    </View>
                )}

                {/* Conteúdo */}
                <View style={styles.content}>
                    {showPodium && rankingData?.ranking ? (
                        // Pódio dos 3 melhores
                        <PodiumDisplay topStudents={rankingData.ranking.slice(0, 3)} />
                    ) : rankingData?.ranking ? (
                        // Visualização de corrida
                        <RaceVisualization
                            ranking={rankingData.ranking}
                            enrolledCount={rankingData.enrolled_count || 0}
                            maxPoints={rankingData.ranking[0]?.points}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialIcons name="hourglass-empty" size={48} color={colors.zinc600} />
                            <Text style={styles.emptyText}>Aguardando respostas...</Text>
                        </View>
                    )}
                </View>

                {/* Footer com ações */}
                {quizStatus === 'ended' && (
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.pdfButton} onPress={handleExportPDF}>
                            <MaterialIcons name="picture-as-pdf" size={20} color={colors.white} />
                            <Text style={styles.pdfButtonText}>Exportar PDF</Text>
                        </TouchableOpacity>

                        {!showPodium && rankingData?.ranking?.length >= 3 && (
                            <TouchableOpacity
                                style={styles.podiumButton}
                                onPress={() => setShowPodium(true)}
                            >
                                <MaterialIcons name="emoji-events" size={20} color={colors.white} />
                                <Text style={styles.podiumButtonText}>Ver Pódio</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.zinc900,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc800,
    },
    title: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    closeButton: {
        padding: spacing.sm,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        gap: spacing.sm,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.zinc600,
    },
    statusDotConnected: {
        backgroundColor: '#10b981',
    },
    statusText: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.fontSize.lg,
        color: colors.zinc600,
    },
    footer: {
        flexDirection: 'row',
        padding: spacing.lg,
        gap: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
    },
    pdfButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: '#ef4444',
        borderRadius: borderRadius.lg,
    },
    pdfButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    podiumButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: '#8b5cf6',
        borderRadius: borderRadius.lg,
    },
    podiumButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
});
