'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Save, 
  RotateCcw, 
  Loader2, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2, 
  Star, 
  Clock, 
  CreditCard, 
  RefreshCw, 
  Coins 
} from 'lucide-react';
import { saveTelegramTemplatesAction } from '@/actions/admin/telegram-bot';
import { 
  type TelegramMessageTemplatesConfig, 
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
} from '@/types/telegram';

interface TelegramTemplatesTabProps {
  initialTemplates: TelegramMessageTemplatesConfig;
  onTemplatesChange?: (templates: TelegramMessageTemplatesConfig) => void;
  tenantId?: string;
}

interface TemplateMeta {
  key: keyof TelegramMessageTemplatesConfig;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  variables: string[];
}

const TEMPLATES_LIST: TemplateMeta[] = [
  {
    key: 'welcome',
    title: 'Приветственное сообщение (/start)',
    desc: 'Отправляется новому пользователю или при команде /start с отображением баланса и меню.',
    icon: Sparkles,
    variables: ['{siteName}', '{userName}', '{balance}']
  },
  {
    key: 'ticketClosedRating',
    title: 'Запрос оценки (CSAT) при закрытии тикета',
    desc: 'Отправляется клиенту сразу после нажатия оператором «Закрыть тикет» с инлайн-кнопками ⭐ 1-5.',
    icon: Star,
    variables: ['{ticketId}', '{siteName}']
  },
  {
    key: 'ratingThanks',
    title: 'Благодарность за оценку / отзыв',
    desc: 'Показывается пользователю после выбора звезды или уточняющей причины оценки.',
    icon: CheckCircle2,
    variables: ['{stars}', '{reasons}', '{siteName}']
  },
  {
    key: 'delayWarning',
    title: 'Уведомление о повышенной нагрузке',
    desc: 'Используется для предупреждения о возможных задержках ответов операторов.',
    icon: Clock,
    variables: ['{siteName}']
  },
  {
    key: 'paymentIssue',
    title: 'Статус зачисления платежа',
    desc: 'Шаблон быстрого ответа при обращении по вопросам зачисления средств.',
    icon: CreditCard,
    variables: ['{orderId}', '{siteName}']
  },
  {
    key: 'serviceRefill',
    title: 'Уведомление о гарантийной докрутке',
    desc: 'Оповещает пользователя о передаче запроса на восстановление списаний поставщику.',
    icon: RefreshCw,
    variables: ['{orderId}', '{siteName}']
  },
  {
    key: 'refundNotice',
    title: 'Уведомление о возврате средств на баланс',
    desc: 'Отправляется при оформлении компенсации или отмене невыполненного заказа.',
    icon: Coins,
    variables: ['{ticketId}', '{amount}', '{siteName}']
  }
];

export function TelegramTemplatesTab({ initialTemplates, onTemplatesChange, tenantId = 'smmplan' }: TelegramTemplatesTabProps) {
  const [templates, setTemplates] = React.useState<TelegramMessageTemplatesConfig>(
    initialTemplates?.welcome ? initialTemplates : DEFAULT_TELEGRAM_MESSAGE_TEMPLATES
  );
  const [isSaving, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (initialTemplates?.welcome) {
      setTemplates(initialTemplates);
    }
  }, [initialTemplates, tenantId]);

  const updateTemplate = (key: keyof TelegramMessageTemplatesConfig, value: string) => {
    const updated = { ...templates, [key]: value };
    setTemplates(updated);
    onTemplatesChange?.(updated);
  };

  const handleInsertVariable = (key: keyof TelegramMessageTemplatesConfig, placeholder: string) => {
    const currentVal = templates[key] || '';
    updateTemplate(key, `${currentVal} ${placeholder}`);
  };

  const handleResetDefaults = () => {
    if (confirm('Сбросить все шаблоны сообщений к исходным стандартным текстам?')) {
      setTemplates(DEFAULT_TELEGRAM_MESSAGE_TEMPLATES);
      onTemplatesChange?.(DEFAULT_TELEGRAM_MESSAGE_TEMPLATES);
      toast.info('Шаблоны сброшены к стандартным');
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await saveTelegramTemplatesAction(templates, tenantId);
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.error || 'Ошибка сохранения шаблонов');
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
            <MessageSquare className="w-4 h-4 text-primary" />
            Шаблоны сообщений и системных уведомлений
          </h3>
          <p className="text-xs text-muted-foreground">
            Настройте формулировки для автоматических сообщений бота, запросов CSAT и ответов операторов.
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
            Сохранить шаблоны
          </Button>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {TEMPLATES_LIST.map(item => {
          const Icon = item.icon;
          return (
            <Card key={item.key} className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                  HTML Tagging
                </span>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={templates[item.key] || ''}
                  onChange={e => updateTemplate(item.key, e.target.value)}
                  rows={item.key === 'welcome' ? 4 : 3}
                  className="font-mono text-xs leading-relaxed text-foreground bg-background"
                />

                {/* Variable Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Переменные подстановки:</span>
                  {item.variables.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVariable(item.key, v)}
                      className="text-[10px] font-mono font-bold bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded-lg border border-primary/20 transition-colors cursor-pointer"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
