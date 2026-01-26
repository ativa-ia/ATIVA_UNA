import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';

interface Props {
    data: {
        // Single Question props
        question?: string;
        options?: string[];
        currentIndex?: number;
        total?: number;

        // Full Quiz props
        questions?: any[];
        currentQuestionIndex?: number;
        [key: string]: any; // Allow loose typing to prevent crashes on unexpectedly shape
    };
}

export default function QuizSlide({ data }: Props) {
    if (!data) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Sem dados do quiz</Text>
            </View>
        );
    }

    // Normalização: Sempre trabalhar com ARRAY de questions
    let questionsList: any[] = [];

    if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        questionsList = data.questions;
    } else if (data.question) {
        // Fallback: Se vier só uma questão solta, transforma em array
        questionsList = [{
            question: data.question,
            options: data.options || [],
            currentIndex: data.currentIndex,
            total: data.total
        }];
    }

    if (questionsList.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Nenhuma questão para exibir</Text>
            </View>
        );
    }

    // Grid Logic Agressiva para 10 Qs sem scroll:
    // 1-3: 1 col
    // 4: 2 cols
    // 5-6: 3 cols
    // 7-8: 4 cols
    // 9+: 5 cols
    const numQuestions = questionsList.length;

    let columns = 1;
    if (numQuestions >= 9) columns = 5;
    else if (numQuestions >= 7) columns = 4;
    else if (numQuestions >= 5) columns = 3;
    else if (numQuestions === 4) columns = 2;

    const useCompact = columns >= 3;
    const useSuperCompact = columns >= 5;

    return (
        <View style={styles.container}>
            <Text style={[styles.headerTitle, useCompact && { marginBottom: 8, fontSize: 24 }]}>
                Quiz ({numQuestions} questões)
            </Text>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, useCompact && { paddingBottom: 8 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={[
                    styles.gridContainer,
                    columns > 1 && styles.gridContainerRow
                ]}>
                    {questionsList.map((q, index) => (
                        <View key={index} style={[
                            styles.card,
                            columns === 2 && styles.cardTwoCols,
                            columns === 3 && styles.cardThreeCols,
                            columns === 4 && styles.cardFourCols,
                            columns === 5 && styles.cardFiveCols,
                            useCompact && styles.cardCompactPadding
                        ]}>
                            <View style={[styles.cardHeader, useCompact && { marginBottom: 4 }]}>
                                <Text style={[styles.questionIndex, useCompact && { fontSize: 16, width: 20 }]}>
                                    {index + 1}.
                                </Text>
                                <Text
                                    style={[
                                        styles.questionText,
                                        useCompact && styles.questionTextCompact,
                                        useSuperCompact && styles.questionTextSuperCompact
                                    ]}
                                    numberOfLines={useSuperCompact ? 2 : 3}
                                >
                                    {q.question || 'Sem texto da pergunta'}
                                </Text>
                            </View>

                            <View style={[styles.optionsContainer, useCompact && { paddingLeft: 24, gap: 4 }]}>
                                {Array.isArray(q.options) && q.options.length > 0 ? (
                                    q.options.map((option: string, optIndex: number) => {
                                        const isCorrect = optIndex === q.correct;
                                        return (
                                            <View
                                                key={optIndex}
                                                style={[
                                                    styles.optionRow,
                                                    isCorrect && styles.optionRowCorrect,
                                                    useCompact && styles.optionRowCompact
                                                ]}
                                            >
                                                <View style={[
                                                    styles.optionLetterBadge,
                                                    isCorrect && styles.optionBadgeCorrect,
                                                    useCompact && styles.optionLetterBadgeCompact,
                                                    useSuperCompact && styles.optionLetterBadgeSuperCompact
                                                ]}>
                                                    <Text style={[
                                                        styles.optionLetterText,
                                                        useCompact && styles.optionLetterTextCompact,
                                                        useSuperCompact && styles.optionLetterTextSuperCompact
                                                    ]}>
                                                        {String.fromCharCode(65 + optIndex)}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.optionText,
                                                        isCorrect && styles.optionTextCorrect,
                                                        useCompact && styles.optionTextCompact,
                                                        useSuperCompact && styles.optionTextSuperCompact
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {option}
                                                </Text>
                                            </View>
                                        );
                                    })
                                ) : (
                                    <Text style={styles.noOptionsText}>
                                        (Sem opções)
                                    </Text>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
    },
    // ... existing styles ...
    gridContainer: {
        width: '100%',
    },
    gridContainerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: spacing.md, // Reduced gap
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: borderRadius.lg, // Reduced radius
        padding: spacing.xl,
        marginBottom: spacing.lg,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        width: '100%',
    },
    cardTwoCols: {
        width: '49%',
        marginBottom: spacing.md,
    },
    cardThreeCols: {
        width: '32%',
        marginBottom: spacing.sm,
    },
    cardFourCols: {
        width: '24%',
        marginBottom: spacing.sm,
    },
    cardFiveCols: {
        width: '19%',
        marginBottom: spacing.xs,
    },
    cardCompactPadding: {
        padding: 8,
    },

    // Compact Levels
    questionTextCompact: {
        fontSize: 14,
        lineHeight: 18,
    },
    questionTextSuperCompact: {
        fontSize: 12,
        lineHeight: 14,
    },
    optionRowCompact: {
        padding: 4,
        gap: 4,
        borderWidth: 0, // Remove border to save space
    },
    optionLetterBadgeCompact: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    optionLetterBadgeSuperCompact: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    optionLetterTextCompact: {
        fontSize: 10,
    },
    optionLetterTextSuperCompact: {
        fontSize: 8,
    },
    optionTextCompact: {
        fontSize: 12,
    },
    optionTextSuperCompact: {
        fontSize: 10,
    },

    // ... Rest of styles ...
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 24,
        color: colors.white,
        textAlign: 'center',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.white,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    scrollContent: {
        paddingBottom: spacing.xl,
        // maxWidth: 800,  <-- REMOVED MAX WIDTH CONSTRAINT FOR GRID
        width: '100%',
        alignSelf: 'center',
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: spacing.lg,
        gap: spacing.md,
    },
    questionIndex: {
        fontSize: 24,
        fontWeight: '900',
        color: colors.primary,
        width: 30, // Largura fixa para alinhamento
    },
    questionText: {
        flex: 1,
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.textPrimary,
        lineHeight: 32,
    },
    optionsContainer: {
        gap: spacing.md,
        paddingLeft: 46,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: 'rgba(0,0,0,0.03)',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    optionRowCorrect: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderColor: '#22c55e',
    },
    optionLetterBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionBadgeCorrect: {
        backgroundColor: '#22c55e',
    },
    optionLetterText: {
        color: colors.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
    optionText: {
        fontSize: 20,
        color: colors.textSecondary,
        flex: 1,
    },
    optionTextCorrect: {
        color: '#166534',
        fontWeight: 'bold',
    },
    noOptionsText: {
        fontSize: 18,
        color: colors.slate400,
        fontStyle: 'italic',
    }
});
