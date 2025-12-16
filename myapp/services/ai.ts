import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

export interface AIChatResponse {
    success: boolean;
    response?: string;
    error?: string;
}

export interface AIMessageType {
    id: number;
    session_id: number;
    role: 'user' | 'model';
    content: string;
    created_at: string;
}

// Chat com IA
export const sendAIMessage = async (subjectId: number, message: string): Promise<AIChatResponse> => {
    const token = await AsyncStorage.getItem('authToken');
    console.log('Token encontrado:', token ? 'Sim' : 'Não', 'SubjectId:', subjectId);

    const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            subject_id: subjectId,
            message: message,
            stream: false
        }),
    });

    const data = await response.json();
    console.log('Resposta AI:', data);
    return data;
};



// Buscar histórico de mensagens
export const getAIMessages = async (sessionId: number): Promise<{ success: boolean; messages: AIMessageType[] }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/ai/session/${sessionId}/messages`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Obter ou criar sessão
export const getAISession = async (subjectId: number): Promise<{ success: boolean; session: any }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/ai/session/${subjectId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

export interface AISession {
    id: number;
    subject_id: number;
    teacher_id: number;
    started_at: string;
    ended_at?: string;
    status: 'active' | 'ended';
}

// Listar todas as sessões (histórico)
export const listAISessions = async (subjectId: number): Promise<{ success: boolean; sessions: AISession[] }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/ai/sessions/${subjectId}/all`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Criar NOVA sessão (arquiva a atual)
export const createAISession = async (subjectId: number): Promise<{ success: boolean; session: AISession }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/ai/session/new`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subject_id: subjectId }),
    });

    return response.json();
};

export const activateAISession = async (sessionId: number): Promise<{ success: boolean; session?: AISession; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/ai/session/${sessionId}/activate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

export const deleteAISession = async (sessionId: number): Promise<{ success: boolean; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/ai/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};
