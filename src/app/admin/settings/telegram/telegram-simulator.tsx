'client';

import { Card } from '@/components/ui/card';
import type { TelegramBotDiagnostics } from '@/types/telegram';
import type { SystemSettings } from '@prisma/client';
import { listTelegramButtonsAction } from '@/actions/admin/telegram-bot';
import { useState, useEffect, useCallback } from 'react';
import { Smartphone } from 'lucide-react';
import type { TelegramButton } from '@/types/telegram';

interface Props {
  settings: SystemSettings;
  diagnostics: TelegramBotDiagnostics | null;
}

export function TelegramSimulator({ settings, diagnostics }: Props) {
  const [buttons, setButtons] = useState<TelegramButton[]>([]);

  const loadButtons = useCallback(async () => {
    try {
      const res = await listTelegramButtonsAction();
      if (Array.isArray(res)) {
        setButtons(res.filter((b: TelegramButton) => b.isVisible));
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadButtons(); }, [loadButtons]);

  // Group buttons into rows for keyboard layout
  const rows = buttons.reduce<Record<number, TelegramButton[]>>((acc, btn) => {
    if (!acc[btn.row]) acc[btn.row] = [];
    acc[btn.row].push(btn);
    return acc;
  }, {});
  const sortedRows = Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b);

  // If no buttons, show defaults
  const hasButtons = sortedRows.length > 0;

  const welcomeText = (settings.welcomeMessage || '')
    .replace(/{siteName}/g, settings.siteName || 'SMMplan')
    .replace(/{userName}/g, '\u0410\u0440\u0442\u0451\u043C')
    .replace(/{balance}/g, '1 500.00')
    .replace(/{date}/g, new Date().toLocaleDateString('ru-RU'));

  // OWASP A03: Safe text rendering — no dangerouslySetInnerHTML
  const safeText = welcomeText
    .replace(/<br\s*\/? ?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-primary" />
          Live Simulator
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">iOS Dark</span>
      </div>

      {/* Phone Frame */}
      <div className="w-full max-w-[380px] mx-auto rounded-[40px] border-[6px] border-zinc-800 bg-zinc-950 p-3 shadow-2xl relative overflow-hidden">
        {/* Notch */}
        <div className="w-28 h-4 bg-zinc-800 rounded-full mx-auto mb-3" />

        {/* Header */}
        <div className="bg-zinc-900/90 rounded-2xl p-3 flex items-center justify-between border border-zinc-800/80 mb-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
              {(settings.siteName || 'S')[0].toUpperCase()}
            </div>
            <div>
              <h4 className="text-xs font-bold text-white leading-tight">{settings.siteName || 'SMMplan'}</h4>
              <p className="text-[10px] text-blue-400 font-mono">
                {diagnostics?.daemonRunning ? 'онлайн' : 'офлайн'}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">
            {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Chat Area */}
        <div className="space-y-3 min-h-[280px] p-2 flex flex-col justify-end">
          <div className="self-end bg-blue-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-xs max-w-[80%] shadow-md">
            /start
          </div>
          <div className="self-start bg-zinc-900 text-zinc-100 rounded-2xl rounded-bl-sm p-3.5 text-xs max-w-[95%] border border-zinc-800/90 shadow-md">
            <p className="leading-relaxed whitespace-pre-wrap font-sans text-zinc-200">{safeText || '\u{1F44B} Настройте приветствие во вкладке "Приветствие"'}</p>
            <div className="text-[9px] text-zinc-500 text-right font-mono mt-2">
              {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} \u2713\u2713
            </div>
          </div>
        </div>

        {/* Custom Keyboard */}
        <div className="pt-3 border-t border-zinc-800/80 space-y-1.5">
          {hasButtons ? (
            sortedRows.map(rowKey => {
              const rowBtns = rows[rowKey].sort((a, b) => a.col - b.col);
              const cols = Math.max(rowBtns.length, 1);
              return (
                <div key={rowKey} className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {rowBtns.map(btn => (
                    <div
                      key={btn.id}
                      className={`p-2.5 rounded-xl text-white text-[11px] font-bold text-center border shadow-xs cursor-default ${
                        btn.style === 'primary' ? 'bg-blue-600 border-blue-500' :
                        btn.style === 'danger' ? 'bg-rose-600 border-rose-500' :
                        'bg-zinc-800 border-zinc-700'
                      }`}
                    >
                      {btn.emoji} {btn.label}
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-2.5 rounded-xl bg-zinc-800 text-white text-[11px] font-bold text-center border border-zinc-700">🛍 Каталог</div>
                <div className="p-2.5 rounded-xl bg-zinc-800 text-white text-[11px] font-bold text-center border border-zinc-700">📦 Заказы</div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-2.5 rounded-xl bg-zinc-800 text-white text-[11px] font-bold text-center border border-zinc-700">💰 Пополнить</div>
                <div className="p-2.5 rounded-xl bg-zinc-800 text-white text-[11px] font-bold text-center border border-zinc-700">👤 Профиль</div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-2.5 rounded-xl bg-zinc-800 text-white text-[11px] font-bold text-center border border-zinc-700">🆘 Поддержка</div>
                <div className="p-2.5 rounded-xl bg-zinc-800 text-white text-[11px] font-bold text-center border border-zinc-700">👥 Рефералы</div>
              </div>
            </>
          )}
        </div>

        {/* Home Indicator */}
        <div className="w-32 h-1 bg-zinc-700 rounded-full mx-auto mt-4" />
      </div>
    </div>
  );
}