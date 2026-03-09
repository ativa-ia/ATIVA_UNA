import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet,
    Text, TouchableOpacity, View, useWindowDimensions, Dimensions, Modal, TouchableWithoutFeedback
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { CoordinatorDashboard, getCoordinatorDashboard, getCoordinatorSubjects, CoordinatorSubject, getCoordinatorStudents, StudentOverview } from '@/services/api';

type DropdownType = 'semester' | 'subject' | 'student' | null;

export default function CoordinatorDashboardScreen() {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 900;

    const [loading, setLoading] = useState(true);
    const [isChartLoading, setIsChartLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<CoordinatorDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [subjects, setSubjects] = useState<CoordinatorSubject[]>([]);
    const [students, setStudents] = useState<StudentOverview[]>([]);

    // Filters
    const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<DropdownType>(null);

    // Auto-select first available semester
    useEffect(() => {
        if (data?.available_semesters && data.available_semesters.length > 0 && !selectedSemester) {
            setSelectedSemester(data.available_semesters[0]);
        }
    }, [data?.available_semesters, selectedSemester]);

    const fetchDashboardData = async (subjId: number | null, studId: number | null, sem: string | null, isRefresh = false, isFilter = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else if (isFilter) setIsChartLoading(true);
            else setLoading(true);

            setError(null);
            const result = await getCoordinatorDashboard(subjId, studId, sem);
            if (!result.success) {
                setError('Erro ao carregar dashboard');
                return;
            }
            setData(result);
        } catch (err) {
            setError('Erro de conexão');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setIsChartLoading(false);
        }
    };

    const isMounted = useRef(false);
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            fetchDashboardData(selectedSubjectId, selectedStudentId, selectedSemester);
            getCoordinatorSubjects().then(res => res.success && setSubjects(res.subjects)).catch(console.log);
        } else {
            fetchDashboardData(selectedSubjectId, selectedStudentId, selectedSemester, false, true);
        }
    }, [selectedSubjectId, selectedStudentId, selectedSemester]);

    // Load students when subject changes
    useEffect(() => {
        if (selectedSubjectId) {
            getCoordinatorStudents({ subject_id: selectedSubjectId }).then(res => {
                if (res.success) setStudents(res.students);
            }).catch(console.log);
        } else {
            setStudents([]);
        }
    }, [selectedSubjectId]);

    const handleLogout = async () => {
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('userRole');
        router.replace('/(auth)/login');
    };

    const kpis = data?.kpis;
    const signal = data?.signal;
    const riskStudents = data?.risk_students || [];

    const signalColors: Record<string, { bg: string; text: string; icon: string }> = {
        stable: { bg: '#dcfce7', text: '#15803d', icon: 'verified' },
        attention: { bg: '#fef3c7', text: '#d97706', icon: 'warning-amber' },
        critical: { bg: '#fee2e2', text: '#ef4444', icon: 'priority-high' },
    };
    const sc = signalColors[signal?.level || 'stable'];

    const statusBadge = (status: string) => {
        if (status === 'needs_help') return { bg: '#fee2e2', text: '#b91c1c', label: 'Precisa de ajuda' };
        if (status === 'attention') return { bg: '#fef3c7', text: '#92400e', label: 'Atenção' };
        return { bg: '#dcfce7', text: '#166534', label: 'Indo bem' };
    };

    const navItems = [
        { key: 'classes', icon: 'groups' as const, label: 'Turmas', route: '/(coordinator)/classes' },
        { key: 'subjects', icon: 'menu-book' as const, label: 'Disciplines', route: '/(coordinator)/subjects' },
        { key: 'teachers', icon: 'person-tie' as const, label: 'Professores', route: '/(coordinator)/teachers', fallbackIcon: 'person' as const },
        { key: 'students', icon: 'school' as const, label: 'Alunos', route: '/(coordinator)/students' },
        { key: 'recaps', icon: 'assignment' as const, label: 'Recaps', route: '/(coordinator)/recaps' },
        { key: 'settings', icon: 'settings' as const, label: 'Config', route: '/(coordinator)/settings' },
    ];

    const chartConfig = {
        backgroundGradientFrom: '#fff',
        backgroundGradientTo: '#fff',
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
        propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: '#fff'
        },
        propsForBackgroundLines: {
            strokeWidth: 1,
            stroke: '#f1f5f9',
            strokeDasharray: ''
        },
        labelColor: (opacity = 1) => `#64748b`,
    };

    const screenWidth = Dimensions.get('window').width;

    return (
        <SafeAreaView style={s.safe}>
            <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <View style={s.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>Monitoramento da Coordenação</Text>
                        <Text style={s.headerSubtitle} numberOfLines={1}>{data?.course?.name || 'Carregando...'}</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={'#5e35b1'} /><Text style={s.centerText}>Carregando painel...</Text></View>
            ) : error ? (
                <View style={s.center}>
                    <MaterialIcons name="error-outline" size={40} color="#ef4444" />
                    <Text style={s.errorText}>{error}</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={() => loadDashboard()}><Text style={s.retryText}>Tentar novamente</Text></TouchableOpacity>
                </View>
            ) : (
                <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} />} showsVerticalScrollIndicator={false}>

                    {/* KPI Cards */}
                    <View style={[s.kpiRow, isDesktop && s.kpiRowDesktop]}>
                        {[
                            { label: 'Alunos', value: kpis?.total_students ?? 0, icon: 'people' as const, color: '#3b82f6', bgIcon: '#eff6ff' },
                            { label: 'Professores', value: kpis?.total_teachers ?? 0, icon: 'person' as const, color: '#8b5cf6', bgIcon: '#f5f3ff' },
                            { label: 'Disciplinas', value: kpis?.total_subjects ?? 0, icon: 'menu-book' as const, color: '#06b6d4', bgIcon: '#ecfeff' },
                            { label: 'Turmas', value: kpis?.total_classes ?? 0, icon: 'format-list-bulleted' as const, color: '#f59e0b', bgIcon: '#fffbeb' },
                        ].map((kpi) => (
                            <View key={kpi.label} style={[s.kpiCard, { borderLeftColor: kpi.color }]}>
                                <View style={[s.kpiIconWrap, { backgroundColor: kpi.bgIcon }]}>
                                    <MaterialIcons name={kpi.icon} size={24} color={kpi.color} />
                                </View>
                                <View style={s.kpiTextWrap}>
                                    <Text style={s.kpiLabelTop}>{kpi.label}</Text>
                                    <Text style={s.kpiValue}>{kpi.value}</Text>
                                    <Text style={s.kpiLabelBot}>{kpi.label}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Lists Row (Dynamic Data) */}
                    <View style={[s.listsRow, isDesktop && s.listsRowDesktop]}>
                        {/* Pending Requests */}
                        <View style={s.listCard}>
                            <View style={s.listHeader}>
                                <Text style={s.listTitle}>Solicitações Pendentes</Text>
                                {data?.pending_requests && data.pending_requests.length > 0 && (
                                    <View style={s.listBadge}><Text style={s.listBadgeText}>{data.pending_requests.length}</Text></View>
                                )}
                            </View>
                            <View style={s.listContent}>
                                {data?.pending_requests && data.pending_requests.length > 0 ? (
                                    data.pending_requests.map((req) => (
                                        <Text key={`req-${req.id}`} style={s.listItem} numberOfLines={1}>
                                            <Text style={s.listBold}>{req.student_name}:</Text> {req.request_type}
                                        </Text>
                                    ))
                                ) : (
                                    <Text style={[s.listItem, { color: '#94a3b8', fontStyle: 'italic' }]}>Nenhum pedido pendente</Text>
                                )}
                            </View>
                        </View>

                        {/* Teacher Deadlines */}
                        <View style={s.listCard}>
                            <View style={s.listHeader}>
                                <Text style={s.listTitle}>Prazos dos Professores</Text>
                            </View>
                            <View style={s.listContent}>
                                {data?.teacher_deadlines && data.teacher_deadlines.length > 0 ? (
                                    data.teacher_deadlines.map((dl) => (
                                        <Text key={`dl-${dl.id}`} style={s.listItem} numberOfLines={1}>
                                            <Text style={s.listBold}>{dl.date}:</Text> {dl.title}
                                        </Text>
                                    ))
                                ) : (
                                    <Text style={[s.listItem, { color: '#94a3b8', fontStyle: 'italic' }]}>Nenhum prazo próximo</Text>
                                )}
                            </View>
                        </View>

                        {/* Upcoming Events */}
                        <View style={s.listCard}>
                            <View style={s.listHeader}>
                                <Text style={s.listTitle}>Próximos Eventos do Curso</Text>
                            </View>
                            <View style={s.listContent}>
                                {data?.upcoming_events && data.upcoming_events.length > 0 ? (
                                    data.upcoming_events.map((ev) => (
                                        <Text key={`ev-${ev.id}`} style={s.listItem} numberOfLines={1}>
                                            <Text style={s.listBold}>{ev.date}:</Text> {ev.title}
                                        </Text>
                                    ))
                                ) : (
                                    <Text style={[s.listItem, { color: '#94a3b8', fontStyle: 'italic' }]}>Sem eventos futuros</Text>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Chart Section */}
                    <View style={s.chartCard}>
                        <View style={s.chartHeader}>
                            <Text style={s.chartTitle}>Evolução Cronológica de Quizzes</Text>

                            <View style={[s.filterGroup, isDesktop && s.filterGroupDesktop]}>
                                {/* Semester Dropdown */}
                                <TouchableOpacity style={s.dropdownBtn} onPress={() => setDropdownOpen('semester')}>
                                    <Text style={s.dropdownBtnText}>{selectedSemester || 'Selecionar Semestre'}</Text>
                                    <MaterialIcons name="arrow-drop-down" size={24} color="#64748b" />
                                </TouchableOpacity>

                                {/* Subject Dropdown */}
                                <TouchableOpacity style={s.dropdownBtn} onPress={() => setDropdownOpen('subject')}>
                                    <Text style={s.dropdownBtnText} numberOfLines={1}>
                                        {selectedSubjectId ? subjects.find(sub => sub.id === selectedSubjectId)?.name : 'Todas as Disciplinas'}
                                    </Text>
                                    <MaterialIcons name="arrow-drop-down" size={24} color="#64748b" />
                                </TouchableOpacity>

                                {/* Student Dropdown */}
                                <TouchableOpacity
                                    style={[s.dropdownBtn, !selectedSubjectId && { opacity: 0.5 }]}
                                    onPress={() => selectedSubjectId && setDropdownOpen('student')}
                                    disabled={!selectedSubjectId}
                                >
                                    <Text style={s.dropdownBtnText} numberOfLines={1}>
                                        {selectedStudentId ? students.find(s => s.id === selectedStudentId)?.name : 'Médias da Turma'}
                                    </Text>
                                    <MaterialIcons name="arrow-drop-down" size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                            {data?.chart_data ? (
                                <LineChart
                                    data={{
                                        labels: data.chart_data.labels,
                                        datasets: [
                                            ...(data.chart_data.datasets.map((ds, index) => ({
                                                ...ds,
                                                color: (opacity = 1) => index === 1 ? `rgba(16, 185, 129, ${opacity})` : `rgba(59, 130, 246, ${opacity})`,
                                            }))),
                                            // Hack to force the max Y-axis to 10
                                            { data: [10], color: () => 'transparent', strokeWidth: 0, withDots: false }
                                        ]
                                    }}
                                    width={Math.max(screenWidth - 60, 600)}
                                    height={280}
                                    chartConfig={chartConfig}
                                    bezier
                                    style={{ marginVertical: 8, borderRadius: 8 }}
                                    withInnerLines={true}
                                    withOuterLines={false}
                                    withVerticalLines={false}
                                    segments={5}
                                    fromZero
                                    yAxisInterval={2}
                                />
                            ) : (
                                <View style={{ width: screenWidth - 60, height: 280, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: '#94a3b8' }}>Nenhum dado de gráfico disponível</Text>
                                </View>
                            )}
                        </ScrollView>

                        {/* Dim chart when fetching filter */}
                        {isChartLoading && (
                            <View style={s.chartLoadingOverlay}>
                                <ActivityIndicator size="large" color="#5e35b1" />
                            </View>
                        )}
                    </View>

                    {/* Management Grid */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Gerenciamento</Text>
                        <View style={[s.navGrid, isDesktop && s.navGridDesktop]}>
                            {navItems.map((item) => (
                                <TouchableOpacity key={item.key} style={s.navCard} onPress={() => router.push(item.route as any)}>
                                    <MaterialIcons name={item.icon} size={28} color="#64748b" style={{ marginBottom: 12 }} />
                                    <Text style={s.navLabel}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* Dropdown Modal */}
            <Modal visible={!!dropdownOpen} transparent animationType="fade">
                <TouchableWithoutFeedback onPress={() => setDropdownOpen(null)}>
                    <View style={s.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={s.modalContent}>
                                <Text style={s.modalTitle}>
                                    {dropdownOpen === 'semester' ? 'Selecionar Semestre' : dropdownOpen === 'subject' ? 'Selecionar Disciplina' : 'Selecionar Aluno'}
                                </Text>
                                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                                    {dropdownOpen === 'semester' && data?.available_semesters?.map(sem => (
                                        <TouchableOpacity key={sem} style={s.modalOption} onPress={() => { setSelectedSemester(sem); setDropdownOpen(null); }}>
                                            <Text style={[s.modalOptionText, selectedSemester === sem && { color: '#5e35b1', fontWeight: 'bold' }]}>{sem}</Text>
                                        </TouchableOpacity>
                                    ))}

                                    {dropdownOpen === 'subject' && (
                                        <>
                                            <TouchableOpacity style={s.modalOption} onPress={() => { setSelectedSubjectId(null); setSelectedStudentId(null); setDropdownOpen(null); }}>
                                                <Text style={[s.modalOptionText, selectedSubjectId === null && { color: '#5e35b1', fontWeight: 'bold' }]}>Todas as Disciplinas</Text>
                                            </TouchableOpacity>
                                            {subjects.map(sub => (
                                                <TouchableOpacity key={sub.id} style={s.modalOption} onPress={() => { setSelectedSubjectId(sub.id); setSelectedStudentId(null); setDropdownOpen(null); }}>
                                                    <Text style={[s.modalOptionText, selectedSubjectId === sub.id && { color: '#5e35b1', fontWeight: 'bold' }]}>{sub.name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </>
                                    )}

                                    {dropdownOpen === 'student' && (
                                        <>
                                            <TouchableOpacity style={s.modalOption} onPress={() => { setSelectedStudentId(null); setDropdownOpen(null); }}>
                                                <Text style={[s.modalOptionText, selectedStudentId === null && { color: '#5e35b1', fontWeight: 'bold' }]}>Médias da Turma</Text>
                                            </TouchableOpacity>
                                            {students.map(st => (
                                                <TouchableOpacity key={st.id} style={s.modalOption} onPress={() => { setSelectedStudentId(st.id); setDropdownOpen(null); }}>
                                                    <Text style={[s.modalOptionText, selectedStudentId === st.id && { color: '#5e35b1', fontWeight: 'bold' }]}>{st.name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </>
                                    )}
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { paddingHorizontal: 32, paddingVertical: 16, backgroundColor: '#5e35b1', zIndex: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    headerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 1200, alignSelf: 'center' },
    headerTitle: { color: '#fff', fontSize: 24, fontWeight: '600', letterSpacing: -0.5 },
    headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', marginTop: 4 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    centerText: { color: '#64748b', marginTop: 10, fontSize: 14 },
    errorText: { color: '#ef4444', marginTop: 10, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    retryBtn: { marginTop: 16, backgroundColor: '#5e35b1', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
    retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    scroll: { flex: 1 },
    scrollContent: { padding: 24, maxWidth: 1200, alignSelf: 'center', width: '100%' },

    // KPIs
    kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
    kpiRowDesktop: { flexWrap: 'nowrap' },
    kpiCard: { flex: 1, minWidth: 160, backgroundColor: '#fff', borderRadius: 8, padding: 16, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1, flexDirection: 'row', alignItems: 'center', height: 96 },
    kpiIconWrap: { width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    kpiTextWrap: { flex: 1, justifyContent: 'center' },
    kpiLabelTop: { fontSize: 10, color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    kpiValue: { fontSize: 24, fontWeight: '700', color: '#1e293b', lineHeight: 28 },
    kpiLabelBot: { fontSize: 12, color: '#64748b', marginTop: 4 },

    // Lists Section
    listsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 24 },
    listsRowDesktop: { flexWrap: 'nowrap' },
    listCard: { flex: 1, minWidth: 280, backgroundColor: '#fff', borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1, overflow: 'hidden' },
    listHeader: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    listTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
    listBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    listBadgeText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    listContent: { padding: 20, gap: 12 },
    listItem: { fontSize: 14, color: '#334155' },
    listBold: { fontWeight: '600', color: '#1e293b' },

    // Chart
    chartCard: { backgroundColor: '#fff', borderRadius: 8, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    chartTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
    chartFilter: { flexDirection: 'row', alignItems: 'center' },
    chartFilterLabel: { marginRight: 8, fontSize: 14, color: '#475569' },
    chartSelect: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, backgroundColor: '#fff' },
    chartSelectText: { fontSize: 14, fontWeight: '500', color: '#334155', marginRight: 8 },

    // Management section
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 16, paddingHorizontal: 4 },
    navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    navGridDesktop: {},
    navCard: { width: '30%', minWidth: 120, flexGrow: 1, backgroundColor: '#fff', borderRadius: 8, height: 112, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1, borderWidth: 1, borderColor: '#f8fafc' },
    navLabel: { fontSize: 14, fontWeight: '500', color: '#334155' },

    // Chart Filter
    filterGroup: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
    filterGroupDesktop: { flexWrap: 'nowrap' },
    dropdownBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 160, flex: 1, justifyContent: 'space-between' },
    dropdownBtnText: { fontSize: 13, fontWeight: '600', color: '#334155', marginRight: 8, flex: 1 },
    chartLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
    modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    modalOptionText: { fontSize: 15, color: '#475569' }
});
