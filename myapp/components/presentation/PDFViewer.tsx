import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface PDFViewerProps {
    fileUrl: string;
    filename: string;
    page?: number;      // Página atual (padrão: 1)
    zoom?: string;      // Zoom: número (ex: "150"), "auto", "page-fit", "page-width", "page-actual"
}

const { width, height } = Dimensions.get('window');

/**
 * PDFViewer - Visualizador de PDF/PPTX para tela de apresentação
 * Similar ao MediaSlide mas para documentos
 */
export default function PDFViewer({ fileUrl, filename, page = 1, zoom = 'auto' }: PDFViewerProps) {
    // Para web, usar PDF.js (Mozilla) para controle total
    if (Platform.OS === 'web') {
        // Construir URL com parâmetros de página e zoom
        const pdfJsUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(fileUrl)}#page=${page}&zoom=${zoom}`;

        return (
            <View style={styles.container}>
                {/* PDF.js Viewer - key força reload quando página/zoom mudar */}
                <iframe
                    key={`pdf-${page}-${zoom}`}  // Force reload on page/zoom change
                    src={pdfJsUrl}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                    }}
                    title={filename}
                />
            </View>
        );
    }

    // Para mobile, mostrar mensagem (ou usar biblioteca específica)
    return (
        <View style={styles.container}>
            <View style={styles.mobileMessage}>
                <MaterialIcons name="picture-as-pdf" size={64} color={colors.white} />
                <Text style={styles.mobileTitle}>{filename}</Text>
                <Text style={styles.mobileSubtitle}>
                    Visualização de PDF disponível apenas na versão web
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff', // Branco para não ter bordas pretas
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    filename: {
        flex: 1,
        fontSize: 24,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    mobileMessage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 48,
        gap: 24,
    },
    mobileTitle: {
        fontSize: 28,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    mobileSubtitle: {
        fontSize: 20,
        fontFamily: typography.fontFamily.body,
        color: colors.slate400,
        textAlign: 'center',
    },
});
