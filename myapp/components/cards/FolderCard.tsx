import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, borderRadius } from '../../constants/spacing';

interface FolderCardProps {
    title: string;
    iconName: keyof typeof MaterialIcons.glyphMap;
    accentColor: string;
    itemCount: number;
    isOpen: boolean;
    onPress: () => void;
    subtitle?: string;
}

export const FolderCard: React.FC<FolderCardProps> = ({
    title,
    iconName,
    accentColor,
    itemCount,
    isOpen,
    onPress,
    subtitle,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    return (
        <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
                style={[
                    styles.container,
                    isOpen && { borderColor: accentColor, borderWidth: 2 },
                ]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
            >
                {/* Accent stripe at top */}
                <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />

                {/* Icon circle */}
                <View style={[styles.iconCircle, { backgroundColor: accentColor + '20' }]}>
                    <MaterialIcons name={iconName} size={28} color={accentColor} />
                </View>

                {/* Title */}
                <Text style={styles.title} numberOfLines={1}>
                    {title}
                </Text>

                {/* Subtitle / Count */}
                {subtitle ? (
                    <Text style={[styles.subtitle, { color: accentColor }]}>{subtitle}</Text>
                ) : (
                    <Text style={styles.countText}>
                        {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                    </Text>
                )}

                {/* Open indicator */}
                <View style={[styles.openIndicator, { backgroundColor: accentColor + '15' }]}>
                    <MaterialIcons
                        name={isOpen ? 'folder-open' : 'folder'}
                        size={16}
                        color={accentColor}
                    />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: '47%',
        minWidth: 150,
    },
    container: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'center',
        gap: spacing.sm,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.slate100,
        overflow: 'hidden',
        position: 'relative',
    },
    accentStripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    title: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        textAlign: 'center',
    },
    countText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
    },
    openIndicator: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
});
