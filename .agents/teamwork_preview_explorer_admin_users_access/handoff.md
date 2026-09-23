# Handoff Report: Users & Access Control Audit

This report presents a deep logical and security audit of the Users and Access Control modules in the Smmplan admin panel.

## 1. Observation

### 1.1 Critical RBAC Blockage for `ADMIN` Role
In `src/lib/server/rbac.ts`, the RBAC validation function `requireStaffPermission` is defined as follows:
```typescript
42:     // OWNER bypass
43:     if (user.role === 'OWNER') {
44:         return await action(user, user.staffRole);
45:     }
46: 
47:     // Requires StaffRole for granular permissions
48:     if (!user.staffRole) {
49:        console.error(`[RBAC] User ${userId} attempted to execute Admin Action without StaffRole.`);
50:        return { success: false, error: "Forbidden: Administrator/Staff context required" };
51:     }
```
In the UI file `src/app/admin/settings/team-management.tsx`, the custom staff role selection has an option `NONE` which renders as `"Все права (OWNER)"` and results in `staffRoleId = null`:
```typescript
238:                             <Select name="staffRoleId" defaultValue={u.staffRoleId || 'NONE'}>
239:                               <SelectTrigger className="w-full sm:w-48 h-11 bg-background text-xs font-bold rounded-xl" size="default">
240:                                 <SelectValue>
241:                                   {(value: string) => {
242:                                     if (!value || value === 'NONE') return 'Все права (OWNER)';
243:                                     return staffRoles.find(r => r.id === value)?.name ?? value;
...
247:                               <SelectContent>
248:                                 <SelectItem value="NONE">Все права (OWNER)</SelectItem>
```
In `src/actions/admin/settings.ts`, the `updateUserRole` action maps this input to `null`:
```typescript
36:     const finalStaffRoleId = staffRoleId === 'NONE' || !staffRoleId ? null : staffRoleId;
37:     await settingsService.updateUserRole(targetUserId, newRole, finalStaffRoleId);
```

### 1.2 Permanent Lockup of Quarantined Deductions
In `src/services/admin/escrow.service.ts`, the `resolveQuarantine` function resolves pending quarantine transactions:
```typescript
277:       if (resolution === 'APPROVE') {
278:         await WalletOps.credit(
279:           tx,
280:           entry.userId,
281:           Number(entry.amount),
282:           `Разблокировка средств из карантина: ${entry.reason}`,
283:           { idempotencyKey: `approve_quarantine_${entryId}`, adminId: owner.id }
284:         );
285:       }
```
However, in `src/services/financial/wallet-ops.ts`, `WalletOps.credit` strictly throws an error if the amount is not positive:
```typescript
116:     if (!Number.isFinite(amountCents) || amountCents <= 0) {
117:       throw new WalletInvalidAmountError('Credit');
118:     }
```
And in `escrow.service.ts` line 55, negative adjustments (deductions) over 10,000 RUB are evaluated and quarantined using a negative `amountCents` value:
```typescript
55:     if (amountCents < 0) {
...
77:             await this.executeQuarantineAdjustmentTx(tx, targetUserId, amountCents, reason, admin);
```

### 1.3 Page-Level Authorization Defect on Client Detail Page
In `src/app/admin/clients/[id]/page.tsx`, the client detail page loads and renders sensitive data directly using Prisma without any RBAC permission checks:
```typescript
37:   const user = await db.user.findUnique({
38:     where: { id },
39:     select: {
40:       id: true,
41:       email: true,
42:       role: true,
43:       balance: true,
...
```
Similarly, in `src/app/admin/clients/page.tsx`, there are no page-level role or permission checks.
However, `src/app/admin/layout.tsx` permits any user with an admin role to access the layout:
```typescript
13: const ADMIN_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];
```

### 1.4 Feature Flags Page Hidden from Staff Sidebar
In `src/app/admin/layout.tsx`, the "Фичи" (Feature Flags) link is defined with `section: 'features'`:
```typescript
49:       { href: '/admin/system/features', icon: 'ToggleLeft', label: 'Фичи',          section: 'features' },
```
However, in `src/actions/admin/team.ts` and `src/validators/admin.validators.ts`, the only configurable sections for roles are:
```typescript
90:       const sections = ['orders', 'finance', 'catalog', 'settings'];
```
In `src/app/admin/layout.tsx`, the navigation list is filtered as follows:
```typescript
96:     }).filter(item => {
97:       if (user.role === 'OWNER') return true;
98:       if (!user.staffRole) return false;
100:       return user.staffRole.permissions.some((p: any) => p.section === item.section && p.canView);
101:     })
```

### 1.5 Privilege Escalation Risk in `updateUserRole`
In `src/actions/admin/settings.ts`, `updateUserRole` is protected by the `settings` section permissions:
```typescript
15: export async function updateUserRole(formData: FormData) {
16:   const result = await requireStaffPermission("settings", "edit", async (admin) => {
```
It restricts assigning or modifying `ADMIN` or `OWNER` roles:
```typescript
24:     if (['ADMIN', 'OWNER'].includes(newRole) && admin.role !== 'OWNER') {
25:       return { success: false as const, error: 'Только Владелец может назначать роли Админ или Владелец' };
26:     }
...
32:     if (['ADMIN', 'OWNER'].includes(targetUser.role) && admin.role !== 'OWNER') {
33:       return { success: false as const, error: 'Только Владелец может изменять права администраторов' };
34:     }
```
However, it does not restrict promoting a `USER` to `MANAGER` or `SUPPORT`, or assigning any custom `staffRoleId` to any other user.

### 1.6 Dead Navigation and Dead Code
- `src/app/admin/layout.tsx` contains a navigation link for `queues`:
```typescript
50:       { href: '/admin/system/queues',   icon: 'Activity',   label: 'Очереди',       section: 'queues' },
```
But no `/admin/system/queues` directory exists in the filesystem.
- `adminUserService.updateBalance` in `src/services/admin/user.service.ts` is never called.
- `requireOwnerPermission` in `src/lib/server/rbac.ts` is never used.
- `getClientProfileAction` in `src/actions/admin/clients.ts` is never exported or used.

---

## 2. Logic Chain

### 2.1 Critical RBAC Blockage for `ADMIN` Role
1. A user is promoted to the system role of `ADMIN` with no custom staff role (selecting `"Все права (OWNER)"` in the UI).
2. This sets their `staffRoleId` to `null` in the `User` database table (Observation 1.1).
3. When they execute any Server Action protected by `requireStaffPermission`, the code checks if `user.role === 'OWNER'`. It is not, so it falls back to checking `user.staffRole` (Observation 1.1).
4. Because `user.staffRoleId` is `null`, `user.staffRole` is `null`.
5. The logic triggers the block: `if (!user.staffRole) return { success: false, error: "Forbidden..." }`.
6. Therefore, all non-OWNER system administrators who do not have a custom `staffRole` mapped are locked out of all staff actions, despite having the system role `ADMIN`.

### 2.2 Permanent Lockup of Quarantined Deductions
1. A non-owner staff member performs a manual balance adjustment to decrease a user's balance (e.g. `-1500000` cents).
2. The deduction exceeds the large deduction threshold, so it is quarantined. The transaction amount remains negative (`-1500000` cents) (Observation 1.2).
3. The owner attempts to approve this quarantined transaction.
4. `resolveQuarantine` attempts to approve by calling `WalletOps.credit(tx, userId, entry.amount, ...)` (Observation 1.2).
5. Since `entry.amount` is negative (`-1500000`), it is passed directly to `WalletOps.credit`.
6. `WalletOps.credit` checks if the amount is less than or equal to `0` and throws `WalletInvalidAmountError` (Observation 1.2).
7. The transaction crashes and rolls back. Thus, quarantined deductions can never be approved.

### 2.3 Page-Level Authorization Defect (IDOR) on Client Detail Page
1. Any staff member (e.g., role `SUPPORT`) who logs into the admin panel is permitted access to `/admin` pages by `AdminLayout` (Observation 1.3).
2. If the user's custom staff role restricts their access to the `clients` section (`canView: false`), the sidebar will not render the "Clients" link.
3. However, if the user manually navigates to `/admin/clients` or `/admin/clients/[id]`, the server component renders the page and queries the user database directly using Prisma without validating the `clients` section permission (Observation 1.3).
4. This allows any support staff member to bypass section restrictions and inspect all SMMplan customer emails, balances, order histories, and personal details.
5. In addition, `/admin/clients/[id]/page.tsx` renders balance details and LTV to all users, bypassing the `canSeeFinances` role check implemented on the main `/admin/clients` list page.

### 2.4 Feature Flags Page Hidden from Staff Sidebar
1. A support or manager user has full read/write permissions for `settings` (`canView: true`, `canEdit: true`).
2. The layout filters the "Фичи" (Feature Flags) navigation link by verifying if the user has `canView: true` for the `features` section (Observation 1.4).
3. Because the custom staff role can only define permissions for `'orders', 'finance', 'catalog', 'settings'`, a permission entry for `features` can never exist in the database (Observation 1.4).
4. Thus, the sidebar filter always evaluates to `false` for non-owners, hiding the page link entirely.

---

## 3. Caveats

- We assumed that `ADMIN` system roles are intended to use the granular permissions system via `requireStaffPermission`, but the omission of an `ADMIN` check bypass (similar to the `OWNER` check bypass) suggests a logic gap in `requireStaffPermission`.
- We assumed that settings edits should not be accessible by lower-level staff without owner authorization; if this is intended, the privilege escalation risk is lower, but it remains a security risk.

---

## 4. Conclusion

The Users & Access Control audit reveals two critical bugs that affect system usability (lockout of `ADMIN` roles and unresolvable quarantined deductions), alongside serious security and IDOR vulnerabilities on the client detail page allowing unauthorized staff members to read sensitive customer data.

---

## 5. Verification Method

To verify these findings:

1. **Verify ADMIN Blockage**:
   - Run typechecks and linting to ensure project stability: `npm run typecheck` and `npm run lint`.
   - Inspect `src/lib/server/rbac.ts` at line 42 to verify that `ADMIN` is not bypassed alongside `OWNER`.

2. **Verify Quarantined Deduction Crash**:
   - Run unit tests to check if any test triggers `resolveQuarantine` for negative values: `npm run test`.
   - Inspect `src/services/admin/escrow.service.ts` at line 278 to confirm `WalletOps.credit` is called on approval, and compare it with the amount checks in `src/services/financial/wallet-ops.ts` at line 116.

3. **Verify Client Detail IDOR**:
   - Inspect `src/app/admin/clients/[id]/page.tsx` and verify that there is no `enforcePageRole` call or `requireStaffPermission` check guarding the server component load.
