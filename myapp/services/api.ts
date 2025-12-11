import AsyncStorage from '@react-native-async-storage/async-storage';

// URL da API (mude para seu IP local se testar em dispositivo físico)
// Para desenvolvimento local, use localhost
//export const API_URL = 'http://localhost:3000/api';

// Para produção/Vercel, use:
export const API_URL = 'https://ativa-ia-9rkb.vercel.app/api';

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
    ai_generated_content: string | null;
    shared_with_students: boolean;
    status: 'waiting' | 'active' | 'ended';
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
        student_id: number;
        student_name: string;
        score: number;
        total: number;
        percentage: number;
        is_correct: boolean;
        submitted_at: string;
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
export const generateQuiz = async (sessionId: number, numQuestions: number = 5): Promise<{ success: boolean; activity?: LiveActivity; checkpoint?: TranscriptionCheckpoint; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/sessions/${sessionId}/generate-quiz`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ num_questions: numQuestions }),
    });

    return response.json();
};

// Gerar Resumo via IA
export const generateSummary = async (sessionId: number): Promise<{ success: boolean; activity: LiveActivity; checkpoint: TranscriptionCheckpoint }> => {
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

// Aluno: enviar resposta
export const submitActivityResponse = async (activityId: number, data: { answers?: Record<string, number>; text?: string }): Promise<{ success: boolean; result: LiveActivityResponse }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/transcription/activities/${activityId}/respond`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
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


