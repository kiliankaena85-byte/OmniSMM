'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { CheckCircle2 } from 'lucide-react';

interface FluxWizardSuccessCardProps {
  onReset: () => void;
}

export function FluxWizardSuccessCard({ onReset }: FluxWizardSuccessCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card/90 border border-success/30 rounded-[2rem] p-8 text-center space-y-4 shadow-xl"
    >
      <div className="w-16 h-16 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto shadow-sm">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-black text-foreground tracking-tight">Заказ успешно оформлен!</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Средства списаны, запуск задачи произойдет в течение нескольких минут. Отслеживайте прогресс в разделе «Мои заказы».
      </p>
      <div className="pt-2 flex justify-center gap-3">
        <Button
          onPress={onReset}
          className="px-6 py-2.5 bg-primary text-primary-foreground font-black rounded-full shadow-md cursor-pointer"
        >
          Создать еще один заказ
        </Button>
        <a
          href="/dashboard/orders"
          className="px-6 py-2.5 bg-muted text-foreground hover:bg-muted/80 font-bold rounded-full transition-colors flex items-center cursor-pointer"
        >
          Перейти к заказам
        </a>
      </div>
    </motion.div>
  );
}
