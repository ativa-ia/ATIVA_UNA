import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { uploadContextFile, getContextFiles, deleteContextFile } from '@/services/api';
import * as DocumentPicker from 'expo-document-picker';
import ConfirmationModal from '@/components/modals/ConfirmationModal';

/**
 * KnowledgeBaseScreen - Base de Conhecimento (Antigo AI Assistant)
 * Tela para gestão de arquivos de contexto para a IA (RAG)
 */
export default function KnowledgeBaseScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';
    const subjectId = parseInt(params.subjectId as string) || 1;

    // Gerenciamento de Arquivos
    const [contextFiles, setContextFiles] = useState<any[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // Modal de Confirmação
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: 'Confirmar',
        isDestructive: false
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, visible: false }));

    useEffect(() => {
        loadContextFiles();
    }, [subjectId]);

    const loadContextFiles = async () => {
        setIsLoadingFiles(true);
        try {
            const result = await getContextFiles(subjectId);
            if (result.success) {
                setContextFiles(result.files || []);
            }
        } catch (error) {
            console.error('Erro ao carregar arquivos:', error);
            Alert.alert('Erro', 'Falha ao carregar lista de arquivos.');
        } finally {
            setIsLoadingFiles(false);
        }
    };

    const handleUploadFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            setIsUploading(true);

            // Upload envia via Webhook para n8n (Vector Store)
            const uploadResult = await uploadContextFile(subjectId, file, { subjectName });

            if (uploadResult.success) {
                Alert.alert('Sucesso', 'Arquivo enviado para processamento!');
                loadContextFiles();
            } else {
                Alert.alert('Erro', uploadResult.error || 'Falha ao enviar arquivo');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Erro ao selecionar arquivo');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteFile = async (fileId: number) => {
        setConfirmModal({
            visible: true,
            title: 'Excluir Arquivo',
            message: 'Tem certeza que deseja remover este arquivo da base de conhecimento da IA? O conteúdo não estará mais disponível para consultas.',
            confirmText: 'Excluir',
            isDestructive: true,
            onConfirm: async () => {
                closeConfirmModal();

                // Optimistic Update
                const previousFiles = [...contextFiles];
                setContextFiles(prev => prev.filter(f => f.id !== fileId));

                try {
                    const result = await deleteContextFile(fileId);
                    if (!result.success) {
                        setContextFiles(previousFiles);
                        Alert.alert('Erro', 'Não foi possível excluir o arquivo.');
                    }
                } catch (error) {
                    setContextFiles(previousFiles);
                    Alert.alert('Erro', 'Erro de conexão ao excluir arquivo.');
                }
            }
        });
    };

    return (
        <View style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#4f46e5', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <MaterialIcons name="folder-shared" size={24} color={colors.white} />
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Base de Conhecimento</Text>
                            <Text style={styles.headerSubtitle}>{subjectName}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Conteúdo Principal */}
                <View style={styles.mainContent}>
                    <View style={styles.infoCard}>
                        <MaterialIcons name="info-outline" size={20} color={colors.primary} />
                        <Text style={styles.infoText}>
                            Arquivos adicionados aqui são processados pela IA e tornam-se disponíveis para consulta contextual durante a transcrição das aulas.
                        </Text>
                    </View>

                    <View style={styles.actionsBar}>
                        <Text style={styles.sectionTitle}>Arquivos ({contextFiles.length})</Text>
                        <TouchableOpacity
                            style={styles.uploadButton}
                            onPress={handleUploadFile}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <MaterialIcons name="add" size={20} color={colors.white} />
                                    <Text style={styles.uploadButtonText}>Adicionar</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.fileList}
                        contentContainerStyle={styles.fileListContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {isLoadingFiles ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                        ) : contextFiles.length === 0 ? (
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIconContainer}>
                                    <MaterialIcons name="cloud-upload" size={48} color={colors.slate300} />
                                </View>
                                <Text style={styles.emptyTitle}>Base Vazia</Text>
                                <Text style={styles.emptyDescription}>
                                    Adicione PDFs, Docs ou textos para enriquecer a inteligência da sua disciplina.
                                </Text>
                            </View>
                        ) : (
                            contextFiles.map((file, index) => (
                                <View key={file.id || index} style={styles.fileItem}>
                                    <View style={styles.fileIcon}>
                                        <MaterialIcons name="description" size={24} color={colors.primary} />
                                    </View>
                                    <View style={styles.fileInfo}>
                                        <Text style={styles.fileName} numberOfLines={1}>
                                            {file.filename}
                                        </Text>
                                        <Text style={styles.fileMeta}>
                                            {new Date(file.created_at).toLocaleDateString()} • {file.file_type?.split('/').pop()?.toUpperCase() || 'DOC'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => handleDeleteFile(file.id)}
                                    >
                                        <MaterialIcons name="delete-outline" size={22} color={colors.slate400} />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>

            <ConfirmationModal
                visible={confirmModal.visible}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDestructive={confirmModal.isDestructive}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
            />
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        paddingBottom: spacing.lg + 20, // Extra padding for curve effect optionally
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        marginRight: spacing.sm,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    headerSubtitle: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: 'rgba(255,255,255,0.9)',
    },
    mainContent: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
        marginTop: -20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: spacing.base,
        paddingTop: spacing.lg,
    },
    infoCard: {
        flexDirection: 'row',
        gap: spacing.sm,
        backgroundColor: '#eef2ff', // Indigo 50
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#c7d2fe', // Indigo 200
        marginBottom: spacing.lg,
    },
    infoText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: '#3730a3', // Indigo 800
        lineHeight: 20,
    },
    actionsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
    },
    uploadButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        elevation: 2,
    },
    uploadButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
        fontSize: typography.fontSize.sm,
    },
    fileList: {
        flex: 1,
    },
    fileListContent: {
        paddingBottom: spacing.xl,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: colors.slate100,
    },
    fileIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.display,
        marginBottom: 2,
    },
    fileMeta: {
        fontSize: typography.fontSize.xs,
        color: colors.slate500,
    },
    deleteButton: {
        padding: spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing['3xl'],
        gap: spacing.md,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.slate50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    emptyTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.slate700,
    },
    emptyDescription: {
        textAlign: 'center',
        color: colors.slate500,
        maxWidth: 250,
        lineHeight: 22,
    },
});
