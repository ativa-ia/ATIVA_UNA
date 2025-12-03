import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Material } from '../../types';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { borderRadius, spacing } from '../../constants/spacing';

interface MaterialCardProps {
    material: Material;
    darkMode?: boolean;
    style?: ViewStyle;
}

const getIconName = (type: Material['type']): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
        case 'pdf':
            return 'picture-as-pdf';
        case 'video':
            return 'play-circle-outline';
        case 'link':
            return 'link';
        case 'document':
            return 'description';
        default:
            return 'description';
    }
};

export const MaterialCard: React.FC<MaterialCardProps> = ({
    material,
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
                    name={getIconName(material.type)}
                    size={24}
                    color={colors.primary}
                />
            </View>

            <View style={styles.content}>
                <Text style={[styles.title, darkMode && styles.titleDark]}>
                    {material.title}
                </Text>
                <Text style={[styles.subject, darkMode && styles.subjectDark]}>
                    {material.subject}
                </Text>
            </View>

            <View style={styles.metadata}>
                <Text style={[styles.date, darkMode && styles.dateDark]}>
                    {material.uploadDate}
                </Text>
                {material.size && (
                    <Text style={[styles.size, darkMode && styles.sizeDark]}>
                        {material.size}
                    </Text>
                )}
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
    metadata: {
        alignItems: 'flex-end',
        gap: 4,
    },
    date: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.normal,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc600,
    },
    dateDark: {
        color: colors.zinc400,
    },
    size: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.normal,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc500,
    },
    sizeDark: {
        color: colors.zinc500,
    },
});
