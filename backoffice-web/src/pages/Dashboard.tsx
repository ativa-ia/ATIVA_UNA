import { useEffect, useState } from 'react';
import { Users, BookOpen, GraduationCap, Building, Activity, Zap, RefreshCw } from 'lucide-react';
import api from '../services/api';

interface StatsData {
    users: {
        total: number;
        students: number;
        teachers: number;
        school_admins: number;
    };
    academic: {
        subjects: number;
        enrollments: number;
    };
}

export default function Dashboard() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [enrollResult, setEnrollResult] = useState<{ created: number, skipped: number } | null>(null);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/backoffice/manage/stats');
            if (data.success) {
                setStats(data.stats);
            }
        } catch (e) {
            console.error('Failed to load stats', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleEnrollAll = async () => {
        if (!window.confirm("Essa ação matriculará TODOS os alunos em TODAS as disciplinas. Confirma?")) {
            return;
        }

        setEnrolling(true);
        setEnrollResult(null);
        try {
            const { data } = await api.post('/backoffice/manage/enroll-all-students');
            if (data.success) {
                setEnrollResult({
                    created: data.enrollments_created,
                    skipped: data.enrollments_skipped
                });
                fetchStats(); // recarregar estatísticas
            }
        } catch (e: any) {
            alert("Falha: " + (e.response?.data?.message || e.message));
        } finally {
            setEnrolling(false);
        }
    };

    const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
        <div className="card flex items-center gap-4 transition-transform hover:-translate-y-1">
            <div className={`p-4 rounded-xl ${colorClass}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <p className="text-3xl font-bold text-slate-800 tracking-tight">
                    {loading ? '-' : value}
                </p>
            </div>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Health</h1>
                    <p className="text-slate-500 mt-1">Métricas de tempo real da infraestrutura da plataforma.</p>
                </div>

                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm font-medium"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total de Usuários"
                    value={stats?.users.total}
                    icon={Users}
                    colorClass="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="Alunos Ativos"
                    value={stats?.users.students}
                    icon={GraduationCap}
                    colorClass="bg-indigo-50 text-indigo-600"
                />
                <StatCard
                    title="Professores"
                    value={stats?.users.teachers}
                    icon={BookOpen}
                    colorClass="bg-green-50 text-green-600"
                />
                <StatCard
                    title="Diretores / Escolas"
                    value={stats?.users.school_admins}
                    icon={Building}
                    colorClass="bg-orange-50 text-orange-600"
                />
                <StatCard
                    title="Materiais e Matérias"
                    value={stats?.academic.subjects}
                    icon={Activity}
                    colorClass="bg-purple-50 text-purple-600"
                />
                <StatCard
                    title="Total de Matrículas"
                    value={stats?.academic.enrollments}
                    icon={Users}
                    colorClass="bg-rose-50 text-rose-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Painel de Gestão e Demos */}
                <div className="card border-primary-100 bg-gradient-to-br from-white to-primary-50/30">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                            <Zap className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">Ações Globais (Demo)</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 border border-slate-200 bg-white rounded-xl shadow-sm">
                            <h3 className="font-semibold text-slate-800 mb-1">Matrícula em Massa</h3>
                            <p className="text-sm text-slate-500 mb-4">
                                Pega todos os alunos registrados na base e matricula instantaneamente em todas as disciplinas disponíveis. Cuidado em bancos de produção.
                            </p>

                            {enrollResult && (
                                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                                    <span className="font-semibold">Sucesso:</span> {enrollResult.created} novas matrículas criadas ({enrollResult.skipped} já existiam).
                                </div>
                            )}

                            <button
                                onClick={handleEnrollAll}
                                disabled={enrolling || loading}
                                className="btn-primary w-full shadow-sm shadow-primary-500/20"
                            >
                                {enrolling ? 'Matriculando...' : 'Executar Auto-Matrícula Global'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
