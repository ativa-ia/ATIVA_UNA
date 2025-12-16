/**
 * TypeScript Types
 * Tipos de dados usados nas telas
 */

export interface Subject {
    id: string;
    name: string;
    imageUrl: string;
    professor?: string;
}

export interface Notice {
    id: string;
    title: string;
    description: string;
}

export interface Activity {
    id: string;
    title: string;
    subject: string;
    dueDate: string;
    type: 'assignment' | 'quiz' | 'exam';
}

export interface Material {
    id: string;
    title: string;
    subject: string;
    type: 'pdf' | 'video' | 'link' | 'document';
    uploadDate: string;
    size?: string;
    url?: string;
}

export interface Student {
    id: string;
    name: string;
    avatarUrl?: string;
    present?: boolean;
}

export interface Performance {
    subject: string;
    grade: number;
    attendance: number;
}

export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
}
