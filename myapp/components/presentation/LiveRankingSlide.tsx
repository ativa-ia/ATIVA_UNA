import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated, LayoutAnimation, Platform, UIManager, useWindowDimensions, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

const SIDEBAR_WIDTH = 350;
const CAR_SIZE = 80;

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface RankingStudent {
    position: number;
    student_name: string;
    student_id?: number;
    points: number;
    answered: number;
    total: number;
}

interface Props {
    data: {
        title?: string;
        ranking: RankingStudent[];
        total_students: number;
    };
}

interface FireState {
    lastAnswered: number;
    combo: number;
    power: number;
    activeUntil: number;
}

// Apenas 5 cores que se repetem
const CAR_IMAGES = {
    red: require('@/assets/images/cars/f1_topdown_red.png'),
    blue: require('@/assets/images/cars/f1_topdown_blue.png'),
    green: require('@/assets/images/cars/f1_topdown_green.png'),
    purple: require('@/assets/images/cars/f1_topdown_purple.png'),
    yellow: require('@/assets/images/cars/f1_topdown_yellow.png'),
};

const CAR_COLORS = ['red', 'blue', 'green', 'purple', 'yellow'] as const;

const getRankColor = (position: number) => {
    switch (position) {
        case 1:
            return '#F59E0B';
        case 2:
            return '#94A3B8';
        case 3:
            return '#C2410C';
        default:
            return '#64748B';
    }
};

const getStudentKey = (student: Pick<RankingStudent, 'student_id' | 'student_name'>) => {
    if (student.student_id != null) return `id:${student.student_id}`;
    return `name:${String(student.student_name || '').trim().toLowerCase()}`;
};

// Função para atribuir cor fixa baseada no nome do aluno
const getCarColorForStudent = (studentName: string, studentId?: number): keyof typeof CAR_IMAGES => {
    // Usa student_id se disponível, senão usa hash do nome
    const identifier = studentId !== undefined ? studentId.toString() : studentName;

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
        hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }

    const index = Math.abs(hash) % CAR_COLORS.length;
    return CAR_COLORS[index];
};

const getMedalEmoji = (position: number) => {
    switch (position) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return null;
    }
};

function LivePulseDot() {
    const pulseScale = useRef(new Animated.Value(1)).current;
    const pulseOpacity = useRef(new Animated.Value(0.65)).current;

    useEffect(() => {
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(pulseScale, {
                        toValue: 1.45,
                        duration: 950,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: false,
                    }),
                    Animated.timing(pulseScale, {
                        toValue: 1,
                        duration: 0,
                        useNativeDriver: false,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(pulseOpacity, {
                        toValue: 0,
                        duration: 950,
                        useNativeDriver: false,
                    }),
                    Animated.timing(pulseOpacity, {
                        toValue: 0.65,
                        duration: 0,
                        useNativeDriver: false,
                    }),
                ]),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.liveDotWrap}>
            <Animated.View
                style={[
                    styles.liveDotPulse,
                    {
                        opacity: pulseOpacity,
                        transform: [{ scale: pulseScale }],
                    },
                ]}
            />
            <View style={styles.liveDot} />
        </View>
    );
}

function FinishLineShimmer({ trackHeight }: { trackHeight: number }) {
    const shineAnim = useRef(new Animated.Value(-42)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(shineAnim, {
                    toValue: trackHeight + 42,
                    duration: 2200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(shineAnim, {
                    toValue: -42,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        );

        loop.start();
        return () => loop.stop();
    }, [trackHeight]);

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.finishShine,
                {
                    transform: [{ translateY: shineAnim }],
                },
            ]}
        />
    );
}

function RankingFireIcon({ intensity = 0.65, combo = 2 }: { intensity?: number; combo?: number }) {
    const firePulse = useRef(new Animated.Value(0)).current;
    const clampedIntensity = Math.max(0.35, Math.min(1, intensity));
    const minOpacity = 0.62 + (clampedIntensity * 0.14);
    const maxOpacity = 0.86 + (clampedIntensity * 0.14);
    const minScale = 0.93 + (clampedIntensity * 0.02);
    const maxScale = 1.08 + (clampedIntensity * 0.06);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(firePulse, {
                    toValue: 1,
                    duration: 420,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(firePulse, {
                    toValue: 0,
                    duration: 520,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        loop.start();
        return () => loop.stop();
    }, []);

    return (
        <Animated.View
            style={[
                styles.fireWrap,
                {
                    opacity: firePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [minOpacity, maxOpacity],
                    }),
                    transform: [
                        {
                            scale: firePulse.interpolate({
                                inputRange: [0, 1],
                                outputRange: [minScale, maxScale],
                            }),
                        },
                        {
                            translateY: firePulse.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -1.5],
                            }),
                        },
                    ],
                },
            ]}
        >
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.fireGlow,
                    {
                        opacity: firePulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.18, 0.24 + (clampedIntensity * 0.24)],
                        }),
                        transform: [
                            {
                                scale: firePulse.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.9, 1.1 + (clampedIntensity * 0.35)],
                                }),
                            },
                        ],
                    },
                ]}
            />
            <MaterialIcons name="whatshot" size={15} color="#fb923c" />
            <Text style={styles.fireComboText}>x{combo}</Text>
        </Animated.View>
    );
}

function ScoreboardRow({
    student,
    index,
    showFire,
    firePower,
    fireCombo,
}: {
    student: RankingStudent;
    index: number;
    showFire: boolean;
    firePower: number;
    fireCombo: number;
}) {
    const rowEnterAnim = useRef(new Animated.Value(0)).current;
    const rowImpactAnim = useRef(new Animated.Value(0)).current;
    const isTopThree = student.position <= 3;
    const rankColor = getRankColor(student.position);

    useEffect(() => {
        Animated.timing(rowEnterAnim, {
            toValue: 1,
            duration: 380,
            delay: Math.min(220, index * 55),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        rowImpactAnim.setValue(0);
        Animated.sequence([
            Animated.timing(rowImpactAnim, {
                toValue: 1,
                duration: 180,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(rowImpactAnim, {
                toValue: 0,
                duration: 300,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start();
    }, [student.points, student.position, showFire]);

    return (
        <Animated.View
            style={[
                styles.scoreItem,
                isTopThree && styles.topThreeScore,
                showFire && styles.fireScoreItem,
                {
                    opacity: rowEnterAnim,
                    transform: [
                        {
                            translateY: rowEnterAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [12, 0],
                            }),
                        },
                        {
                            scale: rowImpactAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.015],
                            }),
                        },
                    ],
                },
            ]}
        >
            <View style={[styles.scorePositionBadge, { borderColor: rankColor }]}> 
                {isTopThree ? (
                    <MaterialIcons name="emoji-events" size={16} color={rankColor} />
                ) : (
                    <Text style={styles.scorePosition}>{`${student.position}º`}</Text>
                )}
            </View>

            <View style={styles.scoreIdentityWrap}>
                <Text style={styles.scoreName} numberOfLines={1}>
                    {student.student_name}
                </Text>
                {showFire && <RankingFireIcon intensity={firePower} combo={fireCombo} />}
            </View>

            <View style={styles.scorePointsPill}>
                <Text style={styles.scorePoints}>{student.points}</Text>
                <Text style={styles.scorePointsLabel}>pts</Text>
            </View>
        </Animated.View>
    );
}

function RaceCar({ student, index, trackWidth, laneHeight, carSize }: { student: RankingStudent; index: number; trackWidth: number; laneHeight: number; carSize: number }) {
    const progressAnim = useRef(new Animated.Value(0)).current;
    const bounceAnim = useRef(new Animated.Value(0)).current;
    const laneAnim = useRef(new Animated.Value(index * laneHeight)).current;
    const topGlowAnim = useRef(new Animated.Value(0.55)).current;
    const speedLineAnim = useRef(new Animated.Value(-50)).current;
    const speedOpacityAnim = useRef(new Animated.Value(0.34)).current;
    const boostAnim = useRef(new Animated.Value(0)).current;
    const overtakeAnim = useRef(new Animated.Value(0)).current;
    const previousPositionRef = useRef(student.position);
    const previousAnsweredRef = useRef(student.answered);

    useEffect(() => {
        const progress = student.total > 0 ? (student.answered / student.total) : 0;
        const targetPosition = progress * (trackWidth - carSize);

        // Animação de movimento horizontal
        Animated.spring(progressAnim, {
            toValue: targetPosition,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
        }).start();

        // Animação de troca de posição (vertical)
        Animated.spring(laneAnim, {
            toValue: index * laneHeight,
            useNativeDriver: true,
            tension: 50,
            friction: 9,
        }).start();
    }, [student.answered, student.total, index, trackWidth, laneHeight, carSize]);

    useEffect(() => {
        const bounceLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnim, {
                    toValue: -3,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(bounceAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ])
        );

        const topGlowLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(topGlowAnim, {
                    toValue: 1,
                    duration: 650,
                    useNativeDriver: true,
                }),
                Animated.timing(topGlowAnim, {
                    toValue: 0.55,
                    duration: 650,
                    useNativeDriver: true,
                }),
            ])
        );

        const speedLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(speedLineAnim, {
                    toValue: 80,
                    duration: 900,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(speedLineAnim, {
                    toValue: -50,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        );

        bounceLoop.start();
        topGlowLoop.start();
        speedLoop.start();

        return () => {
            bounceLoop.stop();
            topGlowLoop.stop();
            speedLoop.stop();
        };
    }, []);

    useEffect(() => {
        const previousPosition = previousPositionRef.current;
        if (student.position < previousPosition) {
            overtakeAnim.setValue(0);
            Animated.sequence([
                Animated.timing(overtakeAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.delay(900),
                Animated.timing(overtakeAnim, {
                    toValue: 0,
                    duration: 260,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        previousPositionRef.current = student.position;
    }, [student.position]);

    useEffect(() => {
        const previousAnswered = previousAnsweredRef.current;
        if (student.answered > previousAnswered) {
            boostAnim.setValue(0);
            Animated.sequence([
                Animated.timing(boostAnim, {
                    toValue: 1,
                    duration: 180,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(boostAnim, {
                    toValue: 0,
                    duration: 420,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]).start();

            Animated.sequence([
                Animated.timing(speedOpacityAnim, {
                    toValue: 0.72,
                    duration: 120,
                    useNativeDriver: true,
                }),
                Animated.timing(speedOpacityAnim, {
                    toValue: student.position <= 3 ? 0.45 : 0.3,
                    duration: 360,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        previousAnsweredRef.current = student.answered;
    }, [student.answered, student.position]);

    // Cor fixa por aluno
    const carColor = getCarColorForStudent(student.student_name, student.student_id);
    const carImage = CAR_IMAGES[carColor];
    return (
        <Animated.View
            style={[
                styles.carLane,
                {
                    height: laneHeight,
                    transform: [{ translateY: laneAnim }],
                    zIndex: 50 - index // Elementos superiores ficam acima
                }
            ]}
        >
            {/* Carro Animado */}
            <Animated.View
                style={[
                    styles.carContainer,
                    {
                        top: Math.max(0, Math.floor((laneHeight - carSize) / 2) - 6),
                        width: carSize,
                        height: carSize + 34,
                        transform: [
                            { translateX: progressAnim },
                            { translateY: bounceAnim },
                            {
                                scale: boostAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.045],
                                }),
                            },
                            { scale: student.position <= 3 ? topGlowAnim.interpolate({ inputRange: [0.55, 1], outputRange: [1, 1.03] }) : 1 },
                        ],
                    },
                ]}
            >
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.turboGlow,
                        {
                            opacity: boostAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 0.55],
                            }),
                            transform: [
                                {
                                    scaleX: boostAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.9, 1.22],
                                    }),
                                },
                                {
                                    scaleY: boostAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.9, 1.06],
                                    }),
                                },
                            ],
                        },
                    ]}
                />

                {/* Rastro de velocidade */}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.speedTrail,
                        {
                            opacity: speedOpacityAnim,
                            transform: [
                                {
                                    translateX: speedLineAnim.interpolate({
                                        inputRange: [-50, 80],
                                        outputRange: [-50, 80],
                                    }),
                                },
                            ],
                        },
                    ]}
                />

                {/* Nome acima do carro */}
                <View style={styles.nameContainer}>
                    <View style={styles.nameRow}>
                        <Text style={styles.carName} numberOfLines={1}>
                            {student.student_name}
                        </Text>
                    </View>
                </View>

                {/* Imagem do carro */}
                <Image source={carImage} style={[styles.carImage, { width: carSize, height: carSize }]} resizeMode="contain" />

                {/* Badge de Posição */}
                <View
                    style={[
                        styles.positionBadge,
                        {
                            backgroundColor: student.position <= 3 ? getRankColor(student.position) : colors.primary,
                        },
                    ]}
                >
                    <Text style={styles.positionText}>{student.position}º</Text>
                </View>

                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.overtakeBadge,
                        {
                            opacity: overtakeAnim,
                            transform: [
                                {
                                    translateY: overtakeAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [6, -8],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <Text style={styles.overtakeText}>+1 posição</Text>
                </Animated.View>

            </Animated.View>

            {/* Progresso no canto direito */}
            <Text style={styles.progressText}>
                {student.answered}/{student.total}
            </Text>
        </Animated.View>
    );
}

export default function LiveRankingSlide({ data }: Props) {
    const { ranking } = data;
    const { width, height } = useWindowDimensions();
    const trackFlowAnim = useRef(new Animated.Value(0)).current;
    const trackWidth = Math.max(300, width - SIDEBAR_WIDTH - 60);
    const trackTopOffset = 56;
    const laneCount = 5;
    const trackHeight = Math.max(410, Math.min(580, height - 200));
    const laneHeight = Math.floor(trackHeight / laneCount);
    const carSize = Math.max(60, Math.min(78, Math.floor(laneHeight * 0.64)));
    const checkerRows = Math.max(42, Math.ceil(trackHeight / 10));
    const [fireByStudent, setFireByStudent] = useState<Record<string, FireState>>({});

    const normalizedRanking = useMemo(() => {
        const map = new Map<string, RankingStudent>();

        ranking.forEach((student) => {
            const idKey = getStudentKey(student);

            const previous = map.get(idKey);
            if (!previous) {
                map.set(idKey, student);
                return;
            }

            const prevStrength = (previous.points || 0) * 1000 + (previous.answered || 0);
            const nextStrength = (student.points || 0) * 1000 + (student.answered || 0);
            if (nextStrength > prevStrength) {
                map.set(idKey, student);
            }
        });

        const uniqueList = Array.from(map.values()).sort((a, b) => {
            if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
            if ((b.answered || 0) !== (a.answered || 0)) return (b.answered || 0) - (a.answered || 0);
            return String(a.student_name || '').localeCompare(String(b.student_name || ''));
        });

        return uniqueList.map((student, index) => ({ ...student, position: index + 1 }));
    }, [ranking]);

    const topRacers = normalizedRanking.slice(0, 5);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(trackFlowAnim, {
                    toValue: 1,
                    duration: 2600,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(trackFlowAnim, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        );

        loop.start();
        return () => loop.stop();
    }, []);

    useEffect(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, [normalizedRanking]);

    useEffect(() => {
        setFireByStudent((previous) => {
            const now = Date.now();
            const nextState: Record<string, FireState> = {};

            normalizedRanking.forEach((student) => {
                const studentKey = getStudentKey(student);
                const previousState = previous[studentKey] ?? {
                    lastAnswered: student.answered,
                    combo: 0,
                    power: 0,
                    activeUntil: 0,
                };

                const answeredDelta = Math.max(0, (student.answered || 0) - (previousState.lastAnswered || 0));
                let combo = previousState.combo;
                let power = Math.max(0, previousState.power * 0.9);
                let activeUntil = previousState.activeUntil;

                if (answeredDelta > 0) {
                    combo = Math.min(10, combo + answeredDelta);
                    power = Math.min(1, power + 0.24 + (answeredDelta * 0.12));
                    activeUntil = now + 12000;
                } else if (activeUntil <= now) {
                    combo = Math.max(0, combo - 1);
                    power = Math.max(0, power * 0.7);
                }

                nextState[studentKey] = {
                    lastAnswered: student.answered,
                    combo,
                    power,
                    activeUntil,
                };
            });

            return nextState;
        });
    }, [normalizedRanking]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>Ranking ao Vivo</Text>
                    <Text style={styles.subtitle}>Desempenho em tempo real da turma</Text>
                </View>
                <View style={styles.liveIndicator}>
                    <LivePulseDot />
                    <Text style={styles.liveText}>AO VIVO</Text>
                </View>
            </View>

            <View style={styles.contentContainer}>
                {/* Pista de Corrida (Esquerda) */}
                <View style={styles.trackArea}>
                    <View style={styles.trackContainer}>
                        {/* Bordas da Pista (Zebra) */}
                        <View style={[styles.trackBorderTop, { top: trackTopOffset - 18 }]} />
                        <View style={[styles.trackBorderBottom, { top: trackTopOffset + trackHeight + 12 }]} />

                        {/* Linha de Largada */}
                        <View style={[styles.startLine, { top: trackTopOffset, height: trackHeight }]}> 
                            <View style={styles.lineIconCircleStart}>
                                <MaterialIcons name="flag" size={18} color="#0f172a" />
                            </View>
                        </View>

                        <View
                            style={[
                                styles.finishLabelContainer,
                                { top: trackTopOffset + Math.max(64, Math.floor(trackHeight * 0.52) - 28) }
                            ]}
                        >
                            <View style={styles.lineIconCircleFinish}>
                                <MaterialIcons name="sports-score" size={18} color="#ffffff" />
                            </View>
                        </View>

                        {/* Pista com Carros */}
                        <View style={[styles.track, { marginTop: trackTopOffset, height: trackHeight }]}> 
                            {/* Surface Texture (Asfalto + Faixas + Grid + Arrows) */}
                            <View style={styles.asphaltSurface}>
                                {/* Faixas */}
                                {Array.from({ length: Math.max(0, laneCount - 1) }).map((_, i) => (
                                    <View key={`lane-${i}`} style={[styles.laneDivider, { top: (i + 1) * laneHeight }]} />
                                ))}

                                {/* Setas de Direção */}
                                {Array.from({ length: 3 }).map((_, col) => (
                                    Array.from({ length: laneCount }).map((__, row) => (
                                        <Animated.View
                                            key={`arrow-${col}-${row}`}
                                            style={[
                                                styles.trackArrow,
                                                {
                                                    top: row * laneHeight + Math.max(24, Math.floor(laneHeight * 0.34)),
                                                    left: 300 + (col * 200),
                                                    opacity: trackFlowAnim.interpolate({
                                                        inputRange: [0, 0.5, 1],
                                                        outputRange: [0.08, 0.2, 0.08],
                                                    }),
                                                    transform: [
                                                        {
                                                            translateX: trackFlowAnim.interpolate({
                                                                inputRange: [0, 1],
                                                                outputRange: [0, 68],
                                                            }),
                                                        },
                                                    ],
                                                }
                                            ]}
                                        >
                                            <MaterialIcons name="keyboard-arrow-right" size={40} color="rgba(255,255,255,0.05)" />
                                            <MaterialIcons name="keyboard-arrow-right" size={40} color="rgba(255,255,255,0.05)" style={{ marginLeft: -25 }} />
                                        </Animated.View>
                                    ))
                                ))}
                            </View>

                            <View pointerEvents="none" style={styles.finishLineInside}>
                                {Array.from({ length: checkerRows }).map((_, row) => (
                                    <View key={`finish-row-${row}`} style={styles.checkeredRow}>
                                        <View style={[styles.checkeredCell, { backgroundColor: row % 2 === 0 ? '#000' : '#fff' }]} />
                                        <View style={[styles.checkeredCell, { backgroundColor: row % 2 === 0 ? '#fff' : '#000' }]} />
                                    </View>
                                ))}
                                <FinishLineShimmer trackHeight={trackHeight} />
                            </View>

                            {topRacers.length === 0 ? (
                                <View style={styles.emptyTrack}>
                                    <MaterialIcons name="hourglass-empty" size={64} color="rgba(255,255,255,0.3)" />
                                    <Text style={styles.emptyText}>Aguardando largada...</Text>
                                </View>
                            ) : (
                                topRacers.map((student, index) => (
                                    <RaceCar
                                        key={`${student.student_id || student.student_name}-${student.position}`}
                                        student={student}
                                        index={index}
                                        trackWidth={trackWidth}
                                        laneHeight={laneHeight}
                                        carSize={carSize}
                                    />
                                ))
                            )}
                        </View>
                    </View>
                </View>

                {/* Placar Lateral (Direita) */}
                <View style={styles.sidebar}>
                    <View style={styles.scoreboard}>
                        <View style={styles.scoreboardHeader}>
                            <View style={styles.scoreboardHeaderTop}>
                                <MaterialIcons name="leaderboard" size={20} color="#f8fafc" />
                                <Text style={styles.scoreboardTitle}>PLACAR</Text>
                            </View>
                            <Text style={styles.scoreboardSubtitle}>Atualização em tempo real</Text>
                        </View>
                        <Animated.ScrollView
                            style={styles.scoreboardList}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scoreboardListContent}
                        >
                            {normalizedRanking.map((student, index) => {
                                const now = Date.now();
                                const studentKey = getStudentKey(student);
                                const fireState = fireByStudent[studentKey];
                                const fireCombo = fireState?.combo ?? 0;
                                const firePower = fireState?.power ?? 0;
                                const fireIsActive = (fireState?.activeUntil ?? 0) > now;
                                const showFire = fireCombo >= 2 && fireIsActive;

                                return (
                                    <ScoreboardRow
                                        key={`${student.student_id || student.student_name}-${student.position}-${index}`}
                                        student={student}
                                        index={index}
                                        showFire={showFire}
                                        firePower={firePower}
                                        fireCombo={fireCombo}
                                    />
                                );
                            })}
                        </Animated.ScrollView>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
        height: 60,
    },
    headerLeft: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        flexDirection: 'row',
        gap: spacing.lg,
    },
    trackArea: {
        flex: 1,
        // Ocupa o espaço restante
    },
    sidebar: {
        width: SIDEBAR_WIDTH,
        height: '100%',
    },
    // ... (Keep existing header styles properly)
    title: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        textShadowColor: 'rgba(0,0,0,0.35)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: typography.fontSize.sm,
        color: 'rgba(241,245,249,0.75)',
        marginTop: 2,
    },
    liveIndicator: {
        // ... (same as before)
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: '#ef4444',
        gap: spacing.sm,
    },
    liveDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },
    liveDotWrap: {
        width: 14,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveDotPulse: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: 'rgba(239,68,68,0.4)',
    },
    liveText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: '#ef4444',
        letterSpacing: 1,
    },
    trackContainer: {
        flex: 1,
        position: 'relative',
        paddingVertical: 10,
        // Remover marginBottom se não for necessário dentro do flex
    },
    // ... (Track specific styles)
    trackBorderTop: {
        position: 'absolute',
        top: 60,
        left: 80,
        right: 0,
        height: 6,
        backgroundColor: 'rgba(148,163,184,0.35)',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.5)',
        zIndex: 5,
    },
    trackBorderBottom: {
        position: 'absolute',
        top: 670,
        left: 80,
        right: 0,
        height: 6,
        backgroundColor: 'rgba(148,163,184,0.35)',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.5)',
        zIndex: 5,
    },
    startLine: {
        position: 'absolute',
        left: 14,
        alignItems: 'center',
        zIndex: 10,
        justifyContent: 'center',
    },
    finishLineInside: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 22,
        zIndex: 3,
        overflow: 'hidden',
        borderTopRightRadius: borderRadius.lg,
        borderBottomRightRadius: borderRadius.lg,
        opacity: 0.92,
    },
    finishShine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 26,
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    checkeredRow: {
        width: '100%',
        height: 10,
        flexDirection: 'row',
    },
    checkeredCell: {
        flex: 1,
        height: '100%',
    },
    finishLabelContainer: {
        position: 'absolute',
        right: -12,
        alignItems: 'center',
        zIndex: 10,
    },
    lineIconCircleStart: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#34d399',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(15,23,42,0.35)',
        marginBottom: 0,
    },
    lineIconCircleFinish: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.45)',
        marginBottom: 0,
    },
    lineLabelBase: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        letterSpacing: 0.6,
    },
    // Removidos progressMarkers, marker, markerLine, markerText
    track: {
        marginTop: 56,
        marginLeft: 80,
        position: 'relative',
        backgroundColor: '#334155',
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(148,163,184,0.55)',
    },
    asphaltSurface: {
        ...StyleSheet.absoluteFillObject,
        opacity: 1, // Aumentado para ver melhor o asfalto escuro
    },
    laneDivider: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    gridSlot: {
        position: 'absolute',
        width: 80,
        height: 70,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        borderRadius: 4,
        transform: [{ skewX: '-20deg' }], // Efeito de perspectiva no chão
    },
    trackArrow: {
        position: 'absolute',
        flexDirection: 'row',
        transform: [{ scaleX: 1.5 }], // Esticar horizontalmente
    },
    carLane: {
        position: 'absolute',
        left: 0,
        width: '100%', // Atualizado para usar 100% do container
        height: 96,
        justifyContent: 'center',
    },
    carContainer: {
        position: 'absolute',
        width: CAR_SIZE,
        height: CAR_SIZE + 40,
        alignItems: 'center',
    },
    speedTrail: {
        position: 'absolute',
        width: 56,
        height: 4,
        borderRadius: 10,
        top: 36,
        left: -60,
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
    turboGlow: {
        position: 'absolute',
        width: 34,
        height: 20,
        left: -22,
        top: 34,
        borderRadius: 16,
        backgroundColor: 'rgba(56,189,248,0.9)',
    },
    nameContainer: {
        marginBottom: 4,
        backgroundColor: 'rgba(2,6,23,0.72)',
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.default,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.35)',
        maxWidth: 118,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    carName: {
        fontSize: typography.fontSize.xs,
        color: '#f8fafc',
        fontWeight: typography.fontWeight.bold,
        textAlign: 'center',
    },
    carImage: {
        width: CAR_SIZE,
        height: CAR_SIZE,
    },
    positionBadge: {
        position: 'absolute',
        top: 20,
        right: -8,
        backgroundColor: colors.primary,
        borderRadius: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.white,
    },
    positionText: {
        fontSize: 12,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    overtakeBadge: {
        position: 'absolute',
        top: -18,
        right: -4,
        backgroundColor: 'rgba(16,185,129,0.92)',
        borderRadius: borderRadius.full,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    overtakeText: {
        fontSize: 10,
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
    },
    progressText: {
        position: 'absolute',
        right: -60,
        top: 34,
        fontSize: typography.fontSize.sm,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: typography.fontWeight.semibold,
        zIndex: 10, // Garantir visibilidade
    },
    emptyTrack: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.fontSize.xl,
        color: 'rgba(255,255,255,0.5)',
        marginTop: spacing.md,
    },
    // Sidebar styles
    scoreboard: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.56)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.45)',
        overflow: 'hidden', // Contain scrolling
    },
    scoreboardHeader: {
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.12)',
        paddingBottom: spacing.md,
        marginBottom: spacing.md,
        gap: 2,
    },
    scoreboardHeaderTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    scoreboardTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: '#f8fafc',
        letterSpacing: 0.5,
    },
    scoreboardSubtitle: {
        fontSize: typography.fontSize.xs,
        color: 'rgba(226,232,240,0.72)',
        letterSpacing: 0.3,
    },
    scoreboardList: {
        flex: 1,
    },
    scoreboardListContent: {
        paddingBottom: spacing.sm,
        paddingTop: 2,
    },
    scoreItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: 9,
        gap: spacing.sm,
        borderBottomWidth: 0,
        borderRadius: borderRadius.md,
        marginBottom: 7,
        backgroundColor: 'rgba(15,23,42,0.36)',
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.18)',
    },
    topThreeScore: {
        backgroundColor: 'rgba(148,163,184,0.2)',
        borderColor: 'rgba(203,213,225,0.35)',
    },
    fireScoreItem: {
        backgroundColor: 'rgba(251,146,60,0.08)',
        borderColor: 'rgba(251,146,60,0.25)',
        borderWidth: 1,
    },
    scorePositionBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15,23,42,0.85)',
    },
    scorePosition: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: '#e2e8f0',
        width: 24,
        textAlign: 'center',
    },
    scoreName: {
        flex: 1,
        fontSize: typography.fontSize.base,
        color: '#f1f5f9',
        fontWeight: typography.fontWeight.semibold,
    },
    scoreIdentityWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fireWrap: {
        minWidth: 34,
        height: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    fireGlow: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(251,146,60,0.45)',
    },
    fireComboText: {
        fontSize: 10,
        color: '#fdba74',
        fontWeight: typography.fontWeight.bold,
        marginLeft: 1,
    },
    scorePoints: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        color: '#2dd4bf',
        minWidth: 34,
        textAlign: 'right',
    },
    scorePointsPill: {
        minWidth: 58,
        height: 32,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(45,212,191,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(45,212,191,0.36)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        gap: 3,
    },
    scorePointsLabel: {
        fontSize: typography.fontSize.xs,
        color: 'rgba(153,246,228,0.9)',
        fontWeight: typography.fontWeight.medium,
        marginTop: 1,
    },
});
