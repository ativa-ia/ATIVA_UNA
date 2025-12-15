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

// Get color based on subject name
const getSubjectColor = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('matemática') || lowerName.includes('math')) return '#4F46E5'; // Indigo
    if (lowerName.includes('português') || lowerName.includes('língua')) return '#F59E0B'; // Amber
    if (lowerName.includes('história')) return '#D97706'; // Dark Amber/Brown
    if (lowerName.includes('geografia')) return '#059669'; // Emerald
    if (lowerName.includes('ciências') || lowerName.includes('biologia')) return '#10B981'; // Green
    if (lowerName.includes('física')) return '#7C3AED'; // Violet
    if (lowerName.includes('química')) return '#DB2777'; // Pink
    if (lowerName.includes('inglês') || lowerName.includes('english')) return '#EF4444'; // Red
    if (lowerName.includes('arte')) return '#EC4899'; // Pink
    return colors.primary; // Default
};

export const SubjectCard: React.FC<SubjectCardProps> = ({
    subject,
    onPress,
    style,
}) => {
    const icon = getSubjectIcon(subject.name);
    const accentColor = getSubjectColor(subject.name);

    return (
        <TouchableOpacity
            style={[styles.container, { borderLeftColor: accentColor }, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View>
                <View style={[styles.iconContainer, { backgroundColor: `${accentColor}15` }]}>
                    <MaterialIcons name={icon} size={28} color={accentColor} />
                </View>

                <Text style={styles.title} numberOfLines={2}>
                    {subject.name}
                </Text>

                {subject.professor && (
                    <Text style={styles.professor} numberOfLines={1}>
                        Prof. {subject.professor}
                    </Text>
                )}
            </View>

            <View style={styles.footer}>
                <Text style={[styles.accessText, { color: accentColor }]}>Acessar</Text>
                <MaterialIcons name="chevron-right" size={16} color={accentColor} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        minHeight: 150,
        justifyContent: 'space-between',
        // Flag Style
        borderLeftWidth: 6,
        // Post-it Shadow
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 0, // No full border
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16, // Slightly clearer shape
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: '700',
        fontFamily: typography.fontFamily.display,
        lineHeight: 20,
        marginBottom: 6,
    },
    professor: {
        color: colors.textSecondary,
        fontSize: 12,
        fontStyle: 'italic',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9', // Very light separator
        paddingTop: 8,
    },
    accessText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginRight: 2,
        letterSpacing: 0.5,
    },
});
