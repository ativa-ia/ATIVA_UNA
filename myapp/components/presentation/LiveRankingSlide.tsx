import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, LayoutAnimation, Platform, UIManager, useWindowDimensions } from 'react-native';
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

// Apenas 5 cores que se repetem
const CAR_IMAGES = {
    red: require('@/assets/images/cars/f1_topdown_red.png'),
    blue: require('@/assets/images/cars/f1_topdown_blue.png'),
    green: require('@/assets/images/cars/f1_topdown_green.png'),
    purple: require('@/assets/images/cars/f1_topdown_purple.png'),
    yellow: require('@/assets/images/cars/f1_topdown_yellow.png'),
};

const CAR_COLORS = ['red', 'blue', 'green', 'purple', 'yellow'] as const;

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

const TRACK_HEIGHT = 600;
const LANE_HEIGHT = 100;

function RaceCar({ student, index, trackWidth }: { student: RankingStudent; index: number; trackWidth: number }) {
    const progressAnim = useRef(new Animated.Value(0)).current;
    const bounceAnim = useRef(new Animated.Value(0)).current;
    const laneAnim = useRef(new Animated.Value(index * LANE_HEIGHT)).current; // Animação vertical

    useEffect(() => {
        const progress = student.total > 0 ? (student.answered / student.total) : 0;
        const targetPosition = progress * (trackWidth - CAR_SIZE);

        // Animação de movimento horizontal
        Animated.spring(progressAnim, {
            toValue: targetPosition,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
        }).start();

        // Animação de troca de posição (vertical)
        Animated.spring(laneAnim, {
            toValue: index * LANE_HEIGHT,
            useNativeDriver: true,
            tension: 50,
            friction: 9,
        }).start();

        // Animação de bounce contínua
        Animated.loop(
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
        ).start();
    }, [student.answered, student.total, index, trackWidth]);

    // Cor fixa por aluno
    const carColor = getCarColorForStudent(student.student_name, student.student_id);
    const carImage = CAR_IMAGES[carColor];
    const medal = getMedalEmoji(student.position);

    return (
        <Animated.View
            style={[
                styles.carLane,
                {
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
                        transform: [
                            { translateX: progressAnim },
                            { translateY: bounceAnim },
                        ],
                    },
                ]}
            >
                {/* Nome acima do carro */}
                <View style={styles.nameContainer}>
                    <Text style={styles.carName} numberOfLines={1}>
                        {medal} {student.student_name}
                    </Text>
                </View>

                {/* Imagem do carro */}
                <Image source={carImage} style={styles.carImage} resizeMode="contain" />

                {/* Badge de Posição */}
                <View style={[styles.positionBadge, student.position <= 3 && styles.topThreeBadge]}>
                    <Text style={styles.positionText}>{student.position}º</Text>
                </View>

                {/* Pontos abaixo do carro */}
                <Text style={styles.carPoints}>{student.points} pts</Text>
            </Animated.View>

            {/* Progresso no canto direito */}
            <Text style={styles.progressText}>
                {student.answered}/{student.total}
            </Text>
        </Animated.View>
    );
}

export default function LiveRankingSlide({ data }: Props) {
    const { title = '🏁 CORRIDA DO CONHECIMENTO', ranking, total_students } = data;
    const topRacers = ranking.slice(0, 5); // Top 5 na pista
    const { width } = useWindowDimensions();
    const trackWidth = Math.max(300, width - SIDEBAR_WIDTH - 60);

    useEffect(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, [ranking]);

    // Função para verificar se está "On Fire"
    const isOnFire = (student: RankingStudent) => {
        if (student.total === 0) return false;
        return student.answered >= 3 && (student.points / student.answered) >= 10;
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>AO VIVO</Text>
                </View>
            </View>

            <View style={styles.contentContainer}>
                {/* Pista de Corrida (Esquerda) */}
                <View style={styles.trackArea}>
                    <View style={styles.trackContainer}>
                        {/* Bordas da Pista (Zebra) */}
                        <View style={styles.trackBorderTop} />
                        <View style={styles.trackBorderBottom} />

                        {/* Linha de Largada */}
                        <View style={styles.startLine}>
                            <MaterialIcons name="flag" size={32} color="#10b981" />
                            <Text style={styles.lineLabel}>LARGADA</Text>
                        </View>

                        {/* Linha de Chegada (Checkered Flag) - Posicionada no container para não ser cortada */}
                        <View style={styles.finishLineContainer}>
                            <View style={styles.checkeredLine}>
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <View key={i} style={{ width: 10, height: '100%' }}>
                                        {Array.from({ length: 60 }).map((_, j) => (
                                            <View
                                                key={j}
                                                style={{
                                                    width: 10,
                                                    height: 10,
                                                    backgroundColor: (i + j) % 2 === 0 ? '#000' : '#fff'
                                                }}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </View>
                            <View style={styles.finishLabelContainer}>
                                <MaterialIcons name="sports-score" size={32} color="#ef4444" />
                                <Text style={styles.lineLabel}>CHEGADA</Text>
                            </View>
                        </View>

                        {/* Pista com Carros */}
                        <View style={styles.track}>
                            {/* Surface Texture (Asfalto + Faixas + Grid + Arrows) */}
                            <View style={styles.asphaltSurface}>
                                {/* Faixas */}
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <View key={`lane-${i}`} style={[styles.laneDivider, { top: (i + 1) * 100 }]} />
                                ))}

                                {/* Setas de Direção */}
                                {Array.from({ length: 3 }).map((_, col) => (
                                    Array.from({ length: 5 }).map((__, row) => (
                                        <View
                                            key={`arrow-${col}-${row}`}
                                            style={[
                                                styles.trackArrow,
                                                {
                                                    top: row * 100 + 40,
                                                    left: 300 + (col * 200),
                                                }
                                            ]}
                                        >
                                            <MaterialIcons name="keyboard-arrow-right" size={40} color="rgba(255,255,255,0.05)" />
                                            <MaterialIcons name="keyboard-arrow-right" size={40} color="rgba(255,255,255,0.05)" style={{ marginLeft: -25 }} />
                                        </View>
                                    ))
                                ))}
                            </View>

                            {topRacers.length === 0 ? (
                                <View style={styles.emptyTrack}>
                                    <MaterialIcons name="hourglass-empty" size={64} color="rgba(255,255,255,0.3)" />
                                    <Text style={styles.emptyText}>Aguardando largada...</Text>
                                </View>
                            ) : (
                                topRacers.map((student, index) => (
                                    <RaceCar
                                        key={student.student_name}
                                        student={student}
                                        index={index}
                                        trackWidth={trackWidth}
                                    />
                                ))
                            )}
                        </View>
                    </View>
                </View>

                {/* Placar Lateral (Direita) */}
                <View style={styles.sidebar}>
                    <View style={styles.scoreboard}>
                        <Text style={styles.scoreboardTitle}>🏆 PLACAR</Text>
                        <Animated.ScrollView
                            style={styles.scoreboardList}
                            showsVerticalScrollIndicator={false}
                        >
                            {ranking.map((student, index) => {
                                // Lógica para "On Fire"
                                const showFire = student.answered >= 3 && student.position <= 3;

                                return (
                                    <View
                                        key={student.student_name}
                                        style={[styles.scoreItem, index < 3 && styles.topThreeScore]}
                                    >
                                        <Text style={styles.scorePosition}>
                                            {getMedalEmoji(student.position) || `${student.position}º`}
                                        </Text>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Text style={styles.scoreName} numberOfLines={1}>
                                                {student.student_name}
                                            </Text>
                                            {showFire && <Text style={{ fontSize: 14 }}>🔥</Text>}
                                        </View>
                                        <Text style={styles.scorePoints}>{student.points}</Text>
                                    </View>
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
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    liveIndicator: {
        // ... (same as before)
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 2,
        borderColor: '#ef4444',
        gap: spacing.sm,
    },
    liveDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
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
        height: 10,
        backgroundColor: '#ef4444',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#fff',
        zIndex: 5,
    },
    trackBorderBottom: {
        position: 'absolute',
        top: 670,
        left: 80,
        right: 0,
        height: 10,
        backgroundColor: '#ef4444',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#fff',
        zIndex: 5,
    },
    startLine: {
        position: 'absolute',
        left: 20,
        top: 0,
        alignItems: 'center',
        zIndex: 10,
        height: '100%',
        justifyContent: 'center',
    },
    finishLineContainer: {
        position: 'absolute',
        right: 0, // Alinhado à direita do container
        top: 80, // Mesmo offset do track (marginTop do track)
        height: 600, // Mesma altura do track
        width: 40,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkeredLine: {
        position: 'absolute',
        right: 0,
        width: 30,
        height: '100%', // Usar 100% para evitar desalinhamento se a pista mudar de tamanho
        flexDirection: 'row',
        flexWrap: 'wrap',
        zIndex: 1,
        opacity: 0.8,
        overflow: 'hidden', // Cortar excesso
    },
    finishLabelContainer: {
        position: 'absolute',
        right: -30,
        alignItems: 'center',
        zIndex: 10,
    },
    lineLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
        marginTop: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 4,
        borderRadius: 4,
    },
    // Removidos progressMarkers, marker, markerLine, markerText
    track: {
        marginTop: 80,
        marginLeft: 80,
        height: 600,
        position: 'relative',
        backgroundColor: '#2d3748',
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#4a5568',
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
        backgroundColor: 'rgba(255,255,255,0.2)', // Levemente mais visível
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
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
        height: 100,
        justifyContent: 'center',
    },
    carContainer: {
        position: 'absolute',
        top: 10,
        width: CAR_SIZE,
        height: CAR_SIZE + 40,
        alignItems: 'center',
    },
    nameContainer: {
        marginBottom: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    carName: {
        fontSize: typography.fontSize.sm,
        color: colors.white,
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
    topThreeBadge: {
        backgroundColor: '#FFD700',
    },
    positionText: {
        fontSize: 12,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    carPoints: {
        fontSize: typography.fontSize.xs,
        color: '#10b981',
        fontWeight: typography.fontWeight.bold,
        marginTop: 2,
    },
    progressText: {
        position: 'absolute',
        right: -60,
        top: 40,
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
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden', // Contain scrolling
    },
    scoreboardTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.sm,
        textAlign: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: spacing.sm,
    },
    scoreboardList: {
        flex: 1,
    },
    scoreItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        gap: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    topThreeScore: {
        backgroundColor: 'rgba(255,215,0,0.15)',
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.md,
        marginHorizontal: -spacing.xs, // Expand background slightly
    },
    scorePosition: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        width: 30, // Reduzido
        textAlign: 'center',
    },
    scoreName: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.white,
    },
    scorePoints: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: '#10b981',
        minWidth: 50,
        textAlign: 'right',
    },
});
