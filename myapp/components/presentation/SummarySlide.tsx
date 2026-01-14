import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors } from '@/constants/colors';

interface Props {
    data: {
        title?: string;
        text: string;
    };
}

export default function SummarySlide({ data }: Props) {
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {data.title && (
                <Text style={styles.title}>{data.title}</Text>
            )}
            <Markdown style={markdownStyles}>
                {data.text}
            </Markdown>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    content: {
        padding: 40,
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 24,
        textAlign: 'center',
    },
});

const markdownStyles = StyleSheet.create({
    body: { fontSize: 24, color: colors.white, lineHeight: 36 },
    heading1: { fontSize: 40, color: colors.primary, marginVertical: 16 },
    heading2: { fontSize: 32, color: colors.primary, marginVertical: 12 },
    paragraph: { fontSize: 24, color: colors.white, marginVertical: 8 },
    listItem: { fontSize: 24, color: colors.white },
    strong: { fontWeight: 'bold', color: colors.primary },
});
