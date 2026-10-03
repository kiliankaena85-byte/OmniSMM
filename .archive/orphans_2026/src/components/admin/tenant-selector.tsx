'use client';

import React, { useTransition } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface TenantSelectorProps {
  tenants: { id: string; name: string; slug: string }[];
  activeFilter: string;
}

export function TenantSelector({ tenants, activeFilter }: TenantSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSelectChange = (value: string | null) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === 'all') {
        params.delete('tenant');
      } else {
        params.set('tenant', value);
      }
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Бренд:</span>
      <Select 
        value={activeFilter} 
        onValueChange={handleSelectChange}
        disabled={isPending}
      >
        <SelectTrigger size="sm" className="w-[180px] bg-background/60 backdrop-blur-md border-border/40 font-semibold shadow-sm transition-all duration-200">
          <SelectValue placeholder="Все бренды">
            {(value) => {
              if (value === 'all' || !value) return 'Все бренды';
              return tenants.find(t => t.slug === value)?.name ?? value;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false} className="z-50 bg-popover/80 backdrop-blur-lg border border-border/40">
          <SelectItem value="all">
            Все бренды
          </SelectItem>
          {tenants.map((tenant) => (
            <SelectItem key={tenant.id} value={tenant.slug}>
              {tenant.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
