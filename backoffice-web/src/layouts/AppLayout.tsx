import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, BookOpen, Settings, Activity, Shield, Users } from 'lucide-react';
import { authService, type AdminUser } from '../services/authService';

export default function AppLayout() {
    const [admin, setAdmin] = useState<AdminUser | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Escutar eventos de token inválido do axios
        const handleUnauthorized = () => {
            navigate('/login');
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, [navigate]);

    useEffect(() => {
        const checkAuth = async () => {
            if (!authService.isAuthenticated()) {
                setLoading(false);
                return;
            }

            const isValid = await authService.verify();
            if (isValid) {
                setAdmin(authService.getCurrentAdmin());
            } else {
                authService.logout();
            }
            setLoading(false);
        };

        checkAuth();
    }, [location.pathname]); // check on route change occasionally

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!admin) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    const navItems = [
        { label: 'System Health', path: '/', icon: <Activity className="w-5 h-5" /> },
        { label: 'Usuários', path: '/users', icon: <Users className="w-5 h-5" /> },
        { label: 'Gestão Acadêmica', path: '/academic', icon: <BookOpen className="w-5 h-5" /> },
        { label: 'Configurações', path: '/settings', icon: <Settings className="w-5 h-5" /> },
        { label: 'Auditoria', path: '/audit-logs', icon: <Shield className="w-5 h-5" /> },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex">
                <div className="h-16 flex items-center px-6 bg-slate-950/50 border-b border-white/5">
                    <h1 className="text-xl font-bold text-white tracking-tight">Ativa IA <span className="text-primary-500 font-light">HQ</span></h1>
                </div>

                <div className="flex-1 py-6 px-4 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${location.pathname === item.path
                                ? 'bg-primary-600/10 text-primary-400'
                                : 'hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-white/5 bg-slate-900">
                    <div className="flex items-center justify-between px-2 mb-4">
                        <div className="flex flex-col truncate pr-2">
                            <span className="text-sm font-semibold text-white truncate">{admin.name}</span>
                            <span className="text-xs text-slate-500 truncate">{admin.email}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-semibold transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair do Painel
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 sm:hidden">
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Ativa IA <span className="text-primary-500">HQ</span></h1>
                </header>
                <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
