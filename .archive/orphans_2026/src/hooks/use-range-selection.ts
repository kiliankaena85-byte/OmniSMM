'use client';

import { useState, useCallback, useRef } from 'react';

export interface UseRangeSelectionOptions<T extends { id: string }> {
  items: T[];
  initialSelectedIds?: string[];
}

export function useRangeSelection<T extends { id: string }>({
  items,
  initialSelectedIds = [],
}: UseRangeSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const lastSelectedIndexRef = useRef<number | null>(null);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleRow = useCallback(
    (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
      const currentIndex = items.findIndex((item) => item.id === id);
      if (currentIndex === -1) return;

      const isShiftKey = e && 'shiftKey' in e && Boolean(e.shiftKey);

      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (isShiftKey && lastSelectedIndexRef.current !== null) {
          // Range selection: select everything between last clicked and current
          const start = Math.min(lastSelectedIndexRef.current, currentIndex);
          const end = Math.max(lastSelectedIndexRef.current, currentIndex);

          const shouldSelect = !prev.has(id);
          for (let i = start; i <= end; i++) {
            const currentItem = items[i];
            if (currentItem) {
              if (shouldSelect) {
                next.add(currentItem.id);
              } else {
                next.delete(currentItem.id);
              }
            }
          }
        } else {
          // Normal toggle
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }

        return next;
      });

      lastSelectedIndexRef.current = currentIndex;
    },
    [items]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIndexRef.current = null;
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [isAllSelected, clearSelection, selectAll]);

  return {
    selectedIds: Array.from(selectedIds),
    selectedSet: selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    isAllSelected,
    toggleRow,
    selectAll,
    clearSelection,
    toggleSelectAll,
    setSelectedIds,
  };
}
