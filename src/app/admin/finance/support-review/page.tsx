import React from 'react';
import { SupportReviewDashboard } from '@/components/admin/SupportReviewDashboard';
import { enforceSectionAccess } from '@/lib/server/rbac';

export const metadata = {
  title: 'Постпроверка операций саппорта | Панель управления',
};

/**
 * ADM-03 follow-up: own 'finance' gate (support-review actions are finance-sectioned);
 * must stay closed for the Cashier role that can now pass the layout gate.
 */
export default async function SupportReviewPage() {
  await enforceSectionAccess('finance');
  return <SupportReviewDashboard />;
}
