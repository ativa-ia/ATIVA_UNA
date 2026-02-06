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
    // Para web, usar PDF.js (Mozilla) ou Google Drive Embed
    if (Platform.OS === 'web') {
        const isGoogleDrive = fileUrl.includes('drive.google.com');
        let viewerUrl = '';

        if (isGoogleDrive) {
            // Extrair ID do arquivo
            let fileId = '';
            const matchId = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (matchId && matchId[1]) {
                fileId = matchId[1];
            } else {
                const matchQuery = fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
                if (matchQuery && matchQuery[1]) {
                    fileId = matchQuery[1];
                }
            }

            if (fileId) {
                if (filename.toLowerCase().endsWith('.pdf')) {
                    // URL do Proxy no Backend
                    // Importar API_URL de @/services/api se necessário, ou usar hardcoded relativo
                    // Assumindo que o app roda na mesma origem ou configurado
                    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
                    const proxyUrl = `${API_URL}/documents/proxy/${fileId}`;

                    // Usar visualizador nativo do navegador (iframe direto)
                    // Evita problema de Mixed Content (HTTPS mozilla.github.io x HTTP localhost)
                    // Chrome/Edge/Firefox nativos suportam #page=N
                    viewerUrl = `${proxyUrl}#page=${page}&zoom=${zoom}`;
                } else {
                    // OUTROS ARQUIVOS (PPTX, DOCX): Usar Google Drive Preview (Embed)
                    viewerUrl = `https://drive.google.com/file/d/${fileId}/preview`;
                }
            } else {
                // Fallback se não conseguir extrair ID
                viewerUrl = fileUrl;
            }
        } else {
            // Usar PDF.js para arquivos diretos (Supabase, etc)
            viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(fileUrl)}#page=${page}&zoom=${zoom}`;
        }

        return (
            <View style={styles.container}>
                {/* Iframe Viewer - key força reload quando URL/página muda */}
                <iframe
                    key={`viewer-${isGoogleDrive ? 'drive' : 'pdfjs'}-${page}-${zoom}`}
                    src={viewerUrl}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                    }}
                    title={filename}
                    allow="autoplay"
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
