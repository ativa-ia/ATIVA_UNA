import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Platform, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { API_URL } from '@/services/api';

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<{ name: string; email: string; role: string; course_name?: string } | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                const res = await fetch(`${API_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const result = await res.json();
                if (result.success && result.user) setUser(result.user);
            } catch { } finally { setLoading(false); }
        })();
    }, []);

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) { Alert.alert('Erro', 'Preencha ambos os campos'); return; }
        if (newPassword.length < 6) { Alert.alert('Erro', 'Nova senha deve ter no mínimo 6 caracteres'); return; }
        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            });
            const data = await res.json();
            if (data.success) { Alert.alert('Sucesso', 'Senha alterada!'); setCurrentPassword(''); setNewPassword(''); }
            else Alert.alert('Erro', data.message || 'Falha ao alterar senha');
        } catch { Alert.alert('Erro', 'Erro de conexão'); } finally { setSaving(false); }
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('userRole');
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={s.safe}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="arrow-back-ios" size={20} color="#fff" /></TouchableOpacity>
                <Text style={s.headerTitle}>Configurações</Text>
                <View style={{ width: 20 }} />
            </LinearGradient>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <View style={s.content}>
                    <View style={s.card}>
                        <View style={s.avatarBig}><MaterialIcons name="person" size={32} color="#6366f1" /></View>
                        <Text style={s.name}>{user?.name || 'Coordenador'}</Text>
                        <Text style={s.email}>{user?.email}</Text>
                        <View style={s.roleBadge}><Text style={s.roleText}>Coordenador</Text></View>
                        {user?.course_name && <Text style={s.course}>{user.course_name}</Text>}
                    </View>

                    <View style={s.card}>
                        <Text style={s.cardTitle}>Alterar Senha</Text>
                        <TextInput style={s.input} placeholder="Senha atual" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
                        <TextInput style={s.input} placeholder="Nova senha" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleChangePassword} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Alterar Senha</Text>}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
                        <MaterialIcons name="logout" size={20} color="#ef4444" />
                        <Text style={s.logoutText}>Sair da conta</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f1f5f9' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 14 },
    headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 12 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: spacing.md },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    avatarBig: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    name: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
    email: { fontSize: 14, color: '#64748b', marginTop: 4 },
    roleBadge: { backgroundColor: '#eef2ff', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8, marginTop: 10 },
    roleText: { fontSize: 13, color: '#6366f1', fontWeight: '700' },
    course: { fontSize: 13, color: '#475569', marginTop: 8 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 14, alignSelf: 'flex-start' },
    input: { width: '100%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, color: '#1e293b' },
    saveBtn: { backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#fecaca' },
    logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
