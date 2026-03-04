import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Loader2, Lock } from 'lucide-react';
import { authService } from '../services/authService';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Preencha os dados de acesso');
            return;
        }

        setLoading(true);
        try {
            const res = await authService.login(email, password);
            if (res.success) {
                navigate('/');
            } else {
                setError(res.message || 'Falha ao acessar o backoffice');
            }
        } catch (err: any) {
            setError(
                err.response?.data?.message || 'Erro de conexão com o servidor'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center flex-col items-center">
                    <div className="bg-primary-500 p-3 rounded-2xl shadow-lg shadow-primary-500/20 mb-4">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-white">
                        Ativa IA <span className="text-primary-500 font-light">HQ</span>
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-400 font-medium tracking-wide">
                        ÁREA RESTRITA - SUPER ADMINISTRAÇÃO
                    </p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-slate-200">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center gap-3">
                                <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0" />
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-slate-700">
                                E-mail Corporativo
                            </label>
                            <div className="mt-2">
                                <input
                                    type="email"
                                    required
                                    autoFocus
                                    placeholder="admin@ativaia.com"
                                    className="input-field"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700">
                                Senha Segura
                            </label>
                            <div className="mt-2">
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="input-field"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 h-12 text-base font-semibold shadow-sm hover:shadow-md transition-all mt-4"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                'Autenticar'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-500 font-medium">
                            O acesso a este painel é monitorado e auditado conforme a lei aplicável.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
