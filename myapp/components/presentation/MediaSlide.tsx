import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '@/constants/colors';

interface Props {
    type: 'image' | 'video';
    data: {
        url: string;
        caption?: string;
    };
}

export default function MediaSlide({ type, data }: Props) {
    return (
        <View style={styles.container}>
            {type === 'image' ? (
                <Image
                    source={{ uri: data.url }}
                    style={styles.image}
                    resizeMode="contain"
                />
            ) : (
                <View style={styles.videoPlaceholder}>
                    <Text style={styles.placeholderText}>🎥 Vídeo</Text>
                    <Text style={styles.urlText}>{data.url}</Text>
                    <Text style={styles.noteText}>
                        (Reprodução de vídeo será implementada em breve)
                    </Text>
                </View>
            )}

            {data.caption && (
                <Text style={styles.caption}>{data.caption}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    image: {
        width: '100%',
        height: '80%',
    },
    videoPlaceholder: {
        width: '100%',
        height: '80%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.slate800,
        borderRadius: 12,
        padding: 20,
    },
    placeholderText: {
        fontSize: 48,
        marginBottom: 16,
    },
    urlText: {
        fontSize: 16,
        color: colors.slate400,
        textAlign: 'center',
        marginBottom: 8,
    },
    noteText: {
        fontSize: 14,
        color: colors.slate500,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    caption: {
        marginTop: 16,
        fontSize: 20,
        color: colors.white,
        textAlign: 'center',
    },
});
