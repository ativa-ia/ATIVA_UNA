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
            <View>
                <View style={styles.iconContainer}>
                    <MaterialIcons name={icon} size={28} color={colors.primary} />
                </View>

                <Text style={styles.title} numberOfLines={2}>
                    {subject.name}
                </Text>

                {subject.professor && (
                    <Text style={styles.professor} numberOfLines={1}>
                        Professor: {subject.professor}
                    </Text>
                )}
            </View>

            <View style={styles.footer}>
                <Text style={styles.accessText}>Acessar</Text>
                <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        minHeight: 140, // Increased height
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(79, 70, 229, 0.1)', // colors.primary with opacity
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        color: colors.textPrimary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        lineHeight: typography.fontSize.base * typography.lineHeight.tight,
        marginBottom: 4,
    },
    professor: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: spacing.sm,
    },
    accessText: {
        fontSize: typography.fontSize.xs,
        color: colors.primary,
        fontWeight: '600',
        marginRight: 2,
    },
});
