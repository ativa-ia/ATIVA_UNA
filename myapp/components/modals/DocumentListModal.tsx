import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';

export interface DocumentItem {
    id: string;
    filename: string;
    created_at?: string;
}

interface DocumentListModalProps {
    visible: boolean;
    documents: DocumentItem[];
    onSelect: (document: DocumentItem) => void;
    onClose: () => void;
}

export default function DocumentListModal({
    visible,
    documents,
    onSelect,
    onClose
}: DocumentListModalProps) {
    const { width, height } = useWindowDimensions();
    const isSmallScreen = width < 400;

    if (!visible || documents.length === 0) return null;

    const getFileIcon = (filename: string) => {
        const lower = filename.toLowerCase();
        if (lower.endsWith('.pdf')) return 'picture-as-pdf';
        if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'description';
        if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'slideshow';
        if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'table-chart';
        return 'insert-drive-file';
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#10b981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.header}
                    >
                        <MaterialIcons name="folder-open" size={28} color="#FFF" />
                        <Text style={styles.headerTitle}>Documentos Disponíveis</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <MaterialIcons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Document List */}
                    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                        {documents.map((doc, index) => (
                            <TouchableOpacity
                                key={doc.id}
                                style={styles.docItem}
                                onPress={() => onSelect(doc)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.docNumber, isSmallScreen && styles.docNumberSmall]}>
                                    <Text style={[styles.docNumberText, isSmallScreen && styles.docNumberTextSmall]}>
                                        {index + 1}
                                    </Text>
                                </View>
                                <View style={styles.docIcon}>
                                    <MaterialIcons
                                        name={getFileIcon(doc.filename)}
                                        size={28}
                                        color="#10b981"
                                    />
                                </View>
                                <View style={styles.docInfo}>
                                    <Text style={styles.docName} numberOfLines={2}>
                                        {doc.filename}
                                    </Text>
                                    {doc.created_at && (
                                        <Text style={styles.docDate}>
                                            {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                        </Text>
                                    )}
                                </View>
                                <MaterialIcons name="open-in-new" size={24} color="#10b981" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Toque ou diga "Fred, abre o documento 1"
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    modalContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        maxWidth: 520,
        width: '100%',
        maxHeight: '85%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 15,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        fontFamily: typography.fontFamily.display,
    },
    closeButton: {
        padding: spacing.xs,
    },
    list: {
        maxHeight: 400,
    },
    listContent: {
        padding: spacing.md,
        gap: spacing.sm,
    },
    docItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.slate50,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        gap: spacing.md,
    },
    docNumber: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    docNumberText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    docNumberSmall: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    docNumberTextSmall: {
        fontSize: typography.fontSize.sm,
    },
    docIcon: {
        marginRight: spacing.xs,
    },
    docInfo: {
        flex: 1,
    },
    docName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate900,
        marginBottom: 2,
    },
    docDate: {
        fontSize: typography.fontSize.sm,
        color: colors.slate500,
    },
    footer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        backgroundColor: colors.slate50,
    },
    footerText: {
        fontSize: typography.fontSize.sm,
        color: colors.slate600,
        textAlign: 'center',
    },
});
