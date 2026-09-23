'use client';

import React, { useState } from "react";
import { approveBalanceAdjustmentAction, rejectBalanceAdjustmentAction, cancelBalanceAdjustmentRequestAction } from "@/actions/admin/balance-adjustments";

export interface BalanceAdjustmentItem {
  id: string;
  userId: string;
  requestedBy: string;
  direction: "CREDIT" | "DEBIT";
  amount: string;
  reasonCode: string;
  reasonNote: string;
  ticketId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  status: string;
  idempotencyKey: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  executionError?: string | null;
  ledgerEntryId?: string | null;
  payment?: { id: string; gateway: string; gatewayId?: string | null; status: string } | null;
  createdAt: string;
  user?: { id: string; email: string; role: string; balance: string } | null;
  requester?: { id: string; email: string } | null;
  approver?: { id: string; email: string } | null;
  rejecter?: { id: string; email: string } | null;
}

interface Props {
  adjustment: BalanceAdjustmentItem | null;
  currentUserId?: string;
  currentUserRole?: string;
  onClose: () => void;
  onActionComplete: () => void;
}

export function BalanceAdjustmentDrawer({ 
  adjustment, 
  currentUserId, 
  currentUserRole,
  onClose, 
  onActionComplete 
}: Props) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualConfirmed, setManualConfirmed] = useState(false);

  if (!adjustment) return null;

  const isOwnerOrAdmin = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const isRequester = Boolean(currentUserId && adjustment.requestedBy === currentUserId);
  const canApprove = isOwnerOrAdmin;
  const canReject = isOwnerOrAdmin;
  const canCancel = isOwnerOrAdmin || isRequester;

  const isRefundToCard = adjustment.reasonCode === 'REFUND_TO_CARD';
  const paymentGateway = adjustment.payment?.gateway?.toLowerCase() || 'yookassa';
  const isManualGateway = isRefundToCard && paymentGateway !== 'yookassa';

  const amountRub = (Number(adjustment.amount) / 100).toFixed(2);
  const isPending = adjustment.status === "PENDING_APPROVAL" || adjustment.status === "EXECUTION_FAILED";

  const handleApprove = async () => {
    if (isManualGateway && !manualConfirmed) {
      setError(`Для утверждения отметьте чекбокс о подтверждении ручного возврата в ЛК ${paymentGateway.toUpperCase()}`);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("id", adjustment.id);
      if (manualConfirmed) {
        formData.append("manualConfirmed", "true");
      }
      const res = await approveBalanceAdjustmentAction(formData);
      if (res.success) {
        onActionComplete();
        onClose();
      } else {
        setError(res.error || "Не удалось утвердить заявку");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || "Ошибка системы");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      setError("Укажите причину отклонения (мин. 5 символов)");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("id", adjustment.id);
      formData.append("rejectionReason", rejectionReason);
      const res = await rejectBalanceAdjustmentAction(formData);
      if (res.success) {
        onActionComplete();
        onClose();
      } else {
        setError(res.error || "Не удалось отклонить заявку");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || "Ошибка системы");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("id", adjustment.id);
      const res = await cancelBalanceAdjustmentRequestAction(formData);
      if (res.success) {
        onActionComplete();
        onClose();
      } else {
        setError(res.error || "Не удалось отменить заявку");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || "Ошибка системы");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-card border-l border-border h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl">
        <div>
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Заявка #${adjustment.id.slice(-6)}
              </h2>
              <p className="text-xs text-muted-foreground">
                Создана: {new Date(adjustment.createdAt).toLocaleString("ru-RU")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4 text-sm">
            <div className="p-4 bg-muted/40 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Статус:</span>
                <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                  adjustment.status === "EXECUTED" ? "bg-emerald-500/10 text-emerald-500" :
                  adjustment.status === "PENDING_APPROVAL" ? "bg-amber-500/10 text-amber-500" :
                  adjustment.status === "REJECTED" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                }`}>
                  {adjustment.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Направление:</span>
                <span className={`font-bold ${adjustment.direction === "CREDIT" ? "text-emerald-500" : "text-destructive"}`}>
                  {adjustment.direction === "CREDIT" ? "+ Начисление" : "- Списание"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма:</span>
                <span className="font-bold text-foreground text-base">
                  {amountRub} ₽ ({adjustment.amount} коп.)
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Причина:</span>
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  {adjustment.reasonCode === 'REFUND_TO_CARD' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      {isManualGateway
                        ? `💳 Возврат на карту (${paymentGateway.toUpperCase()} — Ручной)`
                        : '💳 Возврат на карту (ЮKassa)'}
                    </span>
                  ) : (
                    adjustment.reasonCode
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">Клиент:</span>
                <p className="font-medium text-foreground">{adjustment.user?.email || adjustment.userId}</p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground">Оператор (Support):</span>
                <p className="font-medium text-foreground">{adjustment.requester?.email || adjustment.requestedBy}</p>
              </div>

              {adjustment.paymentId && (
                <div>
                  <span className="text-xs text-muted-foreground">ID платежа в эквайринге:</span>
                  <p className="font-mono text-xs text-primary">{adjustment.paymentId}</p>
                </div>
              )}

              {adjustment.ticketId && (
                <div>
                  <span className="text-xs text-muted-foreground">Тикет поддержки:</span>
                  <p className="font-mono text-xs text-primary">{adjustment.ticketId}</p>
                </div>
              )}

              {adjustment.orderId && (
                <div>
                  <span className="text-xs text-muted-foreground">Заказ:</span>
                  <p className="font-mono text-xs text-primary">{adjustment.orderId}</p>
                </div>
              )}

              <div>
                <span className="text-xs text-muted-foreground">Обоснование:</span>
                <p className="p-3 bg-background border border-border rounded-lg text-foreground text-xs whitespace-pre-wrap mt-1">
                  {adjustment.reasonNote}
                </p>
              </div>

              {isManualGateway && isPending && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-2 mt-2">
                  <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <span>⚠️ Внимание: ручной возврат в ЛК {paymentGateway.toUpperCase()}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Эквайринг {paymentGateway.toUpperCase()} не поддерживает автоматический возврат по API.
                    Выполните возврат средств клиенту вручную в панели эквайринга{adjustment.payment?.gatewayId ? ` (ID: ${adjustment.payment.gatewayId})` : ''}, после чего подтвердите выполнение заявки.
                  </p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-foreground font-medium">
                    <input
                      type="checkbox"
                      checked={manualConfirmed}
                      onChange={(e) => setManualConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-500 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Подтверждаю, что возврат выполнен в ЛК {paymentGateway.toUpperCase()}</span>
                  </label>
                </div>
              )}

              {adjustment.rejectionReason && (
                <div>
                  <span className="text-xs text-destructive font-medium">Причина отклонения:</span>
                  <p className="p-3 bg-destructive/5 border border-destructive/20 text-destructive text-xs rounded-lg mt-1">
                    {adjustment.rejectionReason}
                  </p>
                </div>
              )}

              {adjustment.executionError && (
                <div>
                  <span className="text-xs text-destructive font-medium">Ошибка шлюза / исполнения:</span>
                  <p className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg mt-1 font-mono">
                    {adjustment.executionError}
                  </p>
                </div>
              )}

              {adjustment.ledgerEntryId && (
                <div>
                  <span className="text-xs text-muted-foreground">ID записи реестра (Ledger):</span>
                  <p className="font-mono text-xs text-foreground">{adjustment.ledgerEntryId}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {isPending && (
          <div className="pt-4 border-t border-border space-y-3">
            {showRejectInput ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Укажите причину отклонения заявки..."
                  className="w-full p-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={loading}
                    className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg text-xs font-semibold hover:bg-destructive/90 cursor-pointer"
                  >
                    Подтвердить отклонение
                  </button>
                  <button
                    onClick={() => setShowRejectInput(false)}
                    className="py-2 px-3 border border-border rounded-lg text-xs cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {canApprove && (
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-emerald-600 text-primary-foreground rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    {adjustment.reasonCode === 'REFUND_TO_CARD' 
                      ? (isManualGateway ? `✓ Подтвердить возврат в ${paymentGateway.toUpperCase()}` : '✓ Одобрить и вернуть в ЮKassa') 
                      : '✓ Утвердить и исполнить'}
                  </button>
                )}

                {canReject && (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={loading}
                    className="py-2.5 px-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    ✕ Отклонить
                  </button>
                )}

                {canCancel && (
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="w-full py-2.5 bg-muted text-muted-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 transition-colors"
                  >
                    Отменить свою заявку
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
