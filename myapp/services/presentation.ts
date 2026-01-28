import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

export interface PresentationSession {
    id: number;
    code: string;
    teacher_id: number;
    status: 'active' | 'ended';
    current_content: PresentationContent | null;
    created_at: string;
}

export interface PresentationContent {
    type: 'summary' | 'quiz' | 'podium' | 'ranking' | 'image' | 'video' | 'question' | 'document' | 'blank';
    data: any;
    timestamp: string;
    video_control?: {
        command: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'seek_relative';
        value?: number;
        timestamp: string;
    };
}

/**
 * Iniciar apresentação (Professor)
 */
export const startPresentation = async (): Promise<{
    success: boolean;
    session?: PresentationSession;
    code?: string;
    url?: string;
    error?: string;
}> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/presentation/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        }
    });

    return response.json();
};

/**
 * Obter dados da apresentação (Tela de Apresentação)
 */
export const getPresentation = async (code: string): Promise<{
    success: boolean;
    session?: PresentationSession;
    current_content?: PresentationContent;
    error?: string;
}> => {
    const response = await fetch(`${API_URL}/presentation/${code}`);
    return response.json();
};

/**
 * Enviar conteúdo para apresentação (Professor)
 */
export const sendToPresentation = async (
    code: string,
    type: PresentationContent['type'],
    data: any
): Promise<{ success: boolean; message?: string; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/presentation/${code}/send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ type, data })
    });

    return response.json();
};

/**
 * Limpar tela de apresentação (Professor)
 */
export const clearPresentation = async (code: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
}> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/presentation/${code}/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    return response.json();
};

/**
 * Encerrar apresentação (Professor)
 */
export const endPresentation = async (code: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
}> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/presentation/${code}/end`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

// ... (existing code)

/**
 * Controlar vídeo da apresentação (Professor)
 */
export const controlPresentationVideo = async (code: string, command: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'seek_relative', value?: number): Promise<{
    success: boolean;
    message?: string;
    error?: string;
}> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/presentation/${code}/control`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ command, value })
    });

    return response.json();
};

/**
 * Obter sessão ativa do professor
 */
export const getActivePresentation = async (): Promise<{
    // ... (existing code)    success: boolean;
    active: boolean;
    session?: PresentationSession;
}> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/presentation/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    return response.json();
};
