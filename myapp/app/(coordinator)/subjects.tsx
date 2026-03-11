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
import { CoordinatorSubject, getCoordinatorSubjects, updateCoordinatorSubject } from '@/services/api';

export default function SubjectsScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [subjects, setSubjects] = useState<CoordinatorSubject[]>([]);
    const [editModal, setEditModal] = useState(false);
    const [editSubject, setEditSubject] = useState<CoordinatorSubject | null>(null);
    const [form, setForm] = useState({ name: '', credits: '', description: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true); else setLoading(true);
            const result = await getCoordinatorSubjects();
            if (result.success) setSubjects(result.subjects || []);
        } catch { } finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openEdit = (subj: CoordinatorSubject) => {
        setEditSubject(subj);
        setForm({ name: subj.name, credits: String(subj.credits || 4), description: subj.description || '' });
        setEditModal(true);
    };

    const handleSave = async () => {
        if (!editSubject) return;
        setSaving(true);
        try {
            await updateCoordinatorSubject(editSubject.id, { name: form.name, credits: Number(form.credits), description: form.description });
            setEditModal(false);
            load();
        } catch { Alert.alert('Erro', 'Falha ao salvar'); } finally { setSaving(false); }
    };

    const openAnalytics = (subj: CoordinatorSubject) => {
        router.push({ pathname: '/(coordinator)/subject-analytics', params: { subjectId: String(subj.class_subject_id || subj.id), subjectName: subj.name } });
    };

    return (
        <SafeAreaView style={s.safe}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><MaterialIcons name="arrow-back-ios" size={20} color="#fff" /></TouchableOpacity>
                <Text style={s.headerTitle}>Disciplinas do Curso</Text>
                <View style={{ width: 36 }} />
            </LinearGradient>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
                    {subjects.length === 0 ? (
                        <View style={s.emptyBox}><MaterialIcons name="menu-book" size={40} color="#cbd5e1" /><Text style={s.emptyText}>Nenhuma disciplina encontrada</Text></View>
                    ) : subjects.map((subj) => (
                        <View key={subj.id} style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.cardTitle}>{subj.name}</Text>
                                    <Text style={s.cardCode}>{subj.code} · {subj.credits} créditos</Text>
                                </View>
                                <TouchableOpacity onPress={() => openEdit(subj)} style={s.iconBtn}><MaterialIcons name="edit" size={18} color="#6366f1" /></TouchableOpacity>
                            </View>
                            {subj.description ? <Text style={s.cardDesc} numberOfLines={2}>{subj.description}</Text> : null}
                            <View style={s.cardStats}>
                                <View style={s.stat}><MaterialIcons name="people" size={16} color="#3b82f6" /><Text style={s.statText}>{subj.enrolled_students} alunos</Text></View>
                                <View style={s.stat}><MaterialIcons name="school" size={16} color="#8b5cf6" /><Text style={s.statText}>{subj.teachers.length > 0 ? subj.teachers.join(', ') : 'Sem professor'}</Text></View>
                            </View>
                            <TouchableOpacity style={s.analyticsBtn} onPress={() => openAnalytics(subj)}>
                                <MaterialIcons name="bar-chart" size={16} color="#6366f1" />
                                <Text style={s.analyticsBtnText}>Ver Analytics</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            )}

            <Modal visible={editModal} transparent animationType="slide">
                <View style={s.modalOverlay}><View style={s.modal}>
                    <Text style={s.modalTitle}>Editar Disciplina</Text>
                    <Text style={s.modalSubtitle}>Nome</Text>
                    <TextInput style={s.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
                    <Text style={s.modalSubtitle}>Créditos (Carga Horária)</Text>
                    <TextInput style={s.input} value={form.credits} onChangeText={(t) => setForm({ ...form, credits: t })} keyboardType="numeric" />
                    <Text style={s.modalSubtitle}>Ementa / Descrição</Text>
                    <TextInput style={[s.input, s.textArea]} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} multiline numberOfLines={4} textAlignVertical="top" />
                    <View style={s.modalActions}>
                        <TouchableOpacity style={s.cancelBtn} onPress={() => setEditModal(false)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 14 },
    backBtn: { marginRight: 12 },
    headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.md },
    emptyBox: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#94a3b8', fontSize: 15, marginTop: 10 },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    cardCode: { fontSize: 12, color: '#64748b', marginTop: 2 },
    cardDesc: { fontSize: 13, color: '#475569', marginTop: 8, lineHeight: 18 },
    iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
    cardStats: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statText: { fontSize: 13, color: '#475569', fontWeight: '500', flexShrink: 1 },
    analyticsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, backgroundColor: '#eef2ff', borderRadius: 10 },
    analyticsBtnText: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
    modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
    modalSubtitle: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 4 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, color: '#1e293b' },
    textArea: { minHeight: 80 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    cancelText: { color: '#64748b', fontWeight: '600' },
    saveBtn: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    saveText: { color: '#fff', fontWeight: '600' },
});
