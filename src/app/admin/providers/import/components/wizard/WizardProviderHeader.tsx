import React from 'react';
import { Package } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProviderItem } from '../../types';

interface WizardProviderHeaderProps {
  providers: ProviderItem[];
  providerId: string;
  onProviderChange: (id: string | null) => void;
}

export function WizardProviderHeader({
  providers,
  providerId,
  onProviderChange,
}: WizardProviderHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Источник импорта
          </div>
          <div className="text-xs text-muted-foreground truncate">
            Каталог загружается с выбранной панели{providers.length > 0 ? ` (доступно: ${providers.length})` : ''}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={providerId} onValueChange={onProviderChange}>
          <SelectTrigger className="w-[260px] h-10 text-sm font-semibold" aria-label="Выбор провайдера для импорта">
            <SelectValue placeholder="Выберите провайдера...">
              {(val: string) => {
                const provider = providers.find((p) => p.id === val);
                return provider ? provider.name : val || 'Выберите провайдера...';
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id} label={p.name} className="text-sm cursor-pointer">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
