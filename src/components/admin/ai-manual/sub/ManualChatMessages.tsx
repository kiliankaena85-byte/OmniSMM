'use client';

/**
 * Chat Messages list with Markdown formatting and Citations
 * Complies with Clean Architecture Level 3 Presentation (<= 200 lines).
 */

import React, { useState } from 'react';
import type { ChatMessage } from '../types';
import { Bot, User, Copy, Check, FileText } from 'lucide-react';
import { ChatMarkdownRenderer, renderInlineTokens } from './chat-markdown-renderer';

interface ManualChatMessagesProps {
  messages: ChatMessage[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export const ManualChatMessages: React.FC<ManualChatMessagesProps> = ({ messages, scrollRef }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'assistant' && (
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-primary" />
            </div>
          )}

          <div
            className={`max-w-[85%] rounded-lg p-3 relative group ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground ml-6'
                : 'bg-muted/60 dark:bg-muted/30 border border-border/70 text-foreground mr-6'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="break-words">
                <ChatMarkdownRenderer content={msg.content} />
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse align-middle" />
                )}
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                {renderInlineTokens(msg.content)}
              </div>
            )}

            {/* Chunks/Citations footer & Cache indicator */}
            {((msg.chunksUsed && msg.chunksUsed.length > 0) || msg.isFromCache) && (
              <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-wrap gap-1.5 items-center">
                {msg.isFromCache && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-[9px] border border-emerald-500/25 font-semibold">
                    ⚡ 0 токенов (Zero-Wait кэш)
                  </span>
                )}
                {msg.chunksUsed && msg.chunksUsed.length > 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" /> Фрагменты кода:
                    </span>
                    {msg.chunksUsed.map((chunk, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-1.5 py-0.5 rounded bg-background/80 border border-border text-[9px] font-mono text-muted-foreground truncate max-w-[140px]"
                        title={chunk.filePath || chunk.title}
                      >
                        {chunk.filePath ? chunk.filePath.split('/').slice(-2).join('/') : chunk.title}
                      </span>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Copy Button */}
            {msg.role === 'assistant' && !msg.isStreaming && (
              <button
                type="button"
                onClick={() => handleCopy(msg.content, msg.id)}
                className="absolute top-2 right-2 p-1 rounded bg-background/80 border border-border/60 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                title="Копировать ответ"
              >
                {copiedId === msg.id ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
          </div>

          {msg.role === 'user' && (
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-secondary-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
