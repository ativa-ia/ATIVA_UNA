import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

export interface QuizQuestion {
    id: number;
    quiz_id: number;
    question: string;
    options: string[];
    order: number;
}

export interface Quiz {
    id: number;
    subject_id: number;
    title: string;
    description?: string;
    time_limit: number;
    status: 'waiting' | 'active' | 'ended';
    starts_at?: string;
    ends_at?: string;
    time_remaining?: number;
    question_count: number;
    questions?: QuizQuestion[];
}

export interface QuizResponse {
    id: number;
    quiz_id: number;
    student_id: number;
    student_name?: string;
    answers: Record<string, number>;
    score: number;
    total: number;
    percentage: number;
    submitted_at: string;
}

export interface QuizReport {
    quiz: Quiz;
    enrolled_count: number;
    response_count: number;
    response_rate: number;
    average_score: number;
    top_students: QuizResponse[];
    worst_question?: {
        question: string;
        correct_rate: number;
    };
    all_responses: QuizResponse[];
}

// Criar quiz a partir das perguntas geradas pela IA
export const createQuiz = async (
    subjectId: number,
    title: string,
    questions: { question: string; options: string[]; correct: number }[],
    timeLimit: number = 300,
    description?: string
): Promise<{ success: boolean; quiz?: Quiz; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/quiz/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            subject_id: subjectId,
            title,
            description,
            time_limit: timeLimit,
            questions
        }),
    });

    return response.json();
};

// Enviar quiz para todos os alunos (broadcast)
export const broadcastQuiz = async (
    quizId: number
): Promise<{ success: boolean; message?: string; enrolled_students?: number; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/quiz/${quizId}/broadcast`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Verificar se há quiz ativo (polling - chamado a cada 5 segundos)
export const checkActiveQuiz = async (
    subjectId: number
): Promise<{ success: boolean; active: boolean; already_answered?: boolean; quiz?: Quiz }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/quiz/active/${subjectId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Aluno envia respostas
export const submitQuizResponse = async (
    quizId: number,
    answers: Record<string, number>
): Promise<{ success: boolean; result?: QuizResponse; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/quiz/${quizId}/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ answers }),
    });

    return response.json();
};

// Professor obtém relatório
export const getQuizReport = async (
    quizId: number
): Promise<{ success: boolean; report?: QuizReport; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/quiz/${quizId}/report`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Professor encerra quiz manualmente
export const endQuiz = async (
    quizId: number
): Promise<{ success: boolean; message?: string; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/quiz/${quizId}/end`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Listar quizzes de uma disciplina
export const listQuizzes = async (
    subjectId: number
): Promise<{ success: boolean; quizzes?: Quiz[]; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/quiz/subject/${subjectId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.json();
};

// Processar conteúdo ditado para gerar quiz/resumo/discussão
export const processContent = async (
    content: string,
    action: 'quiz' | 'summary' | 'discussion',
    subjectId: number
): Promise<{ success: boolean; action?: string; result?: any; error?: string }> => {
    const token = await AsyncStorage.getItem('authToken');

    const response = await fetch(`${API_URL}/ai/process-content`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            content,
            action,
            subject_id: subjectId
        }),
    });

    return response.json();
};
