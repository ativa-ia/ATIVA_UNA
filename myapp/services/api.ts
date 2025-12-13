import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// URL da API (mude para seu IP local se testar em dispositivo físico)
// Para desenvolvimento local, use localhost
export const API_URL = 'http://localhost:3000/api';

// Para produção/Vercel, use:
// export const API_URL = 'https://ativa-ia-9rkb.vercel.app/api';

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

export interface Material {
    id: number;
    subject_id: number;
    subject?: string;
    title: string;
    type: 'pdf' | 'video' | 'link';
    url?: string;
    size?: string;
    uploaded_by: number;
    uploaded_at?: string;
    upload_date?: string;
}

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

    return response.json();
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
export const uploadContextFile = async (subjectId: number, file: any) => {
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

export const getContextFiles = async (subjectId: number) => {
    const token = await AsyncStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_URL}/ai/context-files/${subjectId}`, {
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

export interface StudentGrade {
    student_id: number;
    student_name: string;
    av1: number | null;
    av2: number | null;
    average: number | null;
    status: 'excellent' | 'good' | 'warning' | 'critical' | 'pending';
}

export interface ClassPerformanceData {
    subject: {
        id: number;
        name: string;
        code: string;
    };
    stats: {
        total_students: number;
        average_av1: number;
        average_av2: number;
        average_final: number;
        approval_rate: number;
        approved: number;
        at_risk: number;
    };
    students: StudentGrade[];
}

export interface StudentGradesData {
    student: {
        id: number;
        name: string;
    };
    general_average: number;
    total_subjects: number;
    subjects: Array<{
        subject_id: number;
        subject_name: string;
        subject_code: string;
        av1: number | null;
        av2: number | null;
        average: number | null;
        status: 'approved' | 'warning' | 'failed' | 'pending';
    }>;
}

export interface RegisterGradesData {
    subject_id: number;
    assessment_type: 'av1' | 'av2';
    grades: Array<{
        student_id: number;
        grade: number;
    }>;
}

// Professor - Lançar notas
export const registerGrades = async (data: RegisterGradesData): Promise<{ message: string; results: any[] }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/performance/grades`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error('Failed to register grades');
    }

    return response.json();
};

// Professor - Desempenho da turma
// Professor - Desempenho da turma
export const getClassPerformance = async (subjectId: number): Promise<ClassPerformanceData> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/performance/class/${subjectId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch class performance');
    }

    return response.json();
};



// Aluno - Todas as notas
export const getMyGrades = async (): Promise<StudentGradesData> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/performance/student/grades`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch grades');
    }

    return response.json();
};

// Professor - Desempenho individual do aluno
export interface StudentPerformanceData {
    student: {
        id: number;
        name: string;
        email: string;
    };
    subject: {
        id: number;
        name: string;
        code: string;
    };
    grades: {
        av1: number | null;
        av2: number | null;
        average: number | null;
        status: 'excellent' | 'good' | 'warning' | 'critical' | 'pending';
    };
    class_average: number;
    ranking: number | null;
    total_students: number;
    trend: 'improving' | 'declining' | 'stable' | null;
    required_grade: number | null;
    activities: Array<{
        activity_id: number;
        title: string;
        type: string;
        status: 'pending' | 'submitted' | 'graded';
        grade: number | null;
        submitted_at: string | null;
        graded_at: string | null;
    }>;
    total_activities: number;
    completed_activities: number;
    quizzes: Array<{
        quiz_id: number;
        quiz_title: string;
        score: number;
        total: number;
        percentage: number;
        submitted_at: string | null;
    }>;
    total_quizzes: number;
    completed_quizzes: number;
}

export const getStudentPerformance = async (studentId: number, subjectId: number): Promise<StudentPerformanceData> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/performance/student/${studentId}/subject/${subjectId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch student performance');
    }

    return response.json();
};


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
export const broadcastActivity = async (activityId: number): Promise<{ success: boolean; activity: LiveActivity; enrolled_students?: number }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/broadcast`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Compartilhar resumo com alunos
export const shareSummary = async (activityId: number): Promise<{ success: boolean; activity: LiveActivity }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/share`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Atualizar atividade (ex: remover questões do quiz)
export const updateActivity = async (activityId: number, content: any, timeLimit?: number): Promise<{ success: boolean; activity: LiveActivity; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/update`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            content,
            time_limit: timeLimit
        }),
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
export const submitActivityResponse = async (activityId: number, data: any): Promise<{ success: boolean; result?: any; error?: string }> => {
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
