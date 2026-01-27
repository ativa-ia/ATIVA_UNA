import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '@/constants/colors';
import YouTubePlayer from './YouTubePlayer';

interface Props {
    type: 'image' | 'video';
    data: {
        url: string;
        caption?: string;
    };
    controlState?: {
        command: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'seek_relative';
        value?: number;
        timestamp: number;
    };
}

export default function MediaSlide({ type, data, controlState }: Props) {
    const playerControlRef = useRef<any>(null);
    const [isPlaying, setIsPlaying] = useState(true);

    // Extrair ID do vídeo do YouTube
    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const videoId = type === 'video' ? getYouTubeId(data.url) : null;

    // Reagir a comandos externos (Socket)
    useEffect(() => {
        if (controlState) {
            console.log('[MediaSlide] Recebeu comando:', controlState);
            const { command, value } = controlState;

            switch (command) {
                case 'play':
                    setIsPlaying(true);
                    break;
                case 'pause':
                    setIsPlaying(false);
                    break;
                case 'seek':
                    // Seek continua imperativo pois não é um "estado" contínuo
                    if (value !== undefined && playerControlRef.current) {
                        playerControlRef.current.seekTo(value);
                    }
                    break;
                case 'mute':
                    if (playerControlRef.current) playerControlRef.current.mute();
                    break;
                case 'unmute':
                    if (playerControlRef.current) playerControlRef.current.unMute();
                    break;
                case 'seek_relative':
                    if (value !== undefined && playerControlRef.current) {
                        // Obter tempo atual e somar/subtrair
                        try {
                            const currentTime = playerControlRef.current.getCurrentTime();
                            // Promise ou valor direto? A lib geralmente retorna promise se for bridge, mas aqui parece direto
                            // Se for promise, precisaria de async/await, mas useEffect não é async.
                            // Assumindo síncrono ou promise handled
                            Promise.resolve(currentTime).then((t: number) => {
                                const newTime = Math.max(0, t + value);
                                playerControlRef.current.seekTo(newTime);
                            });
                        } catch (e) {
                            console.warn("Error relative seek:", e);
                        }
                    }
                    break;
            }
        }
    }, [controlState]);

    return (
        <View style={styles.container}>
            {type === 'image' ? (
                <Image
                    source={{ uri: data.url }}
                    style={styles.image}
                    resizeMode="contain"
                />
            ) : videoId ? (
                <View style={styles.videoContainer}>
                    <YouTubePlayer
                        videoId={videoId}
                        playing={isPlaying}
                        controlRef={playerControlRef}
                    />
                </View>
            ) : (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>URL de vídeo inválida</Text>
                    <Text style={styles.urlText}>{data.url}</Text>
                </View>
            )}

            {data.caption && (
                <Text style={styles.caption}>{data.caption}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
        width: '100%',
    },
    image: {
        width: '100%',
        height: '90%',
    },
    videoContainer: {
        width: '100%',
        height: '90%', // Deixar espaço para caption
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    errorContainer: {
        padding: 20,
        backgroundColor: colors.slate800,
        borderRadius: 12,
    },
    errorText: {
        color: colors.error,
        fontSize: 24,
        marginBottom: 8,
    },
    urlText: {
        color: colors.slate400,
    },
    caption: {
        marginTop: 16,
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.white,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10
    },
});
