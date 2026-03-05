import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Users } from 'lucide-react';
import api from '../services/api';

interface Teacher {
    id: number;
    name: string;
    email: string;
    registration_number: string | null;
    subjects_count: number;
    created_at: string;
}

export default function Teachers() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/backoffice/manage/teachers');
            if (data.success) {
                setTeachers(data.teachers);
            }
        } catch (e) {
            console.error('Failed to load teachers', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const handleApprove = async (id: number) => {
        setActionLoading(id);
        try {
            await api.patch(`/backoffice/manage/teachers/${id}/approve`);
            fetchTeachers();
        } catch (e: any) {
            alert('Erro ao aprovar: ' + (e.response?.data?.message || e.message));
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Certeza que deseja remover este professor permanentemente?")) return;
        setActionLoading(id);
        try {
            await api.delete(`/backoffice/manage/teachers/${id}`);
            fetchTeachers();
        } catch (e: any) {
            alert('Erro ao remover: ' + (e.response?.data?.message || e.message));
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão de Professores</h1>
                    <p className="text-slate-500 mt-1">Gerencie todos os professores cadastrados na plataforma.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg font-semibold text-sm">
                    <Users className="w-4 h-4" />
                    {teachers.length} professor(es)
                </div>
            </div>

            <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Professor</th>
                                <th className="px-6 py-4 font-semibold">Matrícula</th>
                                <th className="px-6 py-4 font-semibold">Disciplinas</th>
                                <th className="px-6 py-4 font-semibold">Data Cadastro</th>
                                <th className="px-6 py-4 font-semibold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500" />
                                    </td>
                                </tr>
                            ) : teachers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        Nenhum professor cadastrado.
                                    </td>
                                </tr>
                            ) : (
                                teachers.map((teacher) => (
                                    <tr key={teacher.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{teacher.name}</div>
                                            <div className="text-slate-500 text-xs mt-0.5">{teacher.email}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">{teacher.registration_number || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                                                {teacher.subjects_count} disciplina(s)
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {new Date(teacher.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleApprove(teacher.id)}
                                                    disabled={actionLoading === teacher.id}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="Aprovar Professor"
                                                >
                                                    {actionLoading === teacher.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(teacher.id)}
                                                    disabled={actionLoading === teacher.id}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remover Professor"
                                                >
                                                    {actionLoading === teacher.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                                                </button>
                                            </div>
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
