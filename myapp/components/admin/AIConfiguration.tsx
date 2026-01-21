import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { API_URL } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AIConfig {
    openai_api_key?: string;
    ai_model?: string;
}

export const AIConfiguration = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gpt-4o-mini');
    const [showKey, setShowKey] = useState(false);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_URL}/settings/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (data.success && data.settings) {
                const settingsRecord = data.settings.reduce((acc: any, curr: any) => {
                    acc[curr.key] = curr.value;
                    return acc;
                }, {});

                if (settingsRecord.openai_api_key) setApiKey(settingsRecord.openai_api_key);
                if (settingsRecord.ai_model) setModel(settingsRecord.ai_model);
            }
        } catch (error) {
            console.error('Erro ao buscar configurações de IA:', error);
            // Non-blocking error, just keep defaults
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            // Save API Key
            await fetch(`${API_URL}/settings/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    key: 'openai_api_key',
                    value: apiKey,
                    description: 'Chave de API da OpenAI',
                    is_public: false
                })
            });

            // Save Model
            await fetch(`${API_URL}/settings/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    key: 'ai_model',
                    value: model,
                    description: 'Modelo de IA utilizado (ex: gpt-4o-mini)',
                    is_public: false
                })
            });

            Alert.alert('Sucesso', 'Configurações de IA atualizadas!');
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <MaterialIcons name="psychology" size={24} color={colors.primary} />
                    <Text style={styles.title}>Gestão de Cérebro (IA)</Text>
                </View>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={[styles.saveButton, saving && styles.disabledButton]}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Modelo de IA</Text>
                <TextInput
                    style={styles.input}
                    value={model}
                    onChangeText={setModel}
                    placeholder="ex: gpt-4o-mini"
                    placeholderTextColor={colors.zinc400}
                />
                <Text style={styles.hint}>Modelos suportados: gpt-4o, gpt-4o-mini, gpt-3.5-turbo</Text>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>OpenAI API Key</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        value={apiKey}
                        onChangeText={setApiKey}
                        placeholder="sk-..."
                        placeholderTextColor={colors.zinc400}
                        secureTextEntry={!showKey}
                    />
                    <TouchableOpacity onPress={() => setShowKey(!showKey)} style={styles.eyeIcon}>
                        <Ionicons name={showKey ? "eye-off" : "eye"} size={20} color={colors.zinc400} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.hint}>Mantenha esta chave segura. Se deixada em branco, usará a variável de ambiente.</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
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
    title: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    saveButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    disabledButton: {
        opacity: 0.7,
    },
    saveButtonText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    formGroup: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.md,
    },
    passwordInput: {
        flex: 1,
        padding: spacing.sm,
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
    },
    eyeIcon: {
        padding: spacing.sm,
    },
    hint: {
        fontSize: 11,
        color: colors.zinc400,
        marginTop: 4,
    }
});
