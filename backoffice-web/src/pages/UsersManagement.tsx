import { useEffect, useState } from 'react';
import { Loader2, Trash2, UserPlus, Search } from 'lucide-react';
import api from '../services/api';

interface UserEntry {
    id: number;
    name: string;
    email: string;
    role: string;
    registration_number: string | null;
    course_name: string | null;
    created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    student: { label: 'Aluno', color: 'bg-blue-50 text-blue-700' },
    teacher: { label: 'Professor', color: 'bg-purple-50 text-purple-700' },
    admin: { label: 'Admin Escola', color: 'bg-amber-50 text-amber-700' },
};

export default function UsersManagement() {
    const [users, setUsers] = useState<UserEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState('');
    const [search, setSearch] = useState('');
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    // Create user form
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'student' });
    const [formLoading, setFormLoading] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = roleFilter ? `?role=${roleFilter}` : '';
            const { data } = await api.get(`/backoffice/manage/users${params}`);
            if (data.success) setUsers(data.users);
        } catch (e) {
            console.error('Failed to load users', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, [roleFilter]);

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`Certeza que deseja deletar "${name}"? Matrículas e atribuições serão removidas.`)) return;
        setActionLoading(id);
        try {
            await api.delete(`/backoffice/manage/users/${id}`);
            fetchUsers();
        } catch (e: any) {
            alert('Erro: ' + (e.response?.data?.message || e.message));
        } finally {
            setActionLoading(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            await api.post('/backoffice/manage/users', formData);
            setShowForm(false);
            setFormData({ name: '', email: '', password: '', role: 'student' });
            fetchUsers();
        } catch (err: any) {
            alert('Erro: ' + (err.response?.data?.message || err.message));
        } finally {
            setFormLoading(false);
        }
    };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão de Usuários</h1>
                    <p className="text-slate-500 mt-1">Visualize, crie e remova usuários de toda a plataforma.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary gap-2">
                    <UserPlus className="w-4 h-4" /> Novo Usuário
                </button>
            </div>

            {showForm && (
                <div className="card mb-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Criar Novo Usuário</h2>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input className="input-field" placeholder="Nome completo" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <input className="input-field" type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        <input className="input-field" type="password" placeholder="Senha" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        <div className="flex gap-2">
                            <select className="input-field" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                <option value="student">Aluno</option>
                                <option value="teacher">Professor</option>
                                <option value="admin">Admin Escola</option>
                            </select>
                            <button type="submit" disabled={formLoading} className="btn-primary whitespace-nowrap">
                                {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input className="input-field pl-10 text-sm" placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-2">
                    {['', 'student', 'teacher', 'admin'].map(r => (
                        <button key={r} onClick={() => setRoleFilter(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${roleFilter === r ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            {r === '' ? 'Todos' : ROLE_LABELS[r]?.label || r}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4 font-semibold">ID</th>
                                <th className="px-6 py-4 font-semibold">Nome</th>
                                <th className="px-6 py-4 font-semibold">Email</th>
                                <th className="px-6 py-4 font-semibold">Tipo</th>
                                <th className="px-6 py-4 font-semibold">Curso</th>
                                <th className="px-6 py-4 font-semibold">Cadastro</th>
                                <th className="px-6 py-4 font-semibold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500" /></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>
                            ) : (
                                filtered.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400">{u.id}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-900">{u.name}</td>
                                        <td className="px-6 py-4 text-slate-600 text-xs">{u.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${ROLE_LABELS[u.role]?.color || 'bg-slate-100 text-slate-700'}`}>
                                                {ROLE_LABELS[u.role]?.label || u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">{u.course_name || '-'}</td>
                                        <td className="px-6 py-4 text-xs whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleDelete(u.id, u.name)} disabled={actionLoading === u.id}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deletar Usuário">
                                                {actionLoading === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
