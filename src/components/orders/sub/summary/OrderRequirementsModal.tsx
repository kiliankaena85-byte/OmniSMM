import React from 'react';

interface OrderRequirementsModalProps {
  isOpen: boolean;
  requirements: string[];
  onClose: () => void;
  onConfirm: () => void;
}

export function OrderRequirementsModal({
  isOpen,
  requirements,
  onClose,
  onConfirm,
}: OrderRequirementsModalProps) {
  if (!isOpen || requirements.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 text-warning">
          <span className="text-xl">⚠️</span>
          <h3 className="font-bold text-lg text-foreground">Важные требования</h3>
        </div>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Для успешного выполнения заказа необходимо соблюдать следующие условия:</p>
          <ul className="list-disc pl-5 space-y-1 font-semibold text-foreground">
            {requirements.map((req, idx) => (
              <li key={idx}>{req}</li>
            ))}
          </ul>
          <p className="text-xs text-destructive font-bold mt-2">
            * Запуск заказа при несоблюдении правил аннулирует гарантию возврата средств!
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all duration-200 cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/95 transition-all duration-200 cursor-pointer"
          >
            Я согласен, запустить
          </button>
        </div>
      </div>
    </div>
  );
}
