import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const { width } = Dimensions.get('window');

// --- Helper Functions for Smart Parsing ---

const normalizeText = (text: string) => text.replace(/\r\n/g, '\n').trim();

// Função para reparar linhas quebradas (ex: tabelas que viraram linguiça)
const repairText = (text: string): string => {
    const lines = text.split('\n');
    const mergedLines: string[] = [];
    let buffer = "";

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            if (buffer) { mergedLines.push(buffer); buffer = ""; }
            mergedLines.push("");
            return;
        }

        // Heurística: Se a linha é curta, não é lista e sem pontuação final -> junta com a próxima
        const isShort = trimmed.length < 35;
        const isListItem = /^[\s]*[•✔️\-\*]/.test(trimmed);
        const endsWithPunctuation = /[.:!?]$/.test(trimmed);

        if (isShort && !isListItem && !endsWithPunctuation) {
            buffer += (buffer ? " " : "") + trimmed;
        } else {
            if (buffer) { mergedLines.push(buffer); buffer = ""; }
            mergedLines.push(trimmed);
        }
    });
    if (buffer) mergedLines.push(buffer);

    return mergedLines.join('\n');
};

// Tenta quebrar um texto longo em seções baseadas em títulos em CAIXA ALTA
const smartSegmentContent = (originalSections: Section[]): Section[] => {
    // Se já tivermos múltiplas seções validadas, retornamos elas mesmas
    if (originalSections && originalSections.length > 1) {
        return originalSections;
    }

    // Se não tiver conteúdo
    if (!originalSections || originalSections.length === 0) return [];

    const fullContent = originalSections[0].content;
    const lines = normalizeText(fullContent).split('\n');

    const newSections: Section[] = [];
    let currentTitle = originalSections[0].title || "Introdução";
    let currentBuffer: string[] = [];

    // Regex para identificar linhas que parecem títulos
    const isTitleLine = (line: string) => {
        const cleanLine = line.trim();

        // REGRA 1: Títulos explícitos importantes (whitelist)
        if (["QUIZ", "RESUMO", "CONCLUSÃO", "INTRODUÇÃO", "REFERÊNCIAS"].includes(cleanLine.toUpperCase())) {
            return true;
        }

        // Ignorar linhas muito muito curtas, muito longas
        // Agora aceita >= 4 chars genericamente
        if (cleanLine.length < 4 || cleanLine.length > 80) return false;
        if (cleanLine.includes("RESPOSTA LETRA")) return false;

        // Verifica se é tudo maiúsculo
        const isUpperCase = cleanLine === cleanLine.toUpperCase() && /[A-Z]/.test(cleanLine);

        if (isUpperCase) {
            // Aceita se for maiúsculo, mas filtra ruído
            if (/^[\s]*[•✔️\-\*]/.test(cleanLine)) return false; // Lista
            if (cleanLine.includes(':') && cleanLine.length > 20) return false; // Frase longa com dois pontos não costuma ser título de seção
            return true;
        }

        // REGRA 2: Títulos numerados (ex: "01. ASSUNTO: ...")
        // Aceita se começar com numero, tiver "ASSUNTO" ou similar, e for curto
        if (/^\d{1,2}\.\s*ASSUNTO/i.test(cleanLine) && cleanLine.length < 60) {
            return true;
        }

        return false;
    };

    lines.forEach((line) => {
        const cleanLine = line.trim();

        // Ignora se a linha for idêntica ao título atual (evita duplicação visual logo abaixo do header)
        if (cleanLine === currentTitle || cleanLine === currentTitle.toUpperCase()) {
            return;
        }

        if (isTitleLine(line)) {
            // Se já temos conteúdo acumulado, salvamos a seção anterior
            if (currentBuffer.length > 0) {
                newSections.push({
                    section_id: newSections.length + 1,
                    title: currentTitle,
                    content: repairText(currentBuffer.join('\n')).trim()
                });
                currentBuffer = [];
                currentTitle = cleanLine; // Atualiza título
            } else {
                // Se não temos conteúdo, apenas atualizamos o título (evita seções vazias)
                currentTitle = cleanLine;
            }
        } else {
            currentBuffer.push(line);
        }
    });

    // Adicionar a última seção
    if (currentBuffer.length > 0 || newSections.length === 0) {
        newSections.push({
            section_id: newSections.length + 1,
            title: currentTitle,
            content: repairText(currentBuffer.join('\n')).trim()
        });
    }

    // Se o parsing falhou em criar divisões úteis (só criou 1), retorna o original mas limpo
    if (newSections.length <= 1) {
        // Aplica o repair mesmo se não tiver seções
        if (newSections.length === 1) {
            newSections[0].content = repairText(newSections[0].content);
            return newSections;
        }
        return originalSections;
    }

    return newSections.map(section => ({
        ...section,
        content: repairText(section.content)
    }));
};


// --- Componente para Renderizar Texto Rico ---

const RichTextRenderer = ({ content }: { content: string }) => {
    const lines = content.split('\n');

    return (
        <View style={styles.richTextContainer}>
            {lines.map((line, index) => {
                const cleanLine = line.trim();

                if (!cleanLine) return <View key={index} style={{ height: spacing.md }} />; // Espaçamento

                // Item de Lista (Check)
                if (cleanLine.startsWith('✔️')) {
                    return (
                        <View key={index} style={styles.listItemCard}>
                            <MaterialIcons name="check-circle" size={20} color={colors.success} style={{ marginTop: 2 }} />
                            <Text style={styles.listItemText}>{cleanLine.substring(1).trim()}</Text>
                        </View>
                    );
                }

                // Item de Lista (Bullet)
                if (cleanLine.startsWith('•') || cleanLine.startsWith('- ')) {
                    return (
                        <View key={index} style={styles.listItemBullet}>
                            <View style={styles.bulletPoint} />
                            <Text style={styles.listItemText}>{cleanLine.replace(/^[•\-]\s*/, '')}</Text>
                        </View>
                    );
                }

                // Texto Normal (Parágrafo)
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

    // Processamento inteligente das seções
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
            <LinearGradient colors={['#1e293b', '#334155']} style={styles.container}>
                <View style={styles.emptyState}>
                    <MaterialIcons name="article" size={64} color={colors.slate400} />
                    <Text style={styles.emptyText}>Nenhum conteúdo disponível</Text>
                </View>
            </LinearGradient>
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
                    <View>
                        <Text style={styles.fileName} numberOfLines={1}>{filename || 'Documento'}</Text>
                        <Text style={styles.metaInfo}>
                            {processedSections.length} Tópicos • {activeSectionIndex + 1}/{processedSections.length}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.contentWrapper}>
                {/* Sidebar Navigation */}
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
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.sidebarItemText, isActive && styles.sidebarItemTextActive]} numberOfLines={2}>
                                            {section.title}
                                        </Text>
                                        {/* Preview do conteúdo se houver espaço (opcional, removido para limpeza) */}
                                    </View>
                                    {isActive && (
                                        <MaterialIcons name="chevron-right" size={20} color={colors.white} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Main Content Area */}
                <View style={styles.mainContent}>
                    <LinearGradient
                        colors={['#1e293b', '#1e293b']}
                        style={styles.paperContainer}
                    >
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.paperScroll}
                            contentContainerStyle={styles.paperContent}
                            showsVerticalScrollIndicator={true}
                        >
                            <Text style={styles.sectionTitle}>{activeSection.title}</Text>
                            <View style={styles.divider} />

                            {/* Renderizador de Texto Rico */}
                            <RichTextRenderer content={activeSection.content} />

                            {/* Navigation Footer */}
                            <View style={styles.navFooter}>
                                <TouchableOpacity
                                    style={[styles.navButton, activeSectionIndex === 0 && styles.navButtonDisabled]}
                                    onPress={handlePrev}
                                    disabled={activeSectionIndex === 0}
                                >
                                    <MaterialIcons name="arrow-back" size={20} color={activeSectionIndex === 0 ? colors.slate600 : colors.white} />
                                    <Text style={[styles.navButtonText, activeSectionIndex === 0 && styles.navButtonTextDisabled]}>Anterior</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.navButton, styles.navButtonPrimary, activeSectionIndex === processedSections.length - 1 && styles.navButtonDisabled]}
                                    onPress={handleNext}
                                    disabled={activeSectionIndex === processedSections.length - 1}
                                >
                                    <Text style={[styles.navButtonText, activeSectionIndex === processedSections.length - 1 && styles.navButtonTextDisabled]}>Próximo</Text>
                                    <MaterialIcons name="arrow-forward" size={20} color={activeSectionIndex === processedSections.length - 1 ? colors.slate600 : colors.white} />
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </LinearGradient>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        width: '100%',
    },
    header: {
        height: 80,
        backgroundColor: '#1e293b',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        elevation: 4,
        zIndex: 10,
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
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        marginBottom: 2,
    },
    metaInfo: {
        fontSize: typography.fontSize.sm,
        color: colors.slate400,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: typography.fontWeight.medium,
    },
    contentWrapper: {
        flex: 1,
        flexDirection: 'row',
    },
    // Sidebar
    sidebar: {
        width: 320,
        backgroundColor: '#1e293b',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.1)',
    },
    sidebarHeader: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(0,0,0,0.2)'
    },
    sidebarTitle: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.bold,
        color: colors.slate400,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    sidebarList: {
        flex: 1,
        padding: spacing.base,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderRadius: 12,
        marginBottom: spacing.xs,
    },
    sidebarItemActive: {
        backgroundColor: colors.primary + '20',
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
    },
    sectionNumberBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
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
        color: colors.slate400,
    },
    sectionNumberTextActive: {
        color: colors.white,
    },
    sidebarItemText: {
        fontSize: typography.fontSize.base,
        color: colors.slate300,
        fontWeight: typography.fontWeight.medium,
        flex: 1,
    },
    sidebarItemTextActive: {
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
    },

    // Main Content
    mainContent: {
        flex: 1,
        backgroundColor: '#0f172a',
        padding: spacing.xl,
    },
    paperContainer: {
        flex: 1,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        backgroundColor: '#1e293b',
    },
    paperScroll: {
        flex: 1,
    },
    paperContent: {
        padding: spacing['4xl'],
        paddingBottom: 120,
        maxWidth: 1000,
        alignSelf: 'center',
        width: '100%',
    },
    sectionTitle: {
        fontSize: 36,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        marginBottom: spacing.lg,
        lineHeight: 44,
        letterSpacing: -0.5,
    },
    divider: {
        height: 4,
        width: 80,
        backgroundColor: colors.primary,
        borderRadius: 2,
        marginBottom: spacing['2xl'],
    },

    // Rich Text Styles
    richTextContainer: {
        gap: spacing.base,
    },
    paragraphText: {
        fontSize: 20,
        color: colors.slate200,
        lineHeight: 32,
        marginBottom: spacing.sm,
    },
    listItemCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: spacing.base,
        marginVertical: spacing.xs,
    },
    listItemBullet: {
        flexDirection: 'row',
        paddingLeft: spacing.base,
        gap: spacing.base,
        marginVertical: spacing.xs,
    },
    bulletPoint: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.slate400,
        marginTop: 12,
    },
    listItemText: {
        flex: 1,
        fontSize: 18,
        color: colors.slate200,
        lineHeight: 28,
    },

    // Footer
    navFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing['4xl'],
        paddingTop: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.xl,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: spacing.sm,
        minWidth: 140,
        justifyContent: 'center',
    },
    navButtonPrimary: {
        backgroundColor: colors.primary,
    },
    navButtonDisabled: {
        opacity: 0.3,
    },
    navButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
    },
    navButtonTextDisabled: {
        color: colors.slate500,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.fontSize.xl,
        color: colors.slate400,
        marginTop: spacing.lg,
    },
});
