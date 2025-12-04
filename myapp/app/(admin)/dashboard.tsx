import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { API_URL } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AdminAction = 'user' | 'subject' | 'enroll' | 'teach' | null;

export default function AdminDashboard() {
    const insets = useSafeAreaInsets();
    const [activeAction, setActiveAction] = useState<AdminAction>(null);
    const [loading, setLoading] = useState(false);

    // Data Lists
    const [users, setUsers] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);

    // Form States
    const [formData, setFormData] = useState({
        email: '', password: '', name: '', role: 'student', // User
        subjectName: '', subjectCode: '', credits: '4', // Subject
        studentId: '', subjectId: '', // Enroll
        teacherId: '', // Teach
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const headers = { 'Authorization': `Bearer ${token}` };

            const [usersRes, subjectsRes] = await Promise.all([
                fetch(`${API_URL}/admin/users`, { headers }),
                fetch(`${API_URL}/admin/subjects`, { headers })
            ]);

            const usersData = await usersRes.json();
            const subjectsData = await subjectsRes.json();

            if (usersData.success) setUsers(usersData.users);
            if (subjectsData.success) setSubjects(subjectsData.subjects);

        } catch (error) {
            console.error('Erro ao buscar dados:', error);
        }
    };

    const handleAction = async (endpoint: string, payload: any) => {
        setLoading(true);
        try {
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

            if (data.success) {
                Alert.alert('Sucesso', data.message);
                setActiveAction(null);
                fetchData(); // Refresh lists
                setFormData({
                    email: '', password: '', name: '', role: 'student',
                    subjectName: '', subjectCode: '', credits: '4',
                    studentId: '', subjectId: '',
                    teacherId: '',
                });
            } else {
                Alert.alert('Erro', data.message || 'Falha na operação');
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
                            placeholderTextColor={colors.zinc500}
                            value={formData.name}
                            onChangeText={t => setFormData({ ...formData, name: t })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={colors.zinc500}
                            value={formData.email}
                            onChangeText={t => setFormData({ ...formData, email: t })}
                            autoCapitalize="none"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Senha"
                            placeholderTextColor={colors.zinc500}
                            value={formData.password}
                            onChangeText={t => setFormData({ ...formData, password: t })}
                            secureTextEntry
                        />
                        <View style={styles.roleContainer}>
                            <TouchableOpacity
                                style={[styles.roleButton, formData.role === 'student' && styles.roleButtonActive]}
                                onPress={() => setFormData({ ...formData, role: 'student' })}
                            >
                                <Text style={styles.roleText}>Aluno</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleButton, formData.role === 'teacher' && styles.roleButtonActive]}
                                onPress={() => setFormData({ ...formData, role: 'teacher' })}
                            >
                                <Text style={styles.roleText}>Professor</Text>
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
                            placeholderTextColor={colors.zinc500}
                            value={formData.subjectName}
                            onChangeText={t => setFormData({ ...formData, subjectName: t })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Código (ex: MAT101)"
                            placeholderTextColor={colors.zinc500}
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
                            placeholderTextColor={colors.zinc500}
                            value={formData.studentId}
                            onChangeText={t => setFormData({ ...formData, studentId: t })}
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="ID da Disciplina (Toque na lista abaixo)"
                            placeholderTextColor={colors.zinc500}
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
                            placeholderTextColor={colors.zinc500}
                            value={formData.teacherId}
                            onChangeText={t => setFormData({ ...formData, teacherId: t })}
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="ID da Disciplina (Toque na lista abaixo)"
                            placeholderTextColor={colors.zinc500}
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Painel Admin</Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                    <MaterialIcons name="logout" size={24} color={colors.zinc400} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.grid}>
                    <TouchableOpacity style={styles.card} onPress={() => setActiveAction('user')}>
                        <View style={[styles.iconBg, { backgroundColor: '#3B82F6' }]}>
                            <MaterialIcons name="person-add" size={32} color="white" />
                        </View>
                        <Text style={styles.cardText}>Criar Usuário</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={() => setActiveAction('subject')}>
                        <View style={[styles.iconBg, { backgroundColor: '#10b981' }]}>
                            <MaterialIcons name="library-add" size={32} color="white" />
                        </View>
                        <Text style={styles.cardText}>Criar Disciplina</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={() => setActiveAction('enroll')}>
                        <View style={[styles.iconBg, { backgroundColor: '#f59e0b' }]}>
                            <MaterialIcons name="school" size={32} color="white" />
                        </View>
                        <Text style={styles.cardText}>Matricular</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={() => setActiveAction('teach')}>
                        <View style={[styles.iconBg, { backgroundColor: '#8b5cf6' }]}>
                            <MaterialIcons name="work" size={32} color="white" />
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
        backgroundColor: colors.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc800,
    },
    headerTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        fontFamily: typography.fontFamily.display,
    },
    content: {
        padding: spacing.base,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.base,
        justifyContent: 'space-between',
    },
    card: {
        width: '47%',
        backgroundColor: colors.zinc900,
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.zinc800,
    },
    iconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    cardText: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
    },
    formContainer: {
        marginTop: spacing.xl,
        backgroundColor: colors.zinc900,
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.zinc800,
    },
    form: {
        gap: spacing.md,
    },
    formTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.zinc800,
        padding: spacing.md,
        borderRadius: borderRadius.default,
        color: colors.white,
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    roleContainer: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    roleButton: {
        flex: 1,
        padding: spacing.md,
        backgroundColor: colors.zinc800,
        borderRadius: borderRadius.default,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.zinc700,
    },
    roleButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    roleText: {
        color: colors.white,
        fontWeight: typography.fontWeight.semibold,
    },
    submitButton: {
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.default,
        alignItems: 'center',
        marginTop: spacing.sm,
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
        color: colors.zinc400,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        marginTop: spacing.lg,
    },
    listTitle: {
        color: colors.zinc400,
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
        color: colors.white,
        fontWeight: 'bold',
        marginBottom: spacing.xs,
    },
    listItem: {
        backgroundColor: colors.zinc900,
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: colors.zinc800,
    },
    listItemTitle: {
        color: colors.white,
        fontSize: typography.fontSize.xs,
        fontWeight: 'bold',
    },
    listItemSubtitle: {
        color: colors.zinc500,
        fontSize: 10,
    },
});
