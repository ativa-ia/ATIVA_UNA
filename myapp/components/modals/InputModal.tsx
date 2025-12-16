import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TextInput, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';

interface InputModalProps {
    visible: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    initialValue?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: (text: string) => void;
    onCancel: () => void;
}

export default function InputModal({
    visible,
    title,
    message,
    placeholder = 'Digite aqui...',
    initialValue = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    onConfirm,
    onCancel
}: InputModalProps) {
    const [text, setText] = useState(initialValue);

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setText(initialValue);
        }
    }, [visible, initialValue]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onCancel}>
                            <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {message && <Text style={styles.message}>{message}</Text>}

                        <TextInput
                            style={styles.input}
                            value={text}
                            onChangeText={setText}
                            placeholder={placeholder}
                            placeholderTextColor={colors.slate400}
                            autoFocus={Platform.OS === 'web'} // Auto focus on web for better UX
                        />
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onCancel}
                        >
                            <Text style={styles.cancelText}>{cancelText}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                !text.trim() && styles.disabledButton
                            ]}
                            onPress={() => {
                                if (text.trim()) {
                                    onConfirm(text);
                                }
                            }}
                            disabled={!text.trim()}
                        >
                            <Text style={styles.confirmText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    title: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    content: {
        padding: spacing.md,
    },
    message: {
        fontSize: typography.fontSize.base,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.slate300,
        borderRadius: borderRadius.default,
        padding: spacing.sm,
        fontSize: 16,
        color: colors.textPrimary,
        minHeight: 48,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
    },
    cancelButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.default,
    },
    cancelText: {
        color: colors.textSecondary,
        fontWeight: '500',
    },
    confirmButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.default,
    },
    disabledButton: {
        backgroundColor: colors.slate300,
        opacity: 0.7,
    },
    confirmText: {
        color: colors.white,
        fontWeight: 'bold',
    },
});
