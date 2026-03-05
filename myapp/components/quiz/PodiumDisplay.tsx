import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface PodiumStudent {
    position: number;
    student_name: string;
    points: number;
    percentage: number;
    score: number;
    total: number;
}

interface PodiumDisplayProps {
    topStudents: PodiumStudent[];
}

interface PodiumPlaceProps {
    student?: PodiumStudent;
    position: number;
    height: number;
    delay: number;
}

function Spotlight({ delay, side }: { delay: number; side: 'left' | 'right' }) {
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 2600,
                    delay: delay,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                    toValue: 0,
                    duration: 2600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: side === 'left' ? ['-15deg', '15deg'] : ['15deg', '-15deg'],
    });

    return (
        <Animated.View
            style={[
                styles.spotlightContainer,
                side === 'left' ? { left: '20%' } : { right: '20%' },
                {
                    transform: [
                        { translateX: side === 'left' ? -50 : 50 },
                        { rotate: rotation },
                        { translateY: -100 } // Pivot point adjustment
                    ],
                },
            ]}
        >
            <View style={styles.spotlightBeam} />
        </Animated.View>
    );
}

function ShineEffect() {
    const shineAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.delay(1000), // Wait a bit between shines
                Animated.timing(shineAnim, {
                    toValue: 200,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shineAnim, { // Reset quickly invisible
                    toValue: -100,
                    duration: 0,
                    useNativeDriver: true
                })
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.shine,
                {
                    transform: [{ translateX: shineAnim }, { rotate: '45deg' }],
                },
            ]}
        />
    );
}

// ... (PodiumPlace component - add ShineEffect inside studentCard for winner)

function PodiumPlace({ student, position, height, delay }: PodiumPlaceProps) {
    const slideAnim = useRef(new Animated.Value(200)).current;
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const winnerFloatAnim = useRef(new Animated.Value(0)).current;
    const winnerGlowAnim = useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        // Animação de subida do pódio
        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 8,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 8,
                }),
            ]),
        ]).start();

        if (position === 1) {
            const floatLoop = Animated.loop(
                Animated.sequence([
                    Animated.timing(winnerFloatAnim, {
                        toValue: -5,
                        duration: 900,
                        easing: Easing.inOut(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(winnerFloatAnim, {
                        toValue: 0,
                        duration: 900,
                        easing: Easing.inOut(Easing.quad),
                        useNativeDriver: true,
                    }),
                ])
            );

            const glowLoop = Animated.loop(
                Animated.sequence([
                    Animated.timing(winnerGlowAnim, {
                        toValue: 0.9,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                    Animated.timing(winnerGlowAnim, {
                        toValue: 0.35,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ])
            );

            floatLoop.start();
            glowLoop.start();

            return () => {
                floatLoop.stop();
                glowLoop.stop();
            };
        }
    }, []);

    const getMedalColor = () => {
        // ... (same as before)
        switch (position) {
            case 1: return '#FFD700'; // Ouro
            case 2: return '#C0C0C0'; // Prata
            case 3: return '#CD7F32'; // Bronze
            default: return colors.slate400;
        }
    };

    const getMedalIcon = () => {
        switch (position) {
            case 1: return 'emoji-events';
            case 2: return 'military-tech';
            case 3: return 'workspace-premium';
            default: return 'stars';
        }
    };

    if (!student) {
        // ... (same as before)
        return (
            <View style={[styles.placeContainer, { height }]}>
                <View style={styles.emptyPlace}>
                    <Text style={styles.emptyText}>-</Text>
                </View>
                <View style={[styles.podiumBase, { height, backgroundColor: colors.slate200 }]}>
                    <Text style={styles.positionNumber}>{position}º</Text>
                </View>
            </View>
        );
    }

    return (
        <Animated.View
            style={[
                styles.placeContainer,
                {
                    transform: [
                        { translateY: slideAnim },
                        { scale: scaleAnim },
                    ],
                },
            ]}
        >
            {/* Estudante no topo do pódio */}
            <Animated.View
                style={[
                    styles.studentCard,
                    position === 1 && styles.studentCardWinner,
                    position === 1 && {
                        opacity: winnerGlowAnim.interpolate({
                            inputRange: [0.35, 0.9],
                            outputRange: [0.96, 1],
                        }),
                        transform: [{ translateY: winnerFloatAnim }],
                    },
                ]}
            >
                {position === 1 && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.winnerAura,
                            {
                                opacity: winnerGlowAnim,
                                transform: [
                                    {
                                        scale: winnerGlowAnim.interpolate({
                                            inputRange: [0.35, 0.9],
                                            outputRange: [0.96, 1.08],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    />
                )}

                <View style={[styles.rankChip, { borderColor: getMedalColor(), backgroundColor: `${getMedalColor()}22` }]}>
                    <Text style={[styles.rankChipText, { color: getMedalColor() }]}>{position}º LUGAR</Text>
                </View>

                <View style={[styles.medalChip, { borderColor: getMedalColor() }]}>
                    <MaterialIcons name={getMedalIcon()} size={position === 1 ? 24 : 20} color={getMedalColor()} />
                </View>
                <Text style={styles.studentName} numberOfLines={1}>
                    {student.student_name}
                </Text>
                <View style={[styles.pointsBadge, { backgroundColor: getMedalColor() }]}>
                    <Text style={styles.pointsText}>{student.points}</Text>
                    <Text style={styles.pointsLabel}>pts</Text>
                </View>
                <Text style={styles.percentage}>{student.percentage.toFixed(0)}%</Text>
                <Text style={styles.score}>{student.score}/{student.total}</Text>

                {/* Shine effect only for 1st place */}
                {position === 1 && <ShineEffect />}
            </Animated.View>

            {/* Base do pódio */}
            <View style={[styles.podiumBase, { height, backgroundColor: getMedalColor() }]}>
                <View style={styles.podiumTopEdge} />
                <Text style={styles.positionNumber}>{position}º</Text>
            </View>
        </Animated.View>
    );
}

function Confetti() {
    // Increased count
    const confettiPieces = Array.from({ length: 40 }, (_, i) => i);

    return (
        <View style={styles.confettiContainer}>
            {confettiPieces.map((i) => (
                <ConfettiPiece key={i} index={i} />
            ))}
        </View>
    );
}

function ConfettiPiece({ index }: { index: number }) {
    const fallAnim = useRef(new Animated.Value(-50)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(1)).current;
    const swayAnim = useRef(new Animated.Value(0)).current; // New sway

    useEffect(() => {
        const randomDelay = Math.random() * 2000;
        const randomDuration = 3000 + Math.random() * 2000; // Slower fall
        const randomX = Math.random() * width;

        Animated.parallel([
            Animated.timing(fallAnim, {
                toValue: height + 100, // Fall off screen
                duration: randomDuration,
                delay: randomDelay,
                useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
                toValue: 360 * (2 + Math.random() * 2),
                duration: randomDuration,
                delay: randomDelay,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.delay(randomDelay + randomDuration * 0.7),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: randomDuration * 0.3,
                    useNativeDriver: true,
                }),
            ]),
            // Sway animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(swayAnim, {
                        toValue: 20,
                        duration: 1000 + Math.random() * 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(swayAnim, {
                        toValue: -20,
                        duration: 1000 + Math.random() * 500,
                        useNativeDriver: true,
                    })
                ])
            )
        ]).start();
    }, []);

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#a78bfa', '#f472b6'];
    const randomColor = colors[index % colors.length];
    const randomX = (index * 37) % width;
    const shape = index % 3 === 0 ? 'circle' : index % 3 === 1 ? 'rect' : 'twist'; // Variants

    return (
        <Animated.View
            style={[
                styles.confettiPiece,
                shape === 'circle' && { borderRadius: 5 },
                shape === 'twist' && { width: 5, height: 15 },
                {
                    backgroundColor: randomColor,
                    left: randomX,
                    transform: [
                        { translateY: fallAnim },
                        { translateX: swayAnim },
                        {
                            rotate: rotateAnim.interpolate({
                                inputRange: [0, 360],
                                outputRange: ['0deg', '360deg'],
                            })
                        },
                        { rotateX: shape === 'twist' ? rotateAnim.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '1080deg'] }) : '0deg' }
                    ],
                    opacity: opacityAnim,
                },
            ]}
        />
    );
}

export default function PodiumDisplay({ topStudents }: PodiumDisplayProps) {
    // ... (podiumData logic - same)
    const podiumData = [
        topStudents.find(s => s.position === 1),
        topStudents.find(s => s.position === 2),
        topStudents.find(s => s.position === 3),
    ];

    return (
        <View style={styles.container}>
            {/* Spotlights behind */}
            <Spotlight delay={0} side="left" />
            <Spotlight delay={1000} side="right" />

            {/* Título com emoji de troféu */}
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <MaterialIcons name="emoji-events" size={32} color="#facc15" />
                    <Text style={styles.title}>Pódio Final</Text>
                    <MaterialIcons name="emoji-events" size={32} color="#facc15" />
                </View>
                <Text style={styles.subtitle}>Top 3 Melhores Desempenhos</Text>
            </View>

            <View style={styles.podiumStageArea}>
                <View pointerEvents="none" style={styles.stageAmbientGlow} />
                <View pointerEvents="none" style={styles.stageFloor}>
                    <View style={styles.stageTopLine} />
                </View>

                {/* Pódio */}
                <View style={styles.podiumContainer}>
                    {/* 2º Lugar (Esquerda) */}
                    <PodiumPlace
                        student={podiumData[1]}
                        position={2}
                        height={120}
                        delay={200}
                    />

                    {/* 1º Lugar (Centro, mais alto) */}
                    <PodiumPlace
                        student={podiumData[0]}
                        position={1}
                        height={160}
                        delay={0}
                    />

                    {/* 3º Lugar (Direita) */}
                    <PodiumPlace
                        student={podiumData[2]}
                        position={3}
                        height={90}
                        delay={400}
                    />
                </View>
            </View>

            {/* Confetes animados para o vencedor */}
            {podiumData[0] && <Confetti />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: spacing.xl,
        paddingBottom: 0,
        paddingHorizontal: spacing.md,
        overflow: 'hidden',
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.lg,
        zIndex: 5,
    },
    title: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.xs,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    subtitle: {
        fontSize: typography.fontSize.base,
        color: 'rgba(226,232,240,0.86)',
        marginTop: 2,
        letterSpacing: 0.3,
    },
    podiumStageArea: {
        flex: 1,
        justifyContent: 'flex-end',
        position: 'relative',
    },
    stageAmbientGlow: {
        position: 'absolute',
        left: 40,
        right: 40,
        bottom: 120,
        height: 140,
        borderRadius: 100,
        backgroundColor: 'rgba(99,102,241,0.22)',
        zIndex: 1,
    },
    stageFloor: {
        position: 'absolute',
        left: -20,
        right: -20,
        bottom: 0,
        height: 140,
        backgroundColor: 'rgba(15,23,42,0.28)',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.28)',
        zIndex: 2,
    },
    stageTopLine: {
        position: 'absolute',
        top: 0,
        left: 24,
        right: 24,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    podiumContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: 0,
        paddingBottom: 26,
        gap: spacing.sm,
        zIndex: 5,
    },
    spotlightContainer: {
        position: 'absolute',
        top: -100,
        height: height,
        width: 100,
        zIndex: 0,
        alignItems: 'center',
    },
    spotlightBeam: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 50,
        borderRightWidth: 50,
        borderBottomWidth: height,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    },
    placeContainer: {
        flex: 1,
        alignItems: 'center',
    },
    studentCard: {
        backgroundColor: 'rgba(248,250,252,0.98)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginBottom: spacing.sm,
        minWidth: 112,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.32)',
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 6,
        overflow: 'hidden',
    },
    studentCardWinner: {
        borderColor: '#FFD700',
        borderWidth: 2,
        shadowColor: '#FFD700',
        shadowOpacity: 0.42,
        shadowRadius: 16,
        elevation: 10,
    },
    winnerAura: {
        position: 'absolute',
        top: -6,
        left: -6,
        right: -6,
        bottom: -6,
        borderRadius: borderRadius.xl,
        borderWidth: 2,
        borderColor: 'rgba(250,204,21,0.8)',
    },
    shine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 26,
        backgroundColor: 'rgba(255,255,255,0.35)',
        zIndex: 10,
    },
    medalChip: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
        backgroundColor: 'rgba(15,23,42,0.04)',
    },
    rankChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        marginBottom: spacing.xs,
    },
    rankChipText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        letterSpacing: 0.3,
    },
    studentName: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate900,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    pointsBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.xs,
        minWidth: 68,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.14)',
    },
    pointsText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.slate900,
    },
    pointsLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.slate900,
        opacity: 0.8,
    },
    percentage: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: '#059669',
        marginBottom: 2,
    },
    score: {
        fontSize: typography.fontSize.xs,
        color: colors.slate500,
    },
    podiumBase: {
        width: '100%',
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.28)',
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 6,
        elevation: 6,
        overflow: 'hidden',
    },
    podiumTopEdge: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    positionNumber: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    emptyPlace: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginBottom: spacing.sm,
        minWidth: 100,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderStyle: 'dashed',
    },
    emptyText: {
        fontSize: typography.fontSize['2xl'],
        color: 'rgba(255, 255, 255, 0.5)',
    },
    confettiContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
    },
    confettiPiece: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 2,
    },
});
