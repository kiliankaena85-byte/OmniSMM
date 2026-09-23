'client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  AlertTriangle, AlertCircle, XCircle, CheckCircle, Loader2,
  Filter, RefreshCw, Trash2, CheckCheck, ChevronDown, ChevronUp, Clock, User, MessageSquare,
} from 'lucide-react';
import {
  listTelegramErrorsAction,
  resolveTelegramErrorAction,
  massResolveTelegramErrorsAction,
  deleteTelegramErrorAction,
} from '@/actions/admin/telegram-bot';
import type { TelegramErrorLog, ErrorLevel, ErrorSource } from '@/types/telegram';

const LEVEL_STYLES: Record<ErrorLevel, { bg: string; text: string; icon: React.ElementType }> = {
  ERROR: { bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30', text: 'Ошибка', icon: AlertCircle },
  WARN: { bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30', text: 'Предупреждение', icon: AlertTriangle },
  FATAL: { bg: 'bg-red-500/20 text-red-400 border-red-500/40', text: 'Критическая', icon: XCircle },
};

const SOURCE_OPTIONS: { value: ErrorSource | ''; label: string }[] = [
  { value: '', label: 'Все источники' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'polling', label: 'Polling' },
  { value: 'command', label: 'Команды' },
  { value: 'callback_query', label: 'Коллбэки' },
  { value: 'scene', label: 'Сцены' },
];

export function ErrorTracker() {
  const [errors, setErrors] = useState<TelegramErrorLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<ErrorLevel | ''>('');
  const [filterSource, setFilterSource] = useState<ErrorSource | ''>('');
  const [filterResolved, setFilterResolved] = useState<boolean | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const loadErrors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTelegramErrorsAction({
        level: filterLevel || undefined,
        source: filterSource || undefined,
        resolved: filterResolved,
        limit: 50,
      });
      if (res.success && res.data) { setErrors(res.data.errors); setTotal(res.data.total); }
      else { toast.error(res.error || 'Ошибка загрузки'); }
    } catch (err) { toast.error(String(err)); }
    finally { setLoading(false); }
  }, [filterLevel, filterSource, filterResolved]);

  useEffect(() => { loadErrors(); }, [loadErrors]);

  const handleResolve = (id: string) => {
    startTransition(async () => {
      const res = await resolveTelegramErrorAction({ errorId: id });
      if (res.success) { toast.success('Ошибка помечена как решённая'); loadErrors(); }
      else toast.error(res.error!);
    });
  };

  const handleMassResolve = () => {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      const res = await massResolveTelegramErrorsAction({ errorIds: Array.from(selectedIds) });
      if (res.success) { toast.success(res.message!); setSelectedIds(new Set()); loadErrors(); }
      else toast.error(res.error!);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Удалить запись об ошибке? Это действие необратимо.')) return;
    startTransition(async () => {
      const res = await deleteTelegramErrorAction(id);
      if (res.success) { toast.success('Удалено'); loadErrors(); }
      else toast.error(res.error!);
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === errors.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(errors.map(e => e.id)));
  };

  const unresolvedCount = errors.filter(e => !e.isResolved).length;

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1 px-2.5 bg-rose-500/10 text-rose-400 rounded-md text-[10px] font-bold">ERRORS</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Отслеживание сбоев</h3>
            <span className="text-[10px] font-mono text-muted-foreground">{total} записей</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button type="button" size="sm" onClick={handleMassResolve} className="font-bold text-xs h-8 gap-1.5 cursor-pointer">
                <CheckCheck className="w-3.5 h-3.5" /> Решить ({selectedIds.size})
              </Button>
            )}
            <button type="button" onClick={loadErrors} className="p-2 rounded-lg hover:bg-muted cursor-pointer"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Level Filter */}
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value as ErrorLevel | '')} className="bg-background border border-border rounded-xl px-3 py-1.5 text-[10px] font-medium focus:ring-1 focus:ring-primary focus:outline-none">
            <option value="">Все уровни</option>
            <option value="ERROR">Error</option>
            <option value="WARN">Warning</option>
            <option value="FATAL">Fatal</option>
          </select>

          {/* Source Filter */}
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value as ErrorSource | '')} className="bg-background border border-border rounded-xl px-3 py-1.5 text-[10px] font-medium focus:ring-1 focus:ring-primary focus:outline-none">
            {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Resolved Filter */}
          <button type="button" onClick={() => setFilterResolved(undefined)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${filterResolved === undefined ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            Все
          </button>
          <button type="button" onClick={() => setFilterResolved(false)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${filterResolved === false ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            Открытые
          </button>
          <button type="button" onClick={() => setFilterResolved(true)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${filterResolved === true ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            Решённые
          </button>
        </div>
      </Card>

      {/* Error List */}
      {loading ? (
        <Card className="rounded-2xl p-8 text-center"><p className="text-xs text-muted-foreground">Загрузка...</p></Card>
      ) : errors.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Ошибок не обнаружено</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select All */}
          <button type="button" onClick={toggleSelectAll} className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
            {selectedIds.size === errors.length ? 'Снять выделение' : `Выделить все (${errors.length})`}
          </button>

          {errors.map(err => {
            const levelStyle = LEVEL_STYLES[err.level];
            const LevelIcon = levelStyle.icon;
            const isExpanded = expandedId === err.id;
            const isSelected = selectedIds.has(err.id);

            return (
              <Card key={err.id} className={`rounded-2xl border overflow-hidden transition-colors ${err.isResolved ? 'opacity-50' : ''} ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/60'}`}>
                <div className="p-3 flex items-start gap-3">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(err.id)} className="mt-1 cursor-pointer" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${levelStyle.bg}`}>
                        <LevelIcon className="w-3 h-3 inline mr-0.5" /> {err.level}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{err.source}</span>
                      {err.errorCode && <code className="text-[9px] font-mono text-amber-400">{err.errorCode}</code>}
                      {err.occurrenceCount > 1 && <span className="text-[9px] font-bold text-rose-400">x{err.occurrenceCount}</span>}
                      {err.isResolved && <span className="text-[9px] font-bold text-emerald-400">РЕШЕНА</span>}
                    </div>
                    <p className="text-xs text-foreground mt-1 font-medium truncate">{err.errorMessage}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(err.lastSeenAt).toLocaleString('ru-RU')}</span>
                      {err.userId && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {err.userId.substring(0, 8)}...</span>}
                      {err.chatId && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {err.chatId}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : err.id)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {!err.isResolved && (
                      <button type="button" onClick={() => handleResolve(err.id)} className="p-1.5 rounded-lg hover:bg-emerald-500/10 cursor-pointer" title="Решить">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    )}
                    <button type="button" onClick={() => handleDelete(err.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer" title="Удалить">
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-3">
                    {err.stackTrace && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Stack Trace</p>
                        <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-300 text-[10px] font-mono overflow-x-auto max-h-40 overflow-y-auto">{err.stackTrace}</pre>
                      </div>
                    )}
                    {err.updateData && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Raw Update</p>
                        <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-300 text-[10px] font-mono overflow-x-auto max-h-40 overflow-y-auto">{err.updateData}</pre>
                      </div>
                    )}
                    <div className="flex gap-4 text-[10px] text-muted-foreground">
                      <span>Первое появление: {new Date(err.firstSeenAt).toLocaleString('ru-RU')}</span>
                      <span>Последнее: {new Date(err.lastSeenAt).toLocaleString('ru-RU')}</span>
                      {err.resolvedAt && <span>Решена: {new Date(err.resolvedAt).toLocaleString('ru-RU')}</span>}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}