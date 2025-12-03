import React from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    TextInputProps,
    ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { borderRadius, spacing } from '../../constants/spacing';

interface InputProps extends TextInputProps {
    iconName?: keyof typeof MaterialIcons.glyphMap;
    containerStyle?: ViewStyle;
    darkMode?: boolean;
}

export const Input: React.FC<InputProps> = ({
    iconName,
    containerStyle,
    darkMode = false,
    style,
    ...textInputProps
}) => {
    return (
        <View style={[styles.container, containerStyle]}>
            {iconName && (
                <MaterialIcons
                    name={iconName}
                    size={24}
                    color={darkMode ? colors.slate500 : colors.slate400}
                    style={styles.icon}
                />
            )}
            <TextInput
                style={[
                    styles.input,
                    darkMode ? styles.inputDark : styles.inputLight,
                    iconName && styles.inputWithIcon,
                    style,
                ]}
                placeholderTextColor={colors.slate500}
                {...textInputProps}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        width: '100%',
    },
    icon: {
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: [{ translateY: -12 }],
        zIndex: 1,
    },
    input: {
        height: 56,
        borderRadius: borderRadius.lg,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        paddingHorizontal: spacing.base,
    },
    inputLight: {
        backgroundColor: colors.slate200,
        borderWidth: 0,
        color: colors.slate900,
    },
    inputDark: {
        backgroundColor: colors.backgroundDark,
        borderWidth: 1,
        borderColor: colors.slate800,
        color: colors.white,
    },
    inputWithIcon: {
        paddingLeft: 40,
    },
});
