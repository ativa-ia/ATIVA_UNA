import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TRACK_WIDTH = SCREEN_WIDTH - 200;
const CAR_SIZE = 80; // Aumentado de 60 para 80

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

function RaceCar({ student, index }: { student: RankingStudent; index: number }) {
    const progressAnim = useRef(new Animated.Value(0)).current;
    const bounceAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const progress = student.total > 0 ? (student.answered / student.total) : 0;
        const targetPosition = progress * (TRACK_WIDTH - CAR_SIZE);

        // Animação de movimento
        Animated.spring(progressAnim, {
            toValue: targetPosition,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
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
    }, [student.answered, student.total]);

    // Cor fixa por aluno
    const carColor = getCarColorForStudent(student.student_name, student.student_id);
    const carImage = CAR_IMAGES[carColor];
    const medal = getMedalEmoji(student.position);

    return (
        <View style={[styles.carLane, { top: index * 120 }]}>
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
        </View>
    );
}

export default function LiveRankingSlide({ data }: Props) {
    const { title = '🏁 CORRIDA DO CONHECIMENTO', ranking, total_students } = data;
    const topRacers = ranking.slice(0, 5); // Top 5 na pista

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

            {/* Pista de Corrida */}
            <View style={styles.trackContainer}>
                {/* Linha de Largada */}
                <View style={styles.startLine}>
                    <MaterialIcons name="flag" size={32} color="#10b981" />
                    <Text style={styles.lineLabel}>LARGADA</Text>
                </View>

                {/* Linha de Chegada */}
                <View style={styles.finishLine}>
                    <MaterialIcons name="sports-score" size={32} color="#ef4444" />
                    <Text style={styles.lineLabel}>CHEGADA</Text>
                </View>

                {/* Marcações de Progresso */}
                <View style={styles.progressMarkers}>
                    {[25, 50, 75].map((percent) => (
                        <View
                            key={percent}
                            style={[styles.marker, { left: (TRACK_WIDTH * percent) / 100 }]}
                        >
                            <View style={styles.markerLine} />
                            <Text style={styles.markerText}>{percent}%</Text>
                        </View>
                    ))}
                </View>

                {/* Pista com Carros */}
                <View style={styles.track}>
                    {topRacers.length === 0 ? (
                        <View style={styles.emptyTrack}>
                            <MaterialIcons name="hourglass-empty" size={64} color="rgba(255,255,255,0.3)" />
                            <Text style={styles.emptyText}>Aguardando largada...</Text>
                        </View>
                    ) : (
                        topRacers.map((student, index) => (
                            <RaceCar key={student.student_name} student={student} index={index} />
                        ))
                    )}
                </View>
            </View>

            {/* Placar Lateral */}
            <View style={styles.scoreboard}>
                <Text style={styles.scoreboardTitle}>🏆 PLACAR</Text>
                {ranking.slice(0, 10).map((student, index) => (
                    <View
                        key={student.student_name}
                        style={[styles.scoreItem, index < 3 && styles.topThreeScore]}
                    >
                        <Text style={styles.scorePosition}>
                            {getMedalEmoji(student.position) || `${student.position}º`}
                        </Text>
                        <Text style={styles.scoreName} numberOfLines={1}>
                            {student.student_name}
                        </Text>
                        <Text style={styles.scorePoints}>{student.points}</Text>
                    </View>
                ))}
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
    },
    title: {
        fontSize: typography.fontSize['3xl'],
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    liveIndicator: {
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
        marginBottom: spacing.lg,
    },
    startLine: {
        position: 'absolute',
        left: 0,
        top: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    finishLine: {
        position: 'absolute',
        right: 0,
        top: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    lineLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
        marginTop: 4,
    },
    progressMarkers: {
        position: 'absolute',
        top: 60,
        left: 80,
        width: TRACK_WIDTH - 100,
        height: 600,
    },
    marker: {
        position: 'absolute',
        alignItems: 'center',
    },
    markerLine: {
        width: 2,
        height: 600,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    markerText: {
        fontSize: typography.fontSize.xs,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 4,
    },
    track: {
        marginTop: 80,
        marginLeft: 80,
        height: 600,
        position: 'relative',
    },
    carLane: {
        position: 'absolute',
        left: 0,
        width: TRACK_WIDTH,
        height: 100,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
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
    scoreboard: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    scoreboardTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    scoreItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        gap: spacing.sm,
    },
    topThreeScore: {
        backgroundColor: 'rgba(255,215,0,0.15)',
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.md,
    },
    scorePosition: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        width: 40,
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
    },
});
