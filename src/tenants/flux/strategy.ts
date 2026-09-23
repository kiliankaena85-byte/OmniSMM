import { FluxDashboardShell } from '@/components/dashboard/flux/FluxDashboardShell';
import { FluxDashboardHome } from '@/components/dashboard/flux/FluxDashboardHome';
import { FluxDashboardOrderWizard } from '@/components/dashboard/flux/FluxDashboardOrderWizard';
import { FluxOrdersView } from '@/components/dashboard/flux/FluxOrdersView';
import { FluxTransactionsView } from '@/components/dashboard/flux/FluxTransactionsView';
import { ITenantDashboardStrategy } from '../types';

export const FluxTenantStrategy: ITenantDashboardStrategy = {
  ShellLayout: FluxDashboardShell as unknown as ITenantDashboardStrategy['ShellLayout'],
  HomeView: FluxDashboardHome as unknown as ITenantDashboardStrategy['HomeView'],
  NewOrderView: FluxDashboardOrderWizard as unknown as ITenantDashboardStrategy['NewOrderView'],
  OrdersView: FluxOrdersView as unknown as ITenantDashboardStrategy['OrdersView'],
  TransactionsView: FluxTransactionsView as unknown as ITenantDashboardStrategy['TransactionsView'],
};

export default FluxTenantStrategy;
