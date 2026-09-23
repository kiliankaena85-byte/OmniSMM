'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Star, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Save, 
  Loader2, 
  ThumbsDown, 
  Meh, 
  ThumbsUp, 
  Sparkles,
  Info 
} from 'lucide-react';
import { saveTelegramRatingReasonsAction } from '@/actions/admin/telegram-bot';
import { 
  type TelegramRatingReasonsConfig, 
  DEFAULT_TELEGRAM_RATING_REASONS,
} from '@/types/telegram';

interface TelegramCsatTabProps {
  initialReasons: TelegramRatingReasonsConfig;
  onReasonsChange?: (reasons: TelegramRatingReasonsConfig) => void;
  tenantId?: string;
}

export function TelegramCsatTab({ initialReasons, onReasonsChange, tenantId = 'smmplan' }: TelegramCsatTabProps) {
  const [reasons, setReasons] = React.useState<TelegramRatingReasonsConfig>(
    initialReasons?.negative ? initialReasons : DEFAULT_TELEGRAM_RATING_REASONS
  );
  const [isSaving, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (initialReasons?.negative) {
      setReasons(initialReasons);
    }
  }, [initialReasons, tenantId]);

  const [newNegative, setNewNegative] = React.useState('');
  const [newNeutral, setNewNeutral] = React.useState('');
  const [newPositive, setNewPositive] = React.useState('');

  const updateReasons = (updated: TelegramRatingReasonsConfig) => {
    setReasons(updated);
    onReasonsChange?.(updated);
  };

  const handleAddReason = (tier: 'negative' | 'neutral' | 'positive', text: string, clearInput: () => void) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (reasons[tier].includes(trimmed)) {
      toast.warning('Такая причина уже добавлена');
      return;
    }
    const updated = { ...reasons, [tier]: [...reasons[tier], trimmed] };
    updateReasons(updated);
    clearInput();
    toast.success('Причина добавлена');
  };

  const handleRemoveReason = (tier: 'negative' | 'neutral' | 'positive', index: number) => {
    if (reasons[tier].length <= 1) {
      toast.warning('В категории должна оставаться хотя бы одна причина');
      return;
    }
    const updated = {
      ...reasons,
      [tier]: reasons[tier].filter((_, i) => i !== index)
    };
    updateReasons(updated);
  };

  const handleResetDefaults = () => {
    if (confirm('Сбросить все теги причин к стандартным значениям?')) {
      updateReasons(DEFAULT_TELEGRAM_RATING_REASONS);
      toast.info('Теги причин сброшены к стандартным');
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await saveTelegramRatingReasonsAction(reasons, tenantId);
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.error || 'Ошибка сохранения причин');
        }
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-muted/20 border border-border/60">
        <div>
          <h3 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            Причины оценок пользователей (CSAT Reasons)
          </h3>
          <p className="text-xs text-muted-foreground">
            После нажатия на звезду (1–5 ⭐) бот предлагает клиенту выбрать конкретную причину оценки в виде инлайн-кнопок.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            intent="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs font-bold gap-1.5 h-9 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            Сброс
          </Button>

          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs font-bold gap-1.5 h-9 shadow-md shadow-primary/20 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Сохранить причины
          </Button>
        </div>
      </div>

      {/* 3 Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Negative (1-2 Stars) */}
        <Card className="p-5 rounded-3xl bg-card border border-rose-500/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <ThumbsDown className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">Негативные (1–2 ⭐)</h4>
                <p className="text-[10px] text-muted-foreground">Проблемы и жалобы</p>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-400 font-mono">1..2 ★</span>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Активные теги причин</Label>
            <div className="flex flex-wrap gap-2 min-h-[90px] content-start">
              {reasons.negative.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveReason('negative', idx)}
                    className="hover:text-rose-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <Input
              value={newNegative}
              onChange={e => setNewNegative(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddReason('negative', newNegative, () => setNewNegative('')))}
              placeholder="Новая причина..."
              className="text-xs font-medium"
            />
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => handleAddReason('negative', newNegative, () => setNewNegative(''))}
              className="h-9 px-3 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-rose-400" />
            </Button>
          </div>
        </Card>

        {/* Neutral (3 Stars) */}
        <Card className="p-5 rounded-3xl bg-card border border-amber-500/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Meh className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">Нейтральные (3 ⭐)</h4>
                <p className="text-[10px] text-muted-foreground">Замечания и задержки</p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-400 font-mono">3 ★</span>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Активные теги причин</Label>
            <div className="flex flex-wrap gap-2 min-h-[90px] content-start">
              {reasons.neutral.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveReason('neutral', idx)}
                    className="hover:text-amber-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <Input
              value={newNeutral}
              onChange={e => setNewNeutral(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddReason('neutral', newNeutral, () => setNewNeutral('')))}
              placeholder="Новая причина..."
              className="text-xs font-medium"
            />
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => handleAddReason('neutral', newNeutral, () => setNewNeutral(''))}
              className="h-9 px-3 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-amber-400" />
            </Button>
          </div>
        </Card>

        {/* Positive (4-5 Stars) */}
        <Card className="p-5 rounded-3xl bg-card border border-emerald-500/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <ThumbsUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">Позитивные (4–5 ⭐)</h4>
                <p className="text-[10px] text-muted-foreground">Благодарности и скорость</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 font-mono">4..5 ★</span>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Активные теги причин</Label>
            <div className="flex flex-wrap gap-2 min-h-[90px] content-start">
              {reasons.positive.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveReason('positive', idx)}
                    className="hover:text-emerald-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <Input
              value={newPositive}
              onChange={e => setNewPositive(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddReason('positive', newPositive, () => setNewPositive('')))}
              placeholder="Новая причина..."
              className="text-xs font-medium"
            />
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => handleAddReason('positive', newPositive, () => setNewPositive(''))}
              className="h-9 px-3 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Pro-Tip Box */}
      <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 flex items-start gap-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-foreground">Как это работает:</strong> Первые 4 тега из выбранной категории автоматически рендерятся в виде inline-кнопок прямо под сообщением бота. При нажатии на тег он моментально сохраняется в карточку тикета и модель <code>TicketFeedback</code> для построения аналитики саппорта.
        </p>
      </div>
    </div>
  );
}
