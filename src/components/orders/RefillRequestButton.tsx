'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface RefillRequestButtonProps {
  orderId: string;
  isRefillEnabled?: boolean;
  orderStatus: string;
  createdAt?: Date | string;
  guaranteeDays?: number;
  refills?: Array<{
    id: string;
    status: string;
    createdAt: Date | string;
  }>;
  className?: string;
}

export function RefillRequestButton(_props: RefillRequestButtonProps) {
  // Докрутка (Refill) скрыта в личном кабинете клиента согласно регламенту
  return null;
}

