'use client';

import React, { useState, useEffect } from 'react';
import { 
  getMonthlyPayrollAction, 
  PayrollRow 
} from '@/actions/admin/shifts';
import { formatRubles } from '@/utils/format-price';
import { 
  DollarSign, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  TrendingUp, 
  FileSpreadsheet,
  Award,
  ArrowLeftRight
} from 'lucide-react';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export function StaffPayrollTab() {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [isFullAccess, setIsFullAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadPayroll = async (y: number, m: number) => {
    setIsLoading(true);
    try {
      const res = await getMonthlyPayrollAction(y, m);
      if (res.success) {
        setPayrollRows(res.rows);
        setIsFullAccess(Boolean(res.isFullAccess));
      }
    } catch {
      toast.error('Не удалось загрузить табель зарплат');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (payrollRows.length === 0) return;

    const headers = [
      'Сотрудник',
      'Роль',
      'План смен',
      'Факт смен',
      'Вышел на подмену (+)',
      'Его подменили (-)',
      'Отпуск (дней)',
      'Больничный (дней)',
      'Закрыто тикетов',
      'Базовая ставка (руб)',
      'Премии/KPI (руб)',
      'ИТОГО К ВЫПЛАТЕ (руб)',
    ];

    const rows = payrollRows.map((r) => [
      `"${r.userEmail}"`,
      `"${r.role}"`,
      r.plannedShifts,
      r.actualShifts,
      r.substitutionsGiven,
      r.substitutionsTaken,
      r.vacationDays,
      r.sickDays,
      r.ticketsHandled,
      r.baseSalaryRubles,
      r.bonusRubles,
      r.netPayoutRubles,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      isFullAccess 
        ? `payroll_team_${currentYear}_${String(currentMonth).padStart(2, '0')}.csv`
        : `my_payslip_${currentYear}_${String(currentMonth).padStart(2, '0')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(isFullAccess ? 'Табель команды выгружен в CSV' : 'Ваш расчетный лист выгружен в CSV');
  };

  // Metrics summary
  const totalPayout = payrollRows.reduce((acc, r) => acc + r.netPayoutRubles, 0);
  const totalActualShifts = payrollRows.reduce((acc, r) => acc + r.actualShifts, 0);
  const totalTickets = payrollRows.reduce((acc, r) => acc + r.ticketsHandled, 0);

  return (
    <div className="space-y-4">
      {/* ── METRICS SUMMARY BAR ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{formatRubles(totalPayout)}</div>
            <div className="text-xs text-muted-foreground font-medium">
              {isFullAccess ? 'Фонд оплаты труда (ФОТ)' : 'К начислению за месяц'}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{totalActualShifts}</div>
            <div className="text-xs text-muted-foreground font-medium">
              {isFullAccess ? 'Смен отработано за месяц' : 'Моих смен отработано'}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{totalTickets}</div>
            <div className="text-xs text-muted-foreground font-medium">
              {isFullAccess ? 'Тикетов обработано командой' : 'Моих закрытых тикетов'}
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/60 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs sm:text-sm text-foreground px-3 min-w-[130px] text-center">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isFullAccess && (
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Экспорт расчетной ведомости (только для Администратора/Владельца)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Экспорт ведомости (CSV)
          </button>
        )}
      </div>

      {/* ── PAYROLL TABLE ── */}
      <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs font-medium">Расчет зарплатной ведомости...</span>
          </div>
        ) : payrollRows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-xs">
            Данные для начисления отсутствуют
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase">
                  <th className="px-4 py-3.5">Сотрудник</th>
                  <th className="px-3 py-3.5 text-center">План смен</th>
                  <th className="px-3 py-3.5 text-center">Факт смен</th>
                  <th className="px-3 py-3.5 text-center">Подмены</th>
                  <th className="px-3 py-3.5 text-center">Тикеты (KPI)</th>
                  <th className="px-3 py-3.5 text-right">Базовая ставка</th>
                  <th className="px-3 py-3.5 text-right">Премии & Бонусы</th>
                  <th className="px-4 py-3.5 text-right font-black">Итого к выплате</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {payrollRows.map((staff) => (
                  <tr key={staff.userId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-foreground">{staff.userEmail}</div>
                      <div className="text-[10px] text-muted-foreground">{staff.role}</div>
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono font-bold text-muted-foreground">
                      {staff.plannedShifts}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono font-bold text-foreground">
                      {staff.actualShifts}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      {staff.substitutionsGiven > 0 ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          +{staff.substitutionsGiven} подменил
                        </span>
                      ) : staff.substitutionsTaken > 0 ? (
                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                          -{staff.substitutionsTaken} подменен
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono">
                      <span className="font-bold text-foreground">{staff.ticketsHandled}</span>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono">
                      {formatRubles(staff.baseSalaryRubles)}
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {staff.bonusRubles > 0 ? `+${formatRubles(staff.bonusRubles)}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-black text-sm text-foreground bg-primary/5">
                      {formatRubles(staff.netPayoutRubles)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
