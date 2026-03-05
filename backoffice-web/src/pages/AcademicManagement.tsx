import { useEffect, useState } from 'react';
import { BookOpen, Loader2, Search, UserPlus, X, Users, GraduationCap, Trash2 } from 'lucide-react';
import api from '../services/api';

interface Subject {
    id: number;
    name: string;
    code: string;
    description: string;
    credits: number;
    created_at: string;
}

interface UserEntry {
    id: number;
    name: string;
    email: string;
    role: string;
}

export default function AcademicManagement() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Drawer state
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [drawerTab, setDrawerTab] = useState<'students' | 'teachers'>('students');
    const [enrolledStudents, setEnrolledStudents] = useState<UserEntry[]>([]);
    const [assignedTeachers, setAssignedTeachers] = useState<UserEntry[]>([]);
    const [drawerLoading, setDrawerLoading] = useState(false);

    // Add user modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [addType, setAddType] = useState<'student' | 'teacher'>('student');
    const [availableUsers, setAvailableUsers] = useState<UserEntry[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [addLoading, setAddLoading] = useState<number | null>(null);

    const fetchSubjects = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/backoffice/manage/subjects');
            if (data.success) setSubjects(data.subjects);
        } catch (e) {
            console.error('Failed to load subjects', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSubjects(); }, []);

    const openDrawer = async (subject: Subject) => {
        setSelectedSubject(subject);
        setDrawerTab('students');
        setDrawerLoading(true);
        try {
            const [studentsRes, teachersRes] = await Promise.all([
                api.get(`/backoffice/manage/subjects/${subject.id}/enrollments`),
                api.get(`/backoffice/manage/subjects/${subject.id}/teachings`),
            ]);
            setEnrolledStudents(studentsRes.data.success ? studentsRes.data.students : []);
            setAssignedTeachers(teachersRes.data.success ? teachersRes.data.teachers : []);
        } catch (e) {
            console.error('Failed to load subject details', e);
        } finally {
            setDrawerLoading(false);
        }
    };

    const closeDrawer = () => {
        setSelectedSubject(null);
    };

    const openAddModal = async (type: 'student' | 'teacher') => {
        setAddType(type);
        setShowAddModal(true);
        setUserSearch('');
        try {
            const role = type === 'student' ? 'student' : 'teacher';
            const { data } = await api.get(`/backoffice/manage/users?role=${role}`);
            if (data.success) {
                // Filter out already enrolled/assigned
                const existingIds = type === 'student'
                    ? enrolledStudents.map(s => s.id)
                    : assignedTeachers.map(t => t.id);
                setAvailableUsers(data.users.filter((u: UserEntry) => !existingIds.includes(u.id)));
            }
        } catch (e) {
            console.error('Failed to load available users', e);
        }
    };

    const handleAdd = async (userId: number) => {
        if (!selectedSubject) return;
        setAddLoading(userId);
        try {
            if (addType === 'student') {
                await api.post('/backoffice/manage/enroll', { student_id: userId, subject_id: selectedSubject.id });
            } else {
                await api.post('/backoffice/manage/teach', { teacher_id: userId, subject_id: selectedSubject.id });
            }
            // Refresh drawer data
            await openDrawer(selectedSubject);
            setShowAddModal(false);
        } catch (e: any) {
            alert('Erro: ' + (e.response?.data?.message || e.message));
        } finally {
            setAddLoading(null);
        }
    };

    const handleRemoveStudent = async (studentId: number) => {
        if (!selectedSubject || !window.confirm('Desmatricular este aluno?')) return;
        try {
            await api.delete('/backoffice/manage/unenroll', { data: { student_id: studentId, subject_id: selectedSubject.id } });
            await openDrawer(selectedSubject);
        } catch (e: any) {
            alert('Erro: ' + (e.response?.data?.message || e.message));
        }
    };

    const handleRemoveTeacher = async (teacherId: number) => {
        if (!selectedSubject || !window.confirm('Remover professor desta disciplina?')) return;
        try {
            await api.delete('/backoffice/manage/unteach', { data: { teacher_id: teacherId, subject_id: selectedSubject.id } });
            await openDrawer(selectedSubject);
        } catch (e: any) {
            alert('Erro: ' + (e.response?.data?.message || e.message));
        }
    };

    const filtered = subjects.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
    );

    const filteredAvailableUsers = availableUsers.filter(u =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão Acadêmica</h1>
                    <p className="text-slate-500 mt-1">Gerencie matrículas de alunos e atribuições de professores por disciplina.</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input className="input-field pl-10 text-sm" placeholder="Buscar disciplina..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Subjects Grid */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
            ) : filtered.length === 0 ? (
                <div className="card text-center py-12 text-slate-500">Nenhuma disciplina encontrada.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(subject => (
                        <button
                            key={subject.id}
                            onClick={() => openDrawer(subject)}
                            className="card text-left hover:border-primary-300 hover:shadow-md transition-all group cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 bg-primary-50 rounded-lg">
                                    <BookOpen className="w-5 h-5 text-primary-600" />
                                </div>
                                <span className="text-xs font-mono text-slate-400">{subject.code}</span>
                            </div>
                            <h3 className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors">{subject.name}</h3>
                            {subject.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{subject.description}</p>}
                            <div className="mt-3 text-xs text-slate-400">{subject.credits} créditos</div>
                        </button>
                    ))}
                </div>
            )}

            {/* Drawer / Slide Panel */}
            {selectedSubject && (
                <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={closeDrawer}>
                    <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold text-slate-900">{selectedSubject.name}</h2>
                                <button onClick={closeDrawer} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
                            </div>
                            <p className="text-sm text-slate-500 font-mono">{selectedSubject.code} · {selectedSubject.credits} créditos</p>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200">
                            <button
                                onClick={() => setDrawerTab('students')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${drawerTab === 'students' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <GraduationCap className="w-4 h-4" /> Alunos ({enrolledStudents.length})
                            </button>
                            <button
                                onClick={() => setDrawerTab('teachers')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${drawerTab === 'teachers' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <Users className="w-4 h-4" /> Professores ({assignedTeachers.length})
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {drawerLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
                            ) : drawerTab === 'students' ? (
                                <div className="space-y-2">
                                    {enrolledStudents.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-8">Nenhum aluno matriculado nesta disciplina.</p>
                                    ) : enrolledStudents.map(s => (
                                        <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <div>
                                                <span className="font-semibold text-sm text-slate-900">{s.name}</span>
                                                <span className="ml-2 text-xs text-slate-500">{s.email}</span>
                                            </div>
                                            <button onClick={() => handleRemoveStudent(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Desmatricular">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {assignedTeachers.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-8">Nenhum professor atribuído a esta disciplina.</p>
                                    ) : assignedTeachers.map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <div>
                                                <span className="font-semibold text-sm text-slate-900">{t.name}</span>
                                                <span className="ml-2 text-xs text-slate-500">{t.email}</span>
                                            </div>
                                            <button onClick={() => handleRemoveTeacher(t.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Remover">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Add Button */}
                        <div className="p-4 border-t border-slate-200">
                            <button
                                onClick={() => openAddModal(drawerTab === 'students' ? 'student' : 'teacher')}
                                className="btn-primary w-full gap-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                {drawerTab === 'students' ? 'Matricular Aluno' : 'Atribuir Professor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">
                                {addType === 'student' ? 'Matricular Aluno' : 'Atribuir Professor'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="px-6 pt-4 pb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input className="input-field pl-10 text-sm" placeholder="Buscar por nome ou email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} autoFocus />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
                            {filteredAvailableUsers.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">
                                    {availableUsers.length === 0 ? 'Todos já estão vinculados.' : 'Nenhum resultado.'}
                                </p>
                            ) : filteredAvailableUsers.map(u => (
                                <div key={u.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-primary-300 transition-colors">
                                    <div>
                                        <span className="font-semibold text-sm text-slate-900">{u.name}</span>
                                        <span className="ml-2 text-xs text-slate-500">{u.email}</span>
                                    </div>
                                    <button onClick={() => handleAdd(u.id)} disabled={addLoading === u.id}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors">
                                        {addLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Adicionar'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
