import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import {
    controlPresentationVideo,
    pdfNextPage,
    pdfPreviousPage,
    pdfZoom,
} from '@/services/presentation';

interface Props {
    code: string;
    visible: boolean;
    contentType: 'video' | 'document';
    onClose: () => void;
}

export default function MediaControlPanel({ code, visible, contentType, onClose }: Props) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [feedbackText, setFeedbackText] = useState<string | null>(null);

    const showFeedback = (text: string) => {
        setFeedbackText(text);
        setTimeout(() => setFeedbackText(null), 1500);
    };

    // ─── Video Controls ───
    const handlePlayPause = async () => {
        const command = isPlaying ? 'pause' : 'play';
        await controlPresentationVideo(code, command);
        setIsPlaying(!isPlaying);
        showFeedback(isPlaying ? '⏸ Pausado' : '▶ Reproduzindo');
    };

    const handleRewind = async () => {
        await controlPresentationVideo(code, 'seek_relative', -10);
        showFeedback('⏪ -10s');
    };

    const handleForward = async () => {
        await controlPresentationVideo(code, 'seek_relative', 10);
        showFeedback('⏩ +10s');
    };

    const handleMuteToggle = async () => {
        const command = isMuted ? 'unmute' : 'mute';
        await controlPresentationVideo(code, command);
        setIsMuted(!isMuted);
        showFeedback(isMuted ? '🔊 Som ativado' : '🔇 Mudo');
    };

    const handleRestart = async () => {
        await controlPresentationVideo(code, 'restart');
        setIsPlaying(true);
        showFeedback('🔄 Reiniciado');
    };

    // ─── Document Controls ───
    const handlePrevPage = async () => {
        await pdfPreviousPage(code);
        showFeedback('← Página anterior');
    };

    const handleNextPage = async () => {
        await pdfNextPage(code);
        showFeedback('→ Próxima página');
    };

    const handleZoomIn = async () => {
        await pdfZoom(code, 'zoom_in');
        showFeedback('🔍+ Zoom In');
    };

    const handleZoomOut = async () => {
        await pdfZoom(code, 'zoom_out');
        showFeedback('🔍- Zoom Out');
    };

    const handleZoomFit = async () => {
        await pdfZoom(code, 'auto');
        showFeedback('📐 Ajustado');
    };

    if (!visible) return null;

    const isVideo = contentType === 'video';
    const headerIcon = isVideo ? 'play-circle-outline' : 'description';
    const headerLabel = isVideo ? 'Controles do Vídeo' : 'Controles do Documento';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.panelWrapper} onStartShouldSetResponder={() => true}>
                    {/* Header */}
                    <LinearGradient
                        colors={isVideo ? ['#312e81', '#4338ca'] : ['#1e3a5f', '#1e40af']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.header}
                    >
                        <View style={styles.headerRow}>
                            <View style={styles.headerLeft}>
                                <MaterialIcons name={headerIcon} size={22} color={colors.white} />
                                <Text style={styles.headerTitle}>{headerLabel}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <MaterialIcons name="close" size={22} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>

                        {/* Content type badge */}
                        <View style={styles.badge}>
                            <View style={styles.badgeDot} />
                            <Text style={styles.badgeText}>
                                {isVideo ? 'Vídeo em reprodução' : 'Documento aberto'}
                            </Text>
                        </View>
                    </LinearGradient>

                    {/* Body */}
                    <View style={styles.body}>
                        {/* Feedback toast */}
                        {feedbackText && (
                            <View style={styles.feedbackBanner}>
                                <Text style={styles.feedbackText}>{feedbackText}</Text>
                            </View>
                        )}

                        {isVideo ? (
                            <View style={styles.controlsGrid}>
                                {/* Row 1: Main playback */}
                                <Text style={styles.sectionLabel}>Reprodução</Text>
                                <View style={styles.controlRow}>
                                    <ControlButton
                                        icon="replay-10"
                                        label="-10s"
                                        onPress={handleRewind}
                                    />
                                    <ControlButton
                                        icon={isPlaying ? 'pause-circle-filled' : 'play-circle-filled'}
                                        label={isPlaying ? 'Pausar' : 'Play'}
                                        onPress={handlePlayPause}
                                        primary
                                        large
                                    />
                                    <ControlButton
                                        icon="forward-10"
                                        label="+10s"
                                        onPress={handleForward}
                                    />
                                </View>

                                {/* Row 2: Secondary */}
                                <Text style={styles.sectionLabel}>Áudio</Text>
                                <View style={styles.controlRow}>
                                    <ControlButton
                                        icon={isMuted ? 'volume-off' : 'volume-up'}
                                        label={isMuted ? 'Desmutar' : 'Mutar'}
                                        onPress={handleMuteToggle}
                                        accent={isMuted}
                                    />
                                    <ControlButton
                                        icon="restart-alt"
                                        label="Reiniciar"
                                        onPress={handleRestart}
                                    />
                                </View>
                            </View>
                        ) : (
                            <View style={styles.controlsGrid}>
                                {/* Document Pages */}
                                <Text style={styles.sectionLabel}>Páginas</Text>
                                <View style={styles.controlRow}>
                                    <ControlButton
                                        icon="navigate-before"
                                        label="Anterior"
                                        onPress={handlePrevPage}
                                    />
                                    <ControlButton
                                        icon="navigate-next"
                                        label="Próxima"
                                        onPress={handleNextPage}
                                        primary
                                        large
                                    />
                                </View>

                                {/* Document Zoom */}
                                <Text style={styles.sectionLabel}>Zoom</Text>
                                <View style={styles.controlRow}>
                                    <ControlButton
                                        icon="zoom-out"
                                        label="Diminuir"
                                        onPress={handleZoomOut}
                                    />
                                    <ControlButton
                                        icon="fit-screen"
                                        label="Ajustar"
                                        onPress={handleZoomFit}
                                    />
                                    <ControlButton
                                        icon="zoom-in"
                                        label="Aumentar"
                                        onPress={handleZoomIn}
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

// ─── Control Button Sub-component ───
interface ControlButtonProps {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    onPress: () => void;
    primary?: boolean;
    large?: boolean;
    accent?: boolean;
}

function ControlButton({ icon, label, onPress, primary, large, accent }: ControlButtonProps) {
    return (
        <TouchableOpacity
            style={[
                styles.controlButton,
                primary && styles.controlButtonPrimary,
                large && styles.controlButtonLarge,
                accent && styles.controlButtonAccent,
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <MaterialIcons
                name={icon}
                size={large ? 36 : 26}
                color={primary ? colors.white : accent ? '#f59e0b' : 'rgba(255,255,255,0.85)'}
            />
            <Text style={[
                styles.controlLabel,
                primary && styles.controlLabelPrimary,
                accent && styles.controlLabelAccent,
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    panelWrapper: {
        width: '90%',
        maxWidth: 420,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#1e1b4b',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 20,
    },

    // Header
    header: {
        paddingTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        fontFamily: typography.fontFamily.display,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Badge
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    badgeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4ade80',
    },
    badgeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.75)',
    },

    // Body
    body: {
        padding: spacing.lg,
    },

    // Feedback
    feedbackBanner: {
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        borderRadius: borderRadius.md,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.4)',
    },
    feedbackText: {
        color: colors.white,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },

    // Controls
    controlsGrid: {
        gap: spacing.sm,
    },
    sectionLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: spacing.xs,
        marginBottom: 2,
    },
    controlRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },

    // Control Button
    controlButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 78,
        height: 78,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        gap: 4,
    },
    controlButtonPrimary: {
        backgroundColor: 'rgba(79, 70, 229, 0.5)',
        borderColor: 'rgba(99, 102, 241, 0.6)',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    controlButtonLarge: {
        width: 90,
        height: 90,
        borderRadius: 24,
    },
    controlButtonAccent: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    controlLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.55)',
        textAlign: 'center',
    },
    controlLabelPrimary: {
        color: 'rgba(255,255,255,0.9)',
    },
    controlLabelAccent: {
        color: '#f59e0b',
    },
});
