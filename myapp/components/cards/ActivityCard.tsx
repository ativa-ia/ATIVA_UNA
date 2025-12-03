import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Activity } from '../../types';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { borderRadius, spacing } from '../../constants/spacing';

interface ActivityCardProps {
    activity: Activity;
    darkMode?: boolean;
    style?: ViewStyle;
}

const getIconName = (type: Activity['type']): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
        case 'assignment':
            return 'assignment';
        case 'quiz':
            return 'quiz';
        case 'exam':
            return 'school';
        default:
            return 'assignment';
    }
};

export const ActivityCard: React.FC<ActivityCardProps> = ({
    activity,
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
            <View
                style={[
                    styles.iconContainer,
                    darkMode ? styles.iconContainerDark : styles.iconContainerLight,
                ]}
            >
                <MaterialIcons
                    name={getIconName(activity.type)}
                    size={24}
                    color={colors.primary}
                />
            </View>

            <View style={styles.content}>
                <Text style={[styles.title, darkMode && styles.titleDark]}>
                    {activity.title}
                </Text>
                <Text style={[styles.subject, darkMode && styles.subjectDark]}>
                    {activity.subject}
                </Text>
            </View>

            <View style={styles.dueDate}>
                <Text style={[styles.dueDateLabel, darkMode && styles.dueDateLabelDark]}>
                    Vence
                </Text>
                <Text style={[styles.dueDateValue, darkMode && styles.dueDateValueDark]}>
                    {activity.dueDate}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.base,
    },
    containerLight: {
        backgroundColor: colors.zinc100,
    },
    containerDark: {
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainerLight: {
        backgroundColor: colors.primaryOpacity20,
    },
    iconContainerDark: {
        backgroundColor: colors.primaryOpacity20,
    },
    content: {
        flex: 1,
        gap: 4,
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
    subject: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.normal,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc600,
    },
    subjectDark: {
        color: colors.zinc400,
    },
    dueDate: {
        alignItems: 'flex-end',
        gap: 4,
    },
    dueDateLabel: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc900,
    },
    dueDateLabelDark: {
        color: colors.white,
    },
    dueDateValue: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.normal,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc600,
    },
    dueDateValueDark: {
        color: colors.zinc400,
    },
});
