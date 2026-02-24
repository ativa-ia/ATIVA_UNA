import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    TextInput,
    Image,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Modal,
    FlatList,
    Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import {
    getSubjects,
    Subject,
    refineTranscription,
    socraticChat,
    createSocraticSession,
    getSocraticSessions,
    getSocraticSession,
    SocraticSessionData,
} from '@/services/api';

// @ts-ignore
import AvatarIdle from '@/assets/images/avatar-assistente.png';
// @ts-ignore
import AvatarListening from '@/assets/images/avatar-listening.png';
// @ts-ignore
import AvatarThinking from '@/assets/images/avatar-thinking.png';
// @ts-ignore
import AvatarSpeaking from '@/assets/images/avatar-speaking.png';

const TTS_API_URL = process.env.EXPO_PUBLIC_TTS_API_URL;
const MAX_INPUT_HEIGHT = 120; // approx 5 lines

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function SocraticScreen() {
    const blurActiveElement = () => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            (document.activeElement as HTMLElement)?.blur?.();
        }
    };

    // State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [inputHeight, setInputHeight] = useState(44);
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // UI State — two separate modals
    const [showCurrentChat, setShowCurrentChat] = useState(false);
    const [showPastSessions, setShowPastSessions] = useState(false);
    const [showTextInput, setShowTextInput] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');

    // Subject selection — shown immediately
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [showSubjectPicker, setShowSubjectPicker] = useState(true); // starts open
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    // Session management
    const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
    const [pastSessions, setPastSessions] = useState<SocraticSessionData[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Refs
    const scrollViewRef = useRef<ScrollView>(null);
    const chatScrollRef = useRef<ScrollView>(null);
    const recognitionRef = useRef<any>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const soundRef = useRef<Audio.Sound | null>(null);

    // Avatar animations
    const avatarScale = useRef(new Animated.Value(1)).current;
    const avatarGlow = useRef(new Animated.Value(0)).current;
    const breatheAnim = useRef(new Animated.Value(1)).current;

    // Transcript accordion animation
    const transcriptHeight = useRef(new Animated.Value(0)).current;

    // Dynamic avatar based on state
    const currentAvatar = isSpeaking
        ? AvatarSpeaking
        : isRecording
            ? AvatarListening
            : (isLoading || isRefining)
                ? AvatarThinking
                : AvatarIdle;

    // Load subjects immediately on mount
    useEffect(() => {
        loadSubjects();
    }, []);

    // Cleanup sound on unmount
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    // Pulse animation for recording
    useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: false }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording]);

    // Avatar animation when speaking/processing
    useEffect(() => {
        if (isLoading || isRefining || isSpeaking) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(avatarScale, { toValue: 1.05, duration: 1000, useNativeDriver: false }),
                    Animated.timing(avatarScale, { toValue: 1, duration: 1000, useNativeDriver: false }),
                ])
            ).start();
            Animated.loop(
                Animated.sequence([
                    Animated.timing(avatarGlow, { toValue: 1, duration: 1500, useNativeDriver: false }),
                    Animated.timing(avatarGlow, { toValue: 0.3, duration: 1500, useNativeDriver: false }),
                ])
            ).start();
        } else {
            avatarScale.setValue(1);
            avatarGlow.setValue(0);
        }
    }, [isLoading, isRefining, isSpeaking]);

    // Subtle breathing animation when idle (always alive)
    useEffect(() => {
        const breathe = Animated.loop(
            Animated.sequence([
                Animated.timing(breatheAnim, { toValue: 1.02, duration: 2500, useNativeDriver: false }),
                Animated.timing(breatheAnim, { toValue: 1, duration: 2500, useNativeDriver: false }),
            ])
        );
        breathe.start();
        return () => breathe.stop();
    }, []);

    // Transcript accordion toggle
    useEffect(() => {
        Animated.timing(transcriptHeight, {
            toValue: showTranscript ? 1 : 0,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [showTranscript]);

    const loadSubjects = async () => {
        try {
            setLoadingSubjects(true);
            const data = await getSubjects();
            setSubjects(data);
            if (data.length === 1) {
                setSelectedSubject(data[0]);
                setShowSubjectPicker(false);
            }
            // If more than 1 subject, the picker is already open (starts true)
        } catch (err) {
            console.error('Erro ao carregar disciplinas:', err);
        } finally {
            setLoadingSubjects(false);
        }
    };

    // Create a new session when subject is selected
    useEffect(() => {
        if (selectedSubject) {
            startNewSession();
        }
    }, [selectedSubject]);

    const startNewSession = async () => {
        if (!selectedSubject) return;
        try {
            const result = await createSocraticSession(selectedSubject.id);
            if (result.success && result.session) {
                setCurrentSessionId(result.session.id);
                setMessages([]);
                const welcomeMsg: ChatMessage = {
                    id: 'welcome',
                    role: 'assistant',
                    content: `Olá! 👋 Eu sou o Fred, seu assistente de estudo!\n\nEstou aqui para te ajudar a aprender sobre ${selectedSubject.name}.\n\nMe explique o que você entendeu sobre algum assunto da matéria, e eu vou te desafiar com perguntas!`,
                    timestamp: new Date(),
                };
                setMessages([welcomeMsg]);
            }
        } catch (err) {
            console.error('Erro ao criar sessão:', err);
        }
    };

    // Load past sessions
    const loadPastSessions = async () => {
        if (!selectedSubject) return;
        setLoadingSessions(true);
        try {
            const result = await getSocraticSessions(selectedSubject.id);
            if (result.success && result.sessions) {
                setPastSessions(result.sessions);
            }
        } catch (err) {
            console.error('Erro ao carregar sessões:', err);
        } finally {
            setLoadingSessions(false);
        }
    };

    // Load a past session
    const loadSession = async (sessionId: number) => {
        try {
            const result = await getSocraticSession(sessionId);
            if (result.success && result.session) {
                setCurrentSessionId(result.session.id);
                const loadedMessages: ChatMessage[] = (result.session.messages_data || []).map(
                    (msg, idx) => ({
                        id: `loaded-${idx}`,
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content,
                        timestamp: new Date(msg.timestamp),
                    })
                );
                setMessages(loadedMessages);
                setShowPastSessions(false);
                setShowCurrentChat(true);
            }
        } catch (err) {
            console.error('Erro ao carregar sessão:', err);
        }
    };

    // Auto-scroll chat modal
    useEffect(() => {
        if (showCurrentChat && messages.length > 0) {
            setTimeout(() => {
                chatScrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, showCurrentChat]);

    // ===== TTS =====
    const playTTS = async (text: string) => {
        if (!TTS_API_URL) {
            console.warn('TTS_API_URL não configurado');
            return;
        }
        try {
            // NOT setting isSpeaking here — wait for audio to actually play
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }
            const response = await fetch(TTS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            if (!response.ok) {
                console.error('TTS API error:', response.status);
                return;
            }
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const { sound } = await Audio.Sound.createAsync(
                { uri: audioUrl },
                { shouldPlay: true }
            );
            soundRef.current = sound;

            // Only show "Falando..." when audio actually starts playing
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    if (status.isPlaying && !isSpeaking) {
                        setIsSpeaking(true);
                    }
                    if (status.didJustFinish) {
                        setIsSpeaking(false);
                        sound.unloadAsync();
                        soundRef.current = null;
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao reproduzir TTS:', error);
            setIsSpeaking(false);
        }
    };

    // ===== STT (Web Speech API) =====
    const startRecording = () => {
        if (Platform.OS !== 'web') return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Seu navegador não suporta reconhecimento de voz.');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.continuous = true;
        let finalTranscript = '';

        recognition.onresult = (event: any) => {
            let currentFinal = '';
            let interimText = '';
            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    currentFinal += transcript + ' ';
                } else {
                    interimText += transcript;
                }
            }
            finalTranscript = currentFinal;
            const fullText = (currentFinal + interimText).trim();
            setInputText(fullText);
            setLiveTranscript(fullText);
        };

        recognition.onerror = (event: any) => {
            console.error('STT Error:', event.error);
            setIsRecording(false);
        };

        // AUTO-SEND on end
        recognition.onend = () => {
            setIsRecording(false);
            const textToSend = finalTranscript.trim();
            if (textToSend) {
                setInputText(textToSend);
                setTimeout(() => {
                    handleSendText(textToSend);
                }, 200);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
        setLiveTranscript('');
        setInputText('');
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // ===== Send Message =====
    const handleSendText = async (text: string) => {
        const cleanText = text.trim();
        if (!cleanText || isLoading || !selectedSubject || !currentSessionId) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: cleanText,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLiveTranscript('');
        setShowTextInput(false);
        setInputHeight(44);

        setIsLoading(true);

        try {
            setIsRefining(true);
            const refineResult = await refineTranscription(cleanText);
            const refinedText = refineResult.success && refineResult.refined_text
                ? refineResult.refined_text
                : cleanText;
            setIsRefining(false);

            if (refinedText !== cleanText) {
                setMessages(prev => prev.map(m =>
                    m.id === userMsg.id ? { ...m, content: refinedText } : m
                ));
            }

            const result = await socraticChat(
                currentSessionId,
                selectedSubject.name,
                refinedText
            );

            if (result.success && result.response) {
                const assistantMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: result.response,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, assistantMsg]);
                playTTS(result.response);
            } else {
                const errorMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: '😕 Desculpe, tive um problema ao processar sua mensagem. Pode tentar novamente?',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '❌ Erro de conexão. Verifique sua internet e tente novamente.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            setIsRefining(false);
        }
    };

    const handleSend = () => {
        handleSendText(inputText);
    };

    // ===== Render: Message Bubble =====
    const renderMessage = (msg: ChatMessage) => {
        const isUser = msg.role === 'user';
        return (
            <View
                key={msg.id}
                style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAssistant,
                ]}
            >
                {!isUser && (
                    <Image source={AvatarIdle} style={styles.chatAvatar} />
                )}
                <View
                    style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.assistantBubble,
                    ]}
                >
                    <Text style={[
                        styles.messageText,
                        isUser ? styles.userMessageText : styles.assistantMessageText,
                    ]}>
                        {msg.content}
                    </Text>
                    <Text style={[
                        styles.messageTime,
                        isUser ? styles.userMessageTime : styles.assistantMessageTime,
                    ]}>
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    // ===== MODAL 1: Subject Picker (Floating Card) =====
    const renderSubjectPicker = () => (
        <Modal
            visible={showSubjectPicker}
            transparent
            animationType="fade"
            onRequestClose={() => {
                if (selectedSubject) setShowSubjectPicker(false);
            }}
        >
            <View style={styles.floatingOverlay}>
                <View style={styles.floatingCard}>
                    {/* Compact gradient header */}
                    <LinearGradient
                        colors={['#4f46e5', '#7c3aed']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.floatingCardHeader}
                    >
                        <Image source={AvatarIdle} style={styles.floatingAvatar} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.floatingCardTitle}>Escolha a Disciplina</Text>
                            <Text style={styles.floatingCardSubtitle}>
                                Sobre qual matéria vamos conversar?
                            </Text>
                        </View>
                    </LinearGradient>

                    {loadingSubjects ? (
                        <View style={styles.floatingLoading}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={{ color: '#94a3b8', marginTop: 8 }}>Carregando...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={subjects}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={styles.floatingList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.subjectItem,
                                        selectedSubject?.id === item.id && styles.subjectItemActive,
                                    ]}
                                    onPress={() => {
                                        blurActiveElement();
                                        setSelectedSubject(item);
                                        setShowSubjectPicker(false);
                                        setMessages([]);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcons
                                        name="school"
                                        size={22}
                                        color={selectedSubject?.id === item.id ? colors.white : colors.primary}
                                    />
                                    <Text style={[
                                        styles.subjectItemText,
                                        selectedSubject?.id === item.id && styles.subjectItemTextActive,
                                    ]}>
                                        {item.name}
                                    </Text>
                                    {selectedSubject?.id === item.id && (
                                        <MaterialIcons name="check-circle" size={20} color={colors.white} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );

    // ===== MODAL 2: Current Chat =====
    const renderCurrentChat = () => (
        <Modal
            visible={showCurrentChat}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowCurrentChat(false)}
        >
            <View style={styles.chatModalContainer}>
                <View style={styles.chatModalHeader}>
                    <TouchableOpacity onPress={() => { blurActiveElement(); setShowCurrentChat(false); }} style={styles.chatModalClose}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.slate800} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={styles.chatModalTitle}>Conversa Atual</Text>
                        <Text style={styles.chatModalSubtitle}>{selectedSubject?.name || ''}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    ref={chatScrollRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                >
                    {messages.map(renderMessage)}
                    {isLoading && (
                        <View style={styles.typingIndicator}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.typingText}>
                                {isRefining ? 'Processando...' : 'Fred está pensando...'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );

    // ===== MODAL 3: Past Sessions (History) =====
    const renderPastSessions = () => (
        <Modal
            visible={showPastSessions}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowPastSessions(false)}
        >
            <View style={styles.historyContainer}>
                <View style={styles.historyHeader}>
                    <Text style={styles.historyTitle}>Conversas Anteriores</Text>
                    <TouchableOpacity onPress={() => { blurActiveElement(); setShowPastSessions(false); }} style={styles.closeHistoryButton}>
                        <MaterialIcons name="close" size={24} color={colors.slate600} />
                    </TouchableOpacity>
                </View>

                <View style={styles.historyActions}>
                    <TouchableOpacity
                        style={styles.newSessionButton}
                        onPress={() => {
                            blurActiveElement();
                            startNewSession();
                            setShowPastSessions(false);
                        }}
                    >
                        <MaterialIcons name="add" size={18} color={colors.primary} />
                        <Text style={styles.newSessionButtonText}>Nova Conversa</Text>
                    </TouchableOpacity>
                </View>

                {loadingSessions ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ padding: 40 }} />
                ) : pastSessions.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="chat-bubble-outline" size={48} color="#cbd5e1" />
                        <Text style={styles.emptySessionsText}>Nenhuma conversa anterior</Text>
                    </View>
                ) : (
                    <FlatList
                        data={pastSessions}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.sessionsList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.sessionItem,
                                    item.id === currentSessionId && styles.sessionItemActive,
                                ]}
                                onPress={() => {
                                    blurActiveElement();
                                    loadSession(item.id);
                                }}
                            >
                                <View style={styles.sessionItemIcon}>
                                    <MaterialIcons name="chat" size={20} color={colors.primary} />
                                </View>
                                <View style={styles.sessionItemContent}>
                                    <Text style={styles.sessionItemTitle} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={styles.sessionItemMeta}>
                                        {item.message_count} msgs · {new Date(item.updated_at).toLocaleDateString('pt-BR')}
                                    </Text>
                                </View>
                                <View style={[
                                    styles.sessionStatusDot,
                                    item.status === 'active' ? styles.statusDotActive : styles.statusDotFinished
                                ]} />
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>
        </Modal>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Top Controls */}
                <View style={styles.topControls}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => router.canGoBack() ? router.back() : router.push('/(student)/dashboard')}
                    >
                        <MaterialIcons name="arrow-back" size={28} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.subjectPill}
                        onPress={() => {
                            blurActiveElement();
                            setShowSubjectPicker(true);
                        }}
                    >
                        <MaterialIcons name="school" size={16} color="white" />
                        <Text style={styles.subjectPillText}>
                            {selectedSubject?.name || 'Selecionar'}
                        </Text>
                        <MaterialIcons name="expand-more" size={16} color="white" />
                    </TouchableOpacity>

                    {/* History button -> opens past sessions */}
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => {
                            blurActiveElement();
                            loadPastSessions();
                            setShowPastSessions(true);
                        }}
                    >
                        <MaterialIcons name="history" size={28} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>

                {/* Main Avatar Area — clean, no text */}
                <View style={styles.avatarContainer}>
                    <Animated.View style={[
                        styles.avatarWrapper,
                        { transform: [{ scale: Animated.multiply(avatarScale, breatheAnim) }] }
                    ]}>
                        <Animated.View style={[
                            styles.avatarGlow,
                            { opacity: avatarGlow, transform: [{ scale: Animated.add(1, avatarGlow) }] }
                        ]} />
                        <Image source={currentAvatar} style={styles.mainAvatar} resizeMode="cover" />
                    </Animated.View>

                    <View style={styles.statusContainer}>
                        {isSpeaking ? (
                            <View style={[styles.statusBadge, styles.statusBadgeSpeaking]}>
                                <MaterialIcons name="volume-up" size={18} color="white" style={{ marginRight: 6 }} />
                                <Text style={styles.statusText}>Falando...</Text>
                            </View>
                        ) : isLoading || isRefining ? (
                            <View style={styles.statusBadge}>
                                <ActivityIndicator size="small" color="white" style={{ marginRight: 6 }} />
                                <Text style={styles.statusText}>
                                    {isRefining ? 'Processando...' : 'Pensando...'}
                                </Text>
                            </View>
                        ) : isRecording ? (
                            <View style={[styles.statusBadge, styles.statusBadgeRecording]}>
                                <View style={styles.recordingDot} />
                                <Text style={styles.statusText}>Ouvindo você...</Text>
                            </View>
                        ) : (
                            <Text style={styles.instructionText}>
                                Toque no microfone para explicar
                            </Text>
                        )}
                    </View>
                </View>

                {/* Expandable Transcript (STT live text) */}
                {(liveTranscript || isRecording) && (
                    <View style={styles.transcriptSection}>
                        <TouchableOpacity
                            style={styles.transcriptToggle}
                            onPress={() => setShowTranscript(!showTranscript)}
                        >
                            <MaterialIcons
                                name={showTranscript ? 'expand-less' : 'expand-more'}
                                size={20}
                                color="rgba(255,255,255,0.7)"
                            />
                            <Text style={styles.transcriptToggleText}>
                                {showTranscript ? 'Ocultar transcrição' : 'Ver transcrição'}
                            </Text>
                        </TouchableOpacity>

                        <Animated.View style={[
                            styles.transcriptContent,
                            {
                                maxHeight: transcriptHeight.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 120],
                                }),
                                opacity: transcriptHeight,
                            }
                        ]}>
                            <Text style={styles.transcriptText}>
                                {liveTranscript || 'Aguardando fala...'}
                            </Text>
                        </Animated.View>
                    </View>
                )}

                {/* Bottom Controls */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.bottomControls}
                >
                    {showTextInput ? (
                        /* Multiline text input */
                        <View style={styles.textInputContainer}>
                            <TouchableOpacity
                                onPress={() => { setShowTextInput(false); setInputHeight(44); }}
                                style={styles.closeInputButton}
                            >
                                <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.mainInput, { height: Math.min(inputHeight, MAX_INPUT_HEIGHT) }]}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Digite sua resposta..."
                                placeholderTextColor="rgba(255,255,255,0.5)"
                                autoFocus
                                multiline
                                textAlignVertical="top"
                                scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
                                onContentSizeChange={(e) => {
                                    setInputHeight(Math.max(44, e.nativeEvent.contentSize.height));
                                }}
                                blurOnSubmit={false}
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                                onPress={handleSend}
                                disabled={!inputText.trim()}
                            >
                                <MaterialIcons name="send" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.controlsRow}>
                            {/* Keyboard (text fallback) */}
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => setShowTextInput(true)}
                            >
                                <MaterialIcons name="keyboard" size={24} color="rgba(255,255,255,0.6)" />
                            </TouchableOpacity>

                            {/* Main Mic Button */}
                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <TouchableOpacity
                                    style={[
                                        styles.mainMicButton,
                                        isRecording && styles.mainMicButtonRecording
                                    ]}
                                    onPress={toggleRecording}
                                    activeOpacity={0.8}
                                    disabled={isLoading}
                                >
                                    <MaterialIcons
                                        name={isRecording ? 'stop' : 'mic'}
                                        size={48}
                                        color={isRecording ? colors.white : colors.primary}
                                    />
                                </TouchableOpacity>
                            </Animated.View>

                            {/* Chat button -> opens current conversation */}
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => setShowCurrentChat(true)}
                            >
                                <MaterialIcons name="chat" size={24} color="rgba(255,255,255,0.6)" />
                                {messages.length > 1 && (
                                    <View style={styles.chatBadge}>
                                        <Text style={styles.chatBadgeText}>{messages.length - 1}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>

                {/* Modals */}
                {renderSubjectPicker()}
                {renderCurrentChat()}
                {renderPastSessions()}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        justifyContent: 'space-between',
    },

    // Top Controls
    topControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        zIndex: 10,
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    subjectPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    subjectPillText: {
        color: 'white',
        fontWeight: '600',
        fontSize: typography.fontSize.sm,
    },

    // Avatar Area (clean — no text)
    avatarContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20,
        paddingHorizontal: spacing.lg,
    },
    avatarWrapper: {
        width: 220,
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
        position: 'relative',
    },
    avatarGlow: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#a78bfa',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 30,
        elevation: 15,
    },
    mainAvatar: {
        width: 220,
        height: 220,
        borderRadius: 110,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.85)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    statusContainer: {
        alignItems: 'center',
        marginTop: spacing.md,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    statusBadgeRecording: {
        backgroundColor: 'rgba(220, 38, 38, 0.3)',
    },
    statusBadgeSpeaking: {
        backgroundColor: 'rgba(34, 197, 94, 0.3)',
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
        marginRight: 8,
    },
    statusText: {
        color: 'white',
        fontSize: typography.fontSize.base,
        fontWeight: '600',
    },
    instructionText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.fontSize.base,
        marginTop: spacing.sm,
    },

    // Expandable Transcript
    transcriptSection: {
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.sm,
    },
    transcriptToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        gap: 4,
    },
    transcriptToggleText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.fontSize.sm,
    },
    transcriptContent: {
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
    },
    transcriptText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: typography.fontSize.sm,
        lineHeight: 20,
        paddingVertical: spacing.sm,
    },

    // Bottom Controls
    bottomControls: {
        paddingHorizontal: spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 20 : 40,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
    },
    mainMicButton: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    mainMicButtonRecording: {
        backgroundColor: '#ef4444',
    },
    secondaryButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    chatBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#ef4444',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },

    // Text Input — multiline
    textInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 24,
        padding: 6,
    },
    mainInput: {
        flex: 1,
        color: 'white',
        fontSize: typography.fontSize.base,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        minHeight: 44,
        maxHeight: MAX_INPUT_HEIGHT,
        lineHeight: 22,
    },
    closeInputButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
        opacity: 0.7,
    },

    // ===== Floating Subject Picker =====
    floatingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    floatingCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        maxHeight: '70%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },
    floatingCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    floatingAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    floatingCardTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: '700',
        color: 'white',
    },
    floatingCardSubtitle: {
        fontSize: typography.fontSize.xs,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    floatingLoading: {
        padding: 40,
        alignItems: 'center',
    },
    floatingList: {
        padding: 12,
        gap: 8,
    },
    subjectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        gap: 12,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    subjectItemActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primaryDark,
    },
    subjectItemText: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    subjectItemTextActive: {
        color: colors.white,
    },

    // ===== Current Chat Modal =====
    chatModalContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    chatModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    chatModalClose: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatModalTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.slate800,
    },
    chatModalSubtitle: {
        fontSize: typography.fontSize.xs,
        color: '#94a3b8',
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    typingText: {
        color: '#94a3b8',
        fontSize: typography.fontSize.sm,
        fontStyle: 'italic',
    },

    // ===== Past Sessions (History) Modal =====
    historyContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    historyTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.slate800,
    },
    closeHistoryButton: {
        padding: 8,
    },
    historyActions: {
        padding: spacing.md,
    },
    newSessionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#ede9fe',
    },
    newSessionButtonText: {
        color: colors.primary,
        fontSize: typography.fontSize.base,
        fontWeight: '600',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptySessionsText: {
        color: '#94a3b8',
        fontSize: typography.fontSize.base,
    },
    sessionsList: {
        paddingHorizontal: spacing.md,
        gap: 8,
    },
    sessionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: 'white',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 12,
    },
    sessionItemActive: {
        borderColor: colors.primary,
        backgroundColor: '#f5f3ff',
    },
    sessionItemIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ede9fe',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sessionItemContent: {
        flex: 1,
    },
    sessionItemTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
        color: colors.slate800,
    },
    sessionItemMeta: {
        fontSize: typography.fontSize.xs,
        color: '#94a3b8',
        marginTop: 2,
    },
    sessionStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusDotActive: {
        backgroundColor: '#22c55e',
    },
    statusDotFinished: {
        backgroundColor: '#94a3b8',
    },

    // Messages (shared by chat modal)
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: spacing.md,
        gap: spacing.md,
        paddingBottom: 40,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    messageRowUser: {
        justifyContent: 'flex-end',
    },
    messageRowAssistant: {
        justifyContent: 'flex-start',
    },
    chatAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
    },
    userBubble: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 2,
    },
    assistantBubble: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userMessageText: {
        color: 'white',
    },
    assistantMessageText: {
        color: colors.slate800,
    },
    messageTime: {
        fontSize: 10,
        textAlign: 'right',
        marginTop: 4,
    },
    userMessageTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    assistantMessageTime: {
        color: '#94a3b8',
    },
});
