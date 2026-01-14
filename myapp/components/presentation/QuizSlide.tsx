import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';

interface Props {
    data: {
        question: string;
        options: string[];
        currentIndex?: number;
        total?: number;
    };
}

export default function QuizSlide({ data }: Props) {
    return (
        <View style={styles.container}>
            {data.currentIndex !== undefined && data.total && (
                <Text style={styles.counter}>
                    Questão {data.currentIndex + 1} de {data.total}
                </Text>
            )}

            <Text style={styles.question}>{data.question}</Text>

            <View style={styles.optionsContainer}>
                {data.options.map((option, index) => (
                    <View key={index} style={styles.option}>
                        <Text style={styles.optionLetter}>
                            {String.fromCharCode(65 + index)}
                        </Text>
                        <Text style={styles.optionText}>{option}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        padding: 40,
        justifyContent: 'center',
    },
    counter: {
        fontSize: 20,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 24,
    },
    question: {
        fontSize: 36,
        fontWeight: 'bold',
        color: colors.white,
        textAlign: 'center',
        marginBottom: 40,
    },
    optionsContainer: {
        gap: spacing.md,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        padding: 20,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    optionLetter: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.primary,
        marginRight: 16,
        minWidth: 40,
    },
    optionText: {
        fontSize: 24,
        color: colors.white,
        flex: 1,
    },
});
