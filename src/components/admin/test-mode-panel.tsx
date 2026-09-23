'use client';

import { useTransition, useState } from 'react';
import { adminClearTestData } from '@/actions/admin/test-mode.actions';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Info, Trash2, ArrowUpRight } from 'lucide-react';

interface TestModePanelProps {
  initialIsTestMode: boolean;
  isTestEnvironment?: boolean;
}

/**
 * Unified Test Mode Information Card.
 * Eliminates legacy duplicate toggle and guides operator to official Header Switcher.
 */
export function TestModePanel({ initialIsTestMode, isTestEnvironment = false }: TestModePanelProps) {
  const [clearPending, startClearTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleClearTestData() {
    setConfirmOpen(true);
  }

  function executeClearTestData() {
    setConfirmOpen(false);
    startClearTransition(async () => {
      const result = await adminClearTestData();
      if ('success' in result && result.success) {
        setMessage((result as { message: string }).message);
      } else {
        setMessage('error' in result ? (result as { error: string }).error : 'Ошибка очистки');
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground">
                Режимы платформы (Оплата × Исполнение)
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                initialIsTestMode 
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              }`}>
                {initialIsTestMode ? 'Тест / Песочница' : 'Боевой режим'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Глобальное переключение 4 сценариев (<strong>Песочница</strong>, <strong>Гибридный тест</strong>, <strong>Тест эквайринга</strong>, <strong>Боевой режим</strong>) осуществляется централизованно в верхней навигационной панели (Header).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleClearTestData}
            disabled={clearPending}
            className="h-8 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Безопасно удаляет только изолированные заказы из Песочницы (SANDBOX)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{clearPending ? 'Очистка...' : 'Очистить песочницу'}</span>
          </button>
        </div>
      </div>

      {isTestEnvironment && (
        <div className="mt-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-xl flex items-center gap-2">
          <span>⚠️</span>
          <span>
            <strong>Сервер запущен в тестовом окружении</strong> (.env / локальный стенд). Внешние финансовые шлюзы заблокированы на уровне конфигурации.
          </span>
        </div>
      )}

      {message && (
        <div className="mt-3 text-xs font-medium text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 border border-border/60">
          ℹ️ {message}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeClearTestData}
        title="Очистить данные песочницы"
        isDanger={true}
        confirmText="Очистить"
        cancelText="Отмена"
      >
        Вы уверены? Будут удалены <strong>ТОЛЬКО заказы из виртуальной Песочницы (SANDBOX)</strong>. Живые боевые заказы и заказы из Гибридного теста останутся в полной безопасности.
      </ConfirmModal>
    </div>
  );
}
