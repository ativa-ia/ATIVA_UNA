import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet,
    Text, TextInput, TouchableWithoutFeedback, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { CourseStudent, getCoordinatorStudents, getCoordinatorSubjects, CoordinatorSubject } from '@/services/api';

export default function StudentsScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [students, setStudents] = useState<CourseStudent[]>([]);
    const [subjects, setSubjects] = useState<CoordinatorSubject[]>([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterSubject, setFilterSubject] = useState<number | undefined>();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true); else setLoading(true);
            const [studentsRes, subjectsRes] = await Promise.all([
                getCoordinatorStudents({ search, status: filterStatus || undefined, class_subject_id: filterSubject }),
                getCoordinatorSubjects(),
            ]);
            if (studentsRes.success) setStudents(studentsRes.students || []);
            if (subjectsRes.success) setSubjects(subjectsRes.subjects || []);
        } catch { } finally { setLoading(false); setRefreshing(false); }
    }, [search, filterStatus, filterSubject]);

    useEffect(() => { load(); }, [load]);

    const statusBadge = (status: string) => {
        if (status === 'needs_help') return { bg: '#fee2e2', text: '#b91c1c', label: 'Risco de Evasão' };
        if (status === 'attention') return { bg: '#fef3c7', text: '#92400e', label: 'Distante' };
        if (status === 'doing_well') return { bg: '#dcfce7', text: '#166534', label: 'Engajado' };
        return { bg: '#e2e8f0', text: '#334155', label: 'Sem dados' };
    };

    const statuses = [
        { key: '', label: 'Todos' },
        { key: 'needs_help', label: 'Risco Evasão' },
        { key: 'attention', label: 'Distantes' },
        { key: 'doing_well', label: 'Engajados' },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><MaterialIcons name="arrow-back-ios" size={20} color="#fff" /></TouchableOpacity>
                <Text style={s.headerTitle}>Alunos do Curso</Text>
                <View style={s.badge}><Text style={s.badgeText}>{students.length}</Text></View>
            </LinearGradient>

            <View style={s.filtersWrap}>
                <View style={s.searchRow}>
                    <MaterialIcons name="search" size={18} color="#94a3b8" />
                    <TextInput style={s.searchInput} placeholder="Buscar por nome ou matrícula..." placeholderTextColor="#94a3b8" value={search} onChangeText={setSearch} onSubmitEditing={() => load()} returnKeyType="search" />
                </View>
                <TouchableOpacity style={s.subjectDropdownBtn} onPress={() => setDropdownOpen(true)}>
                    <MaterialIcons name="menu-book" size={18} color="#6366f1" />
                    <Text style={s.subjectDropdownText} numberOfLines={1}>
                        {filterSubject ? subjects.find(sub => (sub.class_subject_id || sub.id) === filterSubject)?.name : 'Todas as Disciplinas'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color="#64748b" />
                </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChips}>
                    {statuses.map((st) => (
                        <TouchableOpacity key={st.key} style={[s.chip, filterStatus === st.key && s.chipActive]} onPress={() => setFilterStatus(st.key)}>
                            <Text style={[s.chipText, filterStatus === st.key && s.chipTextActive]}>{st.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
                    {students.length === 0 ? (
                        <View style={s.emptyBox}><MaterialIcons name="people" size={40} color="#cbd5e1" /><Text style={s.emptyText}>Nenhum aluno encontrado</Text></View>
                    ) : students.map((st) => {
                        const badge = statusBadge(st.status);
                        return (
                            <View key={st.student_id} style={s.card}>
                                <View style={s.cardRow}>
                                    <View style={s.avatar}><MaterialIcons name="person" size={20} color="#475569" /></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.name}>{st.student_name}</Text>
                                        <Text style={s.email}>{st.registration_number || st.email}</Text>
                                    </View>
                                    <View style={[s.statusBadgeLbl, { backgroundColor: badge.bg }]}><Text style={[s.statusBadgeText, { color: badge.text }]}>{badge.label}</Text></View>
                                </View>
                                <View style={s.metricsRow}>
                                    <View style={s.metricBox}>
                                        <MaterialIcons name="event-available" size={18} color="#3b82f6" />
                                        <Text style={[s.metricValue, { marginTop: 4 }]}>{st.attendance_count}</Text>
                                        <Text style={s.metricLabel}>Aulas Pres.</Text>
                                    </View>
                                    <View style={[s.metricBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#f1f5f9' }]}>
                                        <MaterialIcons name="psychology" size={18} color="#8b5cf6" />
                                        <Text style={[s.metricValue, { marginTop: 4 }]}>{st.socratic_sessions}</Text>
                                        <Text style={s.metricLabel}>Dúvidas c/ IA</Text>
                                    </View>
                                    <View style={s.metricBox}>
                                        <MaterialIcons name="history" size={18} color={st.days_inactive > 14 ? "#ef4444" : "#10b981"} />
                                        <Text style={[s.metricValue, { marginTop: 4, color: st.days_inactive > 14 ? '#ef4444' : '#1e293b' }]}>
                                            {st.days_inactive}d
                                        </Text>
                                        <Text style={s.metricLabel}>Inativo</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* Subject Dropdown Modal */}
            <Modal visible={dropdownOpen} transparent animationType="fade">
                <TouchableWithoutFeedback onPress={() => setDropdownOpen(false)}>
                    <View style={s.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={s.dropdownContent}>
                                <Text style={s.modalTitle}>Filtrar por Disciplina</Text>
                                <ScrollView style={{ maxHeight: 300 }} indicatorStyle="black">
                                    <TouchableOpacity style={s.modalOption} onPress={() => { setFilterSubject(undefined); setDropdownOpen(false); }}>
                                        <Text style={[s.modalOptionText, filterSubject === undefined && { color: '#6366f1', fontWeight: 'bold' }]}>Todas as Disciplinas</Text>
                                    </TouchableOpacity>
                                    {subjects.map(sub => {
                                        const actId = sub.class_subject_id || sub.id;
                                        return (
                                            <TouchableOpacity key={actId} style={s.modalOption} onPress={() => { setFilterSubject(actId); setDropdownOpen(false); }}>
                                                <Text style={[s.modalOptionText, filterSubject === actId && { color: '#6366f1', fontWeight: 'bold' }]}>{sub.name}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
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
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 14 },
    backBtn: { marginRight: 12 },
    headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    filtersWrap: { backgroundColor: '#fff', paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 10 },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#1e293b' },
    subjectDropdownBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#e2e8f0' },
    subjectDropdownText: { flex: 1, marginLeft: 8, fontSize: 13, color: '#475569', fontWeight: '500' },
    filterChips: { flexDirection: 'row', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    chipTextActive: { color: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.md },
    emptyBox: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#94a3b8', fontSize: 15, marginTop: 10 },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    name: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
    email: { fontSize: 12, color: '#64748b', marginTop: 2 },
    statusBadgeLbl: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusBadgeText: { fontSize: 11, fontWeight: '600' },
    metricsRow: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    metricBox: { flex: 1, alignItems: 'center' },
    metricValue: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    metricLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    dropdownContent: { width: '80%', backgroundColor: '#fff', borderRadius: 14, padding: 16, maxHeight: '70%' },
    modalTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
    modalOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalOptionText: { fontSize: 14, color: '#475569' },
});
