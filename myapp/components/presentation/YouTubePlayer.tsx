import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';

interface Props {
    videoId: string;
    playing: boolean;
    onReady?: () => void;
    onStateChange?: (state: string) => void;
    controlRef?: any;
}

export default function YouTubePlayer({ videoId, playing, onReady, onStateChange, controlRef }: Props) {
    const playerRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);

    // Carregar API do YouTube
    useEffect(() => {
        let mounted = true;

        if (Platform.OS === 'web') {
            // @ts-ignore
            if (!window.YT) {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

                // @ts-ignore
                window.onYouTubeIframeAPIReady = () => {
                    if (mounted) loadPlayer();
                };
            } else {
                loadPlayer();
            }
        }

        return () => {
            mounted = false;
            // Cleanup player instance
            if (playerRef.current) {
                try {
                    // @ts-ignore
                    const player = playerRef.current;
                    if (typeof player.destroy === 'function') {
                        player.destroy();
                    }
                } catch (e) {
                    console.warn('Error destroying player:', e);
                }
                playerRef.current = null;
            }
        };
    }, [videoId]);

    const loadPlayer = () => {
        // @ts-ignore
        if (window.YT && window.YT.Player) {
            // @ts-ignore
            playerRef.current = new window.YT.Player(`youtube-player-${videoId}`, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    autoplay: playing ? 1 : 0,
                    controls: 0,
                    rel: 0,
                    modestbranding: 1,
                    mute: 1, // Começa mudo para o autoplay funcionar
                },
                events: {
                    onReady: (event: any) => {
                        setIsReady(true);
                        if (onReady) onReady();
                        // Forçar play se estiver marcado como playing
                        if (playing) {
                            event.target.playVideo();
                        }
                    },
                    onStateChange: (event: any) => {
                        if (onStateChange) onStateChange(event.data);

                        // Tentar desmutar assim que começar a tocar (1 = PLAYING)
                        if (event.data === 1) {
                            // Delay para garantir que o player renderizou
                            setTimeout(() => {
                                // 1. Rodar o hack do clique
                                simularCliqueHumano(`btn-hack-${videoId}`);

                                // 2. Tentar desmutar logo em seguida (assumindo que o hack enganou o browser)
                                setTimeout(() => {
                                    if (playerRef.current) {
                                        try {
                                            console.log("Tentando desmutar após hack...");
                                            playerRef.current.unMute();
                                            playerRef.current.setVolume(100);
                                        } catch (e) {
                                            console.warn("Falha ao desmutar:", e);
                                        }
                                    }
                                }, 300); // Dá um tempo para os eventos do hack dispararem
                            }, 500);
                        }
                    },
                },
            });
        }
    };

    // Expor controles via ref
    useEffect(() => {
        if (controlRef && playerRef.current) {
            controlRef.current = {
                play: () => playerRef.current.playVideo(),
                pause: () => playerRef.current.pauseVideo(),
                seekTo: (seconds: number) => playerRef.current.seekTo(seconds, true),
                unMute: () => playerRef.current.unMute(),
                mute: () => playerRef.current.mute(),
                getCurrentTime: () => playerRef.current.getCurrentTime(),
            };
        }
    }, [isReady, controlRef]);

    // Reagir a prop 'playing'
    useEffect(() => {
        if (playerRef.current && isReady) {
            try {
                // @ts-ignore
                const playerState = playerRef.current.getPlayerState();

                if (playing) {
                    // Só dar play se não estiver tocando (1 = playing, 3 = buffering)
                    if (playerState !== 1 && playerState !== 3) {
                        playerRef.current.playVideo();
                    }
                } else {
                    // Só dar pause se estiver tocando ou bufferizando
                    if (playerState === 1 || playerState === 3) {
                        playerRef.current.pauseVideo();
                    }
                }
            } catch (e) {
                console.error("YouTube Player Error:", e);
            }
        }
    }, [playing, isReady]);

    if (Platform.OS !== 'web') {
        return <View style={styles.container} />; // Fallback para native (futuro)
    }

    return (
        <View style={styles.container}>
            {!isReady && (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color="#FF0000" />
                </View>
            )}
            <div id={`youtube-player-${videoId}`} style={{ width: '100%', height: '100%' }} />

            {/* Botão invisível para hack de click humano */}
            <button
                id={`btn-hack-${videoId}`}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 9999,
                    opacity: 0.01,
                    width: '50px',
                    height: '50px',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    backgroundColor: '#FFF',
                    cursor: 'pointer'
                }}
                onClick={(e) => {
                    console.log('Botão Hack CLICADO com sucesso!', { isTrusted: e.isTrusted });

                    if (playerRef.current) {
                        try {
                            playerRef.current.unMute();
                            playerRef.current.setVolume(100);
                        } catch (err) {
                            console.warn("Erro ao tentar desmutar no click simulado:", err);
                        }
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loading: {
        position: 'absolute',
        zIndex: 10,
    }
});

/**
 * Simula um clique humano em um elemento pelo ID
 * @param {string} elementId - O ID do botão
 */
function simularCliqueHumano(elementId: string) {
    if (typeof document === 'undefined') return;

    const botao = document.getElementById(elementId);

    if (!botao) {
        console.error("Botão com ID '" + elementId + "' não encontrado.");
        return;
    }

    // 1. Focar no elemento (como se o usuário tivesse navegado até ele)
    botao.focus();

    // 2. Criar os eventos de mouse
    const eventos = ['mousedown', 'mouseup', 'click'];

    eventos.forEach(tipoEvento => {
        const evento = new MouseEvent(tipoEvento, {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1 // Botão esquerdo
        });

        // Pequeno delay aleatório entre os estados do clique para parecer humano
        const delay = Math.floor(Math.random() * 50) + 20;

        setTimeout(() => {
            botao.dispatchEvent(evento);
            console.log(`Evento ${tipoEvento} disparado para ${elementId}.`);
        }, delay);
    });
}
