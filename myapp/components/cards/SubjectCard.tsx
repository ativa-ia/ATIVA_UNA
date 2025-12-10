import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ViewStyle,
    View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Subject } from '../../types';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { borderRadius, spacing } from '../../constants/spacing';

interface SubjectCardProps {
    subject: Subject;
    onPress?: () => void;
    style?: ViewStyle;
}

// Get icon based on subject name
const getSubjectIcon = (name: string): keyof typeof MaterialIcons.glyphMap => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('matemática') || lowerName.includes('math')) return 'calculate';
    if (lowerName.includes('português') || lowerName.includes('língua')) return 'menu-book';
    if (lowerName.includes('história')) return 'history-edu';
    if (lowerName.includes('geografia')) return 'public';
    if (lowerName.includes('ciências') || lowerName.includes('biologia')) return 'science';
    if (lowerName.includes('física')) return 'bolt';
    if (lowerName.includes('química')) return 'biotech';
    if (lowerName.includes('inglês') || lowerName.includes('english')) return 'translate';
    if (lowerName.includes('educação física')) return 'sports';
    if (lowerName.includes('arte')) return 'palette';
    return 'school';
};

export const SubjectCard: React.FC<SubjectCardProps> = ({
    subject,
    onPress,
    style,
}) => {
    const icon = getSubjectIcon(subject.name);

    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.iconContainer}>
                <MaterialIcons name={icon} size={28} color={colors.primary} />
            </View>

            <Text style={styles.title} numberOfLines={2}>
                {subject.name}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        minHeight: 100,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primaryOpacity20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        lineHeight: typography.fontSize.base * typography.lineHeight.tight,
    },
});
