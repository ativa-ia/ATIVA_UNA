import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { API_URL } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AVAILABLE_MODELS = [
    { id: 'gpt-4o', label: 'GPT-4o', description: 'Mais inteligente e versátil', tier: 'premium' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Rápido e econômico', tier: 'standard' },
    { id: 'gpt-4.1', label: 'GPT-4.1', description: 'Último modelo de ponta', tier: 'premium' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Leve e eficiente', tier: 'standard' },
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', description: 'Ultra-leve, custo mínimo', tier: 'economy' },
    { id: 'o4-mini', label: 'o4-mini', description: 'Raciocínio avançado', tier: 'premium' },
];

const TIER_COLORS: Record<string, string> = {
    premium: '#8b5cf6',
    standard: '#3b82f6',
    economy: '#10b981',
};

const TIER_LABELS: Record<string, string> = {
    premium: 'Premium',
    standard: 'Padrão',
    economy: 'Econômico',
};

export const AIConfiguration = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_URL}/settings/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.settings) {
                const settingsRecord = data.settings.reduce((acc: any, curr: any) => {
                    acc[curr.key] = curr.value;
                    return acc;
                }, {});
                if (settingsRecord.ai_model) setSelectedModel(settingsRecord.ai_model);
            }
        } catch (error) {
            console.error('Erro ao buscar configurações de IA:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_URL}/settings/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    key: 'ai_model',
                    value: selectedModel,
                    description: 'Modelo de IA utilizado',
                    is_public: false
                })
            });
            const data = await response.json();
            if (data.success) {
                Alert.alert('Sucesso', `Modelo alterado para ${selectedModel}`);
            } else {
                Alert.alert('Erro', data.message || 'Falha ao salvar.');
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha ao salvar configurações.');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    const currentModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.iconCircle}>
                        <MaterialIcons name="psychology" size={20} color={colors.white} />
                    </View>
                    <View>
                        <Text style={styles.title}>Gestão do Cérebro</Text>
                        <Text style={styles.subtitle}>Modelo de IA ativo</Text>
                    </View>
                </View>
            </View>

            {/* Current Model Badge */}
            {currentModelInfo && (
                <View style={[styles.currentBadge, { borderColor: TIER_COLORS[currentModelInfo.tier] + '40' }]}>
                    <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[currentModelInfo.tier] }]} />
                    <Text style={styles.currentBadgeText}>
                        Ativo: <Text style={{ fontWeight: '700' }}>{currentModelInfo.label}</Text>
                    </Text>
                    <View style={[styles.tierTag, { backgroundColor: TIER_COLORS[currentModelInfo.tier] + '20' }]}>
                        <Text style={[styles.tierTagText, { color: TIER_COLORS[currentModelInfo.tier] }]}>
                            {TIER_LABELS[currentModelInfo.tier]}
                        </Text>
                    </View>
                </View>
            )}

            {/* Model Selection Grid */}
            <Text style={styles.sectionLabel}>Selecionar Modelo</Text>
            <View style={styles.modelsGrid}>
                {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModel === model.id;
                    const tierColor = TIER_COLORS[model.tier];
                    return (
                        <TouchableOpacity
                            key={model.id}
                            style={[
                                styles.modelCard,
                                isSelected && { borderColor: tierColor, borderWidth: 2, backgroundColor: tierColor + '08' },
                            ]}
                            onPress={() => setSelectedModel(model.id)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.modelCardHeader}>
                                <Text style={[styles.modelName, isSelected && { color: tierColor }]}>{model.label}</Text>
                                {isSelected && (
                                    <MaterialIcons name="check-circle" size={18} color={tierColor} />
                                )}
                            </View>
                            <Text style={styles.modelDesc}>{model.description}</Text>
                            <View style={[styles.tierTag, { backgroundColor: tierColor + '15', alignSelf: 'flex-start', marginTop: 6 }]}>
                                <Text style={[styles.tierTagText, { color: tierColor }]}>{TIER_LABELS[model.tier]}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Save Button */}
            <TouchableOpacity
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
            >
                {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                ) : (
                    <View style={styles.saveButtonInner}>
                        <MaterialIcons name="save" size={18} color={colors.white} />
                        <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.slate100,
    },
    loadingContainer: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#7c3aed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    subtitle: {
        fontSize: 11,
        color: colors.zinc400,
        marginTop: 1,
    },
    currentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.slate50,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        gap: 8,
    },
    tierDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    currentBadgeText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
    },
    tierTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    tierTagText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    modelsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: spacing.md,
    },
    modelCard: {
        width: '48%',
        backgroundColor: colors.slate50,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    modelCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modelName: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    modelDesc: {
        fontSize: 11,
        color: colors.zinc400,
        marginTop: 2,
    },
    saveButton: {
        backgroundColor: '#7c3aed',
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.7,
    },
    saveButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    saveButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
});
