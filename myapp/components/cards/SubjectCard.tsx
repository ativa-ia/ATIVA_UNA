import React from 'react';
import {
    TouchableOpacity,
    ImageBackground,
    Text,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Subject } from '../../types';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { borderRadius, spacing } from '../../constants/spacing';

interface SubjectCardProps {
    subject: Subject;
    onPress?: () => void;
    style?: ViewStyle;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
    subject,
    onPress,
    style,
}) => {
    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <ImageBackground
                source={{ uri: subject.imageUrl }}
                style={styles.background}
                imageStyle={styles.backgroundImage}
            >
                <LinearGradient
                    colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.6)']}
                    style={styles.gradient}
                >
                    <Text style={styles.title} numberOfLines={2}>
                        {subject.name}
                    </Text>
                </LinearGradient>
            </ImageBackground>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        aspectRatio: 4 / 3,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    background: {
        width: '100%',
        height: '100%',
    },
    backgroundImage: {
        borderRadius: borderRadius.lg,
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: spacing.md,
    },
    title: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        lineHeight: typography.fontSize.base * typography.lineHeight.tight,
    },
});
