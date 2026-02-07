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
    // Limpar texto: remover tags [TYPE:SUMMARY] e tratar JSON
    const cleanText = React.useMemo(() => {
        let text = data.text || '';

        // 1. Remover tags [TYPE:SUMMARY] ou [TYPE: SUMMARY]
        text = text.replace(/^\[TYPE:\s*SUMMARY\]\s*/i, '');

        // 2. Tentar parsear se for JSON com campo "text"
        if (text.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(text);
                if (parsed.text) {
                    text = parsed.text;
                } else if (parsed.summary) {
                    text = parsed.summary;
                }
            } catch (e) {
                // Não é JSON válido, manter como está
            }
        }

        return text.trim();
    }, [data.text]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {data.title && (
                <Text style={styles.title}>{data.title}</Text>
            )}
            <Markdown style={markdownStyles}>
                {cleanText}
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
