import { API_URL } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationPayload {
    subject_id: number;
    title: string;
    message: string;
    type: 'quiz' | 'material' | 'general';
}

export const sendNotification = async (payload: NotificationPayload) => {
    const token = await AsyncStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_URL}/notifications/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao enviar notificação:', error);
        return { success: false, message: 'Erro de conexão' };
    }
};
