import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Clipboard, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';

interface Props {
    code: string | null;
    onEnd: () => void;
}

export default function PresentationControls({ code, onEnd }: Props) {
    const presentationURL = `http://localhost:8081/presentation?code=${code}`;

    const handleCopyURL = () => {
        Clipboard.setString(presentationURL);
        Alert.alert('✅ Copiado', 'URL copiada para área de transferência');
    };

    const handleCopyCode = () => {
        if (code) {
            Clipboard.setString(code);
            Alert.alert('✅ Copiado', `Código ${code} copiado`);
        }
    };

    const handleEnd = () => {
        onEnd();
    };

    if (!code) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="cast-connected" size={24} color={colors.success} />
                <Text style={styles.title}>Transmissão Ativa</Text>
            </View>

            <View style={styles.codeContainer}>
                <View style={styles.codeRow}>
                    <Text style={styles.label}>Código:</Text>
                    <Text style={styles.code}>{code}</Text>
                    <TouchableOpacity onPress={handleCopyCode} style={styles.copyIcon}>
                        <MaterialIcons name="content-copy" size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleCopyURL} style={styles.urlRow}>
                    <MaterialIcons name="link" size={16} color={colors.slate600} />
                    <Text style={styles.url} numberOfLines={1}>{presentationURL}</Text>
                    <MaterialIcons name="content-copy" size={16} color={colors.slate600} />
                </TouchableOpacity>
            </View>

            <View style={styles.buttons}>
                <TouchableOpacity
                    style={[styles.button, styles.endButton]}
                    onPress={handleEnd}
                >
                    <MaterialIcons name="stop" size={20} color={colors.error} />
                    <Text style={[styles.buttonText, styles.endButtonText]}>Encerrar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.success + '15',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.success + '30',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        marginLeft: spacing.sm,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.success,
    },
    codeContainer: {
        marginBottom: spacing.sm,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    label: {
        fontSize: typography.fontSize.sm,
        color: colors.slate600,
        marginRight: spacing.xs,
    },
    code: {
        fontSize: 24,
        fontWeight: typography.fontWeight.bold,
        color: colors.primary,
        letterSpacing: 2,
        flex: 1,
    },
    copyIcon: {
        padding: spacing.xs,
    },
    urlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    url: {
        fontSize: typography.fontSize.xs,
        color: colors.slate600,
        flex: 1,
    },
    buttons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    endButton: {
        backgroundColor: colors.error + '15',
        borderWidth: 1,
        borderColor: colors.error + '30',
    },
    buttonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
    },
    endButtonText: {
        color: colors.error,
    },
});
