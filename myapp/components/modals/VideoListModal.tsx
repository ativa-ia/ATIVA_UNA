import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';

export interface VideoItem {
    url: string;
    caption: string;
}

interface VideoListModalProps {
    visible: boolean;
    videos: VideoItem[];
    onSelect: (video: VideoItem) => void;
    onClose: () => void;
}

export default function VideoListModal({
    visible,
    videos,
    onSelect,
    onClose
}: VideoListModalProps) {
    const { width, height } = useWindowDimensions();
    const isSmallScreen = width < 400;
    const modalWidth = Math.min(520, width - 32);
    const maxListHeight = Math.min(400, height * 0.5);

    if (!visible || videos.length === 0) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#6366f1', '#a855f7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.header}
                    >
                        <MaterialIcons name="video-library" size={28} color="#FFF" />
                        <Text style={styles.headerTitle}>Vídeos Disponíveis</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <MaterialIcons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Video List */}
                    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                        {videos.map((video, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.videoItem}
                                onPress={() => onSelect(video)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.videoNumber, isSmallScreen && styles.videoNumberSmall]}>
                                    <Text style={[styles.videoNumberText, isSmallScreen && styles.videoNumberTextSmall]}>{index + 1}</Text>
                                </View>
                                <View style={styles.videoIcon}>
                                    <MaterialIcons
                                        name={video.url.includes('youtube') || video.url.includes('youtu.be') ? 'smart-display' : 'play-circle-filled'}
                                        size={32}
                                        color={colors.primary}
                                    />
                                </View>
                                <View style={styles.videoInfo}>
                                    <Text style={styles.videoTitle} numberOfLines={2}>
                                        {video.caption || `Vídeo ${index + 1}`}
                                    </Text>
                                    <Text style={styles.videoUrl} numberOfLines={1}>
                                        {video.url.length > 40 ? video.url.substring(0, 40) + '...' : video.url}
                                    </Text>
                                </View>
                                <MaterialIcons name="play-arrow" size={28} color={colors.primary} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Toque ou diga "Fred, toca o vídeo 1"
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    modalContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        maxWidth: 520,
        width: '100%',
        maxHeight: '85%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 15,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        fontFamily: typography.fontFamily.display,
    },
    closeButton: {
        padding: spacing.xs,
    },
    list: {
        maxHeight: 400,
    },
    listContent: {
        padding: spacing.md,
        gap: spacing.sm,
    },
    videoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.slate50,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        gap: spacing.md,
    },
    videoNumber: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoNumberText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    videoNumberSmall: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    videoNumberTextSmall: {
        fontSize: typography.fontSize.sm,
    },
    videoIcon: {
        marginRight: spacing.xs,
    },
    videoInfo: {
        flex: 1,
    },
    videoTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate900,
        marginBottom: 2,
    },
    videoUrl: {
        fontSize: typography.fontSize.sm,
        color: colors.slate500,
    },
    footer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        backgroundColor: colors.slate50,
    },
    footerText: {
        fontSize: typography.fontSize.sm,
        color: colors.slate600,
        textAlign: 'center',
    },
});
