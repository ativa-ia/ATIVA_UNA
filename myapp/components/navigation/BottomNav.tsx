import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';

export interface NavItem {
    id: string;
    label: string;
    iconName: keyof typeof MaterialIcons.glyphMap;
}

interface BottomNavProps {
    items: NavItem[];
    activeId: string;
    onItemPress: (id: string) => void;
    darkMode?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
    items,
    activeId,
    onItemPress,
    darkMode = false,
}) => {
    return (
        <View
            style={[
                styles.container,
                darkMode ? styles.containerDark : styles.containerLight,
            ]}
        >
            <View style={styles.content}>
                {items.map((item) => {
                    const isActive = item.id === activeId;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.item}
                            onPress={() => onItemPress(item.id)}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons
                                name={item.iconName}
                                size={24}
                                color={isActive ? colors.primary : (darkMode ? colors.zinc400 : colors.zinc500)}
                            />
                            <Text
                                style={[
                                    styles.label,
                                    isActive && styles.labelActive,
                                    darkMode && !isActive && styles.labelDark,
                                ]}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
    },
    containerLight: {
        backgroundColor: colors.backgroundLight,
        borderTopColor: colors.zinc200,
    },
    containerDark: {
        backgroundColor: colors.backgroundDark,
        borderTopColor: colors.zinc800,
    },
    content: {
        flexDirection: 'row',
        height: 80,
        maxWidth: 448, // max-w-md
        marginHorizontal: 'auto',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    item: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: spacing.sm,
        flex: 1,
    },
    label: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc500,
    },
    labelActive: {
        color: colors.primary,
    },
    labelDark: {
        color: colors.zinc400,
    },
});
