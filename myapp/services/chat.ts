/**
 * Serviço de Chat com IA
 * Gerencia histórico de chat persistente por disciplina
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

export interface ChatMessage {
    id: number;
    user_id: number;
    subject_id: number;
    content: string;
    is_user: boolean;
    created_at: string;
}

/**
 * Busca histórico de chat de uma disciplina
 */
export const getChatHistory = async (
    subjectId: number
): Promise<{ success: boolean; messages?: ChatMessage[]; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_URL}/chat/history/${subjectId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        return response.json();
    } catch (error) {
        return { success: false, error: 'Erro ao buscar histórico' };
    }
};

/**
 * Salva uma mensagem no histórico
 */
export const saveChatMessage = async (
    subjectId: number,
    content: string,
    isUser: boolean
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_URL}/chat/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                subject_id: subjectId,
                content,
                is_user: isUser
            }),
        });

        return response.json();
    } catch (error) {
        return { success: false, error: 'Erro ao salvar mensagem' };
    }
};

/**
 * Limpa todo o histórico de chat de uma disciplina
 */
export const clearChatHistory = async (
    subjectId: number
): Promise<{ success: boolean; message?: string; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_URL}/chat/clear/${subjectId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        return response.json();
    } catch (error) {
        return { success: false, error: 'Erro ao limpar histórico' };
    }
};
