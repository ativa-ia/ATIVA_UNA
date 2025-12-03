import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Notice } from '../../types';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { borderRadius, spacing } from '../../constants/spacing';

interface NoticeCardProps {
    notice: Notice;
    darkMode?: boolean;
    style?: ViewStyle;
}

export const NoticeCard: React.FC<NoticeCardProps> = ({
    notice,
    darkMode = false,
    style,
}) => {
    return (
        <View
            style={[
                styles.container,
                darkMode ? styles.containerDark : styles.containerLight,
                style,
            ]}
        >
            <Text style={[styles.title, darkMode && styles.titleDark]}>
                {notice.title}
            </Text>
            <Text style={[styles.description, darkMode && styles.descriptionDark]}>
                {notice.description}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 256,
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        gap: spacing.md,
    },
    containerLight: {
        backgroundColor: colors.zinc100,
    },
    containerDark: {
        backgroundColor: 'rgba(39, 39, 42, 0.5)', // zinc800 with opacity
    },
    title: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc900,
    },
    titleDark: {
        color: colors.white,
    },
    description: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.normal,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc600,
    },
    descriptionDark: {
        color: colors.zinc400,
    },
});
