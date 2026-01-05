import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const N8N_WEBHOOK_URL = 'http://192.168.0.65:5678/webhook/transcribe';

// Generic text processing via N8N Webhook
export const processText = async (text: string, instruction?: string) => {
    try {
        const payload = instruction ? `${text}\n\n[INSTRUCTION]: ${instruction}` : text;
        console.log('Sending text to N8N:', payload.substring(0, 50) + '...');

        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Sending 'text' property as expected by the reference project
            // If N8N agent expects instructions inside the text, we prepend/append them.
            body: JSON.stringify({ text: payload }),
        });

        if (!response.ok) {
            throw new Error(`N8N Request failed with status ${response.status}`);
        }

        return await response.json();
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
