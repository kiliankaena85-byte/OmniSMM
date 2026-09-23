'use client';

import React, { useState, useTransition } from 'react';
import { 
  StaffMemberSummary, 
  HumanReadableLog, 
  getStaffPersonalLogsAction, 
  updateStaffMemberAction 
} from '@/actions/admin/staff';
import { formatRubles } from '@/utils/format-price';
import { 
  Users, ShieldCheck, Clock, Moon, MessageSquare, 
  Activity, AlertCircle, Coffee, Search, RefreshCw,
  X, Check, Lock, ChevronRight, UserCheck, Shield,
  Calendar, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { StaffScheduleTab } from './components/staff-schedule-tab';
import { StaffPayrollTab } from './components/staff-payroll-tab';

interface StaffClientProps {
  initialStaff: StaffMemberSummary[];
  selectedDate: string;
  staffRoles: Array<{ id: string; name: string; description?: string | null }>;
  currentUserRole: string;
}

const ROLE_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  OWNER: { label: 'Владелец', bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' },
  ADMIN: { label: 'Админ', bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20' },
  MANAGER: { label: 'Менеджер', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  SUPPORT: { label: 'Саппорт', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
};

export function StaffClient({
  initialStaff,
  selectedDate,
  staffRoles,
  currentUserRole,
}: StaffClientProps) {
  const [activeTab, setActiveTab] = useState<'activity' | 'schedule' | 'payroll'>('activity');
  const [staffList, setStaffList] = useState<StaffMemberSummary[]>(initialStaff);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffMemberSummary | null>(null);
  const [logs, setLogs] = useState<HumanReadableLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState(false);

  // Role Edit Modal
  const [editingStaff, setEditingStaff] = useState<StaffMemberSummary | null>(null);
  const [editRole, setEditRole] = useState('SUPPORT');
  const [editStaffRoleId, setEditStaffRoleId] = useState<string | null>(null);
  const [editLimitRubles, setEditLimitRubles] = useState(5000);
  const [isPending, startTransition] = useTransition();

  // Open personal logs drawer
  async function handleOpenLogs(staff: StaffMemberSummary) {
    setSelectedStaff(staff);
    setIsLogsDrawerOpen(true);
    setIsLoadingLogs(true);
    try {
      const res = await getStaffPersonalLogsAction(staff.id, 60);
      if (res.success) {
        setLogs(res.logs);
      }
    } catch {
      toast.error('Не удалось загрузить историю действий сотрудника');
    } finally {
      setIsLoadingLogs(false);
    }
  }

  // Open Edit Modal
  function handleOpenEditModal(staff: StaffMemberSummary) {
    setEditingStaff(staff);
    setEditRole(staff.role);
    setEditStaffRoleId(staff.staffRoleId);
    setEditLimitRubles((staff.supportLimitCents || 0) / 100);
  }

  // Save Role and Limits
  function handleSaveStaffRole() {
    if (!editingStaff) return;
    startTransition(async () => {
      try {
        const res = await updateStaffMemberAction({
          userId: editingStaff.id,
          role: editRole as 'SUPPORT' | 'MANAGER' | 'ADMIN' | 'OWNER' | 'USER' | 'BANNED',
          staffRoleId: editStaffRoleId,
          supportLimitRubles: editLimitRubles,
        });

        if (res.success) {
          toast.success('Права и лимиты сотрудника обновлены');
          setStaffList((prev) =>
            prev.map((s) =>
              s.id === editingStaff.id
                ? {
                    ...s,
                    role: editRole,
                    staffRoleId: editStaffRoleId,
                    supportLimitCents: Math.round(editLimitRubles * 100),
                  }
                : s
            )
          );
          setEditingStaff(null);
        } else {
          toast.error(res.error || 'Ошибка при сохранении прав');
        }
      } catch {
        toast.error('Сбой сохранения');
      }
    });
  }

  // Filter staff list
  const filteredStaff = staffList.filter((s) =>
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Summary Metrics
  const totalStaff = staffList.length;
  const activeTodayCount = staffList.filter((s) => s.totalActionsToday > 0).length;
  const totalTicketsClosedToday = staffList.reduce((acc, s) => acc + s.ticketsRepliedToday, 0);
  const nightAlertCount = staffList.filter((s) => s.hasNightActivity).length;

  return (
    <div className="space-y-6">
      {/* ── TABS SELECTOR ── */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 w-max max-w-full overflow-x-auto scrollbar-none shadow-2xs">
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'activity'
              ? 'bg-card text-foreground shadow-xs border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="w-4 h-4 text-primary" />
          Активность & Аудит
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'bg-card text-foreground shadow-xs border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4 text-emerald-500" />
          График смен & Календарь
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'payroll'
              ? 'bg-card text-foreground shadow-xs border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign className="w-4 h-4 text-sky-500" />
          Табель & Зарплата
        </button>
      </div>

      {activeTab === 'schedule' && (
        <StaffScheduleTab currentUserRole={currentUserRole} />
      )}

      {activeTab === 'payroll' && (
        <StaffPayrollTab />
      )}

      {activeTab === 'activity' && (
        <>
          {/* ── TOP METRICS BAR ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Total Staff */}
            <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">{totalStaff}</div>
                <div className="text-xs text-muted-foreground font-medium">Всего в команде</div>
              </div>
            </div>

            {/* Metric 2: Active on shift today */}
            <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">{activeTodayCount}</div>
                <div className="text-xs text-muted-foreground font-medium">На смене сегодня</div>
              </div>
            </div>

            {/* Metric 3: Tickets handled today */}
            <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400 flex-shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">{totalTicketsClosedToday}</div>
                <div className="text-xs text-muted-foreground font-medium">Тикетов обработано</div>
              </div>
            </div>

            {/* Metric 4: Night Activity Alerts */}
            <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                nightAlertCount > 0 
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                  : 'bg-muted/40 text-muted-foreground'
              }`}>
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">{nightAlertCount}</div>
                <div className="text-xs text-muted-foreground font-medium">Ночная активность (23:00–06:00)</div>
              </div>
            </div>
          </div>

          {/* ── SEARCH & FILTER CONTROLS ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/60 rounded-xl p-3.5 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск сотрудника по email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <span>Дата выборки:</span>
              <span className="font-bold text-foreground bg-muted/40 px-2 py-1 rounded-md border border-border/50">
                {selectedDate}
              </span>
            </div>
          </div>

      {/* ── STAFF LIST & 24H ACTIVITY MATRIX ── */}
      <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3.5">Сотрудник / Роль</th>
                <th className="px-4 py-3.5">24ч График активности (00:00 — 23:00 МСК)</th>
                <th className="px-4 py-3.5 text-center" title="Время между действиями в админке">Смена & Простой в админке</th>
                <th className="px-4 py-3.5 text-right">Лимит саппорта</th>
                <th className="px-4 py-3.5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-sm">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    Сотрудники не найдены
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const roleBadge = ROLE_BADGES[staff.role] || ROLE_BADGES.SUPPORT;
                  const spentRubles = (staff.supportSpentTodayCents || 0) / 100;
                  const limitRubles = (staff.supportLimitCents || 0) / 100;
                  const hasActions = staff.totalActionsToday > 0;

                  return (
                    <tr 
                      key={staff.id} 
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => handleOpenLogs(staff)}
                    >
                      {/* 1. Name & Role */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {staff.email.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                              {staff.email}
                              {staff.hasNightActivity && (
                                <span title="Зафиксированы действия в ночное время (23:00–06:00)">
                                  <Moon className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}>
                                {roleBadge.label}
                              </span>
                              {staff.staffRoleName && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/40">
                                  {staff.staffRoleName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. 24h Activity Timeline Bar */}
                      <td className="px-4 py-3.5 align-middle min-w-[240px]">
                        <div className="space-y-1">
                          <div className="flex items-end gap-[2px] h-6 bg-muted/20 p-1 rounded-md border border-border/40">
                            {staff.activityHours.map((hourObj) => {
                              const isNight = hourObj.isNight;
                              const count = hourObj.count;
                              const heightPercent = count === 0 ? 15 : Math.min(100, Math.max(30, count * 20));

                              let barColor = 'bg-muted-foreground/20';
                              if (count > 0) {
                                barColor = isNight 
                                  ? 'bg-amber-500 dark:bg-amber-400' 
                                  : 'bg-primary dark:bg-primary';
                              }

                              return (
                                <div
                                  key={hourObj.hour}
                                  className="flex-1 h-full flex items-end group/bar relative"
                                  title={`${hourObj.hour}:00 — ${count} действ.`}
                                >
                                  <div
                                    className={`w-full rounded-t-[1px] transition-all ${barColor}`}
                                    style={{ height: `${heightPercent}%` }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[9px] text-muted-foreground px-0.5 font-mono">
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>23:00</span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Shift Time & Idle */}
                      <td className="px-4 py-3.5 align-middle text-center">
                        {hasActions ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-foreground flex items-center justify-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              {new Date(staff.firstActionAt!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              {' — '}
                              {new Date(staff.lastActionAt!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                              <Coffee className="w-3 h-3 text-amber-500/80" />
                              Простой: {staff.maxIdleMinutes > 0 ? `${staff.maxIdleMinutes} мин` : 'без пауз'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Не был на смене
                          </span>
                        )}
                      </td>

                      {/* 4. Support Limit & Spent */}
                      <td className="px-4 py-3.5 align-middle text-right">
                        {staff.role === 'SUPPORT' || staff.supportLimitCents > 0 ? (
                          <div>
                            <div className="text-xs font-bold text-foreground">
                              {formatRubles(spentRubles)} <span className="text-muted-foreground font-normal">/ {formatRubles(limitRubles)}</span>
                            </div>
                            <div className="w-24 ml-auto h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  spentRubles > limitRubles * 0.8 ? 'bg-rose-500' : 'bg-primary'
                                }`}
                                style={{
                                  width: `${Math.min(100, (spentRubles / (limitRubles || 1)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* 5. Actions */}
                      <td className="px-4 py-3.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(staff)}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground transition-all cursor-pointer"
                          >
                            Права & Лимит
                          </button>
                          <button
                            onClick={() => handleOpenLogs(staff)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                            title="Открыть подробный аудит"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* ── PERSONAL AUDIT LOGS DRAWER ── */}
      {isLogsDrawerOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div 
            className="w-full max-w-xl bg-card border-l border-border h-full shadow-2xl flex flex-col p-0 animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm flex-shrink-0">
                  {selectedStaff.email.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    {selectedStaff.email}
                    {selectedStaff.hasNightActivity && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Moon className="w-3 h-3" /> Ночные действия
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    История действий и хронология смены (Русский язык)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLogsDrawerOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body / Logs Timeline */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {isLoadingLogs ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm font-medium">Загрузка журнала аудита...</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground space-y-2">
                  <Activity className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium">За этот период действий сотрудника не зафиксировано</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {logs.map((log) => {
                    const timeStr = new Date(log.createdAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                    const dateStr = new Date(log.createdAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                    });

                    return (
                      <div
                        key={log.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          log.isNightActivity
                            ? 'bg-amber-500/5 border-amber-500/20'
                            : 'bg-background border-border/60 hover:border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                            {log.isNightActivity ? (
                              <Moon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            ) : log.iconType === 'ticket' ? (
                              <MessageSquare className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                            ) : log.iconType === 'money' ? (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <Activity className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            )}
                            <span>{log.actionTitle}</span>
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground flex-shrink-0">
                            {dateStr} в {timeStr}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          {log.actionDescription}
                        </p>

                        {log.ipAddress && (
                          <div className="mt-2 text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded inline-block">
                            IP: {log.ipAddress}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT ROLE & LIMIT MODAL ── */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Управление доступом</h3>
                <p className="text-xs text-muted-foreground">{editingStaff.email}</p>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Role Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Роль сотрудника
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="SUPPORT">Саппорт (Оператор поддержки)</option>
                  <option value="MANAGER">Менеджер (Заказы и модерация)</option>
                  {currentUserRole === 'OWNER' && (
                    <>
                      <option value="ADMIN">Администратор</option>
                      <option value="OWNER">Владелец системы</option>
                    </>
                  )}
                  <option value="USER">Обычный клиент (Снять доступ)</option>
                </select>
              </div>

              {/* Custom Staff Role */}
              {staffRoles.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Кастомная матрица прав (RBAC)
                  </label>
                  <select
                    value={editStaffRoleId || ''}
                    onChange={(e) => setEditStaffRoleId(e.target.value || null)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Без кастомной матрицы (Стандартная роль)</option>
                    {staffRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Support Daily Limit in Rubles */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Суточный лимит компенсаций (Рубли)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step={100}
                  value={editLimitRubles}
                  onChange={(e) => setEditLimitRubles(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-muted-foreground">
                  Максимальная сумма, которую саппорт может вернуть клиентам за 1 сутки без одобрения админа.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveStaffRole}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
              >
                {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
