'use client';

import { useState, useTransition, useOptimistic, useMemo } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { bulkCancelOrdersAction } from '@/actions/admin/orders';
import { OrderColumn } from '@/app/admin/orders/components/columns';

export function useOrderManagement({ initialData }: { initialData: OrderColumn[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [isPendingBulk, startBulkTransition] = useTransition();
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSelectedRows, setBulkSelectedRows] = useState<{ original: unknown }[]>([]);

  const [optimisticData, addOptimisticUpdate] = useOptimistic(
    initialData,
    (state, update: { id: string, status: string, remains?: number }) => {
      return state.map(order => 
        order.id === update.id 
                    ? { ...order, status: update.status as OrderColumn["status"], remains: update.remains ?? order.remains } 
          : order
      );
    }
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const editOrderId = searchParams.get('edit_order_id');
  const selectedOrder = useMemo(
    () => optimisticData.find(o => o.id === editOrderId) ?? null,
    [optimisticData, editOrderId]
  );

  function closeDrawer() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('edit_order_id');
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleBulkCancel(selectedRows: { original: unknown }[]) {
    setBulkSelectedRows(selectedRows);
    setBulkConfirmOpen(true);
  }

  function handleLovableBulkCancel(ids: string[]) {
    // For Lovable Grid, we just have the IDs. Let's build the pseudo selectedRows
    const pseudoRows = ids.map(id => ({
      original: optimisticData.find(o => o.id === id) || { id }
    }));
    setBulkSelectedRows(pseudoRows);
    setBulkConfirmOpen(true);
  }

  function handleSelect(id: string, isSelected: boolean) {
    const next = new Set(selectedIds);
    if (isSelected) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  }

  function executeBulkCancel() {
    setBulkConfirmOpen(false);
    const ids = bulkSelectedRows.map(r => (r.original as OrderColumn).id);
    
    startBulkTransition(async () => {
      // Optimistic update
      ids.forEach(id => addOptimisticUpdate({ id, status: 'CANCELED' }));
      setSelectedIds(new Set()); // clear selection
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        const r = await bulkCancelOrdersAction(ids);
        clearTimeout(timeoutId);
        
        if (r.success) {
          const refund = r.totalRefundCents > 0
            ? `, возврат ${(r.totalRefundCents / 100).toFixed(2)} ₽`
            : '';
          if (r.cancelledCount < ids.length) {
            toast.warning(`Отменено ${r.cancelledCount} из ${ids.length} заказов. Остальные не подлежат отмене.${refund}`);
          } else {
            toast.success(`🚫 Отменено ${r.cancelledCount} заказов${refund}`);
          }
        } else {
          toast.error('Неизвестная ошибка при пакетной отмене');
        }
            } catch (e: unknown) {
        const err = e as Error;
        if (err.name === 'AbortError') {
          toast.error('Превышено время ожидания ответа от сервера');
        } else {
          toast.error(err.message || 'Ошибка пакетной отмены');
        }
      }
    });
  }

  return {
    optimisticData,
    selectedOrder,
    isPendingBulk,
    bulkConfirmOpen,
    setBulkConfirmOpen,
    handleBulkCancel,
    handleLovableBulkCancel,
    executeBulkCancel,
    closeDrawer,
    bulkSelectedCount: bulkSelectedRows.length,
    selectedIds,
    handleSelect,
    addOptimisticUpdate
  };
}
