'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SlidersHorizontal, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface GeneralMaintenanceSectionProps {
  maintenance: boolean;
  isTogglingMaintenance: boolean;
  isMaintenanceModalOpen: boolean;
  setIsMaintenanceModalOpen: (open: boolean) => void;
  onToggleMaintenance: (enable: boolean) => Promise<void>;
}

export function GeneralMaintenanceSection({
  maintenance,
  isTogglingMaintenance,
  isMaintenanceModalOpen,
  setIsMaintenanceModalOpen,
  onToggleMaintenance,
}: GeneralMaintenanceSectionProps) {
  return (
    <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-3 border-b border-border/50 pb-5">
        <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Статус платформы & Режим техработ</h3>
          <p className="text-xs text-muted-foreground">
            Аварийный выключатель доступа для клиентов при проведении технических обновлений.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-border/60 bg-muted/20">
          <div className="space-y-1 pr-4">
            <Label htmlFor="maintenanceMode" className="text-sm font-bold text-foreground cursor-pointer flex items-center gap-2">
              Режим технического обслуживания (Maintenance)
              <span title="Аварийный выключатель: при включении все клиенты мгновенно увидят экран техработ. Действие требует подтверждения.">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help" />
              </span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Закрывает витрину для клиентов и показывает специализированный экран техработ (статус узлов, сохранность балансов, экстренная связь с дежурным инженером в Telegram).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-bold ${maintenance ? 'text-rose-500 font-extrabold' : 'text-muted-foreground'}`}>
              {maintenance ? '🔴 Включен' : '⚪ Выключен'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="maintenanceMode"
                name="maintenanceMode"
                checked={maintenance}
                disabled={isTogglingMaintenance}
                onChange={() => {
                  if (!maintenance) {
                    setIsMaintenanceModalOpen(true);
                  } else {
                    onToggleMaintenance(false);
                  }
                }}
                className="sr-only peer"
              />
              <div className={`w-12 h-6.5 bg-muted-foreground/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-background after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600 ${isTogglingMaintenance ? 'opacity-50 cursor-wait' : ''}`} />
            </label>
          </div>
        </div>

        {/* Maintenance Mode Confirmation Modal */}
        <Dialog open={isMaintenanceModalOpen} onOpenChange={setIsMaintenanceModalOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <div className="flex items-center gap-3 text-rose-500 pb-2">
                <AlertTriangle className="w-6 h-6" />
                <DialogTitle className="text-lg font-bold">Включение режима техработ</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Вы собираетесь перевести платформу в режим технического обслуживания.
                <br /><br />
                • Витрина и мастер заказа станут временно недоступны для посетителей.<br />
                • Клиенты увидят экран информирования о плановых работах.<br />
                • Авторизованные администраторы сохранят доступ к панели управления.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTogglingMaintenance}
                onClick={() => setIsMaintenanceModalOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isTogglingMaintenance}
                onClick={() => onToggleMaintenance(true)}
                className="font-bold gap-1.5 cursor-pointer"
              >
                {isTogglingMaintenance && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Включить техработы
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="p-3.5 rounded-xl border border-border/40 bg-card/60 text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="text-primary font-bold">ℹ️ Архитектурные экраны ожидания:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            • <strong className="text-foreground">Экран техработ (Maintenance Screen):</strong> отображается при активном тумблере выше (для неавторизованных пользователей на основном домене).<br />
            • <strong className="text-foreground">Предстартовый экран (Pre-Launch Holding):</strong> презентационная страница сбора email-заявок (доступна по пути <code className="text-primary font-mono text-[10px]">/prelaunch</code> или при holding-маршрутизации).
          </p>
        </div>
      </div>
    </Card>
  );
}
