import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// URL da API (mude para seu IP local se testar em dispositivo físico)
// Para desenvolvimento local, use localhost
export const API_URL = 'http://localhost:3000/api';

// Para produção/Vercel, use:
//export const API_URL = 'https://ativa-ia-9rkb.vercel.app/api';

export interface LoginData {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    role: 'student' | 'teacher';
    name: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    user?: {
        id: number;
        email: string;
        role: 'student' | 'teacher' | 'admin';
        name: string;
    };
    token?: string;
}

// Login
export const login = async (data: LoginData): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
};

// Cadastro
export const register = async (data: RegisterData): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
};

// Recuperar senha
export const forgotPassword = async (email: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    return response.json();
};

// Quick Access (sem senha) - para apresentação
export interface QuickAccessData {
    name: string;
    email: string;
}

export const quickAccess = async (data: QuickAccessData): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/auth/quick-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
};

// Obter usuário autenticado
export const getMe = async (): Promise<AuthResponse> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    return response.json();
};

// Salvar dados de autenticação
export const saveAuth = async (token: string, role: string) => {
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('userRole', role);
};

// Limpar dados de autenticação (logout)
export const clearAuth = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userRole');
};

// Verificar se está autenticado
export const isAuthenticated = async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
};

// Obter role do usuário
export const getUserRole = async (): Promise<'student' | 'teacher' | 'admin' | null> => {
    const role = await AsyncStorage.getItem('userRole');
    return role as 'student' | 'teacher' | 'admin' | null;
};

// ========== SUBJECTS API ==========

export interface Subject {
    id: number;
    name: string;
    code: string;
    description?: string;
    credits?: number;
    image_url?: string;
    imageUrl?: string; // Alias para compatibilidade
}

export interface SubjectDetails extends Subject {
    professor?: string;
    schedule?: string;
    location?: string;
    pending_activities?: number;
}

import { Material } from '@/types';

// ... (other code)

// Material defined in @/types/index.ts
// export interface Material {
//     id: string;
//     title: string;
//     subject: string;
//     type: 'pdf' | 'video' | 'link' | 'document';
//     uploadDate: string;
//     size?: string;
// }

// Buscar disciplinas do usuário logado
export const getSubjects = async (): Promise<Subject[]> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/subjects`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    const data = await response.json();

    // Mapear image_url para imageUrl para compatibilidade
    return data.map((subject: any) => ({
        ...subject,
        imageUrl: subject.image_url || subject.imageUrl
    }));
};

// Buscar detalhes de uma disciplina
export const getSubjectDetails = async (subjectId: number): Promise<SubjectDetails> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/subjects/${subjectId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    const data = await response.json();

    // Mapear image_url para imageUrl
    return {
        ...data,
        imageUrl: data.image_url || data.imageUrl
    };
};

// Buscar materiais de uma disciplina
export const getSubjectMaterials = async (subjectId: number): Promise<Material[]> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/subjects/${subjectId}/materials`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    const data = await response.json();

    return data.map((item: any) => ({
        id: item.id.toString(),
        title: item.title,
        subject: item.subject || 'Disciplina', // Should retrieve from context if missing
        type: item.type || 'document',
        uploadDate: item.upload_date || item.uploaded_at || new Date().toISOString(),
        size: item.size || undefined,
        url: item.url
    }));
};

// Create a new material (Teacher)
export const createMaterial = async (subjectId: number, data: any): Promise<{ success: boolean; message?: string; material?: any; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_URL}/subjects/${subjectId}/materials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });
        return response.json();
    } catch (error) {
        return { success: false, error: 'Erro ao criar material' };
    }
};

// Upload file to storage (Generic)
export const uploadFileToStorage = async (file: any, folder: string = 'materials') => {
    try {
        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        let fileBody: any;
        if (Platform.OS === 'web') {
            fileBody = file.file; // Browser File object
        } else {
            const response = await fetch(file.uri);
            fileBody = await response.blob();
        }

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('context-documents') // Reuse existing bucket or change if 'materials' bucket exists
            .upload(filePath, fileBody, {
                contentType: file.mimeType || 'application/pdf',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase Storage Error:', uploadError);
            return { success: false, error: 'Erro ao enviar para Storage: ' + uploadError.message };
        }

        // 2. Get Public URL
        const { data: urlData } = supabase.storage
            .from('context-documents') // CORRECT
            .getPublicUrl(filePath);

        return { success: true, url: urlData.publicUrl, path: filePath, size: file.size };
    } catch (error) {
        console.error('Upload flow error:', error);
        return { success: false, error: 'Erro no processo de upload' };
    }
};

// Upload text content as file (for AI summaries on Vercel)
export const uploadTextAsFile = async (content: string, filename: string): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
        const filePath = `materials/${filename}`;

        // Convert text to Blob
        const blob = new Blob([content], { type: 'text/markdown' });

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('context-documents')
            .upload(filePath, blob, {
                contentType: 'text/markdown',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase Text Upload Error:', uploadError);
            return { success: false, error: uploadError.message };
        }

        const { data: urlData } = supabase.storage
            .from('context-documents')
            .getPublicUrl(filePath);

        return { success: true, url: urlData.publicUrl };
    } catch (error) {
        console.error('Text upload error:', error);
        return { success: false, error: 'Falha ao salvar resumo na nuvem' };
    }
};

// ========== TEACHER API ==========

export const getTeacherClasses = async (): Promise<TeacherClass[]> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/teacher/classes`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

export interface TeacherClass {
    id: number;
    subject: string;
    classCode: string; // e.g., "A", "B"
    schedule: string;
}

// ========== AI ASSISTANT API ==========

// Upload via Supabase Storage (Bypassing Vercel Limit)
// Upload para N8N (Vector Store) via Webhook
export const uploadContextFile = async (subjectId: number, file: any, options?: { sessionId?: number, subjectName?: string }) => {
    try {
        const token = await AsyncStorage.getItem('authToken');

        // 1. Upload to Supabase Storage (Manter para histórico/backup)
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${subjectId}/${fileName}`;

        let fileBody: any;
        if (Platform.OS === 'web') {
            fileBody = file.file; // Browser File object
        } else {
            const response = await fetch(file.uri);
            fileBody = await response.blob();
        }

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('context-documents')
            .upload(filePath, fileBody, {
                contentType: file.mimeType || 'application/pdf',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase Storage Error:', uploadError);
            return { success: false, error: 'Erro Bucket Supabase: ' + uploadError.message };
        }

        // 2. Get Public URL
        const { data: urlData } = supabase.storage
            .from('context-documents')
            .getPublicUrl(filePath);

        const fileUrl = urlData.publicUrl;

        // 3. Send to N8N Webhook (Multipart Form Data with Binary)
        // URL fornecida pelo usuário
        const N8N_WEBHOOK_URL = 'https://jrbp-n8n-server.hf.space/webhook/upload-aula';
        console.log('[API] Sending to N8N Webhook (Binary):', N8N_WEBHOOK_URL);

        // Construir FormData conforme solicitado
        const formData = new FormData();
        formData.append('classroom_id', options?.subjectName || subjectId.toString()); // Envia nome
        formData.append('filename', file.name);

        // Enviar o arquivo binário no campo 'data'
        if (Platform.OS === 'web') {
            formData.append('data', file.file);
        } else {
            // React Native FormData format
            formData.append('data', {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || 'application/pdf'
            } as any);
        }

        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            body: formData,
            // Header Content-Type é automático
        });

        const responseText = await response.text();

        if (!response.ok) {
            // Ignore "No binary data" error from n8n (it's actually a success)
            if (response.status === 500 && responseText.includes('No binary data was found to return')) {
                console.log('[API] Ignorando erro 500 do n8n (falso negativo)');
            } else {
                console.error('[API] N8N Error:', response.status, responseText);
                return { success: false, error: `Erro n8n (${response.status})` };
            }
        }

        // N8N response
        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { success: true, message: 'Processamento iniciado' };
        }

        // 4. Register File in Backend (to list in App)
        try {
            console.log('[API] Registering file in backend...');
            const backendResponse = await fetch(`${API_URL}/ai/upload-context`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subject_id: subjectId,
                    file_url: fileUrl,
                    filename: file.name
                })
            });

            if (!backendResponse.ok) {
                console.warn('[API] Backend Registration Warning:', await backendResponse.text());
            } else {
                console.log('[API] File registered in backend successfully');
            }
        } catch (backendError) {
            console.warn('[API] Failed to register file in backend:', backendError);
            // Don't fail the whole process if just listing fails, as RAG is the priority
        }

        return { success: true, ...data };

    } catch (error) {
        console.error('Upload flow error:', error);
        return { success: false, error: 'Erro no processo de upload' };
    }
};

export const getContextFiles = async (subjectId: number): Promise<any[]> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/ai/context-files/${subjectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const deleteContextFile = async (fileId: number): Promise<any> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/ai/context-files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const generateSuggestions = async (subjectId: number, topic: string): Promise<any> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/ai/generate-suggestions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subjectId, topic })
    });
    return response.json();
};

export const shareContent = async (content: string, platform: 'whatsapp' | 'email' | 'classroom'): Promise<any> => {
    // Mock implementation
    console.log(`Sharing to ${platform}:`, content);
    return { success: true };
};


// ========== ATIVIDADES (LIVE ACTIVITIES) ==========

export interface LiveActivity {
    id: number;
    title: string;
    type: 'quiz' | 'poll' | 'wordcloud';
    status: 'active' | 'ended';
    participants: number;
    subjectId: number;
    subjectName?: string;
    code: string; // Código de acesso (ex: "X9F2")
}

// Criar nova atividade
export const createLiveActivity = async (data: any): Promise<{ success: boolean; activity?: LiveActivity }> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/activities`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response.json();
};

// Listar atividades ativas (Teacher Dashboard)
export const getActiveActivities = async (subjectId?: number): Promise<LiveActivity[]> => {
    const token = await AsyncStorage.getItem('authToken');
    let url = `${API_URL}/activities/active`;
    if (subjectId) {
        url += `?subjectId=${subjectId}`;
    }

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    return response.json();
};

// Encerrar atividade
export const endActivity = async (activityId: number): Promise<any> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/activities/${activityId}/end`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    return response.json();
};

// ========== TRANSCRIPTION API ==========

export interface TranscriptionSession {
    id: number;
    subject_id: number;
    title: string;
    full_transcript: string;
    summary?: string;
    created_at: string;
    status: 'active' | 'paused' | 'ended';
    activities?: LiveActivity[];
}

export const createTranscriptionSession = async (subjectId: number, title: string): Promise<{ success: boolean; session?: TranscriptionSession; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/transcription/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subject_id: subjectId, title }),
    });
    return response.json();
};

export const updateTranscription = async (sessionId: number, text: string): Promise<{ success: boolean; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ full_transcript: text }),
    });
    return response.json();
};

export const getTranscriptionSession = async (sessionId: number): Promise<{ success: boolean; session?: TranscriptionSession; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const resumeSession = async (sessionId: number): Promise<{ success: boolean; session?: TranscriptionSession; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const endTranscriptionSession = async (sessionId: number): Promise<{ success: boolean; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const shareSummary = async (sessionId: number, platform: string): Promise<{ success: boolean; error?: string }> => {
    // Mock implementation for now
    console.log(`Sharing summary for session ${sessionId} to ${platform}`);
    return { success: true };
};

export const generateQuiz = async (subjectId: number, content: string) => {
    const token = await AsyncStorage.getItem('authToken');
    // Note: The backend expects sessionId, but the frontend function is typed with subjectId. 
    // If the frontend calls this with subjectId as the first arg, we might have a problem if the backend expects sessionId in the URL.
    // However, looking at transcription.tsx, it calls generateQuiz(session.id, 1). So the first arg IS sessionId.
    // I should rename the arg to sessionId to be clear, but I'll keeping it consistent with the file for now, just fixing the URL.
    const sessionId = subjectId;
    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/generate-quiz`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        // Backend expects { num_questions: int, time_limit: int }
        // Frontend passed "content" which seems to be "1" (num questions) based on transcription.tsx call
        body: JSON.stringify({ num_questions: content })
    });
    return response.json();
};

export const generateSummary = async (subjectId: number, content: string) => {
    const token = await AsyncStorage.getItem('authToken');
    const sessionId = subjectId;
    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/generate-summary`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({}) // No body needed for simple summary generation based on transcript
    });
    return response.json();
};

export const createOpenQuestion = async (subjectId: number, question: string, timeLimit: number = 120) => {
    const token = await AsyncStorage.getItem('authToken');
    const sessionId = subjectId;
    // Backend: POST /sessions/<id>/activities { activity_type: 'open_question', question: ..., time_limit: ... }
    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/activities`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            activity_type: 'open_question',
            question: question,
            time_limit: timeLimit
        })
    });
    return response.json();
};

export const broadcastActivity = async (activityId: number) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/activities/${activityId}/broadcast`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

export const updateActivity = async (activityId: number, data: any) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/activities/${activityId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    return response.json();
};

export const saveGeneratedActivity = async (sessionId: number, data: any) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/save-generated-activity`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    return response.json();
};
