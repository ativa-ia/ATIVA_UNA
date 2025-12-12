import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/services/api';

interface UseWebSocketOptions {
    quizId: number | null;
    enabled?: boolean;
}

interface RankingUpdate {
    quiz_id: number;
    quiz_status: string;
    enrolled_count: number;
    response_count: number;
    ranking: Array<{
        position: number;
        student_id: number;
        student_name: string;
        points: number;
        score: number;
        total: number;
        percentage: number;
        time_taken: number;
    }>;
}

export function useWebSocket({ quizId, enabled = true }: UseWebSocketOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [ranking, setRanking] = useState<RankingUpdate | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!enabled || !quizId) {
            return;
        }

        // Conectar ao WebSocket
        const socket = io(API_URL.replace('/api', ''), {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('WebSocket conectado');
            setIsConnected(true);

            // Entrar na room do quiz
            socket.emit('join_quiz', { quiz_id: quizId });
        });

        socket.on('disconnect', () => {
            console.log('WebSocket desconectado');
            setIsConnected(false);
        });

        socket.on('joined_quiz', (data) => {
            console.log('Entrou na room do quiz:', data);
        });

        socket.on('ranking_update', (data: RankingUpdate) => {
            console.log('Atualização de ranking recebida:', data);
            setRanking(data);
        });

        socket.on('new_response', (data) => {
            console.log('Nova resposta:', data);
            // Trigger para buscar ranking atualizado
        });

        socket.on('quiz_ended', (data) => {
            console.log('Quiz encerrado:', data);
        });

        return () => {
            if (socket) {
                socket.emit('leave_quiz', { quiz_id: quizId });
                socket.disconnect();
            }
        };
    }, [quizId, enabled]);

    return {
        isConnected,
        ranking,
        socket: socketRef.current,
    };
}
