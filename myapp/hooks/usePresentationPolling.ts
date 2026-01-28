import { useState, useEffect, useRef } from 'react';
import { getPresentation } from '@/services/presentation';
import { PresentationContent } from '@/services/presentation';
import { API_URL } from '@/services/api';

interface UsePresentationPollingOptions {
    code: string | null;
    enabled?: boolean;
    pollingInterval?: number;
}

export function usePresentationPolling({ code, enabled = true, pollingInterval = 2000 }: UsePresentationPollingOptions) {
    const [content, setContent] = useState<PresentationContent | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [sessionActive, setSessionActive] = useState(true);
    const [videoControl, setVideoControl] = useState<{ command: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'seek_relative', value?: number, timestamp: number } | undefined>(undefined);

    // Armazenar último timestamp para evitar re-renders desnecessários
    const lastTimestampRef = useRef<string | null>(null);

    useEffect(() => {
        if (!enabled || !code) {
            setIsConnected(false);
            return;
        }

        setIsConnected(true);

        const poll = async () => {
            try {
                // 1. Check status (lightweight)
                const statusRes = await fetch(`${API_URL}/presentation/${code}/status`);
                const statusData = await statusRes.json();

                if (!statusData.success || !statusData.active) {
                    setSessionActive(false);
                    return;
                }

                // 2. Compare timestamps
                if (statusData.timestamp !== lastTimestampRef.current) {
                    // 3. Fetch full content if changed
                    const response = await getPresentation(code);

                    if (response.success && response.current_content) {
                        setContent(response.current_content);
                        lastTimestampRef.current = response.current_content.timestamp;

                        // Extract video control from content if present
                        if (response.current_content.video_control) {
                            setVideoControl({
                                ...response.current_content.video_control,
                                timestamp: Date.now() // Force effect trigger
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('[Polling] Error:', error);
            }
        };

        // Initial fetch
        poll();

        // Interval
        const intervalId = setInterval(poll, pollingInterval);

        return () => {
            clearInterval(intervalId);
            setIsConnected(false);
        };
    }, [code, enabled, pollingInterval]);

    return {
        content,
        isConnected, // "Virtual" connection status
        sessionActive,
        videoControl
    };
}
