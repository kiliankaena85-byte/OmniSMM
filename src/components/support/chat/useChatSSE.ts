import { useEffect } from 'react';
import { Message } from './useChatMessages';

function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.05);

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.05);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch {
    /* Audio context might be restricted before user interaction */
  }
}

export function useChatSSE({
  ticketId,
  isClosed,
  addNewMessages,
  lastCheckedRef,
}: {
  ticketId: string;
  isClosed: boolean;
  addNewMessages: (msgs: Message[]) => void;
  lastCheckedRef: React.MutableRefObject<string>;
}) {
  useEffect(() => {
    if (isClosed) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let failCount = 0;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let titleTimer: ReturnType<typeof setInterval> | null = null;
    const originalTitle = typeof document !== 'undefined' ? document.title : '';
    const MAX_FAILURES = 3;
    const MAX_BACKOFF_MS = 16000;

    const handleIncomingNewMessages = (msgs: Message[]) => {
      addNewMessages(msgs);
      
      if (msgs.length > 0) {
        playChimeSound();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('support_unread_changed'));
        }
        if (typeof document !== 'undefined' && document.hidden) {
          if (!titleTimer) {
            let isFlashing = false;
            titleTimer = setInterval(() => {
              document.title = isFlashing ? originalTitle : `🔔 (1) Ответ в поддержке! | ${originalTitle}`;
              isFlashing = !isFlashing;
            }, 1000);
          }
        }
      }
    };

    const checkNewMessagesNow = async () => {
      try {
        const res = await fetch(
          `/api/support/messages?ticketId=${ticketId}&after=${encodeURIComponent(
            lastCheckedRef.current
          )}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          handleIncomingNewMessages(data.messages);
          lastCheckedRef.current = data.messages[data.messages.length - 1].createdAt;
        }
      } catch {
        /* silent */
      }
    };

    const handleFocusOrVisible = () => {
      if (!document.hidden) {
        if (titleTimer) {
          clearInterval(titleTimer);
          titleTimer = null;
          document.title = originalTitle;
        }
        void checkNewMessagesNow();
      }
    };

    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);

    const startPollingFallback = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(async () => {
        if (document.hidden) return;
        await checkNewMessagesNow();
      }, 3000);
    };

    const connectSSE = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      try {
        eventSource = new EventSource(`/api/support/chat/stream?ticketId=${ticketId}`);

        eventSource.onopen = () => {
          failCount = 0; // Reset on successful connection
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') return; // Initial handshake
            if (data.id && data.text !== undefined) {
              handleIncomingNewMessages([data as Message]);
              lastCheckedRef.current = data.createdAt || new Date().toISOString();
            }
          } catch {
            /* malformed SSE data, ignore */
          }
        };

        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          failCount++;

          if (failCount >= MAX_FAILURES) {
            // Degrade gracefully to polling
            startPollingFallback();
            return;
          }

          // Exponential backoff: 1s, 2s, 4s, 8s, 16s cap
          const backoffMs = Math.min(1000 * Math.pow(2, failCount - 1), MAX_BACKOFF_MS);
          reconnectTimer = setTimeout(connectSSE, backoffMs);
        };
      } catch {
        // EventSource constructor failed (e.g. blocked by CSP)
        startPollingFallback();
      }
    };

    connectSSE();
    startPollingFallback(); // Dual-mode: instantaneous SSE push + 3s sync safety net

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (titleTimer) clearInterval(titleTimer);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
      if (typeof document !== 'undefined') document.title = originalTitle;
    };
  }, [ticketId, isClosed, addNewMessages, lastCheckedRef]);
}
