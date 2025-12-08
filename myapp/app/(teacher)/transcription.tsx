import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    Alert,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

/**
 * TranscriptionScreen - Tela dedicada de transcrição de aula
 * Permite ao professor ditar conteúdo continuamente
 * Preparada para futura integração com RAG
 */
export default function TranscriptionScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';

    const [transcribedText, setTranscribedText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [interimText, setInterimText] = useState('');

    // Speech Recognition refs
    const recognitionRef = useRef<any>(null);
    const isRecordingRef = useRef(false);
    const accumulatedTextRef = useRef('');

    // Animação do botão
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    // Efeito de pulsação quando gravando
    useEffect(() => {
        if (isRecording) {
            // Animação de pulso
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Animação de brilho
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.3,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            // Parar animações
            pulseAnim.stopAnimation();
            glowAnim.stopAnimation();
            pulseAnim.setValue(1);
            glowAnim.setValue(0);
        }
    }, [isRecording]);

    // Inicializar speech recognition
    useEffect(() => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'pt-BR';
                recognition.maxAlternatives = 1;

                recognition.onresult = (event: any) => {
                    let finalTranscript = '';
                    let interimTranscript = '';

                    // Processar todos os resultados
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript + ' ';
                        } else {
                            interimTranscript = transcript;
                        }
                    }

                    // Adicionar texto final ao acumulado
                    if (finalTranscript) {
                        accumulatedTextRef.current += finalTranscript;
                        setTranscribedText(accumulatedTextRef.current);
                    }

                    // Mostrar texto interim
                    setInterimText(interimTranscript);
                };

                recognition.onerror = (event: any) => {
                    console.error('Speech error:', event.error);
                    if (event.error === 'not-allowed') {
                        Alert.alert('Permissão Negada', 'Permita o acesso ao microfone.');
                        setIsRecording(false);
                        isRecordingRef.current = false;
                    }
                    // Para erros de rede ou outros, tenta reiniciar
                    if (event.error === 'network' || event.error === 'aborted') {
                        if (isRecordingRef.current) {
                            setTimeout(() => {
                                try {
                                    recognition.start();
                                } catch (e) { }
                            }, 100);
                        }
                    }
                };

                recognition.onend = () => {
                    // Reiniciar se ainda estiver gravando
                    if (isRecordingRef.current) {
                        setTimeout(() => {
                            try {
                                recognition.start();
                            } catch (e) {
                                console.log('Não foi possível reiniciar');
                            }
                        }, 100);
                    }
                };

                recognitionRef.current = recognition;
            }
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) { }
            }
        };
    }, []);

    const startRecording = () => {
        if (!recognitionRef.current) {
            Alert.alert("Não suportado", "Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        // Sincronizar texto atual
        accumulatedTextRef.current = transcribedText;
        isRecordingRef.current = true;
        setIsRecording(true);
        setInterimText('');

        try {
            recognitionRef.current.start();
        } catch (e) {
            console.error('Erro ao iniciar:', e);
            isRecordingRef.current = false;
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        setInterimText('');

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) { }
        }
    };

    const toggleRecording = () => {
        if (Platform.OS !== 'web') {
            Alert.alert("Em breve", "Reconhecimento de voz no celular em breve.");
            return;
        }

        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const clearText = () => {
        Alert.alert(
            'Limpar Transcrição',
            'Deseja apagar todo o texto?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Limpar', style: 'destructive', onPress: () => {
                        setTranscribedText('');
                        accumulatedTextRef.current = '';
                        setInterimText('');
                    }
                }
            ]
        );
    };

    const handleTextChange = (text: string) => {
        setTranscribedText(text);
        accumulatedTextRef.current = text;
    };

    const wordCount = transcribedText.split(/\s+/).filter(w => w).length;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Transcrever Aula</Text>
                    <Text style={styles.headerSubtitle}>{subjectName}</Text>
                </View>
                <TouchableOpacity style={styles.clearButton} onPress={clearText}>
                    <MaterialIcons name="delete-outline" size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
            </View>

            {/* Recording Status */}
            {isRecording && (
                <View style={styles.recordingBanner}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Gravando...</Text>
                </View>
            )}

            {/* Transcribed Text Area */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.textContainer}>
                    <TextInput
                        style={styles.textInput}
                        multiline
                        value={transcribedText + (interimText ? interimText : '')}
                        onChangeText={handleTextChange}
                        placeholder="O texto transcrito aparecerá aqui...

Pressione o botão do microfone para começar a falar."
                        placeholderTextColor={colors.zinc500}
                        editable={!isRecording}
                    />
                </View>

                {/* Info */}
                <View style={styles.infoRow}>
                    <Text style={styles.wordCount}>{wordCount} palavras</Text>
                    <Text style={styles.infoText}>
                        {isRecording ? '🎤 Ditando...' : '📝 Pronto para editar'}
                    </Text>
                </View>
            </ScrollView>

            {/* Footer com botão de gravação */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                {/* Anéis de pulsação */}
                {isRecording && (
                    <>
                        <Animated.View
                            style={[
                                styles.pulseRing,
                                {
                                    transform: [{ scale: pulseAnim }],
                                    opacity: glowAnim,
                                }
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.pulseRingOuter,
                                {
                                    transform: [{ scale: pulseAnim }],
                                    opacity: glowAnim,
                                }
                            ]}
                        />
                    </>
                )}

                <Animated.View style={isRecording ? { transform: [{ scale: pulseAnim }] } : undefined}>
                    <TouchableOpacity
                        style={styles.recordButton}
                        onPress={toggleRecording}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={isRecording ? ['#ef4444', '#dc2626'] : ['#8b5cf6', '#a855f7']}
                            style={styles.recordButtonGradient}
                        >
                            <MaterialIcons
                                name={isRecording ? 'stop' : 'mic'}
                                size={36}
                                color={colors.white}
                            />
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>

                <Text style={styles.recordHint}>
                    {isRecording ? 'Toque para parar' : 'Toque para gravar'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        backgroundColor: colors.zinc900,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.zinc800,
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    clearButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingVertical: spacing.sm,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
    },
    recordingText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: '#ef4444',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        flexGrow: 1,
    },
    textContainer: {
        flex: 1,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        minHeight: 350,
    },
    textInput: {
        flex: 1,
        fontSize: typography.fontSize.base,
        color: colors.white,
        lineHeight: 28,
        textAlignVertical: 'top',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    wordCount: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc500,
    },
    infoText: {
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    footer: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
        alignItems: 'center',
    },
    recordButton: {
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    recordButtonGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordHint: {
        marginTop: spacing.sm,
        fontSize: typography.fontSize.sm,
        color: colors.zinc400,
    },
    pulseRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
    },
    pulseRingOuter: {
        position: 'absolute',
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
});
