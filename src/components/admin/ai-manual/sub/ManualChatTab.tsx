'use client';

/**
 * Tab 1: AI Consultant Chat with SSE Streaming & 0-Token Response Cache
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { ManualChatMessages } from './ManualChatMessages';
import { Send, Sparkles, MapPin } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getRoutePromptChips } from './route-chips';
import { queryAdminAiAssistantAction } from '@/actions/admin/ai-manual/assistant.action';

interface ManualChatTabProps {
  userRole?: string;
  activeTenantId?: 'smmplan' | 'flux' | string;
}

export const ManualChatTab: React.FC<ManualChatTabProps> = ({ activeTenantId = 'smmplan' }) => {
  const tenant: 'smmplan' | 'flux' = activeTenantId === 'flux' ? 'flux' : 'smmplan';
  const pathname = usePathname() || '/admin/dashboard';
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 Здравствуйте! Я интерактивный ИИ-консультант OmniSMM 1.0 на базе Gemini 3.8 Flash.\n\nЗадайте любой вопрос по настройке платформы, коду, фискализации 54-ФЗ или регламентам работы.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isStreaming) return;

    setInput('');
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: textToSend, timestamp: new Date().toLocaleTimeString() },
      { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true, timestamp: new Date().toLocaleTimeString() },
    ]);
    setIsStreaming(true);

    try {
      const res = await fetch('/api/admin/assistant/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          currentRoute: pathname,
          activeTenantId: tenant,
          conversationHistory: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const actionRes = await queryAdminAiAssistantAction({
          query: textToSend,
          currentRoute: pathname,
          activeTenantId: tenant,
          conversationHistory: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        });
        if (actionRes.success && actionRes.result) {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsgId ? { ...m, content: actionRes.result!.fullText, chunksUsed: actionRes.result!.chunksUsed, isFromCache: Boolean(actionRes.result!.isFromCache), isStreaming: false } : m)
          );
          return;
        }
        throw new Error(`Ошибка сервера (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'token' && data.text) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + data.text } : m))
              );
            } else if (data.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        isStreaming: false,
                        chunksUsed: data.chunks,
                        isFromCache: Boolean(data.isFromCache),
                      }
                    : m
                )
              );
            } else if (data.type === 'error') {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: `⚠️ Ошибка: ${data.error}`, isStreaming: false } : m))
              );
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Сбой связи с сервером';
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, content: `⚠️ Ошибка соединения: ${message}`, isStreaming: false } : m))
      );
    } finally {
      setIsStreaming(false);
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m)));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Route context header */}
      <div className="px-4 py-1.5 bg-muted/30 border-b border-border/40 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          <span>Контекст страницы:</span>
          <span className="font-mono text-foreground truncate">{pathname}</span>
        </div>
      </div>

      {/* Messages */}
      <ManualChatMessages messages={messages} scrollRef={scrollRef} />

      {/* Suggested chips */}
      <div className="px-3 py-1.5 flex flex-wrap gap-1.5 border-t border-border/40 bg-background/50 shrink-0">
        {getRoutePromptChips(pathname).map((chip, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isStreaming}
            onClick={() => handleSend(chip)}
            className="px-2 py-0.5 rounded-full bg-secondary/80 hover:bg-secondary text-[10px] text-secondary-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-border/80 bg-background/95 shrink-0">
        <div className="flex items-end gap-2 bg-muted/40 dark:bg-muted/20 border border-border/80 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-primary/30">
          <textarea
            rows={2}
            value={input}
            disabled={isStreaming}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Задайте вопрос по коду или регламенту..."
            className="flex-1 bg-transparent border-none resize-none text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none px-1.5 py-1 min-h-[36px] max-h-[80px]"
          />
          <button
            type="button"
            disabled={!input.trim() || isStreaming}
            onClick={() => handleSend()}
            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
            title="Отправить (Enter)"
          >
            {isStreaming ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
