import { ClassicDashboardShell } from '@/components/dashboard/classic/ClassicDashboardShell';
import { ClassicDashboardHome } from '@/components/dashboard/classic/ClassicDashboardHome';
import ClientPage from '@/app/dashboard/new-order/client-page';
import { ITenantDashboardStrategy } from '../types';

export const SmmplanTenantStrategy: ITenantDashboardStrategy = {
  ShellLayout: ClassicDashboardShell as unknown as ITenantDashboardStrategy['ShellLayout'],
  HomeView: ClassicDashboardHome as unknown as ITenantDashboardStrategy['HomeView'],
  NewOrderView: ClientPage as unknown as ITenantDashboardStrategy['NewOrderView'],
};

export default SmmplanTenantStrategy;
