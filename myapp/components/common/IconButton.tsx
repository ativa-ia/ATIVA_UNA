import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { borderRadius } from '../../constants/spacing';

interface IconButtonProps {
    iconName: keyof typeof MaterialIcons.glyphMap;
    onPress: () => void;
    size?: number;
    color?: string;
    backgroundColor?: string;
    style?: ViewStyle;
}

export const IconButton: React.FC<IconButtonProps> = ({
    iconName,
    onPress,
    size = 24,
    color = colors.slate900,
    backgroundColor = colors.transparent,
    style,
}) => {
    return (
        <TouchableOpacity
            style={[styles.button, { backgroundColor }, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <MaterialIcons name={iconName} size={size} color={color} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
