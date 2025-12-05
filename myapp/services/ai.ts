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
