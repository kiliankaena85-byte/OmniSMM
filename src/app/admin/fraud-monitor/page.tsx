import { AntiFraudMonitorClient } from './fraud-monitor-client';
import { enforceSectionAccess } from '@/lib/server/rbac';

export const metadata = {
  title: 'Anti-Fraud Monitor | OmniSMM 1.0',
};

export default async function AntiFraudMonitorPage() {
  await enforceSectionAccess('finance');
  return <AntiFraudMonitorClient />;
}
