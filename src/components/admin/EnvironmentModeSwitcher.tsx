'use client';

import * as React from 'react';
import { 
  getEnvironmentModeAction, 
  setEnvironmentModeAction 
} from '@/actions/admin/environment-mode';
import { type EnvironmentMode } from '@/lib/settings';
import { 
  ShieldCheck, 
  Zap, 
  CreditCard, 
  Rocket, 
  ChevronDown, 
  Check, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface ModeConfig {
  id: EnvironmentMode;
  label: string;
  badge: string;
  badgeClass: string;
  icon: React.ElementType;
  paymentDesc: string;
  providerDesc: string;
  note: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'SANDBOX',
    label: 'Песочница (100% Mock)',
    badge: 'Песочница',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: ShieldCheck,
    paymentDesc: 'Тестовая оплата (0 ₽)',
    providerDesc: 'Виртуальный Mock SMM',
    note: 'Полная изоляция: реальные деньги и балансы поставщиков не расходуются.'
  },
  {
    id: 'HYBRID',
    label: 'Гибридный тест (Live SMM)',
    badge: 'Гибрид',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: Zap,
    paymentDesc: 'Тестовая оплата (0 ₽)',
    providerDesc: 'РЕАЛЬНЫЙ VexBoost',
    note: 'Идеально для тестов: бесплатный заказ на сайте отправляется реальному поставщику.'
  },
  {
    id: 'ACQUIRING_TEST',
    label: 'Тест эквайринга',
    badge: 'Эквайринг',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    icon: CreditCard,
    paymentDesc: 'Боевая ЮKassa / СБП',
    providerDesc: 'Виртуальный Mock SMM',
    note: 'Тестирование реального списания с карт без отправки накрутки в соцсети.'
  },
  {
    id: 'PRODUCTION',
    label: 'Боевой режим (Production)',
    badge: 'Production',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    icon: Rocket,
    paymentDesc: 'Боевая ЮKassa / СБП',
    providerDesc: 'РЕАЛЬНЫЙ VexBoost',
    note: 'Штатный боевой режим: реальные платежи клиентов и реальное исполнение.'
  }
];

import { useRouter, useSearchParams } from 'next/navigation';

export function EnvironmentModeSwitcher({
  initialMode = 'SANDBOX',
  readOnly = false,
}: {
  initialMode?: EnvironmentMode;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenant') || undefined;

  const [currentMode, setCurrentMode] = React.useState<EnvironmentMode>(initialMode);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [confirmModalMode, setConfirmModalMode] = React.useState<EnvironmentMode | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    getEnvironmentModeAction(tenantId).then((res) => {
      if (res.success && res.mode) {
        setCurrentMode(res.mode as EnvironmentMode);
      }
    });
  }, [tenantId]);

  // Close on outside click
  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeConfig = MODES.find((m) => m.id === currentMode) || MODES[0];
  const ActiveIcon = activeConfig.icon;

  const handleSelectMode = (mode: EnvironmentMode) => {
    if (readOnly) return;
    setIsOpen(false);
    if (mode === currentMode) return;
    if (mode === 'PRODUCTION' || mode === 'HYBRID') {
      setConfirmModalMode(mode);
    } else {
      executeSwitch(mode);
    }
  };

  const executeSwitch = (mode: EnvironmentMode) => {
    if (readOnly) return;
    const prevMode = currentMode;
    setCurrentMode(mode); // ⚡ Optimistic UI update
    setConfirmModalMode(null);

    startTransition(async () => {
      const res = await setEnvironmentModeAction({ mode, tenantId });
      if (res.success) {
        toast.success(`Режим окружения изменён на ${mode}`);
        router.refresh();
      } else {
        setCurrentMode(prevMode); // Rollback state on error
        toast.error(res.error || 'Не удалось переключить режим');
      }
    });
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !readOnly && setIsOpen(!isOpen)}
        disabled={isPending || readOnly}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all duration-200 shadow-sm ${activeConfig.badgeClass} ${
          readOnly ? 'cursor-default opacity-85' : 'hover:opacity-90 active:scale-95 cursor-pointer'
        }`}
        title={
          readOnly
            ? `Текущий режим: ${activeConfig.label} (только просмотр)`
            : 'Переключение режимов окружения (Оплата x Провайдер)'
        }
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ActiveIcon className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="truncate max-w-[120px]">{activeConfig.badge}</span>
        {!readOnly && <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />}
      </button>

      {/* Dropdown Menu */}
      {!readOnly && isOpen && (
        <div className="absolute right-0 mt-1.5 w-80 rounded-xl border border-border bg-card shadow-2xl p-1.5 z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1">
            Режимы платформы (Оплата × Исполнение)
          </div>
          <div className="space-y-1">
            {MODES.map((modeConfig) => {
              const isSelected = modeConfig.id === currentMode;
              const Icon = modeConfig.icon;
              return (
                <button
                  key={modeConfig.id}
                  type="button"
                  onClick={() => handleSelectMode(modeConfig.id)}
                  className={`w-full text-left p-2 rounded-lg transition-all text-xs flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30 text-foreground font-medium'
                      : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Icon className="w-4 h-4 text-primary" />
                      <span>{modeConfig.label}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                  <div className="text-[11px] flex items-center gap-2 text-muted-foreground pl-5.5">
                    <span>💳 {modeConfig.paymentDesc}</span>
                    <span>•</span>
                    <span>⚡ {modeConfig.providerDesc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal for High-Impact Modes */}
      {confirmModalMode && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-2.5 bg-amber-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">
                  Подтверждение смены режима
                </h3>
                <p className="text-xs text-muted-foreground">
                  Переключение на режим: <span className="font-semibold text-foreground">{confirmModalMode}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {confirmModalMode === 'HYBRID' && (
                <>
                  В <b>Гибридном режиме</b> оплата на чекауте останется тестовой (0 ₽), но заказы будут отправляться в <b>реальный VexBoost</b> со списанием вашего реального баланса поставщика.
                </>
              )}
              {confirmModalMode === 'PRODUCTION' && (
                <>
                  В <b>Боевом режиме</b> все платежи будут проходить через реальную ЮKassa / СБП, а заказы — доставляться реальными поставщиками.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setConfirmModalMode(null)}
                disabled={isPending}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => executeSwitch(confirmModalMode)}
                disabled={isPending}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 flex items-center gap-1.5"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Подтвердить переключение
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
