'use client';

import { useState, useTransition } from 'react';
import { generateApiKeyAction, resetApiKeyAction, revokeApiKeyAction } from '@/actions/user/settings-extra';
import { RefreshCw, Trash2, CheckCheck, ShieldAlert, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ApiKeyManager({ 
  hasKey, 
  onKeyGenerated 
}: { 
  hasKey: boolean; 
  onKeyGenerated?: (key: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const handleGenerate = () => {
    setError('');
    setNewKey(null);
    if (onKeyGenerated) onKeyGenerated(null);
    startTransition(async () => {
      const res = await (newKey ? resetApiKeyAction() : generateApiKeyAction());
      if (!res.success) {
        const errMsg = res.error || 'Ошибка при генерации ключа';
        setError(errMsg);
        toast.error(errMsg);
      } else {
        setNewKey(res.apiKey || null);
        toast.success('API-ключ успешно сгенерирован!');
        if (onKeyGenerated && res.apiKey) {
          onKeyGenerated(res.apiKey);
        }
      }
    });
  };

  const handleRevoke = () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      setTimeout(() => setConfirmRevoke(false), 5000);
      return;
    }
    setConfirmRevoke(false);
    setError('');
    if (onKeyGenerated) onKeyGenerated(null);
    startTransition(async () => {
      const res = await revokeApiKeyAction();
      if (!res.success) {
        const errMsg = res.error || 'Ошибка при отзыве ключа';
        setError(errMsg);
        toast.error(errMsg);
      } else {
        setNewKey(null);
        toast.success('API-ключ успешно отозван');
      }
    });
  };

  const copyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      toast.success('API-ключ скопирован в буфер обмена');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать ключ');
    }
  };

  return (
    <div className="space-y-5">
      {hasKey || newKey ? (
        <div className="space-y-4">
          {/* Key display */}
          {newKey ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCheck className="w-5 h-5" />
                <span className="font-semibold text-sm">Новый API-ключ сгенерирован</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Скопируйте ключ прямо сейчас. В целях безопасности он больше никогда не будет показан в открытом виде.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 bg-background border border-emerald-500/30 rounded-xl px-4 py-2.5 font-mono text-sm text-foreground truncate select-all">
                  {newKey}
                </div>
                <button
                  type="button"
                  onClick={copyKey}
                  aria-label="Скопировать API-ключ"
                  className={`shrink-0 px-4 py-2.5 rounded-xl border font-semibold text-xs transition-all duration-200 ${
                    copied
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                      : 'bg-card border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {copied ? 'Скопировано!' : 'Скопировать'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">API-ключ активен (SHA-256)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  В целях безопасности ключ захеширован и скрыт. Если вы его потеряли, сгенерируйте новый токен.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              intent="secondary"
              size="sm"
              className="rounded-xl text-xs font-semibold gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span>Сгенерировать новый</span>
            </Button>

            {confirmRevoke ? (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-1.5 animate-in fade-in">
                <span className="text-xs text-destructive font-semibold">Отозвать ключ навсегда?</span>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isPending}
                  className="text-xs font-bold text-destructive underline hover:no-underline"
                >
                  Да, удалить
                </button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleRevoke}
                disabled={isPending}
                intent="destructive"
                size="sm"
                className="rounded-xl text-xs font-semibold gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Отозвать</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground">
            У вас ещё не создан API-ключ. Сгенерируйте его для доступа к REST API SMMplan (создание заказов, проверка баланса).
          </div>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            intent="primary"
            size="sm"
            isAnimated={true}
            className="rounded-xl text-xs font-semibold gap-2 shadow-sm"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{isPending ? 'Генерация...' : 'Сгенерировать API-ключ'}</span>
          </Button>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 animate-in slide-in-from-top-1">
          {error}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground pt-1">
        Никогда не передавайте API-ключ третьим лицам. При компрометации немедленно отзовите его.
      </p>
    </div>
  );
}
