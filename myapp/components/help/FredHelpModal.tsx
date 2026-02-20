import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

interface FredHelpModalProps {
    visible: boolean;
    onClose: () => void;
}

interface HelpSection {
    id: string;
    title: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    color: string;
    items: {
        title: string;
        description: string;
        examples?: string[];
    }[];
}

const helpSections: HelpSection[] = [
    {
        id: 'voice',
        title: 'Como Usar Comandos de Voz',
        icon: 'mic',
        color: '#ef4444',
        items: [
            {
                title: 'Ativando o Fred',
                description: 'Para dar um comando de voz, basta dizer "Fred" seguido do seu comando. O Fred escuta continuamente enquanto a transcrição está ativa.',
                examples: [
                    '"Fred, gere um quiz sobre esse assunto"',
                    '"Fred, crie um resumo da aula"',
                    '"Fred, busque um vídeo sobre fotossíntese"'
                ]
            },
            {
                title: 'Dica Importante',
                description: 'Fale de forma clara e pausada. Espere o comando anterior terminar antes de dar um novo. O pop-up roxo mostrará o que o Fred entendeu.',
            }
        ]
    },
    {
        id: 'video',
        title: 'Controle de Vídeo',
        icon: 'play-circle-filled',
        color: '#3b82f6',
        items: [
            {
                title: 'Reproduzir Vídeo',
                description: 'Inicia a reprodução do vídeo na tela de apresentação.',
                examples: [
                    '"Fred, play"',
                    '"Fred, toca o vídeo"',
                    '"Fred, continue o vídeo"',
                    '"Fred, inicia o vídeo"'
                ]
            },
            {
                title: 'Pausar Vídeo',
                description: 'Pausa o vídeo que está sendo reproduzido.',
                examples: [
                    '"Fred, pause"',
                    '"Fred, pausa o vídeo"',
                    '"Fred, para o vídeo"'
                ]
            },
            {
                title: 'Mutar/Desmutar Som',
                description: 'Controla o áudio do vídeo.',
                examples: [
                    '"Fred, sem som" / "Fred, tira o som"',
                    '"Fred, com som" / "Fred, volta o som"',
                    '"Fred, mudo" / "Fred, silenciar"'
                ]
            },
            {
                title: 'Avançar/Voltar',
                description: 'Pula ou retrocede o vídeo em segundos.',
                examples: [
                    '"Fred, pular 10 segundos"',
                    '"Fred, avançar 30 segundos"',
                    '"Fred, voltar 15 segundos"',
                    '"Fred, retroceder 20 segundos"'
                ]
            },
            {
                title: 'Reiniciar Vídeo',
                description: 'Volta o vídeo para o início.',
                examples: [
                    '"Fred, reiniciar"',
                    '"Fred, começar do início"',
                    '"Fred, volta tudo"'
                ]
            },
            {
                title: 'Buscar Vídeos',
                description: 'Procura vídeos relacionados ao tema da aula.',
                examples: [
                    '"Fred, busque um vídeo sobre [assunto]"',
                    '"Fred, procura um vídeo de [tema]"',
                    '"Fred, mostra um vídeo sobre [conteúdo]"'
                ]
            }
        ]
    },
    {
        id: 'pdf',
        title: 'Controle de PDF/Slides',
        icon: 'picture-as-pdf',
        color: '#f59e0b',
        items: [
            {
                title: 'Próxima Página',
                description: 'Avança para a próxima página ou slide.',
                examples: [
                    '"Fred, próxima página"',
                    '"Fred, próximo slide"',
                    '"Fred, avançar"',
                    '"Fred, passar"'
                ]
            },
            {
                title: 'Página Anterior',
                description: 'Volta para a página ou slide anterior.',
                examples: [
                    '"Fred, página anterior"',
                    '"Fred, volta"',
                    '"Fred, voltar slide"'
                ]
            },
            {
                title: 'Ir para Página Específica',
                description: 'Vai direto para uma página específica.',
                examples: [
                    '"Fred, vai para página 5"',
                    '"Fred, página 10"',
                    '"Fred, slide três"',
                    '"Fred, ir para página dois"'
                ]
            },
            {
                title: 'Aumentar Zoom',
                description: 'Amplia o conteúdo na tela.',
                examples: [
                    '"Fred, aumentar zoom"',
                    '"Fred, aproximar"',
                    '"Fred, ampliar"',
                    '"Fred, letra maior"'
                ]
            },
            {
                title: 'Diminuir Zoom',
                description: 'Reduz o tamanho do conteúdo.',
                examples: [
                    '"Fred, diminuir zoom"',
                    '"Fred, afastar"',
                    '"Fred, reduzir"',
                    '"Fred, letra menor"'
                ]
            },
            {
                title: 'Zoom Automático',
                description: 'Ajusta o documento para caber na tela.',
                examples: [
                    '"Fred, zoom automático"',
                    '"Fred, ajustar tela"',
                    '"Fred, caber na tela"'
                ]
            },
            {
                title: 'Tamanho Real',
                description: 'Mostra o documento em 100% do tamanho original.',
                examples: [
                    '"Fred, tamanho real"',
                    '"Fred, cem por cento"',
                    '"Fred, zoom original"'
                ]
            }
        ]
    },
    {
        id: 'documents',
        title: 'Documentos e Materiais',
        icon: 'folder',
        color: '#8b5cf6',
        items: [
            {
                title: 'Listar Documentos',
                description: 'Mostra todos os documentos disponíveis para a disciplina.',
                examples: [
                    '"Fred, quais documentos tem disponíveis?"',
                    '"Fred, lista os PDFs"',
                    '"Fred, mostra os arquivos"'
                ]
            },
            {
                title: 'Abrir Documento',
                description: 'Abre um documento específico na tela de apresentação.',
                examples: [
                    '"Fred, abrir documento 1"',
                    '"Fred, abrir documento dois"',
                    '"Fred, abrir PDF matemática"',
                    '"Fred, exibir arquivo apostila"'
                ]
            }
        ]
    },
    {
        id: 'quiz',
        title: 'Quiz e Atividades',
        icon: 'quiz',
        color: '#10b981',
        items: [
            {
                title: 'Gerar Quiz',
                description: 'Cria um quiz automaticamente baseado no conteúdo da aula.',
                examples: [
                    '"Fred, gere um quiz"',
                    '"Fred, cria um quiz sobre esse assunto"',
                    '"Fred, monta 5 perguntas sobre [tema]"'
                ]
            },
            {
                title: 'Enviar Quiz',
                description: 'Envia o quiz gerado para os alunos responderem.',
                examples: [
                    '"Fred, envia esse quiz"',
                    '"Fred, manda o quiz para os alunos"',
                    '"Fred, aplica o quiz"'
                ]
            },
            {
                title: 'Gerar e Enviar',
                description: 'Gera e já envia o quiz automaticamente.',
                examples: [
                    '"Fred, gere e envie um quiz"',
                    '"Fred, cria e manda um quiz"'
                ]
            },
            {
                title: 'Mostrar/Ocultar Gabarito',
                description: 'Controla a exibição das respostas corretas.',
                examples: [
                    '"Fred, mostra as respostas"',
                    '"Fred, exibe o gabarito"',
                    '"Fred, oculta as respostas"',
                    '"Fred, esconde o gabarito"'
                ]
            }
        ]
    },
    {
        id: 'summary',
        title: 'Resumos',
        icon: 'summarize',
        color: '#ec4899',
        items: [
            {
                title: 'Gerar Resumo',
                description: 'Cria um resumo automático do conteúdo transcrito.',
                examples: [
                    '"Fred, gere um resumo"',
                    '"Fred, cria um resumo da aula"',
                    '"Fred, faz um resumo sobre [tema]"'
                ]
            },
            {
                title: 'Enviar Resumo',
                description: 'Compartilha o resumo com os alunos.',
                examples: [
                    '"Fred, envia esse resumo"',
                    '"Fred, manda o resumo para os alunos"'
                ]
            },
            {
                title: 'Enviar Resumo com Áudio (Padrão)',
                description: 'Ao enviar por voz, o resumo vai com áudio usando padrão: voz Jeff, modo Summary e música atual.',
                examples: [
                    '"Fred, enviar resumo para alunos"',
                    '"Fred, manda pros alunos"',
                    '"Fred, emvia esse resumo"'
                ]
            },
            {
                title: 'Título por Voz e Título Automático',
                description: 'Você pode definir o título falando no comando. Se não informar, o sistema cria automaticamente no formato: [Disciplina] - resumo em audio 1, 2, 3...',
                examples: [
                    '"Fred, enviar resumo com título revisão prova 1"',
                    '"Fred, mandar resumo titulo farmacocinética"',
                    '"Fred, enviar resumo" (usa título automático)'
                ]
            },
            {
                title: 'Confirmar Envio por Voz',
                description: 'Após abrir o preview com Título final, você pode editar no campo e confirmar por botão ou por comando de voz.',
                examples: [
                    '"Fred, confirmar envio"',
                    '"Fred, pode enviar"',
                    '"Fred, cancelar envio"'
                ]
            },
            {
                title: 'Configurar Áudio por Voz',
                description: 'Você pode escolher voz, modo e música no próprio comando; o Fred também tolera variações de fala/escrita.',
                examples: [
                    '"Fred, enviar resumo voz jeff modo summary"',
                    '"Fred, enviar resumo modo rapido musica lofi study"',
                    '"Fred, mandar resumo voz jefi modo sumari musica lof stadi"',
                    '"Fred, enviar resumo sem música"'
                ]
            }
        ]
    },
    {
        id: 'presentation',
        title: 'Apresentação/Projetor',
        icon: 'cast',
        color: '#06b6d4',
        items: [
            {
                title: 'Enviar para Tela',
                description: 'Envia o conteúdo atual (quiz ou resumo) para a tela de apresentação.',
                examples: [
                    '"Fred, mostra na tela"',
                    '"Fred, projeta isso"',
                    '"Fred, apresentar"'
                ]
            }
        ]
    },
    {
        id: 'ui',
        title: 'Interface da Tela',
        icon: 'touch-app',
        color: '#64748b',
        items: [
            {
                title: 'Botão de Microfone',
                description: 'O botão vermelho central inicia/para a transcrição de voz. Quando ativo, tudo que você fala é transcrito automaticamente.',
            },
            {
                title: 'Área de Transcrição',
                description: 'O texto transcrito aparece na área central. Você pode editar manualmente clicando no texto.',
            },
            {
                title: 'Pop-up do Fred',
                description: 'Quando você dá um comando de voz, um pop-up roxo aparece mostrando o que o Fred está processando.',
            },
            {
                title: 'Menu Lateral',
                description: 'Acesse o menu pelo ícone ☰ no canto superior direito para navegar para outras telas.',
            },
            {
                title: 'Indicador de Salvamento',
                description: 'O ícone de nuvem no header indica o status de salvamento automático da transcrição.',
            },
            {
                title: 'Controles de Apresentação',
                description: 'Quando uma apresentação está ativa, controles adicionais aparecem para gerenciar o conteúdo na TV.',
            },
            {
                title: 'Edição de Quiz',
                description: 'Após gerar um quiz, você pode editar questões, excluir perguntas, regenerar com IA, ou alterar a resposta correta.',
            },
            {
                title: 'Histórico de Versões',
                description: 'Acesse versões anteriores da transcrição pelo menu para restaurar se necessário.',
            }
        ]
    }
];

export default function FredHelpModal({ visible, onClose }: FredHelpModalProps) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const [expandedSection, setExpandedSection] = useState<string | null>('voice');

    const toggleSection = (id: string) => {
        setExpandedSection(expandedSection === id ? null : id);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, isMobile && styles.containerMobile]}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.headerIcon}>
                                <MaterialIcons name="smart-toy" size={28} color="#FFF" />
                            </View>
                            <View>
                                <Text style={styles.headerTitle}>Central de Ajuda</Text>
                                <Text style={styles.headerSubtitle}>Guia Completo do Assistente Fred</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <MaterialIcons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Content */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Quick Tips */}
                        <View style={styles.quickTips}>
                            <MaterialIcons name="lightbulb" size={20} color="#f59e0b" />
                            <Text style={styles.quickTipsText}>
                                Dica: Diga <Text style={styles.highlight}>"Fred"</Text> seguido do comando para ativar o assistente de voz durante a aula.
                            </Text>
                        </View>

                        {/* Sections */}
                        {helpSections.map((section) => (
                            <View key={section.id} style={styles.section}>
                                <TouchableOpacity
                                    style={styles.sectionHeader}
                                    onPress={() => toggleSection(section.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.sectionHeaderLeft}>
                                        <View style={[styles.sectionIcon, { backgroundColor: `${section.color}15` }]}>
                                            <MaterialIcons name={section.icon} size={20} color={section.color} />
                                        </View>
                                        <Text style={styles.sectionTitle}>{section.title}</Text>
                                    </View>
                                    <MaterialIcons
                                        name={expandedSection === section.id ? 'expand-less' : 'expand-more'}
                                        size={24}
                                        color="#64748b"
                                    />
                                </TouchableOpacity>

                                {expandedSection === section.id && (
                                    <View style={styles.sectionContent}>
                                        {section.items.map((item, index) => (
                                            <View key={index} style={styles.helpItem}>
                                                <Text style={styles.itemTitle}>{item.title}</Text>
                                                <Text style={styles.itemDescription}>{item.description}</Text>
                                                {item.examples && item.examples.length > 0 && (
                                                    <View style={styles.examplesContainer}>
                                                        <Text style={styles.examplesLabel}>Exemplos de comando:</Text>
                                                        {item.examples.map((example, i) => (
                                                            <View key={i} style={styles.exampleRow}>
                                                                <MaterialIcons name="keyboard-voice" size={14} color="#6366f1" />
                                                                <Text style={styles.exampleText}>{example}</Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                Precisa de mais ajuda? Entre em contato com o suporte.
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    container: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        width: '100%',
        maxWidth: 700,
        maxHeight: '90%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    containerMobile: {
        maxWidth: '100%',
        maxHeight: '95%',
        borderRadius: borderRadius.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    quickTips: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#fffbeb',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: '#fef3c7',
    },
    quickTipsText: {
        flex: 1,
        fontSize: 14,
        color: '#92400e',
        lineHeight: 20,
    },
    highlight: {
        fontWeight: '700',
        color: '#6366f1',
    },
    section: {
        marginBottom: spacing.md,
        backgroundColor: '#f8fafc',
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    sectionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    sectionContent: {
        padding: spacing.md,
        paddingTop: 0,
    },
    helpItem: {
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: spacing.xs,
    },
    itemDescription: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
    },
    examplesContainer: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    examplesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginBottom: spacing.xs,
    },
    exampleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: 4,
    },
    exampleText: {
        fontSize: 13,
        color: '#475569',
        fontStyle: 'italic',
    },
    footer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    footerText: {
        fontSize: 13,
        color: '#94a3b8',
    },
});
