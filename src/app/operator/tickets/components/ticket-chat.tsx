'use client';

import * as React from 'react';
import Link from 'next/link';
import { replyTicketAction } from '@/actions/operator/tickets/reply-ticket.action';
import { changeTicketStatusAction } from '@/actions/operator/tickets/change-status.action';
import { generateTicketCoPilotDraftAction } from '@/actions/operator/tickets/ai-copilot.action';
import { Button } from '@/components/ui/button';
import { FileText, Send, MessageSquare, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: 'OPEN' | 'PENDING' | 'CLOSED' | string;
  user: { id: string; email: string };
  messages: Message[];
}

interface TicketChatProps {
  ticket: TicketDetail;
}

const MSG_SENDER_STYLES: Record<string, { bubble: string; text: string; align: string }> = {
  USER: {
    bubble: 'bg-muted/40 border border-border/40 text-foreground rounded-2xl rounded-bl-sm',
    text: 'text-foreground',
    align: 'justify-start',
  },
  STAFF: {
    bubble: 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm',
    text: 'text-primary-foreground',
    align: 'justify-end',
  },
  INTERNAL: {
    bubble: 'bg-warning/10 border border-warning/30 text-warning-foreground rounded-2xl py-3 px-5 text-center max-w-lg mx-auto',
    text: 'text-foreground font-sans leading-relaxed italic',
    align: 'justify-center w-full',
  },
};

const formatChatDateDivider = (dateStr: string | Date) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Сегодня';
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

const isDifferentChatDay = (d1Str?: string | Date, d2Str?: string | Date) => {
  if (!d1Str || !d2Str) return true;
  const d1 = new Date(d1Str);
  const d2 = new Date(d2Str);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return d1.toDateString() !== d2.toDateString();
};

export function TicketChat({ ticket }: TicketChatProps) {
  const [replyText, setReplyText] = React.useState('');
  const [isInternal, setIsInternal] = React.useState(false);
  const [isGeneratingCoPilot, setIsGeneratingCoPilot] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleGenerateCoPilot = async () => {
    setIsGeneratingCoPilot(true);
    try {
      const res = await generateTicketCoPilotDraftAction({ ticketId: ticket.id });
      if (res.success && res.draftText) {
        setReplyText(res.draftText);
        setIsInternal(false);
        if (res.warnings && res.warnings.length > 0) {
          toast.warning(res.warnings.join('. '));
        } else {
          toast.success(
            `✨ Черновик AI Co-Pilot сформирован (${res.confidence === 'HIGH' ? 'высокая точность' : 'детерминированный режим'})`
          );
        }
      } else {
        toast.error(res.error || 'Не удалось сгенерировать черновик');
      }
    } catch {
      toast.error('Сбой обращения к AI Co-Pilot');
    } finally {
      setIsGeneratingCoPilot(false);
    }
  };

  // Automatically scroll message window to bottom
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [ticket.messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    startTransition(async () => {
      const res = await replyTicketAction({
        ticketId: ticket.id,
        message: replyText.trim(),
        isInternal,
      });

      if (res.success) {
        setReplyText('');
        setIsInternal(false);
        toast.success('Ответ отправлен');
      } else {
        toast.error(res.error || 'Не удалось отправить сообщение');
      }
    });
  };

  const handleStatusChange = (newStatus: 'OPEN' | 'CLOSED') => {
    startTransition(async () => {
      const res = await changeTicketStatusAction({
        ticketId: ticket.id,
        status: newStatus,
      });

      if (res.success) {
        toast.success(newStatus === 'CLOSED' ? 'Тикет закрыт' : 'Тикет открыт');
      } else {
        toast.error(res.error || 'Не удалось обновить статус');
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm">
      {/* Ticket Chat Header */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between gap-4 bg-muted/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-muted-foreground">
              #{ticket.id.slice(-6)}
            </span>
            <h2 className="font-bold text-sm text-foreground truncate max-w-sm">
              {ticket.subject}
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Клиент: <span className="font-medium text-foreground">{ticket.user?.email || 'Неизвестно'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {ticket.status === 'OPEN' || ticket.status === 'PENDING' ? (
            <Button
              size="sm"
              intent="ghost"
              disabled={isPending}
              onClick={() => handleStatusChange('CLOSED')}
              className="h-8 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg flex items-center gap-1 font-bold"
            >
              <X className="w-3.5 h-3.5" />
              Закрыть тикет
            </Button>
          ) : (
            <Button
              size="sm"
              intent="ghost"
              disabled={isPending}
              onClick={() => handleStatusChange('OPEN')}
              className="h-8 text-[11px] text-success hover:bg-success/10 hover:text-success rounded-lg flex items-center gap-1 font-bold"
            >
              <Check className="w-3.5 h-3.5" />
              Открыть заново
            </Button>
          )}
        </div>
      </div>

      {/* Messages Scroll Box */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {ticket.messages.length > 0 ? (
          ticket.messages.map((m, index) => {
            const style = MSG_SENDER_STYLES[m.sender] || MSG_SENDER_STYLES.USER;
            const isNewDay = index === 0 || isDifferentChatDay(ticket.messages[index - 1]?.createdAt, m.createdAt);
            const fullDateTooltip = new Date(m.createdAt).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <React.Fragment key={m.id}>
                {isNewDay && (
                  <div className="flex justify-center my-3 pointer-events-none select-none sticky top-2 z-10">
                    <span className="bg-card/90 backdrop-blur-md text-foreground/80 dark:text-foreground/90 text-[11px] font-bold px-3.5 py-1 rounded-full shadow-xs border border-border/70 tracking-wide">
                      {formatChatDateDivider(m.createdAt)}
                    </span>
                  </div>
                )}
                <div className={`flex ${style.align}`}>
                  <div className={`${style.bubble} max-w-[70%] p-4 text-xs`}>
                    <p className={`${style.text} leading-relaxed break-words font-sans whitespace-pre-wrap`}>
                      {m.text}
                    </p>
                    <div 
                      className="text-[9px] opacity-75 font-mono text-right mt-1.5 flex items-center justify-end gap-1.5 select-none cursor-default"
                      title={fullDateTooltip}
                    >
                      <span>
                        {m.sender === 'USER' ? 'Клиент' : m.sender === 'STAFF' ? 'Служба поддержки' : 'Внутренняя заметка'}
                      </span>
                      <span>•</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        ) : (
          <div className="text-center py-12 text-muted-foreground text-xs leading-relaxed">
            В тикете пока нет сообщений.
          </div>
        )}
      </div>

      {/* Input Message Form */}
      <div className="p-4 border-t border-border/40 bg-muted/10">
        <form onSubmit={handleSendReply} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateCoPilot}
                disabled={isPending || isGeneratingCoPilot}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition-all border border-primary/20 hover:border-primary/40 disabled:opacity-50 select-none cursor-pointer"
                title="Сгенерировать безопасный черновик ответа на основе базы знаний"
              >
                {isGeneratingCoPilot ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span>AI думает...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>✨ AI Co-Pilot</span>
                  </>
                )}
              </button>
            </div>
            {replyText && (
              <button
                type="button"
                onClick={() => setReplyText('')}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Очистить черновик
              </button>
            )}
          </div>

          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={isInternal ? 'Введите внутреннюю заметку (клиент её не увидит)...' : 'Напишите сообщение клиенту...'}
            rows={3}
            disabled={isPending}
            className={`w-full p-3 text-xs bg-background border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground leading-relaxed resize-none transition-all ${
              isInternal ? 'border-warning/60 focus:border-warning' : 'border-border/60 focus:border-primary'
            }`}
          />

          <div className="flex items-center justify-between">
            {/* Note Checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="w-3.5 h-3.5 accent-warning rounded"
              />
              <FileText className="w-3.5 h-3.5 text-warning-foreground" />
              <span>Внутренняя заметка (для лога)</span>
            </label>

            {/* Send Button */}
            <Button
              type="submit"
              disabled={isPending || !replyText.trim()}
              className="rounded-xl text-xs py-2 px-4 flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              {isInternal ? 'Добавить заметку' : 'Отправить'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
