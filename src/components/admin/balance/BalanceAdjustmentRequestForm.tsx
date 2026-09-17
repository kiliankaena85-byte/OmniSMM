'use client';

import React, { useState } from "react";
import { BALANCE_ADJUSTMENT_REASONS } from "@/constants/balance-adjustments";
import { createBalanceAdjustmentRequestAction } from "@/actions/admin/balance-adjustments";

interface Props {
  userId: string;
  userEmail: string;
  userBalanceCents: string;
  onSuccess?: () => void;
}

export function BalanceAdjustmentRequestForm({ userId, userEmail, userBalanceCents, onSuccess }: Props) {
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [rubAmount, setRubAmount] = useState<string>("");
  const [reasonCode, setReasonCode] = useState<string>(BALANCE_ADJUSTMENT_REASONS.CREDIT[0]);
  const [reasonNote, setReasonNote] = useState<string>("");
  const [ticketId, setTicketId] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const availableReasons = direction === "CREDIT"
    ? BALANCE_ADJUSTMENT_REASONS.CREDIT
    : BALANCE_ADJUSTMENT_REASONS.DEBIT;

  const handleDirectionChange = (newDir: "CREDIT" | "DEBIT") => {
    setDirection(newDir);
    setReasonCode(newDir === "CREDIT" ? BALANCE_ADJUSTMENT_REASONS.CREDIT[0] : BALANCE_ADJUSTMENT_REASONS.DEBIT[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const parsedRub = parseFloat(rubAmount);
    if (isNaN(parsedRub) || parsedRub <= 0) {
      setError("Укажите корректную положительную сумму в рублях");
      return;
    }

    const amountCents = (BigInt(Math.round(parsedRub * 100))).toString();
    const idempotencyKey = crypto.randomUUID();

    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("direction", direction);
    formData.append("amount", parsedRub.toFixed(2));
    formData.append("amountCents", amountCents);
    formData.append("reasonCode", reasonCode);
    formData.append("reasonNote", reasonNote);
    if (ticketId) formData.append("ticketId", ticketId);
    if (orderId) formData.append("orderId", orderId);
    formData.append("idempotencyKey", idempotencyKey);

    setLoading(true);
    try {
      const res = await createBalanceAdjustmentRequestAction(formData);
      if (res.success) {
        setSuccessMsg(`Заявка #${res.id?.slice(-6)} успешно создана в статусе PENDING_APPROVAL`);
        setRubAmount("");
        setReasonNote("");
        setTicketId("");
        setOrderId("");
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || "Не удалось создать заявку");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const balanceRub = (Number(userBalanceCents) / 100).toFixed(2);

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Создать заявку на изменение баланса
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Клиент: <span className="font-medium text-foreground">{userEmail}</span> (Текущий баланс: {balanceRub} ₽)
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleDirectionChange("CREDIT")}
            className={`py-2 px-4 rounded-lg font-medium text-sm border transition-all ${
              direction === "CREDIT"
                ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            + Начисление (CREDIT)
          </button>

          <button
            type="button"
            onClick={() => handleDirectionChange("DEBIT")}
            className={`py-2 px-4 rounded-lg font-medium text-sm border transition-all ${
              direction === "DEBIT"
                ? "bg-red-500 text-white border-red-600 shadow-sm"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            - Списание (DEBIT)
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Сумма (₽) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={rubAmount}
            onChange={(e) => setRubAmount(e.target.value)}
            placeholder="Например, 500.00"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Причина (Reason Code) *
          </label>
          <select
            name="reasonCode"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          >
            {availableReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            ID тикета поддержки (Ticket ID) *
          </label>
          <input
            type="text"
            required
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder="Например, T-1049"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>

        {direction === "DEBIT" && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              ID заказа (Order ID)
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Например, ORD-8812"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Обоснование / Примечание (мин. 10 символов) *
          </label>
          <textarea
            required
            rows={3}
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="Детальное объяснение причины корректировки баланса..."
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
        >
          {loading ? "Отправка..." : "Отправить заявку на утверждение"}
        </button>
      </form>
    </div>
  );
}
