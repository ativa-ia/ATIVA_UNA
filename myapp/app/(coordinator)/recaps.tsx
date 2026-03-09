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
import { CoordinatorRecapGroup, getCoordinatorRecaps } from '@/services/api';

export default function RecapsScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [groups, setGroups] = useState<CoordinatorRecapGroup[]>([]);
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    const load = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true); else setLoading(true);
            const result = await getCoordinatorRecaps();
            if (result.success) setGroups(result.subjects || []);
        } catch { } finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggle = (id: number) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const totalRecaps = groups.reduce((acc, g) => acc + g.recap_count, 0);

    return (
        <SafeAreaView style={s.safe}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><MaterialIcons name="arrow-back-ios" size={20} color="#fff" /></TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>Recaps das Aulas</Text>
                    <Text style={s.headerSub}>{totalRecaps} recaps em {groups.length} disciplinas</Text>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
                    {groups.length === 0 ? (
                        <View style={s.emptyBox}><MaterialIcons name="history-edu" size={40} color="#cbd5e1" /><Text style={s.emptyText}>Nenhum recap disponível</Text></View>
                    ) : groups.map((group) => {
                        const isOpen = expanded[group.subject_id] ?? true;
                        return (
                            <View key={group.subject_id} style={s.groupCard}>
                                <TouchableOpacity style={s.groupHeader} onPress={() => toggle(group.subject_id)}>
                                    <View style={s.groupIcon}><MaterialIcons name="menu-book" size={18} color="#6366f1" /></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.groupName}>{group.subject_name}</Text>
                                        <Text style={s.groupCode}>{group.subject_code} · {group.recap_count} recaps</Text>
                                    </View>
                                    <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={24} color="#64748b" />
                                </TouchableOpacity>

                                {isOpen && group.recaps.map((recap) => (
                                    <View key={recap.id} style={s.recapRow}>
                                        <View style={s.recapTimeline}><View style={s.recapDot} /></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.recapTitle}>{recap.title || 'Recap sem título'}</Text>
                                            <Text style={s.recapMeta}>
                                                {recap.teacher_name} · {formatDate(recap.created_at)}
                                            </Text>
                                            {recap.ai_summary ? (
                                                <Text style={s.recapSummary} numberOfLines={3}>{recap.ai_summary}</Text>
                                            ) : null}
                                            <View style={s.recapTags}>
                                                {recap.shared_with_students && (
                                                    <View style={s.sharedTag}><MaterialIcons name="share" size={12} color="#16a34a" /><Text style={s.sharedTagText}>Compartilhado</Text></View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                ))}
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
    header: { paddingHorizontal: spacing.md, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.md },
    emptyBox: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#94a3b8', fontSize: 15, marginTop: 10 },
    groupCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
    groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    groupIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    groupName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    groupCode: { fontSize: 12, color: '#64748b', marginTop: 2 },
    recapRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    recapTimeline: { width: 24, alignItems: 'center', paddingTop: 16 },
    recapDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1' },
    recapTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', paddingTop: 12 },
    recapMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    recapSummary: { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 18 },
    recapTags: { flexDirection: 'row', gap: 6, marginTop: 8 },
    sharedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    sharedTagText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
});
