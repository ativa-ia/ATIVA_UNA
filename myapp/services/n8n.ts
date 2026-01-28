import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const N8N_WEBHOOK_URL = process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL;

if (!N8N_WEBHOOK_URL) {
    throw new Error('EXPO_PUBLIC_N8N_WEBHOOK_URL environment variable is not set');
}

// Generic text processing via N8N Webhook
export const processText = async (text: string | null, instruction?: string, extraParams?: Record<string, any>) => {
    try {
        const payload = (text && instruction) ? `${text}\n\n[INSTRUCTION]: ${instruction}` : text;
        console.log('Sending text to N8N:', (payload ? payload.substring(0, 50) : 'null') + '...', 'Extra:', extraParams);

        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Sending 'text' property as expected by the reference project
            // If N8N agent expects instructions inside the text, we prepend/append them.
            // extraParams allows sending additional fields like { subject: 'Math', type: 'quiz' }
            body: JSON.stringify({ text: payload, ...extraParams }),
        });

        if (!response.ok) {
            throw new Error(`N8N Request failed with status ${response.status}`);
        }

        const textResponse = await response.text();

        try {
            return JSON.parse(textResponse);
        } catch (jsonError) {
            console.error('Failed to parse N8N response:', textResponse);
            // Return raw text if JSON parse fails (fallback for simple text or tagged strings)
            return { output: textResponse };
        }
    } catch (error) {
        console.error('Error processing text with N8N:', error);
        throw error;
    }
};

// Legacy alias if needed, or remove
export const summarizeText = (text: string) => processText(text, 'Summarize this text.');


export const transcribeAudio = async (uri: string) => {
    try {
        console.log('Uploading audio from:', uri);

        if (Platform.OS === 'web') {
            // Web Implementation
            const response = await fetch(uri);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', blob, 'recording.m4a');

            const result = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                body: formData,
            });

            if (!result.ok) {
                throw new Error(`Upload failed with status ${result.status}`);
            }

            return await result.json();
        } else {
            // Native Implementation (Android/iOS)
            const uploadResult = await FileSystem.uploadAsync(N8N_WEBHOOK_URL, uri, {
                httpMethod: 'POST',
                uploadType: 1 as any, // FileSystem.FileSystemUploadType.MULTIPART
                fieldName: 'file',
                mimeType: 'audio/m4a', // Adjust based on recording format
            });

            console.log('Upload result:', uploadResult);

            if (uploadResult.status !== 200) {
                throw new Error(`Upload failed with status ${uploadResult.status}`);
            }

            return JSON.parse(uploadResult.body);
        }
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw error;
    }
};
