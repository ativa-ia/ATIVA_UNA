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
                                    color={isActive ? colors.primary : (darkMode ? colors.slate400 : colors.slate500)}
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
        borderRadius: 24,
        elevation: 10,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        // The user specifically asked for the border on the "rectangle behind"
        borderWidth: 1,
        borderColor: colors.primaryLight, // Visible colored border (not black)
    },
    containerLight: {
        backgroundColor: '#FFFFFF',
    },
    containerDark: {
        backgroundColor: '#1E293B',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    content: {
        flexDirection: 'row',
        height: 70,
        maxWidth: 600,
        marginHorizontal: 'auto',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingHorizontal: spacing.xs,
    },
    item: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        flex: 1,
        minWidth: 70,
    },
    label: {
        fontSize: typography.fontSize.xs, // Restored to 12
        fontWeight: '600',
        fontFamily: typography.fontFamily.display,
        color: colors.slate400,
        marginTop: 2,
    },
    labelActive: {
        color: colors.primary,
        fontWeight: 'bold',
    },
    labelDark: {
        color: colors.slate500,
    },
});
