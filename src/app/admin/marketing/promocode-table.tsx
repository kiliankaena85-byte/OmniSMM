'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { columns, PromoCodeWithUsages } from './promocode-columns';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface PromoCodeTableProps {
  data: PromoCodeWithUsages[];
}

export function PromoCodeTable({ data }: PromoCodeTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="code"
      searchPlaceholder="Поиск по коду..."
      renderToolbar={(table) => {
        return (
          <div className="flex flex-wrap gap-4 items-center bg-muted/20 p-3.5 rounded-lg border border-border/70 shadow-xs mb-2">
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Тип бонуса</Label>
              <Select
                value={(table.getColumn('type')?.getFilterValue() as string) ?? 'ALL'}
                onValueChange={(val) => {
                  table.getColumn('type')?.setFilterValue(val === 'ALL' ? undefined : val);
                }}
              >
                <SelectTrigger className="bg-card border-border/60 text-foreground h-9 w-full">
                  <SelectValue placeholder="Все типы">
                    {(value: string) => {
                      if (value === 'ALL') return 'Все типы';
                      if (value === 'DISCOUNT') return 'Скидка';
                      if (value === 'VOUCHER') return 'Ваучер';
                      return value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="ALL" label="Все типы">Все типы</SelectItem>
                  <SelectItem value="DISCOUNT" label="Скидка">Скидка</SelectItem>
                  <SelectItem value="VOUCHER" label="Ваучер">Ваучер</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Статус</Label>
              <Select
                value={
                  table.getColumn('isActive')?.getFilterValue() === undefined
                    ? 'ALL'
                    : table.getColumn('isActive')?.getFilterValue() === true
                    ? 'ACTIVE'
                    : 'INACTIVE'
                }
                onValueChange={(val) => {
                  table.getColumn('isActive')?.setFilterValue(
                    val === 'ALL' ? undefined : val === 'ACTIVE' ? true : false
                  );
                }}
              >
                <SelectTrigger className="bg-card border-border/60 text-foreground h-9 w-full">
                  <SelectValue placeholder="Все статусы">
                    {(value: string) => {
                      if (value === 'ALL') return 'Все статусы';
                      if (value === 'ACTIVE') return 'Активен';
                      if (value === 'INACTIVE') return 'Выкл';
                      return value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="ALL" label="Все статусы">Все статусы</SelectItem>
                  <SelectItem value="ACTIVE" label="Активен">Активен</SelectItem>
                  <SelectItem value="INACTIVE" label="Выкл">Выкл</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">UTM Кампании</Label>
              <Select
                value={
                  table.getColumn('utm')?.getFilterValue() === undefined
                    ? 'ALL'
                    : table.getColumn('utm')?.getFilterValue() === true
                    ? 'WITH_UTM'
                    : 'WITHOUT_UTM'
                }
                onValueChange={(val) => {
                  table.getColumn('utm')?.setFilterValue(
                    val === 'ALL' ? undefined : val === 'WITH_UTM' ? true : false
                  );
                }}
              >
                <SelectTrigger className="bg-card border-border/60 text-foreground h-9 w-full">
                  <SelectValue placeholder="Все метки">
                    {(value: string) => {
                      if (value === 'ALL') return 'Все метки';
                      if (value === 'WITH_UTM') return 'С UTM метками';
                      if (value === 'WITHOUT_UTM') return 'Без UTM меток';
                      return value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="ALL" label="Все метки">Все метки</SelectItem>
                  <SelectItem value="WITH_UTM" label="С UTM метками">С UTM метками</SelectItem>
                  <SelectItem value="WITHOUT_UTM" label="Без UTM меток">Без UTM меток</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      }}
    />
  );
}
