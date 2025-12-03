import React from 'react';
import { Image, View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { borderRadius } from '../../constants/spacing';

interface AvatarProps {
    uri?: string;
    size?: number;
    style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
    uri,
    size = 40,
    style,
}) => {
    return (
        <View
            style={[
                styles.container,
                { width: size, height: size, borderRadius: size / 2 },
                style,
            ]}
        >
            {uri ? (
                <Image
                    source={{ uri }}
                    style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
                />
            ) : (
                <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    image: {
        resizeMode: 'cover',
    },
    placeholder: {
        backgroundColor: colors.slate300,
    },
});
