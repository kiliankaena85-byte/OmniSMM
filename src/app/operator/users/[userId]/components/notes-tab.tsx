'use client';

import * as React from 'react';
import { createUserNoteAction } from '@/actions/operator/users/create-user-note.action';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, User, MessageSquare, Package } from 'lucide-react';
import { toast } from 'sonner';

interface NoteAuthor {
  email: string;
  role: string;
}

interface Note {
  id: string;
  content: string;
  orderId: string | null;
  ticketId: string | null;
  createdAt: Date;
  author: NoteAuthor | null;
}

interface NotesTabProps {
  userId: string;
  notes: Note[];
}

export function NotesTab({ userId, notes }: NotesTabProps) {
  const [content, setContent] = React.useState('');
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      const res = await createUserNoteAction({
        userId,
        content: content.trim(),
      });

      if (res.success) {
        setContent('');
        toast.success('Заметка успешно сохранена');
      } else {
        toast.error((res as { error?: string }).error || 'Не удалось сохранить заметку');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Add Note Form */}
      <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5">
        <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Добавить внутреннюю заметку
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Введите текст заметки об этом клиенте..."
            rows={4}
            disabled={isPending}
            className="w-full p-4 text-sm bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm text-foreground placeholder:text-muted-foreground leading-relaxed resize-none"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isPending || !content.trim()}
              className="rounded-xl active:scale-95 transition-transform shadow-sm min-w-[120px]"
            >
              {isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </div>

      {/* Notes Feed */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider text-muted-foreground">
          История заметок
        </h3>
        {notes.length > 0 ? (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-card border border-border/40 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 space-y-3"
              >
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {note.content}
                </p>

                {/* Optional links to orders or tickets */}
                {(note.orderId || note.ticketId) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {note.orderId && (
                      <a
                        href={`/operator/orders?q=${note.orderId}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-lg text-primary transition-colors"
                      >
                        <Package className="w-3 h-3" />
                        Заказ: {note.orderId.slice(0, 8)}
                      </a>
                    )}
                    {note.ticketId && (
                      <a
                        href={`/operator/tickets?q=${note.ticketId}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-success/5 hover:bg-success/10 border border-success/10 rounded-lg text-success transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Тикет: {note.ticketId.slice(0, 8)}
                      </a>
                    )}
                  </div>
                )}

                {/* Footer Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/20 text-[11px] text-muted-foreground font-mono">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>
                      {note.author?.email || 'Система'} (
                      {note.author?.role ? note.author.role.toLowerCase() : 'системная'}
                      )
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(note.createdAt).toLocaleString('ru-RU')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card/40 border border-border/40 rounded-2xl p-10 text-center ring-1 ring-border/5">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Для этого пользователя пока нет внутренних заметок.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
