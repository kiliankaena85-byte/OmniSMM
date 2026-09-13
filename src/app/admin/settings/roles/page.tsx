import { enforceSectionAccess } from '@/lib/server/rbac';
import { listRolesWithPermissionsAction } from '@/actions/admin/roles';
import { RBAC_SECTIONS } from '@/lib/rbac-sections';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS } from '@/components/admin/navigation-data';
import { RolesClient } from './roles-client';

export const metadata = {
  title: 'Роли и матрица прав | OmniSMM 1.0',
};

export default async function RolesManagementPage() {
  await enforceSectionAccess('settings');

  const res = await listRolesWithPermissionsAction();
  const roles = res.success && res.roles ? res.roles : [];

  return (
    <div className="space-y-6">
      <AdminTabbedHeader
        title="Роли и матрица прав"
        description="Управление ролями сотрудников, гранулярными правами доступа и защитой от несанкционированных действий."
        tabs={SYSTEM_TABS}
      />
      <RolesClient initialRoles={roles} sections={RBAC_SECTIONS} />
    </div>
  );
}
