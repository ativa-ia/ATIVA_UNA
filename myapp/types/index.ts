/**
 * TypeScript Types
 * Tipos de dados usados nas telas
 */

export interface Subject {
    id: string;
    name: string;
    imageUrl: string;
    professor?: string;
    class_name?: string;
    class_year?: number;
    class_semester?: string;
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
    type: 'pdf' | 'video' | 'link' | 'document' | 'audio';
    uploadDate: string;
    size?: string;
    url?: string;
    classSubjectId?: number;
    source?: string;
}

export interface Student {
    id: string;
    name: string;
    avatarUrl?: string;
}

export interface Course {
    id: number;
    name: string;
    code: string;
}

export interface CourseEnrollment {
    id: number;
    course_id: number;
    course_name: string;
    status: string;
}

export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
}
