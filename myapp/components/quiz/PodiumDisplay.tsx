import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

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

export default function PodiumDisplay({ topStudents }: PodiumDisplayProps) {
    // Garantir que temos exatamente 3 posições (preencher com vazios se necessário)
    const podiumData = [
        topStudents.find(s => s.position === 1),
        topStudents.find(s => s.position === 2),
        topStudents.find(s => s.position === 3),
    ];

    return (
        <View style={styles.container}>
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

interface PodiumPlaceProps {
    student?: PodiumStudent;
    position: number;
    height: number;
    delay: number;
}

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
        switch (position) {
            case 1: return '#FFD700'; // Ouro
            case 2: return '#C0C0C0'; // Prata
            case 3: return '#CD7F32'; // Bronze
            default: return colors.zinc600;
        }
    };

    const getMedalEmoji = () => {
        switch (position) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return '🏅';
        }
    };

    if (!student) {
        return (
            <View style={[styles.placeContainer, { height }]}>
                <View style={styles.emptyPlace}>
                    <Text style={styles.emptyText}>-</Text>
                </View>
                <View style={[styles.podiumBase, { height, backgroundColor: colors.zinc800 }]}>
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
            <View style={styles.studentCard}>
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
            </View>

            {/* Base do pódio */}
            <View style={[styles.podiumBase, { height, backgroundColor: getMedalColor() }]}>
                <Text style={styles.positionNumber}>{position}º</Text>
            </View>
        </Animated.View>
    );
}

function Confetti() {
    const confettiPieces = Array.from({ length: 20 }, (_, i) => i);

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

    useEffect(() => {
        const randomDelay = Math.random() * 1000;
        const randomDuration = 2000 + Math.random() * 1000;
        const randomX = Math.random() * width;

        Animated.parallel([
            Animated.timing(fallAnim, {
                toValue: 400,
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
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: randomDuration,
                delay: randomDelay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
    const randomColor = colors[index % colors.length];
    const randomX = (index * 37) % width;

    return (
        <Animated.View
            style={[
                styles.confettiPiece,
                {
                    backgroundColor: randomColor,
                    left: randomX,
                    transform: [
                        { translateY: fallAnim },
                        {
                            rotate: rotateAnim.interpolate({
                                inputRange: [0, 360],
                                outputRange: ['0deg', '360deg'],
                            })
                        },
                    ],
                    opacity: opacityAnim,
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingVertical: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.fontSize.base,
        color: colors.zinc400,
    },
    podiumContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    placeContainer: {
        flex: 1,
        alignItems: 'center',
    },
    studentCard: {
        backgroundColor: colors.zinc800,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginBottom: spacing.sm,
        minWidth: 100,
        borderWidth: 2,
        borderColor: colors.zinc700,
    },
    medalEmoji: {
        fontSize: 40,
        marginBottom: spacing.xs,
    },
    studentName: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
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
    },
    pointsText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    pointsLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.white,
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
        color: colors.zinc400,
    },
    podiumBase: {
        width: '100%',
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(0, 0, 0, 0.2)',
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
        backgroundColor: colors.zinc800,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginBottom: spacing.sm,
        minWidth: 100,
        borderWidth: 2,
        borderColor: colors.zinc700,
        borderStyle: 'dashed',
    },
    emptyText: {
        fontSize: typography.fontSize['2xl'],
        color: colors.zinc600,
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
