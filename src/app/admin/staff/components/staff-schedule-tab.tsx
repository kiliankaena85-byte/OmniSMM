'use client';

import React, { useState, useTransition, useEffect, useMemo } from 'react';
import { 
  getMonthShiftsAction, 
  assignShiftAction, 
  swapShiftAction, 
  deleteShiftAction,
  requestTimeOffAction,
  applyShiftTemplateAction,
  getAvailableSubstitutesAction,
  AvailableSubstituteDTO,
  StaffScheduleRow,
  StaffMemberOption,
  ShiftInfo
} from '@/actions/admin/shifts';
import { formatRubles } from '@/utils/format-price';
import { 
  Calendar as CalendarIcon, 
  Sun, 
  RefreshCw, 
  ArrowLeftRight, 
  Palmtree, 
  HeartPulse, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  SlidersHorizontal,
  Clock,
  UserCheck,
  User,
  Shield,
  Trash2,
  AlertTriangle,
  Sparkles,
  CalendarDays,
  ListOrdered,
  Coffee,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface StaffScheduleTabProps {
  initialRows?: StaffScheduleRow[];
  initialYear?: number;
  initialMonth?: number;
  currentUserRole: string;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_NAMES_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

function formatOperatorLabel(email?: string | null): string {
  if (!email) return '—';
  const prefix = email.split('@')[0];
  if (prefix.startsWith('support_a_')) {
    return `Саппорт #${prefix.slice(-4)}`;
  }
  if (prefix.length > 16) {
    return `${prefix.slice(0, 14)}...`;
  }
  return prefix;
}

export function StaffScheduleTab({
  currentUserRole,
}: StaffScheduleTabProps) {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1); // 1..12
  const [scheduleRows, setScheduleRows] = useState<StaffScheduleRow[]>([]);
  const [staffList, setStaffList] = useState<StaffMemberOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Simplified view modes: 'feed' (Лента смен — default) | 'calendar' (Календарная сетка месяца)
  const [viewMode, setViewMode] = useState<'feed' | 'calendar'>('feed');

  // Modals state
  const [selectedShiftModal, setSelectedShiftModal] = useState<{
    staff?: StaffScheduleRow;
    day: number;
    shift?: ShiftInfo;
    isNew?: boolean;
  } | null>(null);

  // Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateUserId, setTemplateUserId] = useState<string>('');
  const [templateType, setTemplateType] = useState<'2_2_DAY' | '5_2' | 'DAILY'>('2_2_DAY');
  const [templateStartDay, setTemplateStartDay] = useState(1);
  const [templateRate, setTemplateRate] = useState(2500);

  // Swap Modal
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapShift, setSwapShift] = useState<ShiftInfo | null>(null);
  const [substituteUserId, setSubstituteUserId] = useState<string>('');
  const [swapNotes, setSwapNotes] = useState<string>('');
  const [substituteCandidates, setSubstituteCandidates] = useState<AvailableSubstituteDTO[]>([]);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState<boolean>(false);

  // Time Off Modal
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [timeOffUserId, setTimeOffUserId] = useState<string>('');
  const [timeOffType, setTimeOffType] = useState<'VACATION' | 'SICK' | 'DAY_OFF'>('VACATION');
  const [timeOffDateFrom, setTimeOffDateFrom] = useState('');
  const [timeOffDateTo, setTimeOffDateTo] = useState('');
  const [timeOffNotes, setTimeOffNotes] = useState('');

  // Fetch Month Schedule
  const loadMonthData = async (y: number, m: number) => {
    setIsLoading(true);
    try {
      const res = await getMonthShiftsAction(y, m);
      if (res.success) {
        setScheduleRows(res.rows);
        setDaysInMonth(res.daysInMonth);
        setStaffList(res.staffList || []);
        if (res.currentUserId) setCurrentUserId(res.currentUserId);
      }
    } catch {
      toast.error('Не удалось загрузить график смен');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData(currentYear, currentMonth);
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

  // Quick Shift Assignment (Day Only)
  const handleAssignShift = (
    userId: string,
    day: number,
    status: 'PLANNED' | 'VACATION' | 'SICK' | 'DAY_OFF',
    rate = 2500,
    notes = ''
  ) => {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(currentMonth).padStart(2, '0');
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

    startTransition(async () => {
      try {
        const res = await assignShiftAction({
          userId,
          dateStr,
          shiftType: 'DAY', // All shifts are Day only
          status,
          rateRubles: rate,
          notes,
        });

        if (res.success) {
          toast.success('Смена сохранена');
          loadMonthData(currentYear, currentMonth);
          setSelectedShiftModal(null);
        } else {
          toast.error(res.error || 'Ошибка назначения');
        }
      } catch {
        toast.error('Сбой при сохранении');
      }
    });
  };

  // Delete Shift
  const handleDeleteShift = (shiftId: string) => {
    startTransition(async () => {
      try {
        const res = await deleteShiftAction(shiftId);
        if (res.success) {
          toast.success('Смена удалена');
          loadMonthData(currentYear, currentMonth);
          setSelectedShiftModal(null);
        } else {
          toast.error(res.error || 'Ошибка удаления');
        }
      } catch {
        toast.error('Сбой при удалении');
      }
    });
  };

  // Apply Template (2/2 Day Shifts)
  const handleApplyTemplate = () => {
    if (!templateUserId) {
      toast.error('Выберите сотрудника');
      return;
    }

    startTransition(async () => {
      try {
        const res = await applyShiftTemplateAction({
          userId: templateUserId,
          year: currentYear,
          month: currentMonth,
          templateType,
          startDay: templateStartDay,
          rateRubles: templateRate,
        });

        if (res.success) {
          toast.success(`График успешно применен (${res.createdCount} смен)`);
          setIsTemplateModalOpen(false);
          loadMonthData(currentYear, currentMonth);
        } else {
          toast.error(res.error || 'Ошибка применения шаблона');
        }
      } catch {
        toast.error('Сбой при применении');
      }
    });
  };

  // Open Swap Modal & Load Candidate Availability
  const handleOpenSwapModal = async (shift: ShiftInfo) => {
    setSwapShift(shift);
    setSubstituteUserId('');
    setSwapNotes('');
    setIsSwapModalOpen(true);
    setIsCandidatesLoading(true);

    try {
      const res = await getAvailableSubstitutesAction(shift.id);
      if (res.success && res.candidates) {
        setSubstituteCandidates(res.candidates);
      }
    } catch {
      toast.error('Не удалось загрузить доступность коллег');
    } finally {
      setIsCandidatesLoading(false);
    }
  };

  // Execute Swap
  const handleExecuteSwap = () => {
    if (!swapShift || !substituteUserId) {
      toast.error('Выберите коллегу для подмены');
      return;
    }

    startTransition(async () => {
      try {
        const res = await swapShiftAction({
          shiftId: swapShift.id,
          substituteUserId,
          substituteHours: 12,
          notes: swapNotes || 'Передача дневной смены',
        });

        if (res.success) {
          toast.success('Подмена успешно зафиксирована');
          setIsSwapModalOpen(false);
          setSwapShift(null);
          loadMonthData(currentYear, currentMonth);
        } else {
          toast.error(res.error || 'Ошибка подмены');
        }
      } catch {
        toast.error('Сбой при фиксации');
      }
    });
  };

  // Submit Time Off Request
  const handleTimeOffSubmit = () => {
    if (!timeOffUserId || !timeOffDateFrom || !timeOffDateTo) {
      toast.error('Укажите сотрудника и даты');
      return;
    }

    startTransition(async () => {
      try {
        const res = await requestTimeOffAction({
          userId: timeOffUserId,
          status: timeOffType,
          dateFromStr: timeOffDateFrom,
          dateToStr: timeOffDateTo,
          notes: timeOffNotes,
        });

        if (res.success) {
          toast.success(`Оформлено (${res.daysCount} дн.)`);
          setIsTimeOffModalOpen(false);
          loadMonthData(currentYear, currentMonth);
        } else {
          toast.error(res.error || 'Ошибка оформления');
        }
      } catch {
        toast.error('Сбой при оформлении');
      }
    });
  };

  // Aggregate shifts by Day Number (1..31)
  const dayShiftsMap = useMemo(() => {
    const map: Record<number, ShiftInfo[]> = {};
    for (let d = 1; d <= daysInMonth; d++) map[d] = [];

    scheduleRows.forEach((row) => {
      Object.values(row.shifts).forEach((s) => {
        if (!map[s.dayNumber]) map[s.dayNumber] = [];
        map[s.dayNumber].push(s);
      });
    });
    return map;
  }, [scheduleRows, daysInMonth]);

  // Coverage statistics (Day Shifts Only)
  const coverageStats = useMemo(() => {
    let unstaffedDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayList = dayShiftsMap[d] || [];
      const hasDuty = dayList.some(s => ['PLANNED', 'COMPLETED', 'SWAPPED'].includes(s.status));
      if (!hasDuty) unstaffedDays++;
    }
    return {
      unstaffedDays,
      totalDays: daysInMonth,
      coveragePercent: Math.round(((daysInMonth - unstaffedDays) / daysInMonth) * 100),
    };
  }, [dayShiftsMap, daysInMonth]);

  // Current logged in operator shifts
  const myRow = useMemo(() => {
    return scheduleRows.find(r => r.userId === currentUserId);
  }, [scheduleRows, currentUserId]);

  const myShiftsList = useMemo(() => {
    if (!myRow) return [];
    return Object.values(myRow.shifts).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [myRow]);

  // First day of month (0 = Monday, 6 = Sunday)
  const firstDayOfMonth = useMemo(() => {
    const d = new Date(currentYear, currentMonth - 1, 1).getDay();
    return (d + 6) % 7;
  }, [currentYear, currentMonth]);

  // Today's duty calculations
  const todayDate = now.getDate();
  const isCurrentMonthNow = now.getFullYear() === currentYear && now.getMonth() + 1 === currentMonth;
  const todayShifts = isCurrentMonthNow ? (dayShiftsMap[todayDate] || []) : [];
  const todayDuty = todayShifts.find(s => ['PLANNED', 'COMPLETED', 'SWAPPED'].includes(s.status));
  const isTodayDutyMe = todayDuty?.userId === currentUserId;

  // Next shift calculation for logged-in operator
  const myNextShift = useMemo(() => {
    if (!myShiftsList || myShiftsList.length === 0) return null;
    if (isCurrentMonthNow) {
      return myShiftsList.find(s => s.dayNumber >= todayDate && ['PLANNED', 'SWAPPED'].includes(s.status)) || myShiftsList[0];
    }
    return myShiftsList[0];
  }, [myShiftsList, isCurrentMonthNow, todayDate]);

  return (
    <div className="space-y-5 w-full">
      {/* ── TOP BAR: Month Selector, Mode Switcher & Actions ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/80 rounded-2xl p-3.5 shadow-xs">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs sm:text-sm text-foreground px-3 min-w-[130px] text-center font-mono">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => loadMonthData(currentYear, currentMonth)}
            disabled={isLoading || isPending}
            className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Обновить данные"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* View Switcher: Feed / Calendar */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('feed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'feed'
                ? 'bg-card text-foreground shadow-2xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 text-primary" />
            <span>Лента смен</span>
          </button>

          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'calendar'
                ? 'bg-card text-foreground shadow-2xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
            <span>Сетка месяца</span>
          </button>
        </div>

        {/* Action Buttons: Time Off & Auto Template */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTimeOffUserId(currentUserId || staffList[0]?.id || '');
              setTimeOffDateFrom(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);
              setTimeOffDateTo(`${currentYear}-${String(currentMonth).padStart(2, '0')}-05`);
              setIsTimeOffModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-border/70 bg-card hover:bg-muted text-foreground flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Palmtree className="w-3.5 h-3.5 text-emerald-500" />
            <span>Отпуск / Больничный</span>
          </button>

          {['OWNER', 'ADMIN', 'MANAGER'].includes(currentUserRole) && (
            <button
              onClick={() => {
                if (staffList.length > 0) setTemplateUserId(staffList[0].id);
                setIsTemplateModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Авто-шаблон 2/2</span>
            </button>
          )}
        </div>
      </div>

      {/* ── BENTO TOP PANEL: 2 Fast Focus Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Card 1: Who is on duty TODAY */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Дежурный сегодня (09:00 – 21:00)</span>
            </div>
            {todayDuty && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                На смене
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            {todayDuty ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-900 dark:text-amber-100 flex items-center justify-center font-black text-sm border border-amber-500/30 shadow-2xs">
                  {formatOperatorLabel(todayDuty.userEmail).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-black text-foreground flex items-center gap-1.5">
                    <span>{formatOperatorLabel(todayDuty.userEmail)}</span>
                    {isTodayDutyMe && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground">
                        Вы
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Дневная смена • 12 часов {todayDuty.status === 'SWAPPED' && `(Подмена)`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-sm font-bold">Смена не назначена</div>
                  <div className="text-xs text-muted-foreground">Требуется дежурный на сегодня</div>
                </div>
              </div>
            )}

            {todayDuty ? (
              <button
                type="button"
                onClick={() => handleOpenSwapModal(todayDuty)}
                className="px-3 py-1.5 rounded-xl border border-border/70 hover:bg-muted text-xs font-bold text-foreground transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                <span>{isTodayDutyMe ? 'Попросить замену' : 'Подменить'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedShiftModal({ day: todayDate, isNew: true })}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Заступить</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: My Personal Schedule & Quick Actions */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <UserCheck className="w-4 h-4 text-primary" />
              <span>Мой график дежурств</span>
            </div>
            <span className="text-xs font-mono font-bold text-foreground">
              {myShiftsList.length} смен в месяце
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              {myNextShift ? (
                <div>
                  <div className="text-sm font-black text-foreground flex items-center gap-1.5">
                    <span>
                      {myNextShift.dayNumber === todayDate
                        ? 'Сегодня на дежурстве!'
                        : `${myNextShift.dayNumber} ${MONTH_NAMES[currentMonth - 1]}`}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground font-normal">
                      (09:00 – 21:00)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {myNextShift.dayNumber === todayDate ? 'Ваша текущая смена' : 'Ближайшая назначенная смена'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-bold text-muted-foreground">Смен пока нет</div>
                  <div className="text-xs text-muted-foreground/70">Выберите свободный день в ленте</div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {myNextShift && (
                <button
                  type="button"
                  onClick={() => handleOpenSwapModal(myNextShift)}
                  className="px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Подмена</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setTimeOffUserId(currentUserId || staffList[0]?.id || '');
                  setTimeOffDateFrom(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);
                  setTimeOffDateTo(`${currentYear}-${String(currentMonth).padStart(2, '0')}-05`);
                  setIsTimeOffModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-border/70 hover:bg-muted text-xs font-bold text-foreground transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Palmtree className="w-3.5 h-3.5 text-emerald-500" />
                <span>Отгул</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── VIEW 1: DAY FEED (Clean Day-by-Day List — Default) ── */}
      {viewMode === 'feed' && (
        <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-border/60 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Лента дежурств по дням</span>
              <span className="text-[11px] text-muted-foreground font-mono">
                ({daysInMonth} дней • {coverageStats.coveragePercent}% закрыто)
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              {coverageStats.unstaffedDays === 0 ? 'Все дни укомплектованы' : `⚠️ ${coverageStats.unstaffedDays} дн. без дежурного`}
            </span>
          </div>

          <div className="divide-y divide-border/40">
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isToday = isCurrentMonthNow && todayDate === day;
              const dayOfWeek = (firstDayOfMonth + idx) % 7;
              const isWeekend = dayOfWeek >= 5;
              const shiftsOnDay = dayShiftsMap[day] || [];
              const dutyShift = shiftsOnDay.find(s => ['PLANNED', 'COMPLETED', 'SWAPPED'].includes(s.status));
              const leaves = shiftsOnDay.filter(s => ['VACATION', 'SICK', 'DAY_OFF'].includes(s.status));
              const isMyShift = dutyShift?.userId === currentUserId;

              return (
                <div
                  key={`feed-day-${day}`}
                  className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-muted/20 ${
                    isToday ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : ''
                  }`}
                >
                  {/* Left: Date Badge */}
                  <div className="flex items-center gap-3 min-w-[170px]">
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-mono font-bold shrink-0 ${
                      isToday
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : isWeekend
                        ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        : 'bg-muted/60 text-foreground border border-border/50'
                    }`}>
                      <span className="text-xs leading-none">{day}</span>
                      <span className="text-[9px] uppercase opacity-80 mt-0.5">{WEEKDAY_NAMES[dayOfWeek]}</span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>{day} {MONTH_NAMES[currentMonth - 1]}</span>
                        {isToday && (
                          <span className="text-[9px] font-black uppercase text-primary tracking-wider px-1.5 py-0.2 rounded bg-primary/10">
                            Сегодня
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {WEEKDAY_NAMES_FULL[dayOfWeek]} • 09:00 – 21:00
                      </div>
                    </div>
                  </div>

                  {/* Middle: Assigned Operator & Leaves */}
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    {dutyShift ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedShiftModal({ day, shift: dutyShift })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 shadow-2xs hover:scale-[1.01] ${
                            dutyShift.status === 'SWAPPED'
                              ? 'bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/30 hover:bg-amber-500/25'
                          } ${isMyShift ? 'ring-1.5 ring-primary font-black' : ''}`}
                        >
                          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <div className="w-5 h-5 rounded-full bg-amber-500/30 text-amber-900 dark:text-amber-100 flex items-center justify-center text-[10px] font-black shrink-0">
                            {formatOperatorLabel(dutyShift.userEmail).slice(0, 2).toUpperCase()}
                          </div>
                          <span>{formatOperatorLabel(dutyShift.userEmail)}</span>
                          {isMyShift && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-primary text-primary-foreground ml-1">
                              Вы
                            </span>
                          )}
                          {dutyShift.status === 'SWAPPED' && dutyShift.substituteUserEmail && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                              ⇄ {formatOperatorLabel(dutyShift.substituteUserEmail)}
                            </span>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedShiftModal({ day, isNew: true })}
                        className="px-3 py-1.5 text-xs font-bold text-muted-foreground/70 hover:text-amber-600 dark:hover:text-amber-400 border border-dashed border-border/70 hover:border-amber-500/50 rounded-xl hover:bg-amber-500/5 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Свободный слот (Назначить)</span>
                      </button>
                    )}

                    {/* Leaves & Sick Badges */}
                    {leaves.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => setSelectedShiftModal({ day, shift: l })}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                          l.status === 'VACATION'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        }`}
                      >
                        <span>{l.status === 'VACATION' ? '🌴 Отпуск:' : '🩹 Больничный:'}</span>
                        <span>{formatOperatorLabel(l.userEmail)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Right: Fast Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {dutyShift ? (
                      <button
                        type="button"
                        onClick={() => handleOpenSwapModal(dutyShift)}
                        className="px-2.5 py-1 rounded-lg border border-border/60 hover:bg-muted text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
                        title="Оформить подмену смены"
                      >
                        <ArrowLeftRight className="w-3 h-3 text-blue-500" />
                        <span>Подмена</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAssignShift(currentUserId || staffList[0]?.id, day, 'PLANNED')}
                        className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Я выйду
                      </button>
                    )}

                    {['OWNER', 'ADMIN', 'MANAGER'].includes(currentUserRole) && dutyShift && (
                      <button
                        type="button"
                        onClick={() => setSelectedShiftModal({ day, shift: dutyShift })}
                        className="px-2.5 py-1 rounded-lg border border-border/60 hover:bg-muted text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Изменить
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VIEW 2: MONTH GRID (Clean 7-Column Calendar) ── */}
      {viewMode === 'calendar' && (
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
          {/* Weekday Header */}
          <div
            className="grid grid-cols-7 border-b border-border/70 bg-muted/30 text-center font-bold text-[11px] uppercase tracking-wider text-muted-foreground py-2"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
          >
            {WEEKDAY_NAMES.map((wd, i) => (
              <div key={wd} className={i >= 5 ? 'text-rose-500' : ''}>{wd}</div>
            ))}
          </div>

          {/* 7x5 Days Grid */}
          <div
            className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/40 bg-background/50"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
          >
            {/* Offset Days */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`offset-${idx}`} className="min-h-[90px] p-1.5 bg-muted/10 opacity-30 select-none" />
            ))}

            {/* Current Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isToday = isCurrentMonthNow && todayDate === day;
              const shiftsOnDay = dayShiftsMap[day] || [];
              const dutyShift = shiftsOnDay.find(s => ['PLANNED', 'COMPLETED', 'SWAPPED'].includes(s.status));
              const leaves = shiftsOnDay.filter(s => ['VACATION', 'SICK', 'DAY_OFF'].includes(s.status));
              const dayOfWeek = (firstDayOfMonth + idx) % 7;
              const isWeekend = dayOfWeek >= 5;
              const isMyShift = dutyShift?.userId === currentUserId;

              return (
                <div
                  key={`day-${day}`}
                  className={`min-h-[100px] p-1.5 flex flex-col justify-between transition-colors hover:bg-muted/20 relative group ${
                    isToday ? 'bg-primary/5 ring-1 ring-inset ring-primary/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-mono font-bold w-5 h-5 flex items-center justify-center rounded-md ${
                      isToday
                        ? 'bg-primary text-primary-foreground font-black'
                        : isWeekend
                        ? 'text-rose-500'
                        : 'text-foreground'
                    }`}>
                      {day}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedShiftModal({ day, isNew: true })}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity cursor-pointer"
                      title="Назначить смену"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Day Duty Chip */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {dutyShift ? (
                      <button
                        type="button"
                        onClick={() => setSelectedShiftModal({ day, shift: dutyShift })}
                        className={`w-full text-left px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer truncate flex items-center gap-1 shadow-2xs ${
                          dutyShift.status === 'SWAPPED'
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30 hover:bg-amber-500/25'
                        } ${isMyShift ? 'ring-1 ring-primary font-black' : ''}`}
                        title={`${dutyShift.userEmail} (Дневная смена)`}
                      >
                        <Sun className="w-2.5 h-2.5 shrink-0 text-amber-500" />
                        <span className="truncate">{formatOperatorLabel(dutyShift.userEmail)}</span>
                      </button>
                    ) : (
                      <div
                        onClick={() => setSelectedShiftModal({ day, isNew: true })}
                        className="h-7 border border-dashed border-border/40 rounded-lg flex items-center justify-center text-[9px] text-muted-foreground/50 hover:text-muted-foreground hover:border-border cursor-pointer transition-colors"
                      >
                        + Дежурный
                      </div>
                    )}

                    {leaves.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => setSelectedShiftModal({ day, shift: l })}
                        className={`px-1 py-0.5 rounded text-[9px] font-medium border truncate flex items-center gap-0.5 cursor-pointer ${
                          l.status === 'VACATION'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                        }`}
                      >
                        <span>{l.status === 'VACATION' ? '🌴' : '🩹'}</span>
                        <span className="truncate">{formatOperatorLabel(l.userEmail)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL 1: Shift Details / Quick Assign ── */}
      {selectedShiftModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span>
                  {selectedShiftModal.shift ? 'Редактирование смены' : 'Назначение дежурного'} — {selectedShiftModal.day} {MONTH_NAMES[currentMonth - 1]}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedShiftModal(null)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const userId = (formData.get('userId') as string) || currentUserId || staffList[0]?.id;
                const status = formData.get('status') as 'PLANNED' | 'VACATION' | 'SICK' | 'DAY_OFF';
                const rate = Number(formData.get('rate')) || 2500;
                const notes = formData.get('notes') as string;

                handleAssignShift(userId, selectedShiftModal.day, status, rate, notes);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-muted-foreground mb-1">Дежурный сотрудник:</label>
                <select
                  name="userId"
                  defaultValue={selectedShiftModal.shift?.userId || currentUserId || staffList[0]?.id}
                  disabled={!['OWNER', 'ADMIN', 'MANAGER'].includes(currentUserRole)}
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.email} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Статус смены:</label>
                <select
                  name="status"
                  defaultValue={selectedShiftModal.shift?.status || 'PLANNED'}
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                >
                  <option value="PLANNED">☀️ Дневная смена (Запланировано)</option>
                  <option value="COMPLETED">✅ Отработано</option>
                  <option value="VACATION">🌴 Отпуск</option>
                  <option value="SICK">🩹 Больничный</option>
                  <option value="DAY_OFF">☕ Отгул</option>
                </select>
              </div>

              {['OWNER', 'ADMIN', 'MANAGER'].includes(currentUserRole) && (
                <div>
                  <label className="block font-bold text-muted-foreground mb-1">Ставка за смену (₽):</label>
                  <input
                    type="number"
                    name="rate"
                    defaultValue={selectedShiftModal.shift?.rateRubles || 2500}
                    className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Примечание / Комментарий:</label>
                <input
                  type="text"
                  name="notes"
                  defaultValue={selectedShiftModal.shift?.notes || ''}
                  placeholder="Например: Замена на вторую половину дня"
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {selectedShiftModal.shift && (
                  <button
                    type="button"
                    onClick={() => handleDeleteShift(selectedShiftModal.shift!.id)}
                    className="h-8 px-3 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 flex items-center gap-1 font-bold cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedShiftModal(null)}
                    className="h-8 px-3 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground font-bold cursor-pointer"
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="h-8 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold cursor-pointer shadow-2xs"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Simple Shift Swap Modal ── */}
      {isSwapModalOpen && swapShift && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                <span>Передача смены — {swapShift.dayNumber} {MONTH_NAMES[currentMonth - 1]}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSwapModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1">
              <div className="text-xs font-bold text-blue-900 dark:text-blue-100 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Дневная смена (09:00 – 21:00)</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Текущий дежурный: <strong className="text-foreground">{formatOperatorLabel(swapShift.userEmail)}</strong>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-muted-foreground mb-1">Кому передать смену:</label>
                {isCandidatesLoading ? (
                  <div className="h-9 flex items-center justify-center text-muted-foreground text-xs">
                    Загрузка доступных коллег...
                  </div>
                ) : (
                  <select
                    value={substituteUserId}
                    onChange={(e) => setSubstituteUserId(e.target.value)}
                    className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                  >
                    <option value="">-- Выберите коллегу из саппорта --</option>
                    {substituteCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.email} ({c.isAvailable ? 'Свободен ✅' : 'Занят'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Причина / Примечание:</label>
                <input
                  type="text"
                  value={swapNotes}
                  onChange={(e) => setSwapNotes(e.target.value)}
                  placeholder="Например: Зачет в университете / Заболел"
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsSwapModalOpen(false)}
                className="h-8 px-3 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground font-bold cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleExecuteSwap}
                disabled={isPending || !substituteUserId}
                className="h-8 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-2xs disabled:opacity-50"
              >
                Подтвердить передачу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Time Off Modal (Отпуск / Больничный) ── */}
      {isTimeOffModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Palmtree className="w-4 h-4 text-emerald-500" />
                <span>Оформление отсутствия</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTimeOffModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-muted-foreground mb-1">Сотрудник:</label>
                <select
                  value={timeOffUserId}
                  onChange={(e) => setTimeOffUserId(e.target.value)}
                  disabled={!['OWNER', 'ADMIN', 'MANAGER'].includes(currentUserRole)}
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.email} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Тип отсутствия:</label>
                <select
                  value={timeOffType}
                  onChange={(e) => setTimeOffType(e.target.value as any)}
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                >
                  <option value="VACATION">🌴 Оплачиваемый отпуск</option>
                  <option value="SICK">🩹 Больничный лист</option>
                  <option value="DAY_OFF">☕ Отгул / Личные дела</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-muted-foreground mb-1">Дата С:</label>
                  <input
                    type="date"
                    value={timeOffDateFrom}
                    onChange={(e) => setTimeOffDateFrom(e.target.value)}
                    className="w-full h-9 px-2 bg-background border border-border/60 rounded-xl text-foreground"
                  />
                </div>
                <div>
                  <label className="block font-bold text-muted-foreground mb-1">Дата ПО:</label>
                  <input
                    type="date"
                    value={timeOffDateTo}
                    onChange={(e) => setTimeOffDateTo(e.target.value)}
                    className="w-full h-9 px-2 bg-background border border-border/60 rounded-xl text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Комментарий:</label>
                <input
                  type="text"
                  value={timeOffNotes}
                  onChange={(e) => setTimeOffNotes(e.target.value)}
                  placeholder="Согласовано с тимлидом"
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsTimeOffModalOpen(false)}
                className="h-8 px-3 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground font-bold cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleTimeOffSubmit}
                disabled={isPending}
                className="h-8 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-2xs"
              >
                Оформить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: Auto Template 2/2 Modal ── */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <span>Авто-шаблон графика смен</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-muted-foreground mb-1">Сотрудник:</label>
                <select
                  value={templateUserId}
                  onChange={(e) => setTemplateUserId(e.target.value)}
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.email} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Схема графика:</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value as any)}
                  className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground"
                >
                  <option value="2_2_DAY">2 через 2 (Дневные смены 09:00 – 21:00)</option>
                  <option value="5_2">5 через 2 (Пн–Пт с 09:00 до 21:00)</option>
                  <option value="DAILY">Каждый день</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-muted-foreground mb-1">Стартовый день:</label>
                  <input
                    type="number"
                    min={1}
                    max={daysInMonth}
                    value={templateStartDay}
                    onChange={(e) => setTemplateStartDay(Number(e.target.value))}
                    className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-muted-foreground mb-1">Ставка (₽ / смена):</label>
                  <input
                    type="number"
                    value={templateRate}
                    onChange={(e) => setTemplateRate(Number(e.target.value))}
                    className="w-full h-9 px-2.5 bg-background border border-border/60 rounded-xl text-foreground font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="h-8 px-3 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground font-bold cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleApplyTemplate}
                disabled={isPending}
                className="h-8 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold cursor-pointer shadow-2xs"
              >
                Применить график
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
