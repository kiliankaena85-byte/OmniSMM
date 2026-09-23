'use client';

import React, { useState } from 'react';
import { TreasurySimulationOutput } from '@/services/ai/harnesses/customer-liability-treasury.harness';
import { ShieldCheck, AlertTriangle, AlertOctagon, ArrowDownToLine, Info, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  report: TreasurySimulationOutput;
}

export function SafeOwnerDrawHero({ report }: Props) {
  const [showInfoModal, setShowInfoModal] = useState(false);

  const isSolvent = report.liquidityHealthStatus === 'SOLVENT_GREEN';
  const isWarning = report.liquidityHealthStatus === 'WARNING_AMBER';
  const isInsolvent = report.liquidityHealthStatus === 'INSOLVENT_CRITICAL_RED';

  const handleRequestDividend = () => {
    if (report.safeOwnerDrawCapacityRub <= 0) {
      toast.error('Вывод дивидендов заблокирован для предотвращения кассового разрыва');
      return;
    }
    toast.info(
      `Сумма ${Math.round(report.safeOwnerDrawCapacityRub).toLocaleString('ru-RU')} ₽ подтверждена казначейством. Для проведения перевода используйте Альфа-Бизнес Онлайн.`
    );
  };

  return (
    <>
      <div
        className={`border rounded-2xl p-6 shadow-xs relative overflow-hidden transition-all ${
          isSolvent
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : isWarning
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-destructive/10 border-destructive/30'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isSolvent && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              {isInsolvent && <AlertOctagon className="w-4 h-4 text-destructive" />}
              Безопасная сумма для вывода прибыли (Safe Owner Draw)
              <button
                onClick={() => setShowInfoModal(true)}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                title="Подробнее о расчете"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              className={`text-4xl font-bold font-mono tracking-tight mt-2 ${
                isSolvent ? 'text-emerald-500' : isWarning ? 'text-amber-500' : 'text-destructive'
              }`}
            >
              {Math.round(report.safeOwnerDrawCapacityRub).toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Сумма чистых свободных денег после обязательного резервирования клиентских депозитов, налогового резерва УСН 6% и буфера безопасности.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleRequestDividend}
              disabled={report.safeOwnerDrawCapacityRub <= 0}
              className={`px-5 py-2.5 rounded-xl font-medium text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                report.safeOwnerDrawCapacityRub > 0
                  ? 'bg-emerald-600 text-primary-foreground hover:bg-emerald-700 active:scale-98'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" />
              Запросить вывод дивидендов
            </button>
            <span className="text-[11px] text-muted-foreground">
              {report.safeOwnerDrawCapacityRub > 0
                ? '✓ Разрешено казначейским контролем'
                : '⛔ Заблокировано: защита от кассового разрыва'}
            </span>
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Как рассчитывается Safe Owner Draw
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Формула предотвращает риск вывода чужих денег со счета ИП/ООО:
            </p>
            <div className="bg-muted/30 border border-border rounded-xl p-3.5 font-mono text-xs text-foreground space-y-1.5">
              <div><strong>Ликвидные активы</strong> (Альфа-Банк + Эквайринг + Провайдеры)</div>
              <div className="text-destructive">− <strong>Клиентский Эскроу</strong> (Непотраченные балансы)</div>
              <div className="text-amber-500">− <strong>Налоговый Резерв УСН 6%</strong> (ст. 346.17 НК РФ)</div>
              <div className="text-sky-500">− <strong>Буфер кассового разрыва</strong> (10% от обязательств)</div>
              <div className="pt-2 border-t border-border text-emerald-500 font-bold">
                = <strong>Safe Owner Draw</strong> (Чистые деньги собственника)
              </div>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-lg"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}
