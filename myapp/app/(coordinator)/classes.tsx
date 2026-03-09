import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { CourseClass, CourseClassDetails, getCoordinatorClasses, getCoordinatorClassDetails, createCourseClass, updateCourseClass, deleteCourseClass } from '@/services/api';

export default function ClassesScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [classes, setClasses] = useState<CourseClass[]>([]);

    // Create/Edit form states
    const [modalVisible, setModalVisible] = useState(false);
    const [editingClass, setEditingClass] = useState<CourseClass | null>(null);
    const [form, setForm] = useState({ name: '', semester: '', year: String(new Date().getFullYear()) });
    const [saving, setSaving] = useState(false);

    // Details view states
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [classDetails, setClassDetails] = useState<CourseClassDetails | null>(null);
    const [detailsTab, setDetailsTab] = useState<'students' | 'teachers'>('students');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<number | 'all'>('all');

    const load = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true); else setLoading(true);
            const result = await getCoordinatorClasses();
            if (result.success) setClasses(result.classes || []);
        } catch { } finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => { setEditingClass(null); setForm({ name: '', semester: '', year: String(new Date().getFullYear()) }); setModalVisible(true); };
    const openEdit = (cls: CourseClass) => { setEditingClass(cls); setForm({ name: cls.name, semester: cls.semester, year: String(cls.year) }); setModalVisible(true); };

    const handleSave = async () => {
        if (!form.name.trim() || !form.semester.trim()) { Alert.alert('Erro', 'Preencha nome e semestre'); return; }
        setSaving(true);
        try {
            if (editingClass) {
                await updateCourseClass(editingClass.id, { name: form.name, semester: form.semester, year: Number(form.year) });
            } else {
                await createCourseClass({ name: form.name, semester: form.semester, year: Number(form.year) });
            }
            setModalVisible(false);
            load();
        } catch { Alert.alert('Erro', 'Falha ao salvar turma'); } finally { setSaving(false); }
    };

    const handleDelete = (cls: CourseClass) => {
        Alert.alert('Fechar Turma', `Deseja fechar "${cls.name}"? Todas as matrículas e vínculos serão removidos.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Fechar', style: 'destructive', onPress: async () => { await deleteCourseClass(cls.id); load(); } },
        ]);
    };

    const openDetails = async (cls: CourseClass) => {
        setDetailsModalVisible(true);
        setDetailsLoading(true);
        setDetailsTab('students');
        setSearchQuery('');
        setSelectedSubject('all');
        try {
            const res = await getCoordinatorClassDetails(cls.id);
            if (res.success) setClassDetails(res as any);
        } catch {
            Alert.alert('Erro', 'Falha ao carregar detalhes da turma');
        } finally {
            setDetailsLoading(false);
        }
    };

    const filteredStudents = classDetails?.students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSubject = selectedSubject === 'all' || s.enrolled_subjects.some(subj => subj.id === selectedSubject);
        return matchesSearch && matchesSubject;
    }) || [];

    const filteredTeachers = classDetails?.teachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSubject = selectedSubject === 'all' || t.subjects.some(subj => subj.id === selectedSubject);
        return matchesSearch && matchesSubject;
    }) || [];

    return (
        <SafeAreaView style={s.safe}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><MaterialIcons name="arrow-back-ios" size={20} color="#fff" /></TouchableOpacity>
                <Text style={s.headerTitle}>Gestão de Turmas</Text>
                <TouchableOpacity onPress={openCreate} style={s.addBtn}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity>
            </LinearGradient>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
                    {classes.length === 0 ? (
                        <View style={s.emptyBox}><MaterialIcons name="class" size={40} color="#cbd5e1" /><Text style={s.emptyText}>Nenhuma turma cadastrada</Text>
                            <TouchableOpacity style={s.emptyBtn} onPress={openCreate}><Text style={s.emptyBtnText}>+ Criar Turma</Text></TouchableOpacity></View>
                    ) : classes.map((cls) => (
                        <View key={cls.id} style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.cardTitle}>{cls.name}</Text>
                                    <Text style={s.cardSub}>{cls.semester} · {cls.year}</Text>
                                </View>
                                <View style={s.cardActions}>
                                    <TouchableOpacity onPress={() => openDetails(cls)} style={s.iconBtn}><MaterialIcons name="visibility" size={18} color="#10b981" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => openEdit(cls)} style={s.iconBtn}><MaterialIcons name="edit" size={18} color="#6366f1" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(cls)} style={s.iconBtn}><MaterialIcons name="delete-outline" size={18} color="#ef4444" /></TouchableOpacity>
                                </View>
                            </View>
                            <View style={s.cardStats}>
                                <View style={s.stat}><MaterialIcons name="people" size={16} color="#3b82f6" /><Text style={s.statText}>{cls.student_count} alunos</Text></View>
                                <View style={s.stat}><MaterialIcons name="school" size={16} color="#8b5cf6" /><Text style={s.statText}>{cls.teacher_count} professores</Text></View>
                            </View>
                            {cls.subjects.length > 0 && (
                                <View style={s.tagRow}>{cls.subjects.map((subj, i) => (<View key={i} style={s.tag}><Text style={s.tagText}>{subj}</Text></View>))}</View>
                            )}
                        </View>
                    ))}
                </ScrollView>
            )}

            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={s.modalOverlay}>
                    <View style={s.modal}>
                        <Text style={s.modalTitle}>{editingClass ? 'Editar Turma' : 'Nova Turma'}</Text>
                        <TextInput style={s.input} placeholder="Nome da turma" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
                        <TextInput style={s.input} placeholder="Semestre (ex: 2025.1)" value={form.semester} onChangeText={(t) => setForm({ ...form, semester: t })} />
                        <TextInput style={s.input} placeholder="Ano" value={form.year} onChangeText={(t) => setForm({ ...form, year: t })} keyboardType="numeric" />
                        <View style={s.modalActions}>
                            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
                            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveText}>{editingClass ? 'Salvar' : 'Criar'}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal de Detalhes da Turma */}
            <Modal visible={detailsModalVisible} transparent animationType="slide">
                <View style={s.detailsOverlay}>
                    <View style={s.detailsModal}>
                        <View style={s.detailsHeaderRow}>
                            <View>
                                <Text style={s.detailsTitle}>Raio-X da Turma</Text>
                                <Text style={s.detailsSubtitle}>{classDetails?.class_info.name || 'Carregando...'} • {classDetails?.class_info.semester}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDetailsModalVisible(false)} style={s.closeDetailsBtn}>
                                <MaterialIcons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {detailsLoading ? (
                            <View style={[s.center, { minHeight: 200 }]}><ActivityIndicator size="large" color="#6366f1" /></View>
                        ) : classDetails ? (
                            <>
                                {/* Abas */}
                                <View style={s.tabsRow}>
                                    <TouchableOpacity style={[s.tab, detailsTab === 'students' && s.tabActive]} onPress={() => setDetailsTab('students')}>
                                        <MaterialIcons name="people" size={18} color={detailsTab === 'students' ? '#6366f1' : '#64748b'} />
                                        <Text style={[s.tabText, detailsTab === 'students' && s.tabTextActive]}>Alunos ({classDetails.students.length})</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[s.tab, detailsTab === 'teachers' && s.tabActive]} onPress={() => setDetailsTab('teachers')}>
                                        <MaterialIcons name="school" size={18} color={detailsTab === 'teachers' ? '#6366f1' : '#64748b'} />
                                        <Text style={[s.tabText, detailsTab === 'teachers' && s.tabTextActive]}>Professores ({classDetails.teachers.length})</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Filtros */}
                                <View style={s.filtersContainer}>
                                    <View style={s.searchBox}>
                                        <MaterialIcons name="search" size={20} color="#94a3b8" />
                                        <TextInput
                                            style={s.searchInput}
                                            placeholder={`Buscar ${detailsTab === 'students' ? 'aluno' : 'professor'}...`}
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                        />
                                    </View>

                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.subjectFilters} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
                                        <TouchableOpacity
                                            style={[s.filterChip, selectedSubject === 'all' && s.filterChipActive]}
                                            onPress={() => setSelectedSubject('all')}
                                        >
                                            <Text style={[s.filterChipText, selectedSubject === 'all' && s.filterChipTextActive]}>Todas</Text>
                                        </TouchableOpacity>
                                        {classDetails.subjects.map(subj => (
                                            <TouchableOpacity
                                                key={subj.id}
                                                style={[s.filterChip, selectedSubject === subj.id && s.filterChipActive]}
                                                onPress={() => setSelectedSubject(subj.id)}
                                            >
                                                <Text style={[s.filterChipText, selectedSubject === subj.id && s.filterChipTextActive]}>{subj.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Lista */}
                                <ScrollView style={s.detailsList} contentContainerStyle={{ paddingBottom: 20, gap: 12 }}>
                                    {detailsTab === 'students' ? (
                                        filteredStudents.length === 0 ? (
                                            <Text style={s.noResults}>Nenhum aluno encontrado.</Text>
                                        ) : filteredStudents.map(student => (
                                            <View key={student.id} style={s.personCard}>
                                                <View style={s.personHeader}>
                                                    <View style={s.avatar}><Text style={s.avatarText}>{student.name.charAt(0).toUpperCase()}</Text></View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={s.personName}>{student.name}</Text>
                                                        <Text style={s.personEmail}>{student.email}</Text>
                                                    </View>
                                                </View>
                                                <View style={s.personSubjects}>
                                                    <Text style={s.enrolledLabel}>Matriculado em:</Text>
                                                    <View style={s.tagRow}>
                                                        {student.enrolled_subjects.map(subj => (
                                                            <View key={subj.id} style={s.tag}><Text style={s.tagText}>{subj.name}</Text></View>
                                                        ))}
                                                    </View>
                                                </View>
                                            </View>
                                        ))
                                    ) : (
                                        filteredTeachers.length === 0 ? (
                                            <Text style={s.noResults}>Nenhum professor encontrado.</Text>
                                        ) : filteredTeachers.map(teacher => (
                                            <View key={teacher.id} style={s.personCard}>
                                                <View style={s.personHeader}>
                                                    <View style={[s.avatar, { backgroundColor: '#8b5cf6' }]}><Text style={s.avatarText}>{teacher.name.charAt(0).toUpperCase()}</Text></View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={s.personName}>{teacher.name}</Text>
                                                        <Text style={s.personEmail}>{teacher.email}</Text>
                                                    </View>
                                                </View>
                                                <View style={s.personSubjects}>
                                                    <Text style={s.enrolledLabel}>Leciona as matérias:</Text>
                                                    <View style={s.tagRow}>
                                                        {teacher.subjects.map(subj => (
                                                            <View key={subj.id} style={[s.tag, { backgroundColor: '#f3e8ff' }]}><Text style={[s.tagText, { color: '#8b5cf6' }]}>{subj.name}</Text></View>
                                                        ))}
                                                    </View>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </ScrollView>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 14 },
    backBtn: { marginRight: 12 },
    headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
    addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.md },
    emptyBox: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#94a3b8', fontSize: 15, marginTop: 10 },
    emptyBtn: { marginTop: 16, backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    emptyBtnText: { color: '#fff', fontWeight: '600' },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    cardSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
    cardActions: { flexDirection: 'row', gap: 8 },
    iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    cardStats: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statText: { fontSize: 13, color: '#475569', fontWeight: '500' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    tag: { backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    tagText: { fontSize: 11, color: '#6366f1', fontWeight: '600' },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
    modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, color: '#1e293b' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    cancelText: { color: '#64748b', fontWeight: '600' },
    saveBtn: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    saveText: { color: '#fff', fontWeight: '600' },

    // Details Modal
    detailsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.6)' },
    detailsModal: { backgroundColor: '#f8fafc', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%', width: '100%', maxWidth: 800, alignSelf: 'center', padding: 20 },
    detailsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    detailsTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    detailsSubtitle: { fontSize: 15, color: '#64748b', marginTop: 4 },
    closeDetailsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },

    tabsRow: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 4, marginBottom: 16 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 8 },
    tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    tabTextActive: { color: '#6366f1' },

    filtersContainer: { marginBottom: 16 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
    searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 15, color: '#0f172a' },
    subjectFilters: { flexGrow: 0, paddingBottom: 4 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
    filterChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    filterChipText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
    filterChipTextActive: { color: '#fff', fontWeight: '600' },

    detailsList: { flex: 1 },
    personCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    personHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    personName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    personEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
    personSubjects: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    enrolledLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 },
    noResults: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 15 },
});
