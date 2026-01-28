import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
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
                    duration: 2000,
                    delay: delay,
                    useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                    toValue: 0,
                    duration: 2000,
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

    const getMedalEmoji = () => {
        // ... (same as before)
        switch (position) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return '🏅';
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
            <View style={[styles.studentCard, position === 1 && styles.studentCardWinner]}>
                <Text style={styles.medalEmoji}>{getMedalEmoji()}</Text>
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
            </View>

            {/* Base do pódio */}
            <View style={[styles.podiumBase, { height, backgroundColor: getMedalColor() }]}>
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
                <Text style={styles.title}>🏆 Pódio Final 🏆</Text>
                <Text style={styles.subtitle}>Top 3 Melhores Desempenhos</Text>
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

            {/* Confetes animados para o vencedor */}
            {podiumData[0] && <Confetti />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingVertical: spacing.xl,
        overflow: 'hidden',
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
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
    subtitle: {
        fontSize: typography.fontSize.base,
        color: 'rgba(255,255,255,0.8)',
    },
    podiumContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: spacing.md,
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
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginBottom: spacing.sm,
        minWidth: 100,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    studentCardWinner: {
        borderColor: '#FFD700',
        borderWidth: 2,
        shadowColor: '#FFD700',
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
    },
    shine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 30,
        backgroundColor: 'rgba(255,255,255,0.4)',
        zIndex: 10,
    },
    medalEmoji: {
        fontSize: 40,
        marginBottom: spacing.xs,
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
        minWidth: 60,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
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
        color: '#10b981',
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
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
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
