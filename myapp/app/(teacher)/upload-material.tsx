import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import {
    createMaterial,
    uploadFileToStorage,
    getTeacherClasses,
    TeacherClass
} from '@/services/api';

/**
 * UploadMaterialScreen - Envio de Materiais (Professor)
 * Tela para upload de novos materiais educacionais
 */
export default function UploadMaterialScreen() {
    const insets = useSafeAreaInsets();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    // Classes logic
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [showClassModal, setShowClassModal] = useState(false);
    const [loadingClasses, setLoadingClasses] = useState(false);

    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        setLoadingClasses(true);
        try {
            const data = await getTeacherClasses();
            setClasses(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível carregar as turmas.');
        } finally {
            setLoadingClasses(false);
        }
    };

    const isFormValid = title.trim().length > 0 && selectedFile && selectedClassId;

    const handleCancel = () => {
        router.back();
    };

    const handleSelectFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            setSelectedFile(file);
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao selecionar arquivo');
        }
    };

    const handleSubmit = async () => {
        if (!isFormValid) return;

        setUploading(true);

        try {
            // 1. Upload file
            const uploadResult = await uploadFileToStorage(selectedFile, 'materials');

            if (!uploadResult.success) {
                Alert.alert('Erro', uploadResult.error || 'Falha no upload do arquivo');
                return;
            }

            // 2. Create Material Record
            const materialData = {
                title,
                url: uploadResult.url,
                type: 'document', // Simplified for now
                size: uploadResult.size ? `${(uploadResult.size / 1024 / 1024).toFixed(2)} MB` : undefined
            };

            const result = await createMaterial(selectedClassId, materialData);

            if (result.success) {
                Alert.alert('Sucesso', 'Material enviado com sucesso!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('Erro', result.error || 'Falha ao salvar material');
            }

        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Ocorreu um erro inesperado.');
        } finally {
            setUploading(false);
        }
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
                            disabled={!isFormValid || uploading}
                        >
                            <Text style={[
                                styles.sendText,
                                (!isFormValid || uploading) && styles.sendTextDisabled
                            ]}>{uploading ? 'Env...' : 'Enviar'}</Text>
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
                                    {selectedFile ? selectedFile.name : 'Toque para Adicionar Arquivos'}
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
                            onPress={() => setShowClassModal(!showClassModal)}
                        >
                            <View style={styles.selectorContent}>
                                <View style={styles.selectorIcon}>
                                    <MaterialIcons name="group" size={24} color={colors.primary} />
                                </View>
                                <Text style={[
                                    styles.selectorText,
                                    selectedClassId ? styles.selectorTextSelected : {}
                                ]}>
                                    {selectedClassId
                                        ? classes.find(c => c.id === selectedClassId)?.name
                                        : 'Selecione a turma'}
                                </Text>
                            </View>
                            <MaterialIcons name={showClassModal ? "expand-less" : "expand-more"} size={24} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {/* Simple Dropdown for class selection */}
                        {showClassModal && (
                            <View style={styles.dropdownList}>
                                {loadingClasses ? (
                                    <Text style={{ padding: 10, color: colors.textSecondary }}>Carregando turmas...</Text>
                                ) : (
                                    classes.length > 0 ? (
                                        classes.map(cls => (
                                            <TouchableOpacity
                                                key={cls.id}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setSelectedClassId(cls.id);
                                                    setShowClassModal(false);
                                                }}
                                            >
                                                <Text style={styles.dropdownItemText}>{cls.name}</Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <Text style={{ padding: 10, color: colors.textSecondary }}>Nenhuma turma encontrada.</Text>
                                    )
                                )}
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Primary Action Button */}
                <View style={[styles.actionContainer, { paddingBottom: insets.bottom + spacing.base }]}>
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (!isFormValid || uploading) && styles.submitButtonDisabled
                        ]}
                        onPress={handleSubmit}
                        disabled={!isFormValid || uploading}
                    >
                        <Text style={styles.submitButtonText}>
                            {uploading ? 'Enviando...' : 'Enviar Material'}
                        </Text>
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
    dropdownList: {
        marginTop: spacing.xs,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        maxHeight: 200,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    dropdownItem: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
    },
    dropdownItemText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
});
