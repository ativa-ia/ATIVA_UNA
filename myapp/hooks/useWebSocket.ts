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
            console.log('[WebSocket] ========================================');
            console.log('[WebSocket] CONECTADO AO SERVIDOR!');
            console.log('[WebSocket] Socket ID:', socket.id);
            console.log('[WebSocket] ========================================');
            setIsConnected(true);

            // Entrar na room do quiz
            console.log('[WebSocket] Tentando entrar na room do quiz:', quizId);
            socket.emit('join_quiz', { quiz_id: quizId });
        });

        socket.on('disconnect', () => {
            console.log('[WebSocket] ========================================');
            console.log('[WebSocket] DESCONECTADO DO SERVIDOR');
            console.log('[WebSocket] ========================================');
            setIsConnected(false);
        });

        socket.on('joined_quiz', (data) => {
            console.log('[WebSocket] Entrou na room do quiz:', data);
        });

        socket.on('ranking_update', (data: RankingUpdate) => {
            console.log('[WebSocket] ========================================');
            console.log('[WebSocket] RANKING UPDATE RECEBIDO!');
            console.log('[WebSocket] Quiz ID:', data.quiz_id);
            console.log('[WebSocket] Status:', data.quiz_status);
            console.log('[WebSocket] Respostas:', data.response_count);
            console.log('[WebSocket] Ranking:', data.ranking);
            console.log('[WebSocket] ========================================');
            setRanking(data);
        });

        socket.on('new_response', (data) => {
            console.log('[WebSocket] Nova resposta recebida:', data);
        });

        socket.on('quiz_ended', (data) => {
            console.log('[WebSocket] Quiz encerrado:', data);
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
