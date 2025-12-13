import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

/**
 * UploadMaterialScreen - Envio de Materiais (Professor)
 * Tela para upload de novos materiais educacionais
 */
export default function UploadMaterialScreen() {
    const insets = useSafeAreaInsets();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [fileName, setFileName] = useState('');

    const isFormValid = title.trim().length > 0 && fileName.length > 0;

    const handleCancel = () => {
        router.back();
    };

    const handleSelectFile = () => {
        // TODO: Implement file picker
        // For now, simulate file selection
        setFileName('Arquivo selecionado.pdf');
    };

    const handleSelectClass = () => {
        // TODO: Implement class picker modal
        setSelectedClass('Cálculo I - Turma A');
    };

    const handleSubmit = () => {
        if (!isFormValid) return;

        // TODO: Implement file upload to backend
        console.log('Uploading material:', { title, description, selectedClass, fileName });

        // Navigate back after upload
        router.back();
    };

    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#4f46e5', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.headerGradient, { paddingTop: insets.top + spacing.sm }]}>
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={handleCancel}
                        >
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Enviar Material</Text>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={handleSubmit}
                            disabled={!isFormValid}
                        >
                            <Text style={[
                                styles.sendText,
                                !isFormValid && styles.sendTextDisabled
                            ]}>Enviar</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* File Upload Section */}
                    <View style={styles.uploadSection}>
                        <View style={styles.uploadBox}>
                            <Text style={styles.uploadTitle}>Adicionar Arquivos</Text>
                            <Text style={styles.uploadDescription}>
                                Selecione PDFs, vídeos, apresentações, etc.
                            </Text>
                            <TouchableOpacity
                                style={styles.uploadButton}
                                onPress={handleSelectFile}
                            >
                                <MaterialIcons name="upload-file" size={20} color={colors.white} />
                                <Text style={styles.uploadButtonText}>
                                    {fileName || 'Toque para Adicionar Arquivos'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Title Input */}
                    <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>Título do Material</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Ex: Slides da Aula 5"
                            placeholderTextColor={colors.textSecondary}
                            value={title}
                            onChangeText={setTitle}
                        />
                    </View>

                    {/* Description Input */}
                    <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>Descrição (Opcional)</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            placeholder="Adicione uma breve descrição sobre o conteúdo do material."
                            placeholderTextColor={colors.textSecondary}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Class Selector */}
                    <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>Enviar Para</Text>
                        <TouchableOpacity
                            style={styles.selectorButton}
                            onPress={handleSelectClass}
                        >
                            <View style={styles.selectorContent}>
                                <View style={styles.selectorIcon}>
                                    <MaterialIcons name="group" size={24} color={colors.primary} />
                                </View>
                                <Text style={[
                                    styles.selectorText,
                                    selectedClass ? styles.selectorTextSelected : {} // Fixed ternary
                                ]}>
                                    {selectedClass || 'Selecione a turma ou grupo'}
                                </Text>
                            </View>
                            <MaterialIcons name="arrow-forward-ios" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* Primary Action Button */}
                <View style={[styles.actionContainer, { paddingBottom: insets.bottom + spacing.base }]}>
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            !isFormValid && styles.submitButtonDisabled
                        ]}
                        onPress={handleSubmit}
                        disabled={!isFormValid}
                    >
                        <Text style={styles.submitButtonText}>Enviar Material</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
    },
    container: {
        flex: 1,
    },
    headerGradient: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        paddingBottom: spacing.base,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerButton: {
        width: 80,
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    cancelText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        opacity: 0.8,
    },
    sendText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'right',
    },
    sendTextDisabled: {
        opacity: 0.5,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        gap: spacing.xl,
        paddingTop: spacing.lg,
    },
    uploadSection: {
        // Container for upload box
    },
    uploadBox: {
        alignItems: 'center',
        gap: spacing.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.primary,
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
        borderRadius: borderRadius.xl,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing['3xl'],
    },
    uploadTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    uploadDescription: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        height: 40,
        paddingHorizontal: spacing.base,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    uploadButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    inputSection: {
        gap: spacing.sm,
    },
    inputLabel: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginLeft: spacing.xs,
    },
    textInput: {
        height: 56,
        paddingHorizontal: spacing.base,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.lg,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    textArea: {
        height: 144,
        paddingTop: spacing.base,
        paddingBottom: spacing.base,
    },
    selectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        paddingHorizontal: spacing.base,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.lg,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    selectorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.base,
    },
    selectorIcon: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.slate50,
        borderRadius: borderRadius.default,
    },
    selectorText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
    },
    selectorTextSelected: {
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.medium,
    },
    actionContainer: {
        padding: spacing.base,
        paddingTop: spacing.sm,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.slate100,
    },
    submitButton: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.xl,
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    submitButtonDisabled: {
        backgroundColor: colors.slate300,
        elevation: 0,
        shadowOpacity: 0,
    },
    submitButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
});
