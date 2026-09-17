'use client';

import React, { useState, useEffect } from "react";
import { getBalancePoliciesAction, upsertBalancePolicyAction } from "@/actions/admin/balance-policy";
import Link from "next/link";
import { BALANCE_ADJUSTMENT_REASONS } from "@/constants/balance-adjustments";

interface PolicyItem {
  id: string;
  scopeType: "GLOBAL" | "ROLE" | "USER";
  staffRoleId?: string | null;
  userId?: string | null;
  isActive: boolean;
  enabled: boolean;
  canRequestCredit: boolean;
  canRequestDebit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canViewAll: boolean;
  canViewStats: boolean;
  maxCreditPerRequest: string;
  maxDebitPerRequest: string;
  maxCreditPerDay: string;
  maxDebitPerDay: string;
  maxTotalPerDay: string;
  maxApprovalPerRequest: string;
  allowedCreditReasonCodes: string;
  allowedDebitReasonCodes: string;
  allowedTargetRoles: string;
  requireTicket: boolean;
  requireOrderForDebit: boolean;
  blockBannedTargets: boolean;
  blockDeletedTargets: boolean;
  autoExecuteBelow: string;
}

import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { PlanTable, PlanTableHeader, PlanTableHeadCell, PlanTableRow, PlanTableCell } from "@/components/ui/plan";
import { ShieldCheck, Sliders, ArrowLeft } from "lucide-react";

export default function BalancePoliciesPage() {
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  // Form State for Global Policy
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [canCredit, setCanCredit] = useState(true);
  const [canDebit, setCanDebit] = useState(true);
  const [canApprove, setCanApprove] = useState(true);
  const [maxCreditPerReqRub, setMaxCreditPerReqRub] = useState("5000");
  const [maxDebitPerReqRub, setMaxDebitPerReqRub] = useState("5000");
  const [maxCreditPerDayRub, setMaxCreditPerDayRub] = useState("20000");
  const [maxDebitPerDayRub, setMaxDebitPerDayRub] = useState("20000");
  const [maxApprovalRub, setMaxApprovalRub] = useState("50000");
  const [requireTicket, setRequireTicket] = useState(true);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await getBalancePoliciesAction();
      if (res.success && res.policies) {
        setPolicies(res.policies as unknown as PolicyItem[]);
        const globalPol = res.policies.find((p) => p.scopeType === "GLOBAL");
        if (globalPol) {
          setGlobalEnabled(globalPol.enabled);
          setCanCredit(globalPol.canRequestCredit);
          setCanDebit(globalPol.canRequestDebit);
          setCanApprove(globalPol.canApprove);
          setMaxCreditPerReqRub((Number(globalPol.maxCreditPerRequest) / 100).toString());
          setMaxDebitPerReqRub((Number(globalPol.maxDebitPerRequest) / 100).toString());
          setMaxCreditPerDayRub((Number(globalPol.maxCreditPerDay) / 100).toString());
          setMaxDebitPerDayRub((Number(globalPol.maxDebitPerDay) / 100).toString());
          setMaxApprovalRub((Number(globalPol.maxApprovalPerRequest) / 100).toString());
          setRequireTicket(globalPol.requireTicket);
        }
      }
    } catch (err: unknown) {
      console.error("Failed to load policies:", err);
      setError(err instanceof Error ? err.message : "Не удалось загрузить политики");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const parseRubToCents = (rubStr: string): string => {
    const val = parseFloat(rubStr.trim());
    if (isNaN(val) || val < 0) return "0";
    return BigInt(Math.round(val * 100)).toString();
  };

  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);

    const existingGlobal = policies.find((p) => p.scopeType === "GLOBAL");

    const formData = new FormData();
    if (existingGlobal) formData.append("id", existingGlobal.id);
    formData.append("scopeType", "GLOBAL");
    formData.append("enabled", globalEnabled ? "true" : "false");
    formData.append("isActive", "true");
    formData.append("canRequestCredit", canCredit ? "true" : "false");
    formData.append("canRequestDebit", canDebit ? "true" : "false");
    formData.append("canApprove", canApprove ? "true" : "false");
    formData.append("canReject", "true");
    formData.append("canViewAll", "true");
    formData.append("canViewStats", "true");
    formData.append("maxCreditPerRequest", parseRubToCents(maxCreditPerReqRub));
    formData.append("maxDebitPerRequest", parseRubToCents(maxDebitPerReqRub));
    formData.append("maxCreditPerDay", parseRubToCents(maxCreditPerDayRub));
    formData.append("maxDebitPerDay", parseRubToCents(maxDebitPerDayRub));
    formData.append("maxApprovalPerRequest", parseRubToCents(maxApprovalRub));
    formData.append("requireTicket", requireTicket ? "true" : "false");
    formData.append("blockBannedTargets", "true");
    formData.append("blockDeletedTargets", "true");

    BALANCE_ADJUSTMENT_REASONS.CREDIT.forEach((r) => formData.append("allowedCreditReasonCodes", r));
    BALANCE_ADJUSTMENT_REASONS.DEBIT.forEach((r) => formData.append("allowedDebitReasonCodes", r));
    ["USER", "SUPPORT", "MANAGER"].forEach((r) => formData.append("allowedTargetRoles", r));

    try {
      const res = await upsertBalancePolicyAction(formData);
      if (res.success) {
        setMsg("Глобальная политика успешно сохранена!");
        fetchPolicies();
      } else {
        setError(res.error || "Не удалось сохранить политику");
        setShakeKey(Date.now());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка системы");
      setShakeKey(Date.now());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-8">
      <AdminBreadcrumbs
        items={[
          { label: 'Настройки', href: '/admin/settings' },
          { label: 'Политики баланса' },
        ]}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Политики корректировки баланса</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Глобальные лимиты, роли и персональные переопределения заявок
          </p>
        </div>

        <Link
          href="/admin/finance/balance-requests"
          className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-muted text-foreground hover:bg-muted/80 rounded-xl text-xs font-bold transition-all shadow-xs border border-border/80 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" />
          <span>К заявкам на баланс</span>
        </Link>
      </div>

      {msg && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-medium">{msg}</div>}
      {error && (
        <div
          key={shakeKey}
          className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-medium animate-shake"
        >
          {error}
        </div>
      )}

      {/* ── Table of Policies (GLOBAL / ROLES / USERS) ── */}
      <div className="bg-card/70 border border-border/80 rounded-2xl p-4 md:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Реестр действующих правил и лимитов</h2>
              <p className="text-[11px] text-muted-foreground">
                Приоритет: Персональная (USER) → Групповая (ROLE) → Общесистемная (GLOBAL)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-muted-foreground font-medium">
            Всего правил: <span className="text-foreground font-bold">{policies.length}</span>
          </span>
        </div>

        <PlanTable compact={true} className="w-full table-fixed">
          <PlanTableHeader>
            <tr>
              <PlanTableHeadCell className="w-[110px]">Область</PlanTableHeadCell>
              <PlanTableHeadCell className="w-[95px]">Статус</PlanTableHeadCell>
              <PlanTableHeadCell className="w-[140px]">Права</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right w-[18%]">Лимит заявки (+/-)</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right w-[18%]">Дневной лимит (+/-)</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right w-[18%]">Лимит утверждения</PlanTableHeadCell>
              <PlanTableHeadCell className="text-center w-[85px]">Тикет</PlanTableHeadCell>
            </tr>
          </PlanTableHeader>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs font-medium">
                  Загрузка политик...
                </td>
              </tr>
            ) : policies.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs font-medium">
                  Активных политик не найдено. Настройте и сохраните глобальную политику ниже.
                </td>
              </tr>
            ) : (
              policies.map((p) => {
                const maxCreditReq = (Number(p.maxCreditPerRequest) / 100).toLocaleString('ru-RU');
                const maxDebitReq = (Number(p.maxDebitPerRequest) / 100).toLocaleString('ru-RU');
                const maxCreditDay = (Number(p.maxCreditPerDay) / 100).toLocaleString('ru-RU');
                const maxDebitDay = (Number(p.maxDebitPerDay) / 100).toLocaleString('ru-RU');
                const maxApprove = Number(p.maxApprovalPerRequest) === 0 
                  ? 'Безлимит (OWNER)' 
                  : `${(Number(p.maxApprovalPerRequest) / 100).toLocaleString('ru-RU')} ₽`;

                return (
                  <PlanTableRow key={p.id}>
                    <PlanTableCell className="whitespace-nowrap">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {p.scopeType}
                      </span>
                    </PlanTableCell>
                    <PlanTableCell className="whitespace-nowrap">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        p.enabled && p.isActive 
                          ? 'bg-success/15 text-success border border-success/20' 
                          : 'bg-muted text-muted-foreground border border-border/40'
                      }`}>
                        {p.enabled && p.isActive ? 'Активна' : 'Отключена'}
                      </span>
                    </PlanTableCell>
                    <PlanTableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        {p.canRequestCredit && <span className="text-success font-bold" title="Запрос CREDIT">+CR</span>}
                        {p.canRequestDebit && <span className="text-destructive font-bold" title="Запрос DEBIT">-DB</span>}
                        {p.canApprove && <span className="text-primary font-bold" title="Утверждение">✓AP</span>}
                        <span className="text-muted-foreground">
                          {p.canViewAll ? 'ALL' : 'OWN'}
                        </span>
                      </div>
                    </PlanTableCell>
                    <PlanTableCell className="text-right font-mono text-xs whitespace-nowrap">
                      <span className="text-success">+{maxCreditReq} ₽</span> / <span className="text-destructive">-{maxDebitReq} ₽</span>
                    </PlanTableCell>
                    <PlanTableCell className="text-right font-mono text-xs whitespace-nowrap">
                      <span className="text-success">+{maxCreditDay} ₽</span> / <span className="text-destructive">-{maxDebitDay} ₽</span>
                    </PlanTableCell>
                    <PlanTableCell className="text-right font-mono text-xs text-foreground whitespace-nowrap">
                      {maxApprove}
                    </PlanTableCell>
                    <PlanTableCell className="text-center whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        p.requireTicket ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                      }`}>
                        {p.requireTicket ? 'Да' : 'Нет'}
                      </span>
                    </PlanTableCell>
                  </PlanTableRow>
                );
              })
            )}
          </tbody>
        </PlanTable>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4 animate-pulse">
          <div className="h-6 w-1/3 bg-muted rounded-md" />
          <div className="h-4 w-1/2 bg-muted/60 rounded-md" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="h-12 bg-muted/40 rounded-lg" />
            <div className="h-12 bg-muted/40 rounded-lg" />
            <div className="h-12 bg-muted/40 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="h-14 bg-muted/40 rounded-lg" />
            <div className="h-14 bg-muted/40 rounded-lg" />
            <div className="h-14 bg-muted/40 rounded-lg" />
            <div className="h-14 bg-muted/40 rounded-lg" />
          </div>
        </div>
      ) : (
        /* Global Policy Card */
        <div className="bg-card/70 border border-border/80 rounded-2xl p-5 md:p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-muted text-foreground rounded-xl">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Глобальная политика (GLOBAL)</h2>
                <p className="text-xs text-muted-foreground">Применяется ко всем сотрудникам, если не задана персональная политика</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={globalEnabled}
                onChange={(e) => setGlobalEnabled(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
              <span className="text-sm font-medium text-foreground">Включена</span>
            </label>
          </div>

          <form onSubmit={handleSaveGlobal} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
                <input
                  type="checkbox"
                  checked={canCredit}
                  onChange={(e) => setCanCredit(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
                <span className="text-xs font-medium text-foreground">Разрешить запрашивать CREDIT (+)</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
                <input
                  type="checkbox"
                  checked={canDebit}
                  onChange={(e) => setCanDebit(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
                <span className="text-xs font-medium text-foreground">Разрешить запрашивать DEBIT (-)</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
                <input
                  type="checkbox"
                  checked={canApprove}
                  onChange={(e) => setCanApprove(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
                <span className="text-xs font-medium text-foreground">Разрешить утверждать заявки</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Макс. разовое начисление (₽)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={maxCreditPerReqRub}
                  onChange={(e) => setMaxCreditPerReqRub(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Макс. разовое списание (₽)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={maxDebitPerReqRub}
                  onChange={(e) => setMaxDebitPerReqRub(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Дневной лимит начислений (₽)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={maxCreditPerDayRub}
                  onChange={(e) => setMaxCreditPerDayRub(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Дневной лимит списаний (₽)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={maxDebitPerDayRub}
                  onChange={(e) => setMaxDebitPerDayRub(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Лимит утверждения за раз (0 = безлимит для OWNER)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={maxApprovalRub}
                  onChange={(e) => setMaxApprovalRub(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireTicket}
                    onChange={(e) => setRequireTicket(e.target.checked)}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span className="text-xs font-medium text-foreground">Обязательно требовать Ticket ID</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-6 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Сохранение..." : "Сохранить глобальные политики"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
