import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
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
 * AIContextScreen - Gestão de Contexto (Antigo Assistant)
 * Tela para upload de arquivos que servirão de base para a IA (Transcrição/RAG)
 */
export default function AIContextScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const subjectName = params.subject as string || 'Disciplina';
    const subjectId = parseInt(params.subjectId as string) || 1;

    // Context Files State
    const [contextFiles, setContextFiles] = useState<any[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: 'Confirmar',
        isDestructive: false
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, visible: false }));

    // Carga inicial
    useEffect(() => {
        loadContextFiles();
    }, [subjectId]);

    const loadContextFiles = async () => {
        setIsLoadingFiles(true);
        try {
            // Passamos sessionId undefined para pegar todos da disciplina ou ajustar conforme regra de backend
            // O ideal agora é listar TUDO da disciplina já que não tem mais "sessão de chat"
            const result = await getContextFiles(subjectId);
            if (result.success) {
                setContextFiles(result.files);
            } else {
                setContextFiles([]);
            }
        } catch (error) {
            console.log('Erro ao carregar arquivos:', error);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    const handleDeleteFile = async (fileId: number) => {
        setConfirmModal({
            visible: true,
            title: 'Excluir Arquivo',
            message: 'Tem certeza que deseja remover este arquivo da base de conhecimento?',
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

    const handleUploadFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            setIsUploading(true);

            // Upload para backend (que enviará para N8N)
            const uploadResult = await uploadContextFile(subjectId, file);

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
                        onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}
                    >
                        <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <MaterialIcons name="library-books" size={24} color={colors.white} />
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Base de Conhecimento</Text>
                            <Text style={styles.headerSubtitle}>{subjectName}</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.contentContainer}>
                    <View style={styles.infoCard}>
                        <MaterialIcons name="info-outline" size={20} color={colors.primary} />
                        <Text style={styles.infoText}>
                            Os arquivos enviados aqui serão usados para enriquecer as transcrições e gerar conteúdos mais precisos da sua disciplina.
                        </Text>
                    </View>

                    <View style={styles.actionsContainer}>
                        <Text style={styles.sectionTitle}>Arquivos ({contextFiles.length})</Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={handleUploadFile}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <>
                                    <MaterialIcons name="add" size={20} color={colors.white} />
                                    <Text style={styles.addButtonText}>Adicionar</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {isLoadingFiles ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={{ marginTop: 10, color: colors.slate500 }}>Carregando arquivos...</Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.fileList}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {contextFiles.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIconBg}>
                                        <MaterialIcons name="cloud-upload" size={48} color={colors.slate400} />
                                    </View>
                                    <Text style={styles.emptyStateTitle}>Nenhum material ainda</Text>
                                    <Text style={styles.emptyStateText}>
                                        Envie PDFs, DOCX ou arquivos de texto para começar.
                                    </Text>
                                    <TouchableOpacity style={styles.emptyButton} onPress={handleUploadFile}>
                                        <Text style={styles.emptyButtonText}>Fazer Upload Agora</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                contextFiles.map((file, index) => (
                                    <View key={file.id || index} style={styles.fileItem}>
                                        <View style={styles.fileLeft}>
                                            <View style={styles.fileIconContainer}>
                                                <MaterialIcons
                                                    name={file.filename?.endsWith('.pdf') ? 'picture-as-pdf' : 'description'}
                                                    size={24}
                                                    color={colors.primary}
                                                />
                                            </View>
                                            <View style={styles.fileInfo}>
                                                <Text style={styles.fileName} numberOfLines={1}>
                                                    {file.filename}
                                                </Text>
                                                <Text style={styles.fileMeta}>
                                                    {file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Recentemente'}
                                                </Text>
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDeleteFile(file.id)}
                                        >
                                            <MaterialIcons name="delete-outline" size={22} color={colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>

            <ConfirmationModal
                visible={confirmModal.visible}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
                isDestructive={confirmModal.isDestructive}
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
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
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
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    headerSubtitle: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
        color: 'rgba(255,255,255,0.9)',
    },
    contentContainer: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -20,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: '#eff6ff', // blue-50
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xl,
        gap: spacing.sm,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
    },
    infoText: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
        color: '#1e40af', // blue-800
        flex: 1,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    addButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fileList: {
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyIconBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.slate100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    emptyStateTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate700,
        marginBottom: spacing.xs,
    },
    emptyStateText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        color: colors.slate500,
        textAlign: 'center',
        maxWidth: 250,
        marginBottom: spacing.xl,
    },
    emptyButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: borderRadius.full,
    },
    emptyButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            }
        }),
    },
    fileLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
    },
    fileIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    fileMeta: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
        color: colors.slate500,
    },
    deleteButton: {
        padding: 5, // Aumentar área de toque
        marginLeft: 8,
    },
});
