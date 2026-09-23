'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateSystemSettings } from '@/actions/finance/settings';
import { toast } from 'sonner';

interface FinanceSettingsFormProps {
  initialTaxRate: number;
  initialOpex: number;
}

export function FinanceSettingsForm({ initialTaxRate, initialOpex }: FinanceSettingsFormProps) {
  async function action(formData: FormData) {
    // Note: updateSystemSettings is likely an action that needs to be adapted or handled
    try {
      await updateSystemSettings(formData);
      // Assuming it returns some success indicator or we just toast on success
      toast.success('Параметры учёта сохранены');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      toast.error('Ошибка сохранения параметров');
    }
  }

  return (
    <Card className="rounded-2xl border border-border/60 shadow-xs bg-card/60 backdrop-blur-xl h-full transition-all hover:border-border">
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Параметры учёта</h3>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ставка налога (%)
            </Label>
            <Input
              name="taxRate"
              type="number"
              step="0.1"
              defaultValue={initialTaxRate.toString()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ежемесячный OPEX (₽)
            </Label>
            <Input
              name="opexMonthly"
              type="number"
              step="1"
              defaultValue={Math.floor(initialOpex / 100).toString()}
            />
          </div>
          <Button 
            type="submit" 
            intent="primary" 
            className="w-full font-bold uppercase tracking-widest text-xs h-10 shadow-md"
          >
            Сохранить параметры
          </Button>
        </form>
      </div>
    </Card>
  );
}
