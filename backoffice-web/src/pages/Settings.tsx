import { useEffect, useState } from 'react';
import { Settings2, Save, Loader2, AlertCircle, BookOpen, X, Search, Wrench } from 'lucide-react';
import api from '../services/api';

interface SystemSetting {
    key: string;
    value: string;
    description: string;
    is_public: boolean;
    updated_at: string;
}

interface SubjectOption {
    id: number;
    name: string;
    code: string;
}

export default function Settings() {
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    // Derivado: estado atual do modo manutenção
    const maintenanceActive = settings.find(s => s.key === 'MAINTENANCE_MODE')?.value === 'true';

    // New setting form
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newIsPublic, setNewIsPublic] = useState(false);

    // Subject picker modal
    const [showSubjectPicker, setShowSubjectPicker] = useState(false);
    const [allSubjects, setAllSubjects] = useState<SubjectOption[]>([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [subjectSearch, setSubjectSearch] = useState('');

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/settings/');
            if (data.success) setSettings(data.settings);
        } catch (e) {
            console.error('Failed to load settings', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    const handleUpdate = async (key: string, value: string, description: string, is_public: boolean) => {
        setSavingKey(key);
        try {
            const { data } = await api.post('/settings/', { key, value, description, is_public });
            if (data.success) fetchSettings();
        } catch (e: any) {
            alert('Erro ao salvar: ' + (e.response?.data?.message || e.message));
        } finally {
            setSavingKey(null);
        }
    };

    const handleToggleMaintenance = async () => {
        const newValue = maintenanceActive ? 'false' : 'true';
        await handleUpdate(
            'MAINTENANCE_MODE',
            newValue,
            'Ativa ou desativa o modo de manutenção para alunos e professores no app mobile.',
            false
        );
    };

    const handleCreateNew = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKey || !newValue) return;
        setSavingKey('__new__');
        try {
            const { data } = await api.post('/settings/', { key: newKey, value: newValue, description: newDescription, is_public: newIsPublic });
            if (data.success) {
                setNewKey(''); setNewValue(''); setNewDescription(''); setNewIsPublic(false);
                fetchSettings();
            }
        } catch (e: any) {
            alert('Erro ao criar: ' + (e.response?.data?.message || e.message));
        } finally {
            setSavingKey(null);
        }
    };

    // Subject picker logic
    const openSubjectPicker = async (currentValue: string) => {
        setSubjectsLoading(true);
        setShowSubjectPicker(true);
        setSubjectSearch('');
        try {
            const { data } = await api.get('/backoffice/manage/subjects');
            if (data.success) {
                setAllSubjects(data.subjects);
                const currentIds = currentValue ? currentValue.split(',').map(Number).filter(Boolean) : [];
                setSelectedSubjectIds(currentIds);
            }
        } catch (e) {
            console.error('Failed to load subjects', e);
        } finally {
            setSubjectsLoading(false);
        }
    };

    const toggleSubject = (id: number) => {
        setSelectedSubjectIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const saveSubjectSelection = async () => {
        const value = selectedSubjectIds.join(',');
        const setting = settings.find(s => s.key === 'AUTO_ENROLLMENT_SUBJECTS');
        await handleUpdate('AUTO_ENROLLMENT_SUBJECTS', value, setting?.description || '', setting?.is_public || false);
        setShowSubjectPicker(false);
    };

    const isAutoEnrollKey = (key: string) => key === 'AUTO_ENROLLMENT_SUBJECTS';

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configurações Globais</h1>
                    <p className="text-slate-500 mt-1">Gerencie variáveis de ambiente, chaves de IA e configurações gerais.</p>
                </div>
            </div>

            {/* ── Modo Manutenção ── */}
            <div className={`mb-8 rounded-2xl border-2 p-5 flex items-center justify-between gap-4 transition-all ${maintenanceActive
                    ? 'border-red-400 bg-red-50'
                    : 'border-slate-200 bg-white'
                }`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${maintenanceActive ? 'bg-red-100' : 'bg-slate-100'
                        }`}>
                        <Wrench className={`w-6 h-6 ${maintenanceActive ? 'text-red-600' : 'text-slate-500'
                            }`} />
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg ${maintenanceActive ? 'text-red-700' : 'text-slate-800'
                            }`}>
                            Modo Manutenção
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {maintenanceActive
                                ? '🔴 Ativo — alunos e professores veem a tela de manutenção.'
                                : '🟢 Desativado — sistema operando normalmente.'}
                        </p>
                    </div>
                </div>

                {/* Toggle */}
                <button
                    onClick={handleToggleMaintenance}
                    disabled={savingKey === 'MAINTENANCE_MODE' || loading}
                    className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${maintenanceActive
                            ? 'bg-red-500 focus:ring-red-400'
                            : 'bg-slate-300 focus:ring-primary-400'
                        }`}
                    role="switch"
                    aria-checked={maintenanceActive}
                >
                    <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${maintenanceActive ? 'translate-x-6' : 'translate-x-0'
                        }`}>
                        {savingKey === 'MAINTENANCE_MODE' && (
                            <Loader2 className="w-4 h-4 m-1.5 animate-spin text-slate-400" />
                        )}
                    </span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Settings List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-primary-500" />
                        Configurações Ativas
                    </h2>

                    {loading ? (
                        <div className="card flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary-500 animate-spin" /></div>
                    ) : settings.length === 0 ? (
                        <div className="card bg-slate-50 border-dashed text-center py-12 text-slate-500">Nenhuma configuração encontrada.</div>
                    ) : (
                        settings.map((setting) => (
                            <div key={setting.key} className="card hover:border-primary-200 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-900 font-mono bg-slate-100 px-2 py-1 rounded inline-block text-sm">{setting.key}</h3>
                                        <p className="text-sm text-slate-500 mt-2">{setting.description || 'Sem descrição'}</p>
                                    </div>
                                    {setting.is_public && (
                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Pública</span>
                                    )}
                                </div>

                                {isAutoEnrollKey(setting.key) ? (
                                    <div className="flex items-center gap-4 mt-4">
                                        <div className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-mono">
                                            {setting.value ? `${setting.value.split(',').length} disciplina(s) selecionada(s)` : 'Nenhuma selecionada'}
                                        </div>
                                        <button onClick={() => openSubjectPicker(setting.value)} className="btn-primary gap-2">
                                            <BookOpen className="w-4 h-4" /> Configurar
                                        </button>
                                    </div>
                                ) : setting.key === 'DEFAULT_LOGIN_MODE' ? (
                                    <div className="flex items-center gap-4 mt-4">
                                        <select
                                            className="input-field flex-1 font-mono text-sm"
                                            defaultValue={setting.value}
                                            id={`val-${setting.key}`}
                                        >
                                            <option value="quick_access">quick_access</option>
                                            <option value="tradicional">tradicional</option>
                                        </select>
                                        <button onClick={() => {
                                            const val = (document.getElementById(`val-${setting.key}`) as HTMLSelectElement).value;
                                            handleUpdate(setting.key, val, setting.description, setting.is_public);
                                        }} disabled={savingKey === setting.key} className="btn-primary">
                                            {savingKey === setting.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4 mt-4">
                                        <input type="text" className="input-field flex-1 font-mono text-sm" defaultValue={setting.value} id={`val-${setting.key}`} />
                                        <button onClick={() => {
                                            const val = (document.getElementById(`val-${setting.key}`) as HTMLInputElement).value;
                                            handleUpdate(setting.key, val, setting.description, setting.is_public);
                                        }} disabled={savingKey === setting.key} className="btn-primary">
                                            {savingKey === setting.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* New Setting Form */}
                <div>
                    <div className="card sticky top-8">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Adicionar Nova</h2>
                        <form onSubmit={handleCreateNew} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Chave (Key)</label>
                                <input type="text" required placeholder="EX: MAX_TOKENS" className="input-field font-mono text-sm" value={newKey} onChange={e => setNewKey(e.target.value.toUpperCase())} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Valor</label>
                                <input type="text" required className="input-field font-mono text-sm" value={newValue} onChange={e => setNewValue(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
                                <textarea className="input-field text-sm min-h-[80px]" placeholder="Para que serve essa chave?" value={newDescription} onChange={e => setNewDescription(e.target.value)} />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4" checked={newIsPublic} onChange={e => setNewIsPublic(e.target.checked)} />
                                Tornar pública
                            </label>
                            <button type="submit" disabled={savingKey === '__new__' || !newKey || !newValue} className="btn-primary w-full mt-2">
                                {savingKey === '__new__' ? 'Salvando...' : 'Adicionar Configuração'}
                            </button>
                        </form>
                        <div className="mt-6 p-4 bg-amber-50 rounded-lg flex gap-3 text-amber-800 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>Chaves públicas não devem conter secrets. Elas são expostas para o Frontend Expo.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subject Picker Modal — Escalável para 100+ disciplinas */}
            {showSubjectPicker && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSubjectPicker(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-900">Selecionar Disciplinas</h2>
                            <button onClick={() => setShowSubjectPicker(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Search + Bulk Actions */}
                        <div className="px-6 pt-4 pb-2 space-y-3 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    className="input-field pl-10 text-sm"
                                    placeholder="Buscar por nome ou código..."
                                    value={subjectSearch}
                                    onChange={e => setSubjectSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const filtered = allSubjects.filter(s =>
                                            s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
                                            s.code.toLowerCase().includes(subjectSearch.toLowerCase())
                                        );
                                        setSelectedSubjectIds(prev => {
                                            const newIds = new Set(prev);
                                            filtered.forEach(s => newIds.add(s.id));
                                            return Array.from(newIds);
                                        });
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                                >
                                    Selecionar{subjectSearch ? ' Filtrados' : ' Todos'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedSubjectIds([])}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                                >
                                    Limpar Seleção
                                </button>
                            </div>
                        </div>

                        {/* Subject List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-2">
                            {subjectsLoading ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
                            ) : (() => {
                                const filtered = allSubjects.filter(s =>
                                    s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
                                    s.code.toLowerCase().includes(subjectSearch.toLowerCase())
                                );
                                if (filtered.length === 0) return <p className="text-slate-500 text-center py-8">Nenhuma disciplina encontrada.</p>;
                                return filtered.map(subject => (
                                    <label key={subject.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedSubjectIds.includes(subject.id) ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input type="checkbox" checked={selectedSubjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)}
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-semibold text-slate-900">{subject.name}</span>
                                            <span className="ml-2 text-xs font-mono text-slate-500">{subject.code}</span>
                                        </div>
                                    </label>
                                ));
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-sm text-slate-500">{selectedSubjectIds.length} de {allSubjects.length} selecionada(s)</span>
                            <button onClick={saveSubjectSelection} disabled={savingKey === 'AUTO_ENROLLMENT_SUBJECTS'} className="btn-primary">
                                {savingKey === 'AUTO_ENROLLMENT_SUBJECTS' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Seleção'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
