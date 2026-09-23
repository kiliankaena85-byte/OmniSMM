'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyCacheCardProps {
  syncing: boolean;
  onSync: () => void;
}

export function EmptyCacheCard({ syncing, onSync }: EmptyCacheCardProps) {
  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Download className="w-6 h-6 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">Каталог провайдера пуст</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Теневой каталог выбранного провайдера ещё не загружен в базу. Нажмите «Загрузить каталог»,
          чтобы синхронизироваться с API панели — после этого здесь появится список услуг для выбора.
        </p>
      </div>
      <Button
        intent="primary"
        onClick={onSync}
        disabled={syncing}
        className="h-10 px-6 font-semibold text-sm cursor-pointer"
      >
        <Download className="w-4 h-4" />
        {syncing ? 'Загрузка каталога...' : 'Загрузить каталог'}
      </Button>
    </div>
  );
}
