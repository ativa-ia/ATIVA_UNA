import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { TeacherOverview, getCoordinatorTeachers } from '@/services/api';

export default function TeachersScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [teachers, setTeachers] = useState<TeacherOverview[]>([]);

    const load = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true); else setLoading(true);
            const result = await getCoordinatorTeachers();
            if (result.success) setTeachers(result.teachers || []);
        } catch { } finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Sem atividade';
        const d = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const isActive = (dateStr: string | null) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const diff = Date.now() - d.getTime();
        return diff < 7 * 24 * 60 * 60 * 1000; // 7 days
    };

    return (
        <SafeAreaView style={s.safe}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><MaterialIcons name="arrow-back-ios" size={20} color="#fff" /></TouchableOpacity>
                <Text style={s.headerTitle}>Professores do Curso</Text>
                <View style={s.badge}><Text style={s.badgeText}>{teachers.length}</Text></View>
            </LinearGradient>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
                    {teachers.length === 0 ? (
                        <View style={s.emptyBox}><MaterialIcons name="school" size={40} color="#cbd5e1" /><Text style={s.emptyText}>Nenhum professor encontrado</Text></View>
                    ) : teachers.map((t) => {
                        const active = isActive(t.last_activity);
                        return (
                            <View key={t.id} style={s.card}>
                                <View style={s.cardRow}>
                                    <View style={[s.avatar, { backgroundColor: active ? '#dbeafe' : '#f1f5f9' }]}>
                                        <MaterialIcons name="person" size={22} color={active ? '#3b82f6' : '#94a3b8'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={s.nameRow}>
                                            <Text style={s.name}>{t.name}</Text>
                                            <View style={[s.statusDot, { backgroundColor: active ? '#22c55e' : '#cbd5e1' }]} />
                                        </View>
                                        <Text style={s.email}>{t.email}</Text>
                                    </View>
                                </View>
                                <View style={s.statsRow}>
                                    <View style={s.statBox}><MaterialIcons name="menu-book" size={14} color="#6366f1" /><Text style={s.statLabel}>{t.subject_count} disciplinas</Text></View>
                                    <View style={s.statBox}><MaterialIcons name="mic" size={14} color="#06b6d4" /><Text style={s.statLabel}>{t.sessions_count} sessões</Text></View>
                                    <View style={s.statBox}><MaterialIcons name="schedule" size={14} color="#64748b" /><Text style={s.statLabel}>{formatDate(t.last_activity)}</Text></View>
                                </View>
                                {t.subjects.length > 0 && (
                                    <View style={s.tagRow}>{t.subjects.map((subj, i) => (<View key={i} style={s.tag}><Text style={s.tagText}>{subj}</Text></View>))}</View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            )}
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.md },
    emptyBox: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#94a3b8', fontSize: 15, marginTop: 10 },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    email: { fontSize: 12, color: '#64748b', marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexWrap: 'wrap' },
    statBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statLabel: { fontSize: 12, color: '#475569', fontWeight: '500' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    tag: { backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    tagText: { fontSize: 11, color: '#6366f1', fontWeight: '600' },
});
