'use client';

import React, { useState, useTransition } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Clock, 
  User, 
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { UserNoteDTO } from '../tabs/types';
import { ClientDate } from '@/components/ui/client-date';
import { 
  createClientNoteAction, 
  deleteClientNoteAction, 
  editClientNoteAction,
  clearClientNoteAction 
} from '@/actions/admin/clients';
import { toast } from 'sonner';

interface ClientNotesManagerProps {
  userId: string;
  initialNotes: UserNoteDTO[];
  compact?: boolean;
}

export function ClientNotesManager({ userId, initialNotes, compact = false }: ClientNotesManagerProps) {
  const [notes, setNotes] = useState<UserNoteDTO[]>(initialNotes);
  const [newContent, setNewContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleAddNote = () => {
    const trimmed = newContent.trim();
    if (!trimmed) {
      toast.error('Введите текст заметки');
      return;
    }

    startTransition(async () => {
      const res = await createClientNoteAction(userId, trimmed);
      if (res.success && res.note) {
        setNotes(prev => [res.note, ...prev]);
        setNewContent('');
        toast.success('Заметка добавлена');
      } else {
        toast.error((res as { error?: string }).error || 'Ошибка добавления заметки');
      }
    });
  };

  const handleDeleteNote = (noteId: string) => {
    if (!confirm('Удалить эту заметку? Действие необратимо.')) return;

    startTransition(async () => {
      const res = await deleteClientNoteAction(noteId, userId);
      if (res.success) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        toast.success('Заметка удалена');
      } else {
        toast.error((res as { error?: string }).error || 'Ошибка удаления');
      }
    });
  };

  const handleStartEdit = (note: UserNoteDTO) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = (noteId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) {
      toast.error('Текст заметки не может быть пустым');
      return;
    }

    startTransition(async () => {
      const res = await editClientNoteAction(noteId, userId, trimmed);
      if (res.success && res.note) {
        setNotes(prev => prev.map(n => n.id === noteId ? res.note : n));
        setEditingNoteId(null);
        setEditContent('');
        toast.success('Заметка обновлена');
      } else {
        toast.error((res as { error?: string }).error || 'Ошибка редактирования');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Note Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
            <span>Новая заметка</span>
          </label>
          <span className="text-[10px] font-mono text-muted-foreground">
            Всего заметок: {notes.length}
          </span>
        </div>

        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Внутренняя информация о клиенте (договорённости, специфика, контекст)..."
          rows={compact ? 3 : 4}
          className="w-full text-xs px-3 py-2 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary resize-none"
        />

        <button
          type="button"
          onClick={handleAddNote}
          disabled={isPending || !newContent.trim()}
          className="w-full h-9 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isPending ? 'Сохранение...' : 'Добавить заметку'}</span>
        </button>
      </div>

      {/* Historical Notes Feed */}
      <div className="space-y-2.5 pt-2 border-t border-border/40">
        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>История заметок ({notes.length})</span>
        </div>

        {notes.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground bg-muted/15 rounded-xl border border-dashed border-border/60 p-4">
            <FileText className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/40" />
            <p className="text-xs font-medium">Заметок по клиенту пока нет</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">Добавьте первую заметку в поле выше</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {notes.map(item => {
              const isEditing = editingNoteId === item.id;

              return (
                <div 
                  key={item.id} 
                  className="bg-background/80 border border-border/60 rounded-xl p-3 shadow-2xs space-y-2 transition-all hover:border-border"
                >
                  {/* Note Header: Author & Timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                        <User className="w-3 h-3" />
                      </span>
                      <span className="text-[11px] font-bold text-foreground truncate max-w-[130px]" title={item.authorEmail || 'Оператор'}>
                        {item.authorEmail ? item.authorEmail.split('@')[0] : 'Оператор'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        <ClientDate date={item.createdAt} format="datetime" />
                      </span>

                      {!isEditing && (
                        <div className="flex items-center gap-0.5 ml-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Редактировать заметку"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(item.id)}
                            className="p-1 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Удалить эту заметку"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Note Body */}
                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary resize-none"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={isPending}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
