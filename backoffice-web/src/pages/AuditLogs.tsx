import { useEffect, useState } from 'react';
import { Shield, Clock, User, Globe, Loader2 } from 'lucide-react';
import api from '../services/api';

interface AuditEntry {
    id: number;
    admin_name: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    ip_address: string | null;
    created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-50 text-blue-700',
    DELETE_USER: 'bg-red-50 text-red-700',
    DELETE_TEACHER: 'bg-red-50 text-red-700',
    DELETE_SUBJECT: 'bg-red-50 text-red-700',
    CREATE_USER: 'bg-green-50 text-green-700',
    CREATE_SUBJECT: 'bg-green-50 text-green-700',
    APPROVE_TEACHER: 'bg-emerald-50 text-emerald-700',
    AUTO_ENROLL_ALL: 'bg-amber-50 text-amber-700',
    ENROLL_STUDENT: 'bg-sky-50 text-sky-700',
    ASSIGN_TEACHER: 'bg-violet-50 text-violet-700',
    UPDATE_SETTING: 'bg-orange-50 text-orange-700',
};

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/backoffice/manage/audit-logs');
            if (data.success) {
                setLogs(data.logs);
                setTotal(data.total);
            }
        } catch (e) {
            console.error('Failed to load audit logs', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Logs de Auditoria</h1>
                    <p className="text-slate-500 mt-1">Registro imutável de todas as ações realizadas por Super Admins.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm">
                    <Shield className="w-4 h-4" />
                    {total} registro(s)
                </div>
            </div>

            <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Ação</th>
                                <th className="px-6 py-4 font-semibold">Admin</th>
                                <th className="px-6 py-4 font-semibold">Alvo</th>
                                <th className="px-6 py-4 font-semibold">IP</th>
                                <th className="px-6 py-4 font-semibold">Data/Hora</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500" />
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        Nenhum registro de auditoria encontrado.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-slate-400" />
                                                <span className="font-medium text-slate-900">{log.admin_name || 'Sistema'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.target_type ? (
                                                <span className="text-xs">
                                                    <span className="font-mono text-slate-500">{log.target_type}</span>
                                                    {log.target_id && <span className="text-slate-400 ml-1">#{log.target_id}</span>}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Globe className="w-3.5 h-3.5" />
                                                <span className="font-mono text-xs">{log.ip_address || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span className="text-xs">
                                                    {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '-'}
                                                </span>
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
