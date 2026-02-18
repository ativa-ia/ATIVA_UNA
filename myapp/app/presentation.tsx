import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { getPresentation, PresentationContent } from '@/services/presentation';
import { usePresentationPolling } from '@/hooks/usePresentationPolling';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

// Componentes de exibição
import SummarySlide from '@/components/presentation/SummarySlide';
import QuizSlide from '@/components/presentation/QuizSlide';
import PodiumDisplay from '@/components/quiz/PodiumDisplay';
import MediaSlide from '@/components/presentation/MediaSlide';
import LiveRankingSlide from '@/components/presentation/LiveRankingSlide';
import DocumentSlide from '@/components/presentation/DocumentSlide';
import DocumentListSlide from '@/components/presentation/DocumentListSlide';
import PDFViewer from '@/components/presentation/PDFViewer';

export default function PresentationScreen() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { code } = useLocalSearchParams<{ code: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [content, setContent] = useState<PresentationContent | null>(null);
    const [sessionActive, setSessionActive] = useState(true);
    // Estado de controle de vídeo
    const [videoControl, setVideoControl] = useState<{ command: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'seek_relative' | 'restart', value?: number, timestamp: number } | undefined>(undefined);
    // State for manual code entry
    const [inputCode, setInputCode] = useState('');
    // Estado de interação do usuário (para autoplay)
    const [hasInteracted, setHasInteracted] = useState(false);

    const { content: polledContent, videoControl: polledVideoControl, sessionActive: isSessionActive } = usePresentationPolling({
        code: code as string,
        enabled: !!code
    });

    // Carregar conteúdo inicial
    useEffect(() => {
        loadPresentation();
    }, [code]);

    const loadPresentation = async () => {
        if (!code) {
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

    // Sincronizar estado com o polling
    useEffect(() => {
        if (polledContent) {
            setContent(polledContent);
        }

        if (polledVideoControl) {
            setVideoControl(polledVideoControl);
        }

        if (!isSessionActive) {
            setSessionActive(false);
        }
    }, [polledContent, polledVideoControl, isSessionActive]);

    // Fullscreen listener (web only)
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;

        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        handleFullscreenChange();

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    // Se não tiver código na URL e não estiver carregando, mostrar tela de input
    if (!code && !loading) {
        return (
            <View style={styles.entryContainer}>
                <LinearGradient
                    colors={['#1e1b4b', '#312e81']}
                    style={styles.entryBackground}
                >
                    <SafeAreaView style={styles.safeArea}>
                        <View style={styles.entryContent}>
                            <View style={styles.entryHeader}>
                                <MaterialIcons name="cast-connected" size={64} color={colors.primary} />
                                <Text style={styles.entryTitle}>Conectar à Tela</Text>
                                <Text style={styles.entrySubtitle}>
                                    Digite o código da apresentação para conectar este dispositivo como uma tela secundária.
                                </Text>
                            </View>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.codeInput}
                                    placeholder="000000"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={inputCode}
                                    onChangeText={setInputCode}
                                    keyboardType="numeric"
                                    maxLength={6}
                                    autoFocus
                                />
                                <TouchableOpacity
                                    style={[styles.connectButton, !inputCode && styles.connectButtonDisabled]}
                                    onPress={() => {
                                        if (inputCode.length >= 5) {
                                            router.replace(`/presentation?code=${inputCode}`);
                                        }
                                    }}
                                    disabled={!inputCode}
                                >
                                    <Text style={styles.connectButtonText}>CONECTAR</Text>
                                    <MaterialIcons name="arrow-forward" size={24} color={colors.white} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')}
                            >
                                <Text style={styles.backButtonText}>Voltar</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </LinearGradient>
            </View>
        );
    }

    const handleInteraction = () => {
        setHasInteracted(true);
    };

    const handleToggleFullscreen = async () => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;

        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            // Keep silent to avoid blocking the presentation flow
        }
    };

    // Renderizar conteúdo baseado no tipo
    const renderContent = () => {
        // 0. Loading state - show nothing (or a spinner) while the initial fetch is in progress
        // This prevents the "Aguardando Conteúdo" screen from flashing before the interaction overlay
        if (loading) {
            return (
                <View style={[styles.gradientContainer, { backgroundColor: 'transparent' }]}>
                    <ActivityIndicator size="large" color={colors.white} />
                </View>
            );
        }

        // 1. Interaction Overlay (Force click for autoplay)
        if (!hasInteracted && !error) {
            return (
                <View style={styles.overlayContainer}>
                    <LinearGradient
                        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.9)']}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.overlayContent}>
                        <MaterialIcons name="play-circle-outline" size={100} color={colors.white} />
                        <Text style={styles.overlayTitle}>Clique para Iniciar</Text>
                        <Text style={styles.overlaySubtitle}>Necessario para ativar o audio</Text>

                        <TouchableOpacity style={styles.startButtonContainer} onPress={handleInteraction}>
                            <Text style={styles.startButton}>
                                INICIAR APRESENTACAO
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        // 1. Verificar se a sessão foi encerrada
        if (!sessionActive) {
            return (
                <View style={styles.endedContent}>
                    <View style={styles.endedIconContainer}>
                        <MaterialIcons name="cancel-presentation" size={80} color={colors.white} />
                    </View>
                    <Text style={styles.endedTitle}>Apresentação Encerrada</Text>
                    <Text style={styles.endedSubtitle}>O professor finalizou esta sessão.</Text>
                </View>
            );
        }

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
                // Pass video control state
                return <MediaSlide type={content.type} data={content.data} controlState={content.type === 'video' ? videoControl : undefined} />;
            case 'document':
                // Se tiver file_url, usar PDFViewer (arquivo original)
                if (content.data.file_url) {
                    const docUrl = content.data.supabase_url || content.data.file_url;
                    return (
                        <View style={styles.documentWrapper}>
                            <PDFViewer
                                fileUrl={docUrl}
                                filename={content.data.filename || 'Documento'}
                                page={content.pdf_page || 1}
                                zoom={content.pdf_zoom || 'auto'}
                            />
                        </View>
                    );
                }
                // Fallback: usar DocumentSlide (texto em seções)
                return <DocumentSlide data={content.data} />;
            case 'document_list':
                return <DocumentListSlide data={content.data} />;
            default:
                return (
                    <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>Tipo de conteúdo desconhecido: {content.type}</Text>
                    </View>
                );
        }
    };

    const isDocumentFull = !!content && content.type === 'document' && !!content.data?.file_url;

    return (
        <LinearGradient
            colors={['#1e1b4b', '#312e81', '#3730a3']}
            style={[styles.gradientContainer, isDocumentFull && styles.fullscreenContainer]}
        >
            <View style={[styles.contentWrapper, isDocumentFull && styles.fullscreenContentWrapper]}>
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
        padding: 4,
    },
    fullscreenContainer: {
        padding: 0,
        alignItems: 'stretch',
    },
    contentWrapper: {
        flex: 1,
        width: '100%',
    },
    fullscreenContentWrapper: {
        alignSelf: 'stretch',
    },
    documentWrapper: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    fullscreenButton: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    fullscreenButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
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

    // Overlay Styles
    overlayContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    overlayContent: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    overlayTitle: {
        fontSize: typography.fontSize['4xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginTop: spacing.lg,
        fontFamily: typography.fontFamily.display,
        textAlign: 'center',
    },
    overlaySubtitle: {
        fontSize: typography.fontSize.xl,
        color: colors.white,
        opacity: 0.8,
        marginTop: spacing.sm,
        marginBottom: spacing['2xl'],
        textAlign: 'center',
    },
    startButtonContainer: {
        backgroundColor: colors.primary,
        borderRadius: 50,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        elevation: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
    },
    startButton: {
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
        fontSize: typography.fontSize.xl,
        letterSpacing: 1,
        textAlign: 'center',
    },

    // Styles for Code Entry Screen
    entryContainer: {
        flex: 1,
    },
    entryBackground: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    entryContent: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
        maxWidth: 500,
        width: '100%',
        alignSelf: 'center',
    },
    entryHeader: {
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    entryTitle: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    entrySubtitle: {
        fontSize: typography.fontSize.base,
        color: 'rgba(255,255,255,0.7)',
        fontFamily: typography.fontFamily.body,
        textAlign: 'center',
        lineHeight: 24,
    },
    inputContainer: {
        gap: spacing.lg,
    },
    codeInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        fontSize: 32,
        color: colors.white,
        textAlign: 'center',
        fontFamily: 'monospace',
        letterSpacing: 8,
    },
    connectButton: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    connectButtonDisabled: {
        backgroundColor: colors.slate600,
        opacity: 0.7,
        shadowOpacity: 0,
    },
    connectButtonText: {
        color: colors.white,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    backButton: {
        marginTop: spacing['2xl'],
        alignItems: 'center',
    },
    backButtonText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: typography.fontSize.base,
    },
});
