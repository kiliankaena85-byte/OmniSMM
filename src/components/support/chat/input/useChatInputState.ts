'use client';

import { useEffect, useRef, useState } from 'react';

interface UseChatInputStateOptions {
  ticketId: string;
  text: string;
  setText: (val: string) => void;
  sending: boolean;
}

export function useChatInputState({
  ticketId,
  text,
  setText,
  sending,
}: UseChatInputStateOptions) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [kbOffset, setKbOffset] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Initial draft restore for this specific ticket
  useEffect(() => {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
      const saved = localStorage.getItem(`smmplan_draft_ticket_${ticketId}`);
      if (saved && saved.trim()) {
        setText(saved);
        setDraftSavedAt('восстановлен');
      }
    } catch (err) {
      void err;
    }
  }, [ticketId, setText]);

  // 2. Draft auto-save on text change (isolated per ticketId)
  useEffect(() => {
    if (typeof window === 'undefined' || !ticketId) return;
    const timer = setTimeout(() => {
      try {
        if (text.trim().length > 0) {
          localStorage.setItem(`smmplan_draft_ticket_${ticketId}`, text);
          const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          setDraftSavedAt(timeStr);
        } else {
          localStorage.removeItem(`smmplan_draft_ticket_${ticketId}`);
          setDraftSavedAt(null);
        }
      } catch (err) {
        void err;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [text, ticketId]);

  // 3. Dynamic auto-resize of textarea for multi-line AI replies & templates
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const targetHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 44), 280);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [text]);

  // 4. Online/Offline network connection tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 5. Protection against accidental tab closure when drafting response
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (text.trim().length > 15 && !sending) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [text, sending]);

  // 6. VisualViewport keyboard offset tracking
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vp = window.visualViewport;
    const update = () => {
      const diff = window.innerHeight - vp.height;
      setKbOffset(diff > 0 ? diff : 0);
    };
    vp.addEventListener('resize', update);
    vp.addEventListener('scroll', update);
    update();
    return () => {
      vp.removeEventListener('resize', update);
      vp.removeEventListener('scroll', update);
    };
  }, []);

  const clearDraft = () => {
    try {
      localStorage.removeItem(`smmplan_draft_ticket_${ticketId}`);
      setDraftSavedAt(null);
    } catch (err) {
      void err;
    }
  };

  return {
    isOnline,
    draftSavedAt,
    setDraftSavedAt,
    kbOffset,
    textareaRef,
    clearDraft,
  };
}
