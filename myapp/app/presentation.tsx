import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { getPresentation, PresentationContent } from '@/services/presentation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

// Componentes de exibição
import SummarySlide from '@/components/presentation/SummarySlide';
import QuizSlide from '@/components/presentation/QuizSlide';
import PodiumDisplay from '@/components/quiz/PodiumDisplay';
import MediaSlide from '@/components/presentation/MediaSlide';
import LiveRankingSlide from '@/components/presentation/LiveRankingSlide';

export default function PresentationScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [content, setContent] = useState<PresentationContent | null>(null);
    const [sessionActive, setSessionActive] = useState(true);

    const { socket } = useWebSocket({ quizId: null, enabled: false });

    // Carregar conteúdo inicial
    useEffect(() => {
        loadPresentation();
    }, [code]);

    const loadPresentation = async () => {
        if (!code) {
            setError('Código não fornecido');
            setLoading(false);
            return;
        }

        try {
            const response = await getPresentation(code as string);

            if (!response.success) {
                setError(response.error || 'Apresentação não encontrada');
                setSessionActive(false);
            } else {
                if (response.current_content) {
                    setContent(response.current_content);
                }
            }
        } catch (err) {
            setError('Erro ao conectar');
        } finally {
            setLoading(false);
        }
    };

    // WebSocket - Entrar na sala
    useEffect(() => {
        if (socket && code) {
            socket.emit('join_presentation', { code });

            socket.on('presentation_content', (newContent: PresentationContent) => {
                setContent(newContent);
            });

            socket.on('presentation_clear', () => {
                setContent({ type: 'blank', data: {}, timestamp: new Date().toISOString() });
            });

            socket.on('presentation_ended', () => {
                setSessionActive(false);
            });

            return () => {
                socket.emit('leave_presentation', { code });
                socket.off('presentation_content');
                socket.off('presentation_clear');
                socket.off('presentation_ended');
            };
        }
    }, [socket, code]);

    // Polling como fallback
    useEffect(() => {
        const interval = setInterval(async () => {
            if (!socket && code && sessionActive) {
                const response = await getPresentation(code as string);
                if (response.success && response.current_content) {
                    setContent(response.current_content);
                }
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [socket, code, sessionActive]);

    if (loading) {
        return (
            <LinearGradient
                colors={['#0f172a', '#1e293b', '#334155']}
                style={styles.gradientContainer}
            >
                <View style={styles.loadingContent}>
                    <View style={styles.iconContainer}>
                        <MaterialIcons name="cast-connected" size={64} color={colors.primary} />
                    </View>
                    <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
                    <Text style={styles.loadingText}>Conectando à apresentação</Text>
                    <View style={styles.dotsContainer}>
                        <View style={[styles.dot, styles.dotPulse1]} />
                        <View style={[styles.dot, styles.dotPulse2]} />
                        <View style={[styles.dot, styles.dotPulse3]} />
                    </View>
                </View>
            </LinearGradient>
        );
    }

    if (error) {
        return (
            <LinearGradient
                colors={['#450a0a', '#7f1d1d', '#991b1b']}
                style={styles.gradientContainer}
            >
                <View style={styles.errorContent}>
                    <View style={styles.errorIconContainer}>
                        <MaterialIcons name="error-outline" size={80} color={colors.error} />
                    </View>
                    <Text style={styles.errorTitle}>Erro de Conexão</Text>
                    <Text style={styles.errorMessage}>{error}</Text>
                    <View style={styles.codeBox}>
                        <Text style={styles.codeLabel}>Código fornecido:</Text>
                        <Text style={styles.codeValue}>{code}</Text>
                    </View>
                </View>
            </LinearGradient>
        );
    }

    if (!sessionActive) {
        return (
            <LinearGradient
                colors={['#1e1b4b', '#312e81', '#3730a3']}
                style={styles.gradientContainer}
            >
                <View style={styles.endedContent}>
                    <View style={styles.endedIconContainer}>
                        <MaterialIcons name="check-circle" size={80} color={colors.success} />
                    </View>
                    <Text style={styles.endedTitle}>Apresentação Encerrada</Text>
                    <Text style={styles.endedSubtitle}>Obrigado por participar!</Text>
                </View>
            </LinearGradient>
        );
    }

    // Renderizar conteúdo baseado no tipo
    const renderContent = () => {
        if (!content || content.type === 'blank') {
            return (
                <LinearGradient
                    colors={['#0c4a6e', '#075985', '#0369a1']}
                    style={styles.gradientContainer}
                >
                    <View style={styles.waitingContent}>
                        <View style={styles.waitingIconContainer}>
                            <MaterialIcons name="hourglass-empty" size={72} color={colors.white} />
                        </View>
                        <Text style={styles.waitingTitle}>Aguardando Conteúdo</Text>
                        <Text style={styles.waitingSubtitle}>O professor enviará o material em breve</Text>
                        <View style={styles.codeDisplayBox}>
                            <Text style={styles.codeDisplayLabel}>Código da Sessão</Text>
                            <Text style={styles.codeDisplayValue}>{code}</Text>
                        </View>
                    </View>
                </LinearGradient>
            );
        }

        switch (content.type) {
            case 'summary':
                return <SummarySlide data={content.data} />;
            case 'quiz':
            case 'question':
                return <QuizSlide data={content.data} />;
            case 'podium':
                return <PodiumDisplay topStudents={content.data.topStudents || []} />;
            case 'ranking':
                return <LiveRankingSlide data={content.data} />;
            case 'image':
            case 'video':
                return <MediaSlide type={content.type} data={content.data} />;
            default:
                return (
                    <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>Tipo de conteúdo desconhecido</Text>
                    </View>
                );
        }
    };

    return (
        <LinearGradient
            colors={['#1e1b4b', '#312e81', '#3730a3']}
            style={styles.gradientContainer}
        >
            <View style={{ flex: 1, width: '100%' }}>
                {renderContent()}
            </View>
        </LinearGradient>
    );

}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradientContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },

    // Loading State
    loadingContent: {
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: spacing.xl,
    },
    spinner: {
        marginVertical: spacing.lg,
    },
    loadingText: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
        marginTop: spacing.md,
        fontFamily: typography.fontFamily.display,
    },
    dotsContainer: {
        flexDirection: 'row',
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    dotPulse1: {
        opacity: 0.4,
    },
    dotPulse2: {
        opacity: 0.7,
    },
    dotPulse3: {
        opacity: 1,
    },

    // Error State
    errorContent: {
        alignItems: 'center',
        maxWidth: 500,
    },
    errorIconContainer: {
        marginBottom: spacing.xl,
    },
    errorTitle: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.md,
        fontFamily: typography.fontFamily.display,
    },
    errorMessage: {
        fontSize: typography.fontSize.lg,
        color: colors.white,
        textAlign: 'center',
        marginBottom: spacing.xl,
        opacity: 0.9,
    },
    codeBox: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        minWidth: 250,
    },
    codeLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.white,
        opacity: 0.7,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    codeValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        letterSpacing: 4,
        textAlign: 'center',
        fontFamily: 'monospace',
    },

    // Ended State
    endedContent: {
        alignItems: 'center',
    },
    endedIconContainer: {
        marginBottom: spacing.xl,
    },
    endedTitle: {
        fontSize: typography.fontSize['4xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.md,
        fontFamily: typography.fontFamily.display,
    },
    endedSubtitle: {
        fontSize: typography.fontSize.xl,
        color: colors.white,
        opacity: 0.8,
    },

    // Waiting State
    waitingContent: {
        alignItems: 'center',
    },
    waitingIconContainer: {
        marginBottom: spacing.xl,
    },
    waitingTitle: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.sm,
        fontFamily: typography.fontFamily.display,
    },
    waitingSubtitle: {
        fontSize: typography.fontSize.lg,
        color: colors.white,
        opacity: 0.8,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    codeDisplayBox: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: spacing.xl,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        minWidth: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    codeDisplayLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.white,
        opacity: 0.7,
        marginBottom: spacing.sm,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    codeDisplayValue: {
        fontSize: 56,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        letterSpacing: 8,
        textAlign: 'center',
        fontFamily: 'monospace',
    },

    // Fallback
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.slate900,
        padding: spacing.xl,
    },
    errorText: {
        fontSize: typography.fontSize.xl,
        color: colors.error,
        textAlign: 'center',
    },
});
