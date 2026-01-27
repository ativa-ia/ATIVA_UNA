import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

interface Section {
    section_id: number;
    title: string;
    content: string;
}

interface DocumentSlideProps {
    data: {
        filename?: string;
        classroom_id?: string;
        sections?: Section[];
        total_sections?: number;
        total_chunks?: number;
    };
}

const { width, height } = Dimensions.get('window');
const isSmallScreen = width < 1024;

// Função para limpar e melhorar o conteúdo
const cleanupContent = (content: string): string => {
    let cleaned = content;

    // Juntar URLs quebradas (http:// ou https:// seguido de quebra de linha)
    cleaned = cleaned.replace(/(https?:\/\/[^\s]+)\n([^\s]+)/g, '$1$2');

    // Remover linhas muito curtas isoladas (provavelmente lixo de parsing)
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter((line) => {
        const trimmed = line.trim();
        if (trimmed.length < 3) return false; // Remove linhas muito curtas
        if (trimmed.match(/^[IVX]+$/)) return false; // Remove números romanos isolados
        return true;
    });

    return filteredLines.join('\n');
};

// Melhorar algoritmo de parsing para evitar duplicações e filtrar conteúdo ruim
const smartSegmentContent = (originalSections: Section[]): Section[] => {
    if (!originalSections || originalSections.length === 0) return [];

    // Se já temos múltiplas seções distintas, retornar
    if (originalSections.length > 1) {
        // Filtrar seções duplicadas, vazias ou muito pequenas
        const uniqueSections: Section[] = [];
        const seenTitles = new Set<string>();

        originalSections.forEach(section => {
            const normalizedTitle = section.title.trim().toUpperCase();
            const contentLength = section.content.trim().length;

            // Filtrar seções muito pequenas (menos de 50 caracteres) ou vazias
            if (contentLength < 50) {
                return;
            }

            // Filtrar títulos genéricos ou vazios
            if (!normalizedTitle || (normalizedTitle === 'INTRODUÇÃO' && contentLength < 100)) {
                return;
            }

            if (!seenTitles.has(normalizedTitle)) {
                seenTitles.add(normalizedTitle);
                uniqueSections.push({
                    ...section,
                    content: cleanupContent(section.content)
                });
            }
        });

        return uniqueSections.length > 0 ? uniqueSections : originalSections;
    }

    // Parsing inteligente de seção única
    const fullContent = originalSections[0].content;
    const lines = fullContent.split('\n');
    const newSections: Section[] = [];
    let currentTitle = originalSections[0].title || "Introdução";
    let currentBuffer: string[] = [];
    const seenTitles = new Set<string>();

    const isTitleLine = (line: string) => {
        const cleanLine = line.trim();
        if (cleanLine.length < 4 || cleanLine.length > 100) return false;

        // Títulos em MAIÚSCULAS
        const isUpperCase = cleanLine === cleanLine.toUpperCase() && /[A-Z]/.test(cleanLine);
        if (isUpperCase && !cleanLine.includes(':') && !cleanLine.startsWith('•') && !cleanLine.includes('http')) {
            return true;
        }

        // Títulos numerados
        if (/^\d{1,2}\.\s+[A-Z]/.test(cleanLine)) {
            return true;
        }

        return false;
    };

    lines.forEach((line) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        if (isTitleLine(line)) {
            const normalizedTitle = cleanLine.toUpperCase();

            // Evitar duplicações e seções muito pequenas
            if (!seenTitles.has(normalizedTitle) && currentBuffer.length > 0) {
                const content = currentBuffer.join('\n').trim();
                if (content.length >= 50) { // Mínimo 50 caracteres
                    newSections.push({
                        section_id: newSections.length + 1,
                        title: currentTitle,
                        content: cleanupContent(content)
                    });
                }
                currentBuffer = [];
                currentTitle = cleanLine;
                seenTitles.add(normalizedTitle);
            } else if (!seenTitles.has(normalizedTitle)) {
                currentTitle = cleanLine;
                seenTitles.add(normalizedTitle);
            }
        } else {
            currentBuffer.push(line);
        }
    });

    // Adicionar última seção se tiver conteúdo suficiente
    if (currentBuffer.length > 0) {
        const content = currentBuffer.join('\n').trim();
        if (content.length >= 50) {
            newSections.push({
                section_id: newSections.length + 1,
                title: currentTitle,
                content: cleanupContent(content)
            });
        }
    }

    return newSections.length > 0 ? newSections : originalSections;
};

// Componente de texto rico
const RichTextRenderer = ({ content }: { content: string }) => {
    const lines = content.split('\n');

    // Detectar se o conteúdo é muito curto ou parece incompleto
    const isContentTooShort = content.trim().length < 100;
    const hasIncompleteUrls = content.includes('http') && content.split('http').length > 2;

    return (
        <View style={styles.richTextContainer}>
            {/* Aviso se conteúdo parecer incompleto */}
            {(isContentTooShort || hasIncompleteUrls) && (
                <View style={styles.warningBanner}>
                    <MaterialIcons name="warning" size={20} color={colors.warning} />
                    <Text style={styles.warningText}>
                        Este conteúdo pode estar incompleto devido a problemas no processamento do PDF
                    </Text>
                </View>
            )}

            {lines.map((line, index) => {
                const cleanLine = line.trim();
                if (!cleanLine) return <View key={index} style={{ height: spacing.sm }} />;

                // Detectar URLs
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                if (urlRegex.test(cleanLine)) {
                    const parts = cleanLine.split(urlRegex);
                    return (
                        <View key={index} style={styles.urlContainer}>
                            <MaterialIcons name="link" size={18} color={colors.primary} />
                            <Text style={styles.urlText}>
                                {parts.map((part, i) => {
                                    if (part.match(urlRegex)) {
                                        return (
                                            <Text key={i} style={styles.urlLink}>
                                                {part}
                                            </Text>
                                        );
                                    }
                                    return <Text key={i}>{part}</Text>;
                                })}
                            </Text>
                        </View>
                    );
                }

                // Lista com check
                if (cleanLine.startsWith('✔️') || cleanLine.startsWith('✓')) {
                    return (
                        <View key={index} style={styles.listItemCheck}>
                            <MaterialIcons name="check-circle" size={20} color={colors.success} />
                            <Text style={styles.listItemText}>{cleanLine.substring(1).trim()}</Text>
                        </View>
                    );
                }

                // Lista com bullet
                if (cleanLine.startsWith('•') || cleanLine.startsWith('- ')) {
                    return (
                        <View key={index} style={styles.listItemBullet}>
                            <View style={styles.bulletPoint} />
                            <Text style={styles.listItemText}>{cleanLine.replace(/^[•\-]\s*/, '')}</Text>
                        </View>
                    );
                }

                // Parágrafo normal
                return (
                    <Text key={index} style={styles.paragraphText}>
                        {cleanLine}
                    </Text>
                );
            })}
        </View>
    );
};

export default function DocumentSlide({ data }: DocumentSlideProps) {
    const { filename, sections = [] } = data;
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    const processedSections = useMemo(() => {
        return smartSegmentContent(sections);
    }, [sections]);

    const activeSection = processedSections[activeSectionIndex];

    const handleNext = () => {
        if (activeSectionIndex < processedSections.length - 1) {
            setActiveSectionIndex(prev => prev + 1);
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }
    };

    const handlePrev = () => {
        if (activeSectionIndex > 0) {
            setActiveSectionIndex(prev => prev - 1);
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }
    };

    if (processedSections.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <MaterialIcons name="article" size={64} color={colors.slate400} />
                    <Text style={styles.emptyText}>Nenhum conteúdo disponível</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.iconBadge}>
                        <MaterialIcons name="description" size={24} color={colors.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.fileName} numberOfLines={1}>{filename || 'Documento'}</Text>
                        <Text style={styles.metaInfo}>
                            {processedSections.length} Tópicos • {activeSectionIndex + 1}/{processedSections.length}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.contentWrapper}>
                {/* Sidebar - Esconde em telas pequenas */}
                {!isSmallScreen && (
                    <View style={styles.sidebar}>
                        <View style={styles.sidebarHeader}>
                            <Text style={styles.sidebarTitle}>ÍNDICE</Text>
                        </View>
                        <ScrollView style={styles.sidebarList} showsVerticalScrollIndicator={false}>
                            {processedSections.map((section, index) => {
                                const isActive = index === activeSectionIndex;
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                                        onPress={() => setActiveSectionIndex(index)}
                                    >
                                        <View style={[styles.sectionNumberBadge, isActive && styles.sectionNumberBadgeActive]}>
                                            <Text style={[styles.sectionNumberText, isActive && styles.sectionNumberTextActive]}>
                                                {index + 1}
                                            </Text>
                                        </View>
                                        <Text style={[styles.sidebarItemText, isActive && styles.sidebarItemTextActive]} numberOfLines={2}>
                                            {section.title}
                                        </Text>
                                        {isActive && (
                                            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* Main Content */}
                <View style={styles.mainContent}>
                    <View style={styles.paperContainer}>
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.paperScroll}
                            contentContainerStyle={styles.paperContent}
                            showsVerticalScrollIndicator={true}
                        >
                            <Text style={styles.sectionTitle}>{activeSection.title}</Text>
                            <View style={styles.divider} />

                            <RichTextRenderer content={activeSection.content} />

                            {/* Navigation Footer */}
                            <View style={styles.navFooter}>
                                <TouchableOpacity
                                    style={[styles.navButton, activeSectionIndex === 0 && styles.navButtonDisabled]}
                                    onPress={handlePrev}
                                    disabled={activeSectionIndex === 0}
                                >
                                    <MaterialIcons name="arrow-back" size={20} color={activeSectionIndex === 0 ? colors.slate400 : colors.primary} />
                                    <Text style={[styles.navButtonText, activeSectionIndex === 0 && styles.navButtonTextDisabled]}>Anterior</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.navButton, styles.navButtonPrimary, activeSectionIndex === processedSections.length - 1 && styles.navButtonDisabled]}
                                    onPress={handleNext}
                                    disabled={activeSectionIndex === processedSections.length - 1}
                                >
                                    <Text style={[styles.navButtonTextPrimary, activeSectionIndex === processedSections.length - 1 && styles.navButtonTextDisabled]}>Próximo</Text>
                                    <MaterialIcons name="arrow-forward" size={20} color={colors.white} />
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.slate50,
        width: '100%',
    },
    header: {
        height: 80,
        backgroundColor: colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
        ...Platform.select({
            web: {
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            },
            default: {
                elevation: 2,
            },
        }),
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBadge: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.lg,
    },
    fileName: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.slate900,
        marginBottom: 2,
    },
    metaInfo: {
        fontSize: typography.fontSize.sm,
        color: colors.slate600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: typography.fontWeight.medium,
    },
    contentWrapper: {
        flex: 1,
        flexDirection: 'row',
    },
    // Sidebar
    sidebar: {
        width: 300,
        backgroundColor: colors.white,
        borderRightWidth: 1,
        borderRightColor: colors.slate200,
    },
    sidebarHeader: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
        backgroundColor: colors.slate50,
    },
    sidebarTitle: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        color: colors.slate600,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    sidebarList: {
        flex: 1,
        padding: spacing.md,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.xs,
        backgroundColor: 'transparent',
    },
    sidebarItemActive: {
        backgroundColor: colors.primary + '10',
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
    },
    sectionNumberBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.slate200,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    sectionNumberBadgeActive: {
        backgroundColor: colors.primary,
    },
    sectionNumberText: {
        fontSize: 12,
        fontWeight: typography.fontWeight.bold,
        color: colors.slate600,
    },
    sectionNumberTextActive: {
        color: colors.white,
    },
    sidebarItemText: {
        fontSize: typography.fontSize.sm,
        color: colors.slate700,
        fontWeight: typography.fontWeight.medium,
        flex: 1,
    },
    sidebarItemTextActive: {
        color: colors.slate900,
        fontWeight: typography.fontWeight.bold,
    },

    // Main Content
    mainContent: {
        flex: 1,
        backgroundColor: colors.slate50,
        padding: isSmallScreen ? spacing.md : spacing.xl,
    },
    paperContainer: {
        flex: 1,
        borderRadius: 16,
        backgroundColor: colors.white,
        ...Platform.select({
            web: {
                boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
            },
            default: {
                elevation: 3,
            },
        }),
        overflow: 'hidden',
    },
    paperScroll: {
        flex: 1,
    },
    paperContent: {
        padding: isSmallScreen ? spacing.xl : spacing['4xl'],
        paddingBottom: 120,
        maxWidth: 900,
        alignSelf: 'center',
        width: '100%',
    },
    sectionTitle: {
        fontSize: isSmallScreen ? 28 : 36,
        fontWeight: typography.fontWeight.bold,
        color: colors.slate900,
        marginBottom: spacing.lg,
        lineHeight: isSmallScreen ? 36 : 44,
    },
    divider: {
        height: 4,
        width: 60,
        backgroundColor: colors.primary,
        borderRadius: 2,
        marginBottom: spacing['2xl'],
    },

    // Rich Text
    richTextContainer: {
        gap: spacing.base,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning + '15',
        padding: spacing.md,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    warningText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.warning,
        fontWeight: typography.fontWeight.medium,
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.primary + '08',
        padding: spacing.md,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        gap: spacing.sm,
        marginVertical: spacing.xs,
    },
    urlText: {
        flex: 1,
        fontSize: isSmallScreen ? 14 : 15,
        color: colors.slate700,
        lineHeight: isSmallScreen ? 22 : 24,
    },
    urlLink: {
        color: colors.primary,
        fontWeight: typography.fontWeight.semibold,
        textDecorationLine: 'underline',
    },
    paragraphText: {
        fontSize: isSmallScreen ? 16 : 18,
        color: colors.slate700,
        lineHeight: isSmallScreen ? 26 : 30,
        marginBottom: spacing.sm,
    },
    listItemCheck: {
        flexDirection: 'row',
        backgroundColor: colors.success + '08',
        padding: spacing.md,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: colors.success,
        gap: spacing.md,
        marginVertical: spacing.xs,
    },
    listItemBullet: {
        flexDirection: 'row',
        paddingLeft: spacing.md,
        gap: spacing.md,
        marginVertical: spacing.xs,
    },
    bulletPoint: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
        marginTop: 10,
    },
    listItemText: {
        flex: 1,
        fontSize: isSmallScreen ? 15 : 17,
        color: colors.slate700,
        lineHeight: isSmallScreen ? 24 : 28,
    },

    // Footer
    navFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing['4xl'],
        paddingTop: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: 10,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.slate300,
        gap: spacing.sm,
        minWidth: 130,
        justifyContent: 'center',
    },
    navButtonPrimary: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    navButtonDisabled: {
        opacity: 0.4,
    },
    navButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.slate700,
    },
    navButtonTextPrimary: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.white,
    },
    navButtonTextDisabled: {
        color: colors.slate400,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.fontSize.xl,
        color: colors.slate500,
        marginTop: spacing.lg,
    },
});
