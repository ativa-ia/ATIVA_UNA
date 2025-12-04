import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, borderRadius } from '../../constants/spacing';

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
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.wrapper,
                darkMode ? styles.wrapperDark : styles.wrapperLight,
                { paddingBottom: insets.bottom + spacing.sm }
            ]}
        >
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
                                    numberOfLines={1}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        // No absolute positioning - sits at bottom of flex container
        paddingHorizontal: spacing.base,
        paddingTop: spacing.sm,
    },
    wrapperLight: {
        backgroundColor: colors.backgroundLight,
    },
    wrapperDark: {
        backgroundColor: colors.backgroundDark,
    },
    container: {
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    containerLight: {
        backgroundColor: '#f6f6f8',
        borderColor: colors.zinc200,
    },
    containerDark: {
        backgroundColor: '#1a1f2e',
        borderColor: colors.zinc800,
    },
    content: {
        flexDirection: 'row',
        height: 50,
        maxWidth: 448,
        marginHorizontal: 'auto',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: spacing.sm,
    },
    item: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        flex: 1,
        minWidth: 50,
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
