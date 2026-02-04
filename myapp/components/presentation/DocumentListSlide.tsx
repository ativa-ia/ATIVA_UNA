import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

interface Document {
    id: string;
    filename: string;
    created_at?: string;
}

interface DocumentListSlideProps {
    data: {
        documents: Document[];
        title?: string;
    };
}

export default function DocumentListSlide({ data }: DocumentListSlideProps) {
    const { documents = [], title = 'Documentos Disponíveis' } = data;

    if (documents.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <MaterialIcons name="folder-open" size={80} color={colors.slate400} />
                    <Text style={styles.emptyTitle}>Nenhum documento disponível</Text>
                    <Text style={styles.emptyText}>
                        Adicione documentos na Base de Conhecimento
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <MaterialIcons name="folder-open" size={56} color={colors.primary} />
                </View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{documents.length} documento(s)</Text>
            </View>

            {/* Document List */}
            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            >
                {documents.map((doc, index) => (
                    <View key={doc.id} style={styles.docItem}>
                        <View style={styles.docNumber}>
                            <Text style={styles.docNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.docIcon}>
                            <MaterialIcons
                                name={doc.filename.toLowerCase().endsWith('.pdf') ? 'picture-as-pdf' : 'description'}
                                size={32}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.docInfo}>
                            <Text style={styles.docName} numberOfLines={2}>{doc.filename}</Text>
                            {doc.created_at && (
                                <Text style={styles.docDate}>
                                    Adicionado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                </Text>
                            )}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc', // slate-50
        padding: 48,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 44,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 22,
        fontFamily: typography.fontFamily.body,
        color: colors.slate600,
        fontWeight: typography.fontWeight.medium,
    },
    list: {
        flex: 1,
    },
    listContent: {
        gap: 20,
        paddingBottom: 32,
    },
    docItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        padding: 24,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    docNumber: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
    },
    docNumberText: {
        fontSize: 26,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    docIcon: {
        marginRight: 20,
    },
    docInfo: {
        flex: 1,
    },
    docName: {
        fontSize: 26,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate900,
        marginBottom: 6,
    },
    docDate: {
        fontSize: 18,
        fontFamily: typography.fontFamily.body,
        color: colors.slate500,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 36,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate700,
        marginTop: 24,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 22,
        fontFamily: typography.fontFamily.body,
        color: colors.slate500,
        textAlign: 'center',
    },
});
