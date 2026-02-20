import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';

export interface SummaryAudioOptions {
    voice: string;
    mode: 'summary' | 'normal' | 'fast';
    bg_id: string | null;
    bg_volume: number;
}

interface SummaryAudioOptionsModalProps {
    visible: boolean;
    initialTitle?: string;
    initialValue?: SummaryAudioOptions;
    onConfirm: (value: { title: string; options: SummaryAudioOptions }) => void;
    onCancel: () => void;
}

const VOICES = [
    { id: 'pt_BR-faber-medium', label: 'Faber (equilibrado)' },
    { id: 'pt_BR-cadu-medium', label: 'Cadu (variação)' },
    { id: 'pt_BR-jeff-medium', label: 'Jeff (padrão)' },
    { id: 'pt_BR-edresson-low', label: 'Edresson (rápido)' },
];

const MODES: Array<{ id: 'summary' | 'normal' | 'fast'; label: string }> = [
    { id: 'summary', label: 'Summary (didático)' },
    { id: 'normal', label: 'Normal' },
    { id: 'fast', label: 'Fast' },
];

const BG_TRACKS = [
    { id: null, label: 'Sem música' },
    { id: 'lofi_calm', label: 'Lofi Calm' },
    { id: 'lofi_study', label: 'Lofi Study' },
    { id: 'lofi_jazz', label: 'Lofi Jazz' },
    { id: 'lofi_ambient', label: 'Lofi Ambient' },
    { id: 'lofi_dreams', label: 'Lofi Dreams' },
];

export default function SummaryAudioOptionsModal({
    visible,
    initialTitle,
    initialValue,
    onConfirm,
    onCancel,
}: SummaryAudioOptionsModalProps) {
    const defaults: SummaryAudioOptions = useMemo(() => ({
        voice: initialValue?.voice || 'pt_BR-jeff-medium',
        mode: initialValue?.mode || 'summary',
        bg_id: initialValue?.bg_id ?? 'lofi_calm',
        bg_volume: initialValue?.bg_volume ?? 0.10,
    }), [initialValue]);

    const [voice, setVoice] = useState(defaults.voice);
    const [mode, setMode] = useState<SummaryAudioOptions['mode']>(defaults.mode);
    const [bgId, setBgId] = useState<string | null>(defaults.bg_id);
    const [title, setTitle] = useState(initialTitle || 'Resumo da Aula');

    React.useEffect(() => {
        if (visible) {
            setVoice(defaults.voice);
            setMode(defaults.mode);
            setBgId(defaults.bg_id);
            setTitle(initialTitle || 'Resumo da Aula');
        }
    }, [visible, defaults, initialTitle]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Configurar Áudio do Resumo</Text>
                        <TouchableOpacity onPress={onCancel}>
                            <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} contentContainerStyle={{ gap: spacing.md }}>
                        <View>
                            <Text style={styles.label}>Título do resumo</Text>
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Ex: Resumo da Aula 1"
                                placeholderTextColor={colors.slate400}
                                style={styles.input}
                            />
                        </View>

                        <View>
                            <Text style={styles.label}>Voz</Text>
                            <View style={styles.optionsWrap}>
                                {VOICES.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.optionChip, voice === item.id && styles.optionChipActive]}
                                        onPress={() => setVoice(item.id)}
                                    >
                                        <Text style={[styles.optionText, voice === item.id && styles.optionTextActive]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View>
                            <Text style={styles.label}>Modo</Text>
                            <View style={styles.optionsWrap}>
                                {MODES.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.optionChip, mode === item.id && styles.optionChipActive]}
                                        onPress={() => setMode(item.id)}
                                    >
                                        <Text style={[styles.optionText, mode === item.id && styles.optionTextActive]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View>
                            <Text style={styles.label}>Música</Text>
                            <View style={styles.optionsWrap}>
                                {BG_TRACKS.map((item) => (
                                    <TouchableOpacity
                                        key={item.id ?? 'none'}
                                        style={[styles.optionChip, bgId === item.id && styles.optionChipActive]}
                                        onPress={() => setBgId(item.id)}
                                    >
                                        <Text style={[styles.optionText, bgId === item.id && styles.optionTextActive]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.confirmButton, !title.trim() && styles.disabledButton]}
                            disabled={!title.trim()}
                            onPress={() => onConfirm({
                                title: title.trim(),
                                options: {
                                    voice,
                                    mode,
                                    bg_id: bgId,
                                    bg_volume: 0.10,
                                }
                            })}
                        >
                            <Text style={styles.confirmText}>Enviar com Áudio</Text>
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
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    container: {
        width: '100%',
        maxWidth: 560,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    header: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    content: {
        maxHeight: 420,
        padding: spacing.md,
    },
    label: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    optionsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.slate300,
        borderRadius: borderRadius.default,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        color: colors.textPrimary,
        fontSize: typography.fontSize.base,
        minHeight: 44,
    },
    optionChip: {
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: 999,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: colors.white,
    },
    optionChipActive: {
        borderColor: colors.primary,
        backgroundColor: '#ede9fe',
    },
    optionText: {
        color: colors.textSecondary,
        fontSize: typography.fontSize.sm,
    },
    optionTextActive: {
        color: colors.primary,
        fontWeight: typography.fontWeight.semibold,
    },
    footer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
    cancelButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    cancelText: {
        color: colors.textSecondary,
        fontWeight: typography.fontWeight.medium,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.default,
    },
    disabledButton: {
        opacity: 0.6,
    },
    confirmText: {
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
    },
});
