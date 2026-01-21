import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { API_URL, getAllSettings, updateSetting } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SystemHealth } from '@/components/admin/SystemHealth';
import { AIConfiguration } from '@/components/admin/AIConfiguration';

type AdminAction = 'user' | 'subject' | 'enroll' | 'teach' | null;

export default function AdminDashboard() {
    const insets = useSafeAreaInsets();
    const [activeAction, setActiveAction] = useState<AdminAction>(null);
    const [loading, setLoading] = useState(false);

    // Data Lists
    const [users, setUsers] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [settingsList, setSettingsList] = useState<any[]>([]);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState('Admin');

    // Form States
    const [formData, setFormData] = useState({
        email: '', password: '', name: '', role: 'student', // User
        subjectName: '', subjectCode: '', credits: '4', // Subject
        studentId: '', subjectId: '', // Enroll
        teacherId: '', // Teach
        settingKey: '', settingValue: '', settingDesc: '', // Settings
    });

    useEffect(() => {
        fetchData();
        getUserName();
    }, []);

    const getUserName = async () => {
        const name = await AsyncStorage.getItem('userName');
        if (name) setUserName(name);
    }

    const fetchData = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const storedRole = await AsyncStorage.getItem('userRole');
            setUserRole(storedRole);

            const headers = { 'Authorization': `Bearer ${token}` };

            const [usersRes, subjectsRes] = await Promise.all([
                fetch(`${API_URL}/admin/users`, { headers }),
                fetch(`${API_URL}/admin/subjects`, { headers })
            ]);

            const usersData = await usersRes.json();
            const subjectsData = await subjectsRes.json();

            if (usersData.success) setUsers(usersData.users);
            if (subjectsData.success) setSubjects(subjectsData.subjects);

            if (storedRole === 'super_admin') {
                const settingsRes = await getAllSettings();
                if (settingsRes.success) setSettingsList(settingsRes.settings);
            }

        } catch (error) {
            console.error('Erro ao buscar dados:', error);
        }
    };

    const handleAction = async (endpoint: string, payload: any) => {
        setLoading(true);
        try {
            let success = false;
            let message = '';

            if (endpoint === 'settings') {
                const res = await updateSetting(payload);
                success = res.success;
                message = res.message || '';
            } else {
                const token = await AsyncStorage.getItem('authToken');
                const response = await fetch(`${API_URL}/admin/${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                success = data.success;
                message = data.message;
            }

            if (success) {
                Alert.alert('Sucesso', message);
                // Only reset activeAction if it's not settings (since settings is always visible)
                if (endpoint !== 'settings') {
                    setActiveAction(null);
                }
                fetchData(); // Refresh lists
                setFormData({
                    email: '', password: '', name: '', role: 'student',
                    subjectName: '', subjectCode: '', credits: '4',
                    studentId: '', subjectId: '',
                    teacherId: '',
                    settingKey: '', settingValue: '', settingDesc: '',
                });
            } else {
                Alert.alert('Erro', message || 'Falha na operação');
            }
        } catch (error) {
            Alert.alert('Erro', 'Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    const renderDataList = () => {
        if (!activeAction) return null;

        return (
            <View style={styles.listContainer}>
                <Text style={styles.listTitle}>Dados Disponíveis (Toque para preencher)</Text>

                <View style={styles.listsRow}>
                    {/* Users List */}
                    <View style={styles.listColumn}>
                        <Text style={styles.columnHeader}>Usuários</Text>
                        {users.map(u => (
                            <TouchableOpacity
                                key={u.id}
                                style={styles.listItem}
                                onPress={() => {
                                    if (activeAction === 'enroll') setFormData({ ...formData, studentId: u.id.toString() });
                                    if (activeAction === 'teach') setFormData({ ...formData, teacherId: u.id.toString() });
                                }}
                            >
                                <Text style={styles.listItemTitle}>{u.name} (ID: {u.id})</Text>
                                <Text style={styles.listItemSubtitle}>{u.role} - {u.email}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Subjects List */}
                    <View style={styles.listColumn}>
                        <Text style={styles.columnHeader}>Disciplinas</Text>
                        {subjects.map(s => (
                            <TouchableOpacity
                                key={s.id}
                                style={styles.listItem}
                                onPress={() => setFormData({ ...formData, subjectId: s.id.toString() })}
                            >
                                <Text style={styles.listItemTitle}>{s.name} (ID: {s.id})</Text>
                                <Text style={styles.listItemSubtitle}>{s.code}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        );
    };

    const renderForm = () => {
        switch (activeAction) {
            case 'user':
                return (
                    <View style={styles.form}>
                        <Text style={styles.formTitle}>Novo Usuário</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nome"
                            placeholderTextColor={colors.zinc400}
                            value={formData.name}
                            onChangeText={t => setFormData({ ...formData, name: t })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={colors.zinc400}
                            value={formData.email}
                            onChangeText={t => setFormData({ ...formData, email: t })}
                            autoCapitalize="none"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Senha"
                            placeholderTextColor={colors.zinc400}
                            value={formData.password}
                            onChangeText={t => setFormData({ ...formData, password: t })}
                            secureTextEntry
                        />
                        <View style={styles.roleContainer}>
                            <TouchableOpacity
                                style={[styles.roleButton, formData.role === 'student' && styles.roleButtonActive]}
                                onPress={() => setFormData({ ...formData, role: 'student' })}
                            >
                                <Text style={[styles.roleText, formData.role === 'student' && styles.roleTextActive]}>Aluno</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleButton, formData.role === 'teacher' && styles.roleButtonActive]}
                                onPress={() => setFormData({ ...formData, role: 'teacher' })}
                            >
                                <Text style={[styles.roleText, formData.role === 'teacher' && styles.roleTextActive]}>Professor</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={() => handleAction('users', {
                                name: formData.name,
                                email: formData.email,
                                password: formData.password,
                                role: formData.role
                            })}
                        >
                            <Text style={styles.submitButtonText}>Criar Usuário</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 'subject':
                return (
                    <View style={styles.form}>
                        <Text style={styles.formTitle}>Nova Disciplina</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nome (ex: Cálculo I)"
                            placeholderTextColor={colors.zinc400}
                            value={formData.subjectName}
                            onChangeText={t => setFormData({ ...formData, subjectName: t })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Código (ex: MAT101)"
                            placeholderTextColor={colors.zinc400}
                            value={formData.subjectCode}
                            onChangeText={t => setFormData({ ...formData, subjectCode: t })}
                            autoCapitalize="characters"
                        />
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={() => handleAction('subjects', {
                                name: formData.subjectName,
                                code: formData.subjectCode,
                                credits: parseInt(formData.credits)
                            })}
                        >
                            <Text style={styles.submitButtonText}>Criar Disciplina</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 'enroll':
                return (
                    <View style={styles.form}>
                        <Text style={styles.formTitle}>Matricular Aluno</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="ID do Aluno (Toque na lista abaixo)"
                            placeholderTextColor={colors.zinc400}
                            value={formData.studentId}
                            onChangeText={t => setFormData({ ...formData, studentId: t })}
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="ID da Disciplina (Toque na lista abaixo)"
                            placeholderTextColor={colors.zinc400}
                            value={formData.subjectId}
                            onChangeText={t => setFormData({ ...formData, subjectId: t })}
                            keyboardType="numeric"
                        />
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={() => handleAction('enroll', {
                                student_id: parseInt(formData.studentId),
                                subject_id: parseInt(formData.subjectId)
                            })}
                        >
                            <Text style={styles.submitButtonText}>Matricular</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 'teach':
                return (
                    <View style={styles.form}>
                        <Text style={styles.formTitle}>Atribuir Professor</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="ID do Professor (Toque na lista abaixo)"
                            placeholderTextColor={colors.zinc400}
                            value={formData.teacherId}
                            onChangeText={t => setFormData({ ...formData, teacherId: t })}
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="ID da Disciplina (Toque na lista abaixo)"
                            placeholderTextColor={colors.zinc400}
                            value={formData.subjectId}
                            onChangeText={t => setFormData({ ...formData, subjectId: t })}
                            keyboardType="numeric"
                        />
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={() => handleAction('teach', {
                                teacher_id: parseInt(formData.teacherId),
                                subject_id: parseInt(formData.subjectId)
                            })}
                        >
                            <Text style={styles.submitButtonText}>Atribuir</Text>
                        </TouchableOpacity>
                    </View>
                );
            default:
                return null;
        }
    };

    const renderSettingsSection = () => {
        if (userRole !== 'super_admin') return null;

        return (
            <View style={styles.settingsSection}>

                <View style={styles.settingsHeader}>
                    <MaterialIcons name="settings" size={24} color={colors.danger} />
                    <Text style={styles.settingsTitle}>Configurações do Sistema</Text>
                </View>

                <SystemHealth />
                <AIConfiguration />

                <View style={styles.formContainer}>
                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Nova Palavra de Ativação (ex: Assistente)"
                            placeholderTextColor={colors.zinc400}
                            value={formData.settingValue}
                            onChangeText={t => setFormData({ ...formData, settingValue: t })}
                        />

                        <TouchableOpacity
                            style={[styles.submitButton, { backgroundColor: colors.danger }]}
                            onPress={() => handleAction('settings', {
                                key: 'trigger_word',
                                value: formData.settingValue,
                                description: 'Palavra de ativação para comandos de voz',
                                is_public: true
                            })}
                        >
                            <Text style={styles.submitButtonText}>Salvar Configuração</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Settings List */}
                <View style={[styles.listColumn, { marginTop: spacing['2xl'] }]}>
                    <Text style={styles.columnHeader}>Variáveis Ativas</Text>
                    {settingsList.map(s => (
                        <TouchableOpacity
                            key={s.key}
                            style={styles.listItem}
                            onPress={() => setFormData({
                                ...formData,
                                settingKey: s.key,
                                settingValue: s.value,
                                settingDesc: s.description || ''
                            })}
                        >
                            <Text style={styles.listItemTitle}>{s.key}</Text>
                            <Text style={styles.listItemSubtitle}>{s.value}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    // Get current date string 
    const getCurrentDate = () => {
        const date = new Date();
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            day: 'numeric',
            month: 'short'
        };
        const formatted = date.toLocaleDateString('pt-BR', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    return (
        <View style={styles.container}>
            {/* Gradient Header */}
            <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.headerGradient, { paddingTop: insets.top + spacing.md }]}
            >
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.greeting}>Painel Admin</Text>
                        <Text style={styles.date}>{userName} • {getCurrentDate()}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => router.replace('/(auth)/login')}
                    >
                        <MaterialIcons name="logout" size={20} color={colors.white} />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.grid}>
                    <TouchableOpacity style={styles.card} onPress={() => setActiveAction('user')}>
                        <View style={[styles.iconBg, { backgroundColor: colors.info }]}>
                            <MaterialIcons name="person-add" size={28} color={colors.white} />
                        </View>
                        <Text style={styles.cardText}>Criar Usuário</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={() => setActiveAction('subject')}>
                        <View style={[styles.iconBg, { backgroundColor: colors.secondary }]}>
                            <MaterialIcons name="library-add" size={28} color={colors.white} />
                        </View>
                        <Text style={styles.cardText}>Criar Disciplina</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={() => setActiveAction('enroll')}>
                        <View style={[styles.iconBg, { backgroundColor: colors.warning }]}>
                            <MaterialIcons name="school" size={28} color={colors.white} />
                        </View>
                        <Text style={styles.cardText}>Matricular</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={() => setActiveAction('teach')}>
                        <View style={[styles.iconBg, { backgroundColor: colors.accent }]}>
                            <MaterialIcons name="work" size={28} color={colors.white} />
                        </View>
                        <Text style={styles.cardText}>Atribuir Prof</Text>
                    </TouchableOpacity>
                </View>

                {activeAction && (
                    <View>
                        <View style={styles.formContainer}>
                            {renderForm()}
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setActiveAction(null)}
                            >
                                <Text style={styles.closeButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                        {renderDataList()}
                    </View>
                )}

                {renderSettingsSection()}
            </ScrollView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundLight, // Light mode background
    },
    headerGradient: {
        paddingHorizontal: spacing.base,
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
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: spacing.base,
        paddingBottom: 40,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.base,
        justifyContent: 'space-between',
        marginTop: spacing.md,
    },
    card: {
        width: '47%',
        backgroundColor: colors.white,
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        // Shadow for depth
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: spacing.xs,
    },
    iconBg: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    cardText: {
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        fontSize: typography.fontSize.sm,
    },
    formContainer: {
        marginTop: spacing.xl,
        backgroundColor: colors.white,
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        // Shadow for depth
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    form: {
        gap: spacing.md,
    },
    formTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.slate100,
        padding: spacing.md,
        borderRadius: borderRadius.default,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    roleContainer: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    roleButton: {
        flex: 1,
        padding: spacing.md,
        backgroundColor: colors.slate100,
        borderRadius: borderRadius.default,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    roleButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    roleText: {
        color: colors.textSecondary,
        fontWeight: typography.fontWeight.semibold,
    },
    roleTextActive: {
        color: colors.white,
    },
    submitButton: {
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.default,
        alignItems: 'center',
        marginTop: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonText: {
        color: colors.white,
        fontWeight: typography.fontWeight.bold,
        fontSize: typography.fontSize.base,
    },
    closeButton: {
        marginTop: spacing.md,
        alignItems: 'center',
    },
    closeButtonText: {
        color: colors.zinc500,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        marginTop: spacing.lg,
    },
    listTitle: {
        color: colors.zinc500,
        marginBottom: spacing.sm,
        fontSize: typography.fontSize.sm,
    },
    listsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    listColumn: {
        flex: 1,
    },
    columnHeader: {
        color: colors.textPrimary,
        fontWeight: 'bold',
        marginBottom: spacing.sm,
    },
    listItem: {
        backgroundColor: colors.white,
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: colors.slate200,
    },
    listItemTitle: {
        color: colors.textPrimary,
        fontSize: typography.fontSize.xs,
        fontWeight: 'bold',
    },
    listItemSubtitle: {
        color: colors.zinc500,
        fontSize: 10,
    },
    settingsSection: {
        marginTop: spacing['2xl'],
        borderTopWidth: 1,
        borderTopColor: colors.slate200,
        paddingTop: spacing.lg,
    },
    settingsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    settingsTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
    },
});

