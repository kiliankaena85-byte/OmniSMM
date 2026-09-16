'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useActionState, useState, useEffect } from 'react';
import { Loader2, MessageSquare, Eye, Copy, RotateCcw } from 'lucide-react';
import { updateGlobalSettings } from '@/actions/admin/settings';
import type { SystemSettings } from '@prisma/client';

const DEFAULT_WELCOME = '\u{1F44B} <b>Добро пожаловать в {siteName}!</b>\n\n' +
  'Платформа автоматического продвижения в социальных сетях.\n\n' +
  '\u{1F4B0} Ваш баланс: <b>{balance} \u20BD</b>\n\n' +
  'Выберите действие в меню ниже:';

const VARIABLES = ['{siteName}', '{userName}', '{balance}', '{date}'];

const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  '{siteName}': 'Название платформы',
  '{userName}': 'Имя пользователя',
  '{balance}': 'Текущий баланс',
  '{date}': 'Текущая дата',
};

interface Props {
  settings: SystemSettings;
}

// OWASP A03: Preview uses textContent, NOT dangerouslySetInnerHTML
// HTML rendering is done via a safe sanitizer on the server side.
function SafeHtmlPreview({ html, className }: { html: string; className?: string }) {
  // Simple HTML-to-text with formatting hints for the preview
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?b>/gi, '**')
    .replace(/<\/?i>/gi, '__')
    .replace(/<\/?strong>/gi, '**')
    .replace(/<\/?em>/gi, '__')
    .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();

  return (
    <pre className={className}>{text}</pre>
  );
}

export function WelcomeEditor({ settings }: Props) {
  const [welcomeText, setWelcomeText] = useState(settings.welcomeMessage || DEFAULT_WELCOME);
  const [showPreview, setShowPreview] = useState(true);

  const [state, formAction, isPendingSave] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      try {
        const res = await updateGlobalSettings(formData);
        if (res && typeof res === 'object' && 'success' in res && !res.success) return res;
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }, null
  );
  const formState = state as { success?: boolean; error?: string } | null;

  const [formKey, setFormKey] = useState(0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Inject current welcomeText into formData before server action
    const form = e.currentTarget;
    const existing = form.querySelector('input[name="welcomeMessage"]') as HTMLInputElement;
    if (existing) existing.value = welcomeText;
  };

  useEffect(() => {
    if (formState?.success) { toast.success('Приветственное сообщение сохранено'); }
    else if (formState?.error) { toast.error(formState.error); }
  }, [formState]);

  const previewText = welcomeText
    .replace(/{siteName}/g, settings.siteName || 'SMMplan')
    .replace(/{userName}/g, '\u0410\u0440\u0442\u0451\u043C')
    .replace(/{balance}/g, '1 500.00')
    .replace(/{date}/g, new Date().toLocaleDateString('ru-RU'));

  const insertVariable = (v: string) => {
    setWelcomeText(prev => prev + ' ' + v);
  };

  const resetToDefault = () => {
    setWelcomeText(DEFAULT_WELCOME);
    toast.success('Шаблон сброшен к стандартному');
  };

  const charCount = welcomeText.length;
  const maxChars = 4096;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7">
        <form action={formAction} onSubmit={handleSubmit} key={formKey} className="space-y-6">
          <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <span className="p-1 px-2.5 bg-blue-500/10 text-blue-400 rounded-md text-[10px] font-bold">MSG</span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Приветственное сообщение (/start)</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono ${isOverLimit ? 'text-rose-400' : 'text-muted-foreground'}`}>
                  {charCount} / {maxChars}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)} className="h-7 w-7 p-0">
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Hidden input for server action */}
            <input type="hidden" name="welcomeMessage" value={welcomeText} />

            <div className="space-y-2">
              <Textarea
                value={welcomeText}
                onChange={(e) => setWelcomeText(e.target.value)}
                rows={10}
                className={`font-mono text-xs leading-relaxed ${isOverLimit ? 'border-rose-500' : ''}`}
                placeholder="Введите приветственное сообщение..."
              />

              {/* Variable Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground leading-7">Переменные:</span>
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="group relative text-[10px] font-mono font-bold bg-muted/60 hover:bg-muted text-primary px-2 py-1 rounded-lg border border-border transition-colors cursor-pointer"
                    title={VARIABLE_DESCRIPTIONS[v]}
                  >
                    {v}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                      {VARIABLE_DESCRIPTIONS[v]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Allowed HTML Tags Info */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <b>Допустимые HTML-теги:</b> {'<b>'}, {'<i>'}, {'<code>'}, {'<a>'}, {'<br>'}, {'<p>'}, {'<pre>'}, {'<strong>'}, {'<em>'}, {'<span>'}.{' '}
                <b>Запрещены:</b> {'<script>'}, {'<style>'}, event handlers (onclick, onerror...).{' '}
                Все входные данные санитизируются на сервере (OWASP A03).
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={resetToDefault} className="text-xs gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Сбросить
              </Button>
              <Button type="submit" disabled={isPendingSave || isOverLimit} className="font-bold uppercase tracking-widest text-xs h-11 px-6 shadow-lg shadow-primary/20 cursor-pointer">
                {isPendingSave && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Сохранить
              </Button>
            </div>
          </Card>
        </form>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div className="lg:col-span-5">
          <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-primary" /> Предпросмотр
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(previewText); toast.success('Скопировано'); }} className="h-7 w-7 p-0">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 min-h-[200px]">
              <SafeHtmlPreview html={previewText} className="text-xs leading-relaxed whitespace-pre-wrap font-sans" />
            </div>
            <div className="text-[10px] text-muted-foreground text-center">
              Переменные заменены на тестовые значения
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}