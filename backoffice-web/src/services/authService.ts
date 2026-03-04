import api from './api';

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
    last_login_at: string;
}

export interface LoginResponse {
    success: boolean;
    message: string;
    token?: string;
    admin?: AdminUser;
}

export const authService = {
    async login(email: string, password: string): Promise<LoginResponse> {
        const { data } = await api.post<LoginResponse>('/backoffice/auth/login', {
            email,
            password,
        });

        if (data.success && data.token && data.admin) {
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('admin_user', JSON.stringify(data.admin));
        }

        return data;
    },

    async verify(): Promise<boolean> {
        try {
            const { data } = await api.get('/backoffice/auth/verify');
            return data.success;
        } catch {
            return false;
        }
    },

    logout() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
    },

    getCurrentAdmin(): AdminUser | null {
        const userStr = localStorage.getItem('admin_user');
        if (!userStr) return null;
        try {
            return JSON.parse(userStr) as AdminUser;
        } catch {
            return null;
        }
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem('admin_token');
    }
};
