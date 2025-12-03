import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Avatar } from '../common/Avatar';
import { IconButton } from '../common/IconButton';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';

interface HeaderProps {
    userName: string;
    avatarUri?: string;
    onNotificationPress?: () => void;
    darkMode?: boolean;
    style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
    userName,
    avatarUri,
    onNotificationPress,
    darkMode = false,
    style,
}) => {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.avatarContainer}>
                <Avatar uri={avatarUri} size={40} />
            </View>

            <Text style={[styles.greeting, darkMode && styles.greetingDark]}>
                Olá, {userName}
            </Text>

            <View style={styles.actions}>
                <IconButton
                    iconName="notifications"
                    onPress={onNotificationPress || (() => { })}
                    color={darkMode ? colors.white : colors.zinc900}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base,
        paddingBottom: spacing.sm,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    greeting: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc900,
        letterSpacing: typography.letterSpacing.tight,
    },
    greetingDark: {
        color: colors.white,
    },
    actions: {
        width: 48,
        alignItems: 'flex-end',
    },
});
