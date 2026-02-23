import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { API_URL, getAllSettings, updateSetting, getCalendarEvents, createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SystemHealth } from '@/components/admin/SystemHealth';
import { AIConfiguration } from '@/components/admin/AIConfiguration';

type Tab = 'overview' | 'users' | 'subjects' | 'enroll' | 'teach' | 'events';
type RoleFilter = 'all' | 'student' | 'teacher' | 'admin';
type EventType = 'event' | 'notice';
type EventTargetRole = 'student' | 'teacher' | 'both';

const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Visão Geral', icon: 'dashboard' },
    { key: 'users', label: 'Usuários', icon: 'people' },
    { key: 'subjects', label: 'Disciplinas', icon: 'menu-book' },
    { key: 'enroll', label: 'Matrículas', icon: 'school' },
    { key: 'teach', label: 'Professores', icon: 'work' },
    { key: 'events', label: 'Eventos', icon: 'event-note' },
];

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'student', label: 'Alunos' },
    { key: 'teacher', label: 'Professores' },
    { key: 'admin', label: 'Admins' },
];

export default function AdminDashboard() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [loading, setLoading] = useState(false);

    // Data Lists
    const [users, setUsers] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [settingsList, setSettingsList] = useState<any[]>([]);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState('Admin');

    // Form States
    const [formData, setFormData] = useState({
        email: '', password: '', name: '', role: 'student',
        subjectName: '', subjectCode: '', credits: '4',
        settingKey: '', settingValue: '', settingDesc: '',
    });

    // User filter
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

    // Enroll / Teach: Search & Pick
    const [enrollSearch, setEnrollSearch] = useState({ student: '', subject: '' });
    const [enrollPick, setEnrollPick] = useState<{ studentId: number | null; subjectId: number | null }>({ studentId: null, subjectId: null });
    const [teachSearch, setTeachSearch] = useState({ teacher: '', subject: '' });
    const [teachPick, setTeachPick] = useState<{ teacherId: number | null; subjectId: number | null }>({ teacherId: null, subjectId: null });

    // Calendar events / notices
    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
    const [eventForm, setEventForm] = useState<{ title: string; description: string; eventDate: string; eventType: EventType; targetRole: EventTargetRole }>({
        title: '',
        description: '',
        eventDate: '',
        eventType: 'event',
        targetRole: 'both',
    });
    const [editingEventId, setEditingEventId] = useState<number | null>(null);

    // Subject detail modal
    const [detailSubject, setDetailSubject] = useState<any>(null);
    const [detailStudents, setDetailStudents] = useState<any[]>([]);
    const [detailTeachers, setDetailTeachers] = useState<any[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => { fetchData(); getUserName(); }, []);

    const getUserName = async () => {
        const name = await AsyncStorage.getItem('userName');
        if (name) setUserName(name);
    };

    // Helper: filter out super_admin for non-super_admin users
    const visibleUsers = useMemo(() => {
        if (userRole === 'super_admin') return users;
        return users.filter(u => u.role !== 'super_admin');
    }, [users, userRole]);

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

            const eventsRes = await getCalendarEvents();
            if (eventsRes.success) setCalendarEvents(eventsRes.events || []);

            if (storedRole === 'super_admin') {
                const settingsRes = await getAllSettings();
                if (settingsRes.success) setSettingsList(settingsRes.settings);
            }
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
        }
    };

    const handleAction = async (endpoint: string, payload: any, method: string = 'POST') => {
        setLoading(true);
        try {
            let success = false; let message = '';
            if (endpoint === 'settings') {
                const res = await updateSetting(payload);
                success = res.success; message = res.message || '';
            } else {
                const token = await AsyncStorage.getItem('authToken');
                const response = await fetch(`${API_URL}/admin/${endpoint}`, {
                    method,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                success = data.success; message = data.message;
            }
            if (success) {
                Alert.alert('Sucesso', message);
                fetchData();
                setFormData({ email: '', password: '', name: '', role: 'student', subjectName: '', subjectCode: '', credits: '4', settingKey: '', settingValue: '', settingDesc: '' });
                setEnrollPick({ studentId: null, subjectId: null });
                setTeachPick({ teacherId: null, subjectId: null });
            } else {
                Alert.alert('Erro', message || 'Falha na operação');
            }
        } catch (error) { Alert.alert('Erro', 'Erro de conexão'); }
        finally { setLoading(false); }
    };

    const handleDelete = async (endpoint: string) => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_URL}/admin/${endpoint}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            const data = await response.json();
            if (data.success) { Alert.alert('Sucesso', data.message); fetchData(); }
            else { Alert.alert('Erro', data.message || 'Falha na operação'); }
        } catch (error) { Alert.alert('Erro', 'Erro de conexão'); }
        finally { setLoading(false); }
    };

    const handleDeleteWithBody = async (endpoint: string, body: any) => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_URL}/admin/${endpoint}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (data.success) { Alert.alert('Sucesso', data.message); fetchData(); if (detailSubject) openSubjectDetail(detailSubject); }
            else { Alert.alert('Erro', data.message || 'Falha na operação'); }
        } catch (error) { Alert.alert('Erro', 'Erro de conexão'); }
        finally { setLoading(false); }
    };

    const confirmDelete = (label: string, onConfirm: () => void) => {
        Alert.alert('Confirmar Exclusão', `Tem certeza que deseja excluir ${label}?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: onConfirm }
        ]);
    };

    const openSubjectDetail = async (subject: any) => {
        setDetailSubject(subject); setDetailLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const headers = { 'Authorization': `Bearer ${token}` };
            const [enrollRes, teachRes] = await Promise.all([
                fetch(`${API_URL}/admin/subjects/${subject.id}/enrollments`, { headers }),
                fetch(`${API_URL}/admin/subjects/${subject.id}/teachings`, { headers })
            ]);
            const enrollData = await enrollRes.json();
            const teachData = await teachRes.json();
            if (enrollData.success) setDetailStudents(enrollData.students);
            if (teachData.success) setDetailTeachers(teachData.teachers);
        } catch (e) { console.error(e); }
        finally { setDetailLoading(false); }
    };

    const getCurrentDate = () => {
        const date = new Date();
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
        const formatted = date.toLocaleDateString('pt-BR', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    const getISODateFromOffset = (daysOffset: number) => {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const applyQuickEventDate = (daysOffset: number) => {
        setEventForm({ ...eventForm, eventDate: getISODateFromOffset(daysOffset) });
    };

    const handleCreateEvent = async () => {
        if (!eventForm.title.trim() || !eventForm.eventDate.trim()) {
            Alert.alert('Campos obrigatórios', 'Informe título e data no formato YYYY-MM-DD.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                title: eventForm.title.trim(),
                description: eventForm.description.trim(),
                event_date: eventForm.eventDate.trim(),
                event_type: eventForm.eventType,
                target_role: eventForm.targetRole,
            };

            const result = editingEventId
                ? await updateCalendarEvent(editingEventId, payload)
                : await createCalendarEvent(payload);

            if (!result.success) {
                Alert.alert('Erro', result.message || 'Não foi possível salvar o evento/aviso.');
                return;
            }

            Alert.alert('Sucesso', result.message || 'Evento/aviso salvo com sucesso.');
            setEventForm({
                title: '',
                description: '',
                eventDate: '',
                eventType: 'event',
                targetRole: 'both',
            });
            setEditingEventId(null);
            fetchData();
        } catch (error) {
            Alert.alert('Erro', 'Falha ao salvar evento/aviso.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteEvent = async (eventId: number) => {
        setLoading(true);
        try {
            const result = await deleteCalendarEvent(eventId);
            if (!result.success) {
                Alert.alert('Erro', result.message || 'Não foi possível remover o evento.');
                return;
            }

            Alert.alert('Sucesso', result.message || 'Evento/aviso removido com sucesso.');
            fetchData();
        } catch (error) {
            Alert.alert('Erro', 'Falha ao remover evento/aviso.');
        } finally {
            setLoading(false);
        }
    };

    // ============ Computed Stats ============
    const studentCount = visibleUsers.filter(u => u.role === 'student').length;
    const teacherCount = visibleUsers.filter(u => u.role === 'teacher').length;
    const studentsPerTeacher = teacherCount > 0 ? (studentCount / teacherCount).toFixed(1) : '—';

    // ============ TAB RENDERERS ============

    const renderOverview = () => (
        <View style={styles.tabContent}>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
                    <Text style={styles.statNumber}>{visibleUsers.length}</Text>
                    <Text style={styles.statLabel}>Usuários</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#8b5cf6' }]}>
                    <Text style={styles.statNumber}>{subjects.length}</Text>
                    <Text style={styles.statLabel}>Disciplinas</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
                    <Text style={styles.statNumber}>{studentCount}</Text>
                    <Text style={styles.statLabel}>Alunos</Text>
                </View>
            </View>

            {/* Secondary Stats */}
            <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
                <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
                    <Text style={styles.statNumber}>{teacherCount}</Text>
                    <Text style={styles.statLabel}>Professores</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#06b6d4' }]}>
                    <Text style={styles.statNumber}>{studentsPerTeacher}</Text>
                    <Text style={styles.statLabel}>Alunos/Prof</Text>
                </View>
            </View>

            {/* Quick Actions for ALL admins */}
            <View style={{ marginTop: spacing.lg }}>
                <Text style={styles.quickActionsTitle}>AÇÕES RÁPIDAS</Text>
                <View style={styles.quickActionsGrid}>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('users')} activeOpacity={0.7}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#3b82f615' }]}>
                            <MaterialIcons name="person-add" size={22} color="#3b82f6" />
                        </View>
                        <Text style={styles.quickActionLabel}>Novo Usuário</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('subjects')} activeOpacity={0.7}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#8b5cf615' }]}>
                            <MaterialIcons name="library-add" size={22} color="#8b5cf6" />
                        </View>
                        <Text style={styles.quickActionLabel}>Nova Disciplina</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('enroll')} activeOpacity={0.7}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#10b98115' }]}>
                            <MaterialIcons name="how-to-reg" size={22} color="#10b981" />
                        </View>
                        <Text style={styles.quickActionLabel}>Matricular</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('teach')} activeOpacity={0.7}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#f59e0b15' }]}>
                            <MaterialIcons name="assignment-ind" size={22} color="#f59e0b" />
                        </View>
                        <Text style={styles.quickActionLabel}>Atribuir Prof</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('events')} activeOpacity={0.7}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#06b6d415' }]}>
                            <MaterialIcons name="event-note" size={22} color="#06b6d4" />
                        </View>
                        <Text style={styles.quickActionLabel}>Eventos/Avisos</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Welcome Card for regular admins */}
            {userRole !== 'super_admin' && (
                <View style={[styles.card, { marginTop: spacing.md, backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <MaterialIcons name="tips-and-updates" size={20} color="#0284c7" />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0284c7' }}>Dica do Sistema</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#0369a1', lineHeight: 20 }}>
                        Use as abas acima para gerenciar usuários, disciplinas e matrículas. Você pode tocar em uma disciplina para ver seus alunos e professores vinculados.
                    </Text>
                </View>
            )}

            {/* Super Admin Section */}
            {userRole === 'super_admin' && (
                <View style={{ marginTop: spacing.lg }}>
                    <View style={styles.sectionHeader}>
                        <MaterialIcons name="admin-panel-settings" size={20} color="#ef4444" />
                        <Text style={styles.sectionTitle}>Super Admin</Text>
                    </View>
                    <SystemHealth />
                    <AIConfiguration />

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Palavra de Ativação</Text>
                        <View style={styles.inlineForm}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Nova Palavra de Ativação"
                                placeholderTextColor={colors.zinc400}
                                value={formData.settingValue}
                                onChangeText={t => setFormData({ ...formData, settingValue: t })}
                            />
                            <TouchableOpacity style={styles.inlineButton}
                                onPress={() => handleAction('settings', {
                                    key: 'trigger_word', value: formData.settingValue,
                                    description: 'Palavra de ativação para comandos de voz', is_public: true
                                })}>
                                <MaterialIcons name="save" size={18} color={colors.white} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {settingsList.length > 0 && (
                        <View style={[styles.card, { marginTop: spacing.sm }]}>
                            <Text style={styles.cardTitle}>Variáveis Ativas</Text>
                            {settingsList.map(s => (
                                <View key={s.key} style={styles.settingItem}>
                                    <Text style={styles.settingKey}>{s.key}</Text>
                                    <Text style={styles.settingValueText} numberOfLines={1}>{s.value}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </View>
    );

    const renderUsers = () => {
        const filtered = roleFilter === 'all'
            ? visibleUsers
            : visibleUsers.filter(u => u.role === roleFilter);

        return (
            <View style={styles.tabContent}>
                {/* Create User Form */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Novo Usuário</Text>
                    <View style={styles.formFields}>
                        <TextInput style={styles.input} placeholder="Nome" placeholderTextColor={colors.zinc400}
                            value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} />
                        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.zinc400}
                            value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} autoCapitalize="none" />
                        <TextInput style={styles.input} placeholder="Senha" placeholderTextColor={colors.zinc400}
                            value={formData.password} onChangeText={t => setFormData({ ...formData, password: t })} secureTextEntry />
                        <View style={styles.roleRow}>
                            {[{ key: 'student', label: 'Aluno' }, { key: 'teacher', label: 'Professor' }].map(r => (
                                <TouchableOpacity key={r.key}
                                    style={[styles.roleChip, formData.role === r.key && styles.roleChipActive]}
                                    onPress={() => setFormData({ ...formData, role: r.key })}>
                                    <Text style={[styles.roleChipText, formData.role === r.key && styles.roleChipTextActive]}>{r.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.primaryButton}
                            onPress={() => handleAction('users', {
                                name: formData.name, email: formData.email,
                                password: formData.password, role: formData.role
                            })}>
                            <MaterialIcons name="person-add" size={18} color={colors.white} />
                            <Text style={styles.primaryButtonText}>Criar Usuário</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Role Filter Chips */}
                <View style={[styles.card, { marginTop: spacing.md }]}>
                    <View style={styles.filterRow}>
                        {ROLE_FILTERS.map(f => (
                            <TouchableOpacity key={f.key}
                                style={[styles.filterChip, roleFilter === f.key && styles.filterChipActive]}
                                onPress={() => setRoleFilter(f.key)}>
                                <Text style={[styles.filterChipText, roleFilter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={[styles.cardTitle, { marginTop: spacing.sm }]}>
                        {roleFilter === 'all' ? 'Todos os Usuários' : `${ROLE_FILTERS.find(f => f.key === roleFilter)?.label}`} ({filtered.length})
                    </Text>

                    {filtered.map(u => (
                        <View key={u.id} style={styles.listRow}>
                            <View style={styles.listRowLeft}>
                                <View style={[styles.avatar, { backgroundColor: u.role === 'student' ? '#3b82f620' : u.role === 'teacher' ? '#8b5cf620' : '#ef444420' }]}>
                                    <MaterialIcons name={u.role === 'student' ? 'person' : u.role === 'teacher' ? 'school' : 'admin-panel-settings'} size={18}
                                        color={u.role === 'student' ? '#3b82f6' : u.role === 'teacher' ? '#8b5cf6' : '#ef4444'} />
                                </View>
                                <View>
                                    <Text style={styles.listRowTitle}>{u.name}</Text>
                                    <Text style={styles.listRowSub}>{u.role} • {u.email}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.deleteBtn}
                                onPress={() => confirmDelete(`"${u.name}"`, () => handleDelete(`users/${u.id}`))}>
                                <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const renderSubjects = () => (
        <View style={styles.tabContent}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Nova Disciplina</Text>
                <View style={styles.formFields}>
                    <TextInput style={styles.input} placeholder="Nome (ex: Cálculo I)" placeholderTextColor={colors.zinc400}
                        value={formData.subjectName} onChangeText={t => setFormData({ ...formData, subjectName: t })} />
                    <TextInput style={styles.input} placeholder="Código (ex: MAT101)" placeholderTextColor={colors.zinc400}
                        value={formData.subjectCode} onChangeText={t => setFormData({ ...formData, subjectCode: t })} autoCapitalize="characters" />
                    <TouchableOpacity style={styles.primaryButton}
                        onPress={() => handleAction('subjects', {
                            name: formData.subjectName, code: formData.subjectCode,
                            credits: parseInt(formData.credits)
                        })}>
                        <MaterialIcons name="library-add" size={18} color={colors.white} />
                        <Text style={styles.primaryButtonText}>Criar Disciplina</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={[styles.card, { marginTop: spacing.md }]}>
                <Text style={styles.cardTitle}>Disciplinas ({subjects.length})</Text>
                {subjects.map(s => (
                    <View key={s.id} style={styles.listRow}>
                        <TouchableOpacity style={styles.listRowLeft} onPress={() => openSubjectDetail(s)}>
                            <View style={[styles.avatar, { backgroundColor: '#8b5cf620' }]}>
                                <MaterialIcons name="menu-book" size={18} color="#8b5cf6" />
                            </View>
                            <View>
                                <Text style={styles.listRowTitle}>{s.name}</Text>
                                <Text style={styles.listRowSub}>{s.code} • Toque para detalhes</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn}
                            onPress={() => confirmDelete(`"${s.name}"`, () => handleDelete(`subjects/${s.id}`))}>
                            <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </View>
    );

    // ============ ENROLL (Search & Pick) ============
    const renderEnroll = () => {
        const allStudents = visibleUsers.filter(u => u.role === 'student');
        const filteredStudents = enrollSearch.student
            ? allStudents.filter(u => u.name.toLowerCase().includes(enrollSearch.student.toLowerCase()))
            : allStudents;
        const filteredSubjects = enrollSearch.subject
            ? subjects.filter(s => s.name.toLowerCase().includes(enrollSearch.subject.toLowerCase()))
            : subjects;

        const selectedStudent = allStudents.find(u => u.id === enrollPick.studentId);
        const selectedSubject = subjects.find(s => s.id === enrollPick.subjectId);

        return (
            <View style={styles.tabContent}>
                {/* Summary of selection */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Matricular Aluno em Disciplina</Text>
                    <View style={styles.selectionSummary}>
                        <View style={[styles.selectionBox, enrollPick.studentId ? styles.selectionBoxActive : {}]}>
                            <MaterialIcons name="person" size={18} color={enrollPick.studentId ? '#3b82f6' : colors.zinc400} />
                            <Text style={[styles.selectionBoxText, enrollPick.studentId ? { color: '#3b82f6' } : {}]}>
                                {selectedStudent ? selectedStudent.name : 'Selecione um aluno ↓'}
                            </Text>
                        </View>
                        <MaterialIcons name="add" size={20} color={colors.zinc400} />
                        <View style={[styles.selectionBox, enrollPick.subjectId ? styles.selectionBoxActive : {}]}>
                            <MaterialIcons name="menu-book" size={18} color={enrollPick.subjectId ? '#8b5cf6' : colors.zinc400} />
                            <Text style={[styles.selectionBoxText, enrollPick.subjectId ? { color: '#8b5cf6' } : {}]}>
                                {selectedSubject ? selectedSubject.name : 'Selecione uma disciplina ↓'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.primaryButton, (!enrollPick.studentId || !enrollPick.subjectId) && styles.disabledButton]}
                        disabled={!enrollPick.studentId || !enrollPick.subjectId}
                        onPress={() => handleAction('enroll', {
                            student_id: enrollPick.studentId,
                            subject_id: enrollPick.subjectId
                        })}>
                        <MaterialIcons name="how-to-reg" size={18} color={colors.white} />
                        <Text style={styles.primaryButtonText}>Matricular</Text>
                    </TouchableOpacity>
                </View>

                {/* Pick lists */}
                <View style={styles.pickSection}>
                    <View style={styles.pickColumn}>
                        <Text style={styles.pickTitle}>ALUNOS</Text>
                        <TextInput style={styles.searchInput} placeholder="Buscar aluno..."
                            placeholderTextColor={colors.zinc400} value={enrollSearch.student}
                            onChangeText={t => setEnrollSearch({ ...enrollSearch, student: t })} />
                        {filteredStudents.map(u => (
                            <TouchableOpacity key={u.id}
                                style={[styles.pickItem, enrollPick.studentId === u.id && styles.pickItemSelected]}
                                onPress={() => setEnrollPick({ ...enrollPick, studentId: u.id })}>
                                <Text style={[styles.pickItemText, enrollPick.studentId === u.id && { color: '#3b82f6' }]}>{u.name}</Text>
                                <Text style={styles.pickItemSub}>{u.email}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.pickColumn}>
                        <Text style={styles.pickTitle}>DISCIPLINAS</Text>
                        <TextInput style={styles.searchInput} placeholder="Buscar disciplina..."
                            placeholderTextColor={colors.zinc400} value={enrollSearch.subject}
                            onChangeText={t => setEnrollSearch({ ...enrollSearch, subject: t })} />
                        {filteredSubjects.map(s => (
                            <TouchableOpacity key={s.id}
                                style={[styles.pickItem, enrollPick.subjectId === s.id && styles.pickItemSelected]}
                                onPress={() => setEnrollPick({ ...enrollPick, subjectId: s.id })}>
                                <Text style={[styles.pickItemText, enrollPick.subjectId === s.id && { color: '#8b5cf6' }]}>{s.name}</Text>
                                <Text style={styles.pickItemSub}>{s.code}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        );
    };

    // ============ TEACH (Search & Pick) ============
    const renderTeach = () => {
        const allTeachers = visibleUsers.filter(u => u.role === 'teacher');
        const filteredTeachers = teachSearch.teacher
            ? allTeachers.filter(u => u.name.toLowerCase().includes(teachSearch.teacher.toLowerCase()))
            : allTeachers;
        const filteredSubjects = teachSearch.subject
            ? subjects.filter(s => s.name.toLowerCase().includes(teachSearch.subject.toLowerCase()))
            : subjects;

        const selectedTeacher = allTeachers.find(u => u.id === teachPick.teacherId);
        const selectedSubject = subjects.find(s => s.id === teachPick.subjectId);

        return (
            <View style={styles.tabContent}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Atribuir Professor a Disciplina</Text>
                    <View style={styles.selectionSummary}>
                        <View style={[styles.selectionBox, teachPick.teacherId ? styles.selectionBoxActive : {}]}>
                            <MaterialIcons name="school" size={18} color={teachPick.teacherId ? '#8b5cf6' : colors.zinc400} />
                            <Text style={[styles.selectionBoxText, teachPick.teacherId ? { color: '#8b5cf6' } : {}]}>
                                {selectedTeacher ? selectedTeacher.name : 'Selecione um professor ↓'}
                            </Text>
                        </View>
                        <MaterialIcons name="arrow-forward" size={20} color={colors.zinc400} />
                        <View style={[styles.selectionBox, teachPick.subjectId ? styles.selectionBoxActive : {}]}>
                            <MaterialIcons name="menu-book" size={18} color={teachPick.subjectId ? '#3b82f6' : colors.zinc400} />
                            <Text style={[styles.selectionBoxText, teachPick.subjectId ? { color: '#3b82f6' } : {}]}>
                                {selectedSubject ? selectedSubject.name : 'Selecione uma disciplina ↓'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.primaryButton, (!teachPick.teacherId || !teachPick.subjectId) && styles.disabledButton]}
                        disabled={!teachPick.teacherId || !teachPick.subjectId}
                        onPress={() => handleAction('teach', {
                            teacher_id: teachPick.teacherId,
                            subject_id: teachPick.subjectId
                        })}>
                        <MaterialIcons name="assignment-ind" size={18} color={colors.white} />
                        <Text style={styles.primaryButtonText}>Atribuir</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.pickSection}>
                    <View style={styles.pickColumn}>
                        <Text style={styles.pickTitle}>PROFESSORES</Text>
                        <TextInput style={styles.searchInput} placeholder="Buscar professor..."
                            placeholderTextColor={colors.zinc400} value={teachSearch.teacher}
                            onChangeText={t => setTeachSearch({ ...teachSearch, teacher: t })} />
                        {filteredTeachers.map(u => (
                            <TouchableOpacity key={u.id}
                                style={[styles.pickItem, teachPick.teacherId === u.id && styles.pickItemSelected]}
                                onPress={() => setTeachPick({ ...teachPick, teacherId: u.id })}>
                                <Text style={[styles.pickItemText, teachPick.teacherId === u.id && { color: '#8b5cf6' }]}>{u.name}</Text>
                                <Text style={styles.pickItemSub}>{u.email}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.pickColumn}>
                        <Text style={styles.pickTitle}>DISCIPLINAS</Text>
                        <TextInput style={styles.searchInput} placeholder="Buscar disciplina..."
                            placeholderTextColor={colors.zinc400} value={teachSearch.subject}
                            onChangeText={t => setTeachSearch({ ...teachSearch, subject: t })} />
                        {filteredSubjects.map(s => (
                            <TouchableOpacity key={s.id}
                                style={[styles.pickItem, teachPick.subjectId === s.id && styles.pickItemSelected]}
                                onPress={() => setTeachPick({ ...teachPick, subjectId: s.id })}>
                                <Text style={[styles.pickItemText, teachPick.subjectId === s.id && { color: '#3b82f6' }]}>{s.name}</Text>
                                <Text style={styles.pickItemSub}>{s.code}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        );
    };

    const renderEvents = () => {
        const sortedEvents = [...calendarEvents].sort((a, b) => (a.event_date > b.event_date ? 1 : -1));

        return (
            <View style={styles.tabContent}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{editingEventId ? 'Editar Evento/Aviso' : 'Criar Evento/Aviso'}</Text>
                    <View style={styles.formFields}>
                        <TextInput
                            style={styles.input}
                            placeholder="Título"
                            placeholderTextColor={colors.zinc400}
                            value={eventForm.title}
                            onChangeText={(t) => setEventForm({ ...eventForm, title: t })}
                        />
                        <TextInput
                            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                            placeholder="Descrição (opcional)"
                            placeholderTextColor={colors.zinc400}
                            multiline
                            value={eventForm.description}
                            onChangeText={(t) => setEventForm({ ...eventForm, description: t })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Data (YYYY-MM-DD)"
                            placeholderTextColor={colors.zinc400}
                            value={eventForm.eventDate}
                            onChangeText={(t) => setEventForm({ ...eventForm, eventDate: t })}
                            autoCapitalize="none"
                        />
                        <View style={styles.dateQuickRow}>
                            {[
                                { label: 'Hoje', days: 0 },
                                { label: 'Amanhã', days: 1 },
                                { label: '+7 dias', days: 7 },
                            ].map((quick) => {
                                const quickDate = getISODateFromOffset(quick.days);
                                const isActive = eventForm.eventDate === quickDate;

                                return (
                                    <TouchableOpacity
                                        key={quick.label}
                                        style={[styles.dateQuickChip, isActive && styles.dateQuickChipActive]}
                                        onPress={() => applyQuickEventDate(quick.days)}
                                    >
                                        <Text style={[styles.dateQuickChipText, isActive && styles.dateQuickChipTextActive]}>{quick.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.roleRow}>
                            {[
                                { key: 'event', label: 'Evento' },
                                { key: 'notice', label: 'Aviso' },
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.roleChip, eventForm.eventType === item.key && styles.roleChipActive]}
                                    onPress={() => setEventForm({ ...eventForm, eventType: item.key as EventType })}
                                >
                                    <Text style={[styles.roleChipText, eventForm.eventType === item.key && styles.roleChipTextActive]}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.roleRow}>
                            {[
                                { key: 'student', label: 'Alunos' },
                                { key: 'teacher', label: 'Professores' },
                                { key: 'both', label: 'Ambos' },
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.roleChip, eventForm.targetRole === item.key && styles.roleChipActive]}
                                    onPress={() => setEventForm({ ...eventForm, targetRole: item.key as EventTargetRole })}
                                >
                                    <Text style={[styles.roleChipText, eventForm.targetRole === item.key && styles.roleChipTextActive]}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={styles.primaryButton} onPress={handleCreateEvent}>
                            <MaterialIcons name="event-available" size={18} color={colors.white} />
                            <Text style={styles.primaryButtonText}>{editingEventId ? 'Salvar Alterações' : 'Publicar no Calendário'}</Text>
                        </TouchableOpacity>
                        {editingEventId && (
                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: colors.slate400 }]}
                                onPress={() => {
                                    setEditingEventId(null);
                                    setEventForm({
                                        title: '',
                                        description: '',
                                        eventDate: '',
                                        eventType: 'event',
                                        targetRole: 'both',
                                    });
                                }}
                            >
                                <MaterialIcons name="close" size={18} color={colors.white} />
                                <Text style={styles.primaryButtonText}>Cancelar Edição</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={[styles.card, { marginTop: spacing.md }]}>
                    <Text style={styles.cardTitle}>Eventos e Avisos ({sortedEvents.length})</Text>
                    {sortedEvents.length === 0 && (
                        <Text style={styles.emptyText}>Nenhum evento/aviso cadastrado.</Text>
                    )}

                    {sortedEvents.map((event) => (
                        <View key={event.id} style={styles.listRow}>
                            <View style={styles.listRowLeft}>
                                <View style={[styles.avatar, { backgroundColor: event.event_type === 'notice' ? '#f59e0b20' : '#4f46e520' }]}>
                                    <MaterialIcons
                                        name={event.event_type === 'notice' ? 'campaign' : 'event'}
                                        size={18}
                                        color={event.event_type === 'notice' ? '#f59e0b' : '#4f46e5'}
                                    />
                                </View>
                                <View>
                                    <Text style={styles.listRowTitle}>{event.title}</Text>
                                    <Text style={styles.listRowSub}>
                                        {event.event_date} • {event.event_type === 'notice' ? 'Aviso' : 'Evento'} • {event.target_role === 'both' ? 'Alunos e Professores' : event.target_role === 'student' ? 'Alunos' : 'Professores'}
                                    </Text>
                                    {!!event.description && (
                                        <Text style={styles.listRowSub}>{event.description}</Text>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={() => {
                                    setEditingEventId(event.id);
                                    setEventForm({
                                        title: event.title || '',
                                        description: event.description || '',
                                        eventDate: event.event_date || '',
                                        eventType: event.event_type === 'notice' ? 'notice' : 'event',
                                        targetRole: event.target_role === 'teacher' ? 'teacher' : event.target_role === 'both' ? 'both' : 'student',
                                    });
                                }}
                            >
                                <MaterialIcons name="edit" size={18} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={() => confirmDelete(`o evento "${event.title}"`, () => handleDeleteEvent(event.id))}
                            >
                                <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return renderOverview();
            case 'users': return renderUsers();
            case 'subjects': return renderSubjects();
            case 'enroll': return renderEnroll();
            case 'teach': return renderTeach();
            case 'events': return renderEvents();
            default: return null;
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.headerGradient, { paddingTop: insets.top + spacing.md }]}
            >
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.greeting}>Painel Admin</Text>
                        <Text style={styles.date}>{userName} • {getCurrentDate()}</Text>
                    </View>
                    <TouchableOpacity style={styles.headerButton} onPress={() => router.replace('/(auth)/login')}>
                        <MaterialIcons name="logout" size={20} color={colors.white} />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <View style={styles.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.key;
                        return (
                            <TouchableOpacity key={tab.key} style={[styles.tab, isActive && styles.tabActive]}
                                onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
                                <MaterialIcons name={tab.icon as any} size={18} color={isActive ? '#4f46e5' : colors.zinc400} />
                                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {renderTabContent()}
            </ScrollView>

            {/* Subject Detail Modal */}
            <Modal visible={!!detailSubject} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{detailSubject?.name}</Text>
                                <Text style={styles.modalSub}>{detailSubject?.code}</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setDetailSubject(null); setDetailStudents([]); setDetailTeachers([]); }}>
                                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        {detailLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.modalSection}>Professores ({detailTeachers.length})</Text>
                                {detailTeachers.length === 0 && <Text style={styles.emptyText}>Nenhum professor atribuído</Text>}
                                {detailTeachers.map(t => (
                                    <View key={t.id} style={styles.listRow}>
                                        <View style={styles.listRowLeft}>
                                            <View style={[styles.avatar, { backgroundColor: '#8b5cf620' }]}>
                                                <MaterialIcons name="school" size={16} color="#8b5cf6" />
                                            </View>
                                            <View>
                                                <Text style={styles.listRowTitle}>{t.name}</Text>
                                                <Text style={styles.listRowSub}>{t.email}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity style={styles.deleteBtn}
                                            onPress={() => confirmDelete(`professor "${t.name}" desta disciplina`, () =>
                                                handleDeleteWithBody('unteach', { teacher_id: t.id, subject_id: detailSubject.id })
                                            )}>
                                            <MaterialIcons name="person-remove" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <Text style={[styles.modalSection, { marginTop: spacing.lg }]}>Alunos Matriculados ({detailStudents.length})</Text>
                                {detailStudents.length === 0 && <Text style={styles.emptyText}>Nenhum aluno matriculado</Text>}
                                {detailStudents.map(s => (
                                    <View key={s.id} style={styles.listRow}>
                                        <View style={styles.listRowLeft}>
                                            <View style={[styles.avatar, { backgroundColor: '#3b82f620' }]}>
                                                <MaterialIcons name="person" size={16} color="#3b82f6" />
                                            </View>
                                            <View>
                                                <Text style={styles.listRowTitle}>{s.name}</Text>
                                                <Text style={styles.listRowSub}>{s.email}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity style={styles.deleteBtn}
                                            onPress={() => confirmDelete(`aluno "${s.name}" desta disciplina`, () =>
                                                handleDeleteWithBody('unenroll', { student_id: s.id, subject_id: detailSubject.id })
                                            )}>
                                            <MaterialIcons name="person-remove" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: {
        paddingHorizontal: spacing.base, paddingBottom: spacing.lg,
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    greeting: { fontSize: typography.fontSize.xl, fontWeight: '700', color: colors.white },
    date: { fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    headerButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
    },
    tabBar: {
        backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    tabBarContent: { paddingHorizontal: spacing.sm, paddingVertical: 8, gap: 4 },
    tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
    tabActive: { backgroundColor: '#4f46e510' },
    tabLabel: { fontSize: 13, fontWeight: '600', color: colors.zinc400 },
    tabLabelActive: { color: '#4f46e5' },
    content: { padding: spacing.base, paddingBottom: 40 },
    tabContent: {},
    // Stats
    statsRow: { flexDirection: 'row', gap: spacing.sm },
    statCard: {
        flex: 1, backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.lg,
        borderLeftWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    statNumber: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    statLabel: { fontSize: 11, color: colors.zinc400, marginTop: 2, fontWeight: '500' },
    // Quick Actions
    quickActionsTitle: {
        fontSize: 11, fontWeight: '700', color: colors.zinc400,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm,
    },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    quickAction: {
        width: '47%', backgroundColor: colors.white, paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.lg, alignItems: 'center', gap: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    quickActionIcon: {
        width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    },
    quickActionLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    // Section headers
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    sectionTitle: { fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary },
    // Cards
    card: {
        backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.lg,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    cardTitle: { fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
    formFields: { gap: spacing.sm },
    dateQuickRow: { flexDirection: 'row', gap: spacing.sm },
    dateQuickChip: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: borderRadius.md,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    dateQuickChipActive: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    dateQuickChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    dateQuickChipTextActive: {
        color: colors.white,
    },
    input: {
        backgroundColor: '#f1f5f9', paddingHorizontal: spacing.md, paddingVertical: 12,
        borderRadius: borderRadius.md, color: colors.textPrimary, fontSize: typography.fontSize.sm,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    roleRow: { flexDirection: 'row', gap: spacing.sm },
    roleChip: {
        flex: 1, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: borderRadius.md,
        alignItems: 'center', borderWidth: 1.5, borderColor: '#e2e8f0',
    },
    roleChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
    roleChipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
    roleChipTextActive: { color: colors.white },
    primaryButton: {
        flexDirection: 'row', backgroundColor: '#4f46e5', paddingVertical: 12,
        borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', gap: 6,
        shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    },
    disabledButton: { opacity: 0.4 },
    primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: typography.fontSize.sm },
    // Filter chips
    filterRow: { flexDirection: 'row', gap: 6 },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
    },
    filterChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
    filterChipText: { fontSize: 12, fontWeight: '600', color: colors.zinc400 },
    filterChipTextActive: { color: colors.white },
    // List rows
    listRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    listRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    listRowTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    listRowSub: { fontSize: 11, color: colors.zinc400, marginTop: 1 },
    deleteBtn: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef2f2',
        justifyContent: 'center', alignItems: 'center',
    },
    // Search & Pick (Enroll/Teach)
    selectionSummary: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm,
    },
    selectionBox: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: '#e2e8f0',
    },
    selectionBoxActive: { borderColor: '#4f46e5', backgroundColor: '#f5f3ff' },
    selectionBoxText: { fontSize: 12, fontWeight: '600', color: colors.zinc400, flex: 1 },
    pickSection: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    pickColumn: { flex: 1 },
    pickTitle: {
        fontSize: 10, fontWeight: '700', color: colors.zinc400,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs,
    },
    searchInput: {
        backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: borderRadius.md, fontSize: 12, color: colors.textPrimary,
        borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6,
    },
    pickItem: {
        backgroundColor: colors.white, padding: spacing.sm, borderRadius: borderRadius.md,
        marginBottom: 4, borderWidth: 1.5, borderColor: '#e2e8f0',
    },
    pickItemSelected: { borderColor: '#4f46e5', backgroundColor: '#f5f3ff' },
    pickItemText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    pickItemSub: { fontSize: 10, color: colors.zinc400 },
    // Inline form
    inlineForm: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    inlineButton: {
        backgroundColor: '#ef4444', width: 44, height: 44, borderRadius: borderRadius.md,
        justifyContent: 'center', alignItems: 'center',
    },
    // Settings
    settingItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    settingKey: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    settingValueText: { fontSize: 12, color: colors.zinc400, maxWidth: '50%' },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: spacing.lg, maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: typography.fontSize.xl, fontWeight: '700', color: colors.textPrimary },
    modalSub: { fontSize: typography.fontSize.sm, color: colors.zinc400, marginTop: 2 },
    modalSection: {
        fontSize: 12, fontWeight: '700', color: colors.zinc400,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm,
    },
    emptyText: { fontSize: 13, color: colors.zinc400, fontStyle: 'italic', paddingVertical: 8 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center', alignItems: 'center',
    },
});
