import React, { useState, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    View,
    Text,
    Modal,
    Alert,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '@/components/navigation/Header';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { SubjectCard } from '@/components/cards/SubjectCard';
import { Subject } from '@/types';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { getSubjects, Subject as APISubject, getMe } from '@/services/api';

/**
 * TeacherDashboardScreen - Dashboard do Professor
 * Tela principal do professor com disciplinas que leciona
 */
export default function TeacherDashboardScreen() {
    const [activeNavId, setActiveNavId] = useState('dashboard');
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userName, setUserName] = useState('Professor');


    // Formatar data atual
    const getCurrentDate = () => {
        const date = new Date();
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            day: 'numeric',
            month: 'short'
        };
        const formatted = date.toLocaleDateString('pt-BR', options);
        // Capitalizar primeira letra
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    // Buscar disciplinas da API
    useEffect(() => {
        loadData();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            setActiveNavId('dashboard');
            setShowSubjectModal(false);
        }, [])
    );

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar nome do usuário
            const meResponse = await getMe();
            if (meResponse.success && meResponse.user) {
                setUserName(meResponse.user.name);
            }

            // Buscar disciplinas
            const data = await getSubjects();

            // Converter para o formato esperado pelo componente
            const formattedSubjects: Subject[] = data.map((subject: APISubject) => ({
                id: subject.id.toString(),
                name: subject.name,
                imageUrl: subject.imageUrl || subject.image_url || 'https://via.placeholder.com/400'
            }));

            setSubjects(formattedSubjects);
        } catch (err) {
            console.error('Erro ao carregar disciplinas:', err);
            setError('Erro ao carregar disciplinas');
        } finally {
            setLoading(false);
        }
    };

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'calendar', label: 'Calendário', iconName: 'calendar-today' },
        { id: 'recaps', label: 'Recapitulando', iconName: 'history-edu' },
    ];
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [modalMode, setModalMode] = useState<'recap' | 'analytics'>('recap');

    const closeSubjectModal = () => {
        setShowSubjectModal(false);
        setModalMode('recap');
        // Evita manter o item de recap ativo quando o professor cancela o modal.
        setActiveNavId('dashboard');
    };

    const handleRecapShortcut = () => {
        if (!subjects || subjects.length === 0) {
            Alert.alert('Sem disciplinas', 'Nenhuma disciplina encontrada para abrir os recaps.');
            return;
        }

        if (subjects.length === 1) {
            const subject = subjects[0];
            router.push({
                pathname: '/(teacher)/recaps',
                params: { subjectId: subject.id.toString(), subjectName: subject.name }
            });
            return;
        }

        // Multiple subjects: show modal to pick one
        setModalMode('recap');
        setActiveNavId('recaps');
        setShowSubjectModal(true);
    };

    const handleAnalyticsShortcut = () => {
        if (!subjects || subjects.length === 0) {
            Alert.alert('Sem disciplinas', 'Nenhuma disciplina encontrada para abrir analytics.');
            return;
        }

        if (subjects.length === 1) {
            const subject = subjects[0];
            router.push({
                pathname: '/(teacher)/class-analytics',
                params: { subjectId: subject.id.toString(), subjectName: subject.name }
            });
            return;
        }

        setModalMode('analytics');
        setShowSubjectModal(true);
    };

    const handleNavPress = (id: string) => {
        switch (id) {
            case 'dashboard':
                setActiveNavId('dashboard');
                // Already on dashboard
                break;
            case 'calendar':
                setActiveNavId('calendar');
                router.push('./calendar');
                break;
            case 'recaps':
                handleRecapShortcut();
                break;
        }
    };

    const handleSubjectPress = (subject: Subject) => {
        router.push({
            pathname: '/(teacher)/transcription',
            params: { subject: subject.name, subjectId: subject.id.toString() }
        });
    };




    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header Customizado */}
                    <LinearGradient
                        colors={['#4f46e5', '#7c3aed']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.headerGradient}
                    >
                        <View style={styles.headerTop}>
                            <View>
                                <Text style={styles.greeting}>Olá, {userName}</Text>
                                <Text style={styles.date}>{getCurrentDate()}</Text>
                            </View>
                            <View style={styles.headerButtons}>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => router.push('/(teacher)/settings')}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="settings" size={24} color={colors.white} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </LinearGradient>



                    <View style={styles.quickActionsSection}>
                        <TouchableOpacity
                            style={styles.analyticsShortcut}
                            activeOpacity={0.85}
                            onPress={handleAnalyticsShortcut}
                        >
                            <LinearGradient
                                colors={['#0ea5e9', '#2563eb']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.analyticsGradient}
                            >
                                <View style={styles.analyticsContent}>
                                    <MaterialIcons name="insights" size={24} color={colors.white} />
                                    <View style={styles.analyticsTextWrap}>
                                        <Text style={styles.analyticsTitle}>Analytics da Turma</Text>
                                        <Text style={styles.analyticsSubtitle}>
                                            Veja participação, taxa de erro e alunos que precisam de ajuda
                                        </Text>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={28} color={colors.white} />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Minhas Disciplinas Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Minhas Disciplinas</Text>

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <Text style={styles.loadingText}>Carregando disciplinas...</Text>
                            </View>
                        ) : error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                                <TouchableOpacity style={styles.retryButton} onPress={loadData}>
                                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                                </TouchableOpacity>
                            </View>
                        ) : subjects.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>Nenhuma disciplina encontrada</Text>
                            </View>
                        ) : (
                            <View style={styles.subjectsGrid}>
                                {subjects.map((subject) => (
                                    <SubjectCard
                                        key={subject.id}
                                        subject={subject}
                                        style={styles.subjectCard}
                                        onPress={() => handleSubjectPress(subject)}
                                    />
                                ))}
                            </View>
                        )}
                    </View>


                </ScrollView>

                {/* Bottom Navigation */}
                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={handleNavPress}
                />
                {/* Subject selection modal for Recapitulando shortcut */}
                <Modal
                    visible={showSubjectModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={closeSubjectModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <LinearGradient
                                colors={modalMode === 'analytics' ? ['#0ea5e9', '#2563eb'] : ['#4f46e5', '#7c3aed']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalHeader}
                            >
                                <View style={styles.modalHeaderIconWrap}>
                                    <MaterialIcons
                                        name={modalMode === 'analytics' ? 'insights' : 'history-edu'}
                                        size={22}
                                        color={colors.white}
                                    />
                                </View>
                                <View style={styles.modalHeaderTextWrap}>
                                    <Text style={styles.modalTitle}>
                                        {modalMode === 'analytics' ? 'Escolha uma disciplina para Analytics' : 'Escolha uma disciplina para Recapitulando'}
                                    </Text>
                                    <Text style={styles.modalSubtitle}>
                                        {modalMode === 'analytics'
                                            ? 'Vamos abrir os indicadores da turma da disciplina selecionada.'
                                            : 'Selecione a disciplina para ver os recaps e continuar o acompanhamento da aula.'}
                                    </Text>
                                </View>
                            </LinearGradient>

                            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                                {subjects.map((subject) => (
                                    <TouchableOpacity
                                        key={subject.id}
                                        style={styles.modalItem}
                                        activeOpacity={0.85}
                                        onPress={() => {
                                            const selectedMode = modalMode;
                                            closeSubjectModal();
                                            if (selectedMode === 'analytics') {
                                                router.push({
                                                    pathname: '/(teacher)/class-analytics',
                                                    params: { subjectId: subject.id.toString(), subjectName: subject.name }
                                                });
                                            } else {
                                                router.push({
                                                    pathname: '/(teacher)/recaps',
                                                    params: { subjectId: subject.id.toString(), subjectName: subject.name }
                                                });
                                            }
                                        }}
                                    >
                                        <View style={styles.modalItemIcon}>
                                            <MaterialIcons name="school" size={18} color={colors.primary} />
                                        </View>
                                        <Text style={styles.modalItemText}>{subject.name}</Text>
                                        <MaterialIcons name="chevron-right" size={20} color={colors.slate500} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.modalCancel} onPress={closeSubjectModal}>
                                    <Text style={styles.modalCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </SafeAreaView>
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.base,
    },
    headerGradient: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greeting: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    date: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginTop: spacing.lg,
    },
    quickActionsSection: {
        marginTop: spacing.lg,
        paddingHorizontal: spacing.base,
    },
    analyticsShortcut: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    analyticsGradient: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
    },
    analyticsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    analyticsTextWrap: {
        flex: 1,
    },
    analyticsTitle: {
        color: colors.white,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
    },
    analyticsSubtitle: {
        marginTop: 2,
        color: 'rgba(255,255,255,0.88)',
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.body,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        letterSpacing: typography.letterSpacing.tight,
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.md,
    },
    subjectsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.base,
        gap: spacing.md,
    },
    subjectCard: {
        width: '47%',
        minWidth: 158,
        // Shadow and bg handled by SubjectCard component, assuming it uses theme colors correctly
        // If SubjectCard needs update, we check that next
    },

    loadingContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        color: colors.textSecondary,
    },
    errorContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        color: colors.danger,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    emptyContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.body,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.58)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.lg,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 760,
        backgroundColor: colors.white,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 18,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
    },
    modalHeader: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.base,
        paddingBottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    modalHeaderIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    modalHeaderTextWrap: {
        flex: 1,
    },
    modalTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        lineHeight: 24,
    },
    modalSubtitle: {
        marginTop: 6,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.body,
        color: 'rgba(255,255,255,0.88)',
        lineHeight: 20,
    },
    modalList: {
        maxHeight: 320,
    },
    modalListContent: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.base,
        gap: spacing.sm,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.base,
        borderRadius: 14,
        backgroundColor: colors.slate50,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    modalItemIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: colors.primaryOpacity20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalItemText: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
    },
    modalFooter: {
        marginTop: spacing.base,
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.base,
    },
    modalCancel: {
        paddingVertical: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.slate100,
        borderRadius: 12,
    },
    modalCancelText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.slate700,
    },
});
