'use client';

import { SmmplanOrderWizard } from '@/components/orders/SmmplanOrderWizard';

export default function NewOrderPage({ 
  userEmail, 
  userBalanceCents = 0,
  initialReorderData,
  tenantId = 'smmplan'
}: { 
  userEmail?: string; 
  userBalanceCents?: number;
  initialReorderData?: { serviceId: string; categoryId: string; link: string; quantity: number } | null;
  tenantId?: string;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <SmmplanOrderWizard 
        userBalanceCents={userBalanceCents} 
        userEmail={userEmail} 
        initialReorderData={initialReorderData} 
        tenantId={tenantId}
      />
    </div>
  );
}
