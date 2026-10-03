'use client';


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

