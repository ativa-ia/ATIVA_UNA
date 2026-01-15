import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// URL da API (mude para seu IP local se testar em dispositivo físico)
// Para desenvolvimento local, use localhost
//export const API_URL = 'http://localhost:3000/api';

// Para produção/Vercel, use:
//export const API_URL = 'https://ativa-ia-9rkb.vercel.app/api';

export const API_URL = 'https://ativa2.vercel.app/api';

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

export interface TeacherClass {
    id: number;
    name: string;
    code: string;
    schedule?: string;
    location?: string;
    student_count?: number;
}

// Buscar turmas/disciplinas do professor
export const getTeacherClasses = async (): Promise<TeacherClass[]> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/subjects`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    const subjects = await response.json();

    // Mapear para o formato esperado pelo dashboard
    return subjects.map((subject: any) => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        schedule: subject.schedule || 'Seg/Qua 14h-16h',
        location: subject.location,
        student_count: subject.student_count || 0,
    }));
};

// ========== ACCOUNT MANAGEMENT ==========

export interface UpdateProfileData {
    name?: string;
    email?: string;
}

export interface ChangePasswordData {
    current_password: string;
    new_password: string;
}

// Atualizar perfil do usuário
export const updateProfile = async (data: UpdateProfileData): Promise<AuthResponse> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/auth/update-profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    return response.json();
};

// Alterar senha do usuário
export const changePassword = async (data: ChangePasswordData): Promise<AuthResponse> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    return response.json();
};


// ========== AI CONTEXT API ==========

// Upload via Supabase Storage (Bypassing Vercel Limit)
// Upload via Supabase Storage (Bypassing Vercel Limit)
export const uploadContextFile = async (subjectId: number, file: any, options?: { sessionId?: number }) => {
    try {
        const token = await AsyncStorage.getItem('authToken');

        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${subjectId}/${fileName}`;

        // For Expo Document Picker, we need to read the file as ArrayBuffer or Blob
        // Since Expo < 50 might be tricky with Blob, let's try FormData to Supabase if supported, 
        // or fetch the URI to get the blob.

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
            return { success: false, error: 'Erro ao enviar para Storage: ' + uploadError.message };
        }

        // 2. Get Public URL (or Signed URL if bucket is private, assuming public for now or backend can access)
        const { data: urlData } = supabase.storage
            .from('context-documents')
            .getPublicUrl(filePath);

        const fileUrl = urlData.publicUrl;

        // 3. Send Metadata to Backend
        const response = await fetch(`${API_URL}/ai/upload-context`, {
            method: 'POST',
            body: JSON.stringify({
                subject_id: subjectId,
                session_id: options?.sessionId, // Pass Session ID explicitly
                file_url: fileUrl,
                file_path: filePath,
                file_type: file.mimeType || 'application/pdf',
                filename: file.name
            }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            try {
                return JSON.parse(errorText);
            } catch (e) {
                return { success: false, error: `Erro no backend (${response.status})` };
            }
        }

        return response.json();
    } catch (error) {
        console.error('Upload flow error:', error);
        return { success: false, error: 'Erro no processo de upload' };
    }
};

// Gerar sugestões de perguntas baseadas no contexto (novo arquivo)
export const generateSuggestions = async (subjectId: number) => {
    const token = await AsyncStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_URL}/ai/generate-suggestions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ subject_id: subjectId }),
        });
        return response.json();
    } catch (error) {
        return { success: false, error: 'Erro ao gerar sugestões' };
    }
};

export const getContextFiles = async (subjectId: number, sessionId?: number) => {
    const token = await AsyncStorage.getItem('authToken');
    try {
        const url = new URL(`${API_URL}/ai/context-files/${subjectId}`);
        if (sessionId) {
            url.searchParams.append('session_id', sessionId.toString());
        }

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        return response.json();
    } catch (error) {
        return { success: false, error: 'Erro ao listar arquivos' };
    }
};

export const deleteContextFile = async (fileId: number) => {
    const token = await AsyncStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_URL}/ai/context-files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        return response.json();
    } catch (error) {
        console.error('Erro detalhado ao deletar:', error);
        return { success: false, error: 'Erro ao deletar arquivo' };
    }
};

// Compartilhar conteúdo (Quiz/Resumo) com a turma
export const shareContent = async (subjectId: number, content: string | object, type: 'quiz' | 'summary', title: string) => {
    const token = await AsyncStorage.getItem('authToken');
    console.log('[API] Sharing Content...', { subjectId, type, title });

    try {
        const response = await fetch(`${API_URL}/ai/share-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                subject_id: subjectId,
                content,
                type,
                title
            }),
        });

        const text = await response.text();
        console.log('[API] Share Content Raw Response:', text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('[API] Failed to parse JSON response:', e);
            return { success: false, error: 'Resposta inválida do servidor: ' + text.substring(0, 100) };
        }

        return data;
    } catch (error) {
        console.error('Erro ao compartilhar conteúdo:', error);
        return { success: false, error: 'Erro de conexão ao compartilhar' };
    }
};


// ========== ENROLLMENTS API ==========

export interface AutoEnrollResponse {
    success: boolean;
    message: string;
    enrollments_created?: number;
    total_enrollments?: number;
}

// Auto-matrícula de estudante em todas as disciplinas
export const autoEnrollStudent = async (): Promise<AutoEnrollResponse> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/enrollments/auto-enroll`, {
        method: 'POST',  // IMPORTANTE: Deve ser POST, não GET
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};


// ========== PERFORMANCE API ==========









// Professor - Lançar notas


// Professor - Desempenho da turma
// Professor - Desempenho da turma




// Aluno - Todas as notas


// Professor - Desempenho individual do aluno





// ========== TRANSCRIPTION API ==========

export interface TranscriptionSession {
    id: number;
    subject_id: number;
    teacher_id: number;
    title: string;
    full_transcript: string;
    word_count: number;
    status: 'active' | 'paused' | 'ended';
    started_at: string;
    ended_at: string | null;
    checkpoints?: TranscriptionCheckpoint[];
    activities?: LiveActivity[];
}

export interface TranscriptionCheckpoint {
    id: number;
    session_id: number;
    transcript_at_checkpoint: string;
    word_count: number;
    reason: string;
    created_at: string;
}

export interface LiveActivity {
    id: number;
    session_id: number;
    checkpoint_id: number;
    activity_type: 'quiz' | 'summary' | 'open_question';
    title: string;
    content: any;
    ai_generated_content?: string;
    shared_with_students: boolean;
    status: 'waiting' | 'active' | 'ended';
    subject_name?: string;
    time_limit: number;
    time_remaining: number | null;
    starts_at: string | null;
    ends_at: string | null;
    response_count: number;
}

export interface LiveActivityResponse {
    id: number;
    activity_id: number;
    student_id: number;
    student_name: string;
    response_data: any;
    is_correct: boolean | null;
    score: number;
    total: number;
    percentage: number;
    points?: number; // Pontos gamificados
    submitted_at: string;
}

export interface RankingData {
    activity_status: string;
    time_remaining: number;
    enrolled_count: number;
    response_count: number;
    response_rate: number;
    ranking: Array<{
        position: number;
        student_id?: number;
        student_name: string;
        score: number;
        total?: number;
        points: number; // Pontos gamificados
        percentage: number;
        is_correct?: boolean;
        submitted_at?: string;
    }>;
}

// Criar ou recuperar sessão de transcrição
export const createTranscriptionSession = async (subjectId: number, title?: string): Promise<{ success: boolean; session: TranscriptionSession }> => {
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

// Obter sessão de transcrição
export const getTranscriptionSession = async (sessionId: number): Promise<{ success: boolean; session: TranscriptionSession }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Atualizar transcrição (auto-save)
export const updateTranscription = async (sessionId: number, fullTranscript: string): Promise<{ success: boolean; word_count: number }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ full_transcript: fullTranscript }),
    });

    return response.json();
};

// Criar checkpoint
export const createCheckpoint = async (sessionId: number, reason?: string): Promise<{ success: boolean; checkpoint: TranscriptionCheckpoint }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/checkpoint`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
    });

    return response.json();
};



// Retomar sessão
export const resumeSession = async (sessionId: number): Promise<{ success: boolean; session: TranscriptionSession }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/resume`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Encerrar sessão
export const endTranscriptionSession = async (sessionId: number): Promise<{ success: boolean; session: TranscriptionSession }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/end`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Gerar Quiz via IA
export const generateQuiz = async (sessionId: number, numQuestions: number = 5, timeLimit?: number): Promise<{ success: boolean; activity?: LiveActivity; checkpoint?: TranscriptionCheckpoint; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/generate-quiz`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            num_questions: numQuestions,
            time_limit: timeLimit || numQuestions * 60  // Default: 1 minute per question
        }),
    });

    return response.json();
};

// Salvar atividade gerada externamente
export const saveGeneratedActivity = async (sessionId: number, data: any): Promise<{ success: boolean; activity: LiveActivity; checkpoint: TranscriptionCheckpoint }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/save-generated-activity`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    return response.json();
};

// Gerar Resumo via IA
export const generateSummary = async (sessionId: number): Promise<{ success: boolean; activity: LiveActivity; checkpoint: TranscriptionCheckpoint; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/generate-summary`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Criar Pergunta Aberta
export const createOpenQuestion = async (sessionId: number, question: 'doubts' | 'feedback', timeLimit: number = 120): Promise<{ success: boolean; activity: LiveActivity }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/activities`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            activity_type: 'open_question',
            question,
            time_limit: timeLimit,
        }),
    });

    return response.json();
};

// Iniciar atividade para alunos
export const broadcastActivity = async (activityId: number, title?: string): Promise<{ success: boolean; activity: LiveActivity; enrolled_students?: number }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/broadcast`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title })
    });

    return response.json();
};

// Compartilhar resumo com alunos
export const shareSummary = async (activityId: number, title?: string): Promise<{ success: boolean; activity: LiveActivity }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/share`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title })
    });

    return response.json();
};

// Atualizar atividade (ex: remover questões do quiz)
// Atualizar atividade (ex: remover questões do quiz ou editar resumo)
export const updateActivity = async (activityId: number, data: any): Promise<{ success: boolean; activity: LiveActivity; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/update`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    return response.json();
};


// Encerrar atividade
export const endActivity = async (activityId: number): Promise<{ success: boolean; activity: LiveActivity }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/end`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Obter ranking em tempo real (polling)
export const getActivityRanking = async (activityId: number): Promise<{ success: boolean } & RankingData> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/ranking`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

/**
 * Envia progresso parcial do quiz (sem finalizar)
 */
export const submitQuizProgress = async (quizId: number, data: any): Promise<{ success: boolean; points?: number }> => {
    try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/transcription/activities/${quizId}/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        return response.json();
    } catch (error) {
        console.error('Error submitting progress:', error);
        return { success: false };
    }
};


// Aluno: verificar atividade ativa
export const getActiveActivity = async (subjectId: number): Promise<{ success: boolean; active: boolean; activity?: LiveActivity; has_summary?: boolean; summary?: LiveActivity }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/subjects/${subjectId}/active`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Aluno:// Local cache for submitted activities to ensure instant UI updates
export const submittedActivities = new Set<number>();

export const markActivityAsSubmitted = (activityId: number) => {
    submittedActivities.add(activityId);
};

export const isActivitySubmitted = (activityId: number) => {
    return submittedActivities.has(activityId);
};

/**
 * Envia resposta para uma atividade
 */
export const submitActivityResponse = async (activityId: number, data: any): Promise<{ success: boolean; result?: any; error?: string; already_answered?: boolean }> => {
    try {
        const token = await AsyncStorage.getItem('authToken');
        // Correct URL with /transcription prefix
        const response = await fetch(`${API_URL}/transcription/activities/${activityId}/respond`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            markActivityAsSubmitted(activityId);
        }

        return result;
    } catch (error) {
        console.error('Error submitting response:', error);
        return { success: false, error: 'Erro de conexão' };
    }
};

export const getStudentHistory = async (subjectId: number, page: number = 1, limit: number = 10) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/transcription/subjects/${subjectId}/history?page=${page}&per_page=${limit}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    return response.json();
};

// Listar sessões de uma disciplina
export const getTranscriptionSessions = async (subjectId: number): Promise<{ success: boolean; sessions: TranscriptionSession[] }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/subjects/${subjectId}/sessions`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Obter relatório de atividade (paridade com Quiz)
export const getLiveActivityReport = async (activityId: number): Promise<{ success: boolean; report?: any; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/report`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Exportar relatório de atividade em PDF
export const exportActivityPDF = async (activityId: number): Promise<Blob> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/export-pdf`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to export PDF');
    }

    return response.blob();
};

// Encerrar atividade (LiveActivity)
export const endLiveActivity = async (activityId: number): Promise<{ success: boolean; activity?: LiveActivity; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/end`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Converter conteúdo usando IA
export const convertContent = async (content: string, type: 'quiz' | 'summary') => {
    const token = await AsyncStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_URL}/ai/convert-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                content,
                type
            }),
        });
        return response.json();
    } catch (error) {
        console.error('Erro ao converter conteúdo:', error);
        return { success: false, error: 'Erro de conexão ao converter' };
    }
};

// Professor: Listar atividades ativas da disciplina
export const getActiveActivitiesList = async (subjectId: number): Promise<{ success: boolean; activities: LiveActivity[] }> => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/transcription/subjects/${subjectId}/active_list`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    return response.json();
};

// Professor:// Distribuir material de reforço (Professor)
export const distributeActivityMaterial = async (activityId: number, file: any, title: string, textContent?: string, contentUrl?: string): Promise<{ success: boolean; message?: string; count?: number; average?: number; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const formData = new FormData();
    formData.append('title', title);

    if (contentUrl) {
        formData.append('content_url', contentUrl);
    }

    if (file) {
        if (Platform.OS === 'web') {
            // Expo Document Picker on Web returns the File object in the 'file' property of the asset
            if (file.file) {
                formData.append('file', file.file);
            } else {
                formData.append('file', file);
            }
        } else {
            formData.append('file', {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || 'application/pdf'
            } as any);
        }
    } else if (textContent) {
        formData.append('text_content', textContent);
    }

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/distribute_material`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            // 'Content-Type': 'multipart/form-data', // Do NOT set this manually with FormData
        },
        body: formData,
    });

    return response.json();
};

// Gerar resumo de IA para reforço
export const generateActivitySummary = async (activityId: number): Promise<{ success: boolean; summary?: string; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/ai_summary`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    return response.json();
};

// Obter materiais do aluno (Aluno)
export const getStudentMaterials = async (): Promise<Material[]> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/subjects/student/materials`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    const data = await response.json();

    // Map API response (snake_case) to Frontend Model (camelCase)
    return data.map((item: any) => ({
        id: item.id.toString(),
        title: item.title,
        subject: item.subject || 'Geral',
        type: item.type || 'document',
        uploadDate: item.upload_date || item.created_at || new Date().toISOString(),
        size: item.file_size || item.size || undefined,
        url: item.content_url || item.url
    }));
};
