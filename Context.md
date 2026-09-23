       89 -           </Link>
       90 -           <Link 
       91 -             href="/admin/refills" 
       92 -             className={cn(
       93 -               "flex items-center gap-2 px-4 py-2 text-sm font-medium
          rounded-lg transition-all",
       94 -               "text-slate-500 hover:text-slate-700 hover:bg-white/50"
       95 -             )}
       96 -           >
       97 -             <RefreshCw className="w-4 h-4" />
       98 -             Докрутки
       99 -           </Link>
      100 -         </div>
      101 - 
      102 -         {/* Search + Filters */}
      103 -   ...
      104 -           <CardContent>
      105 -             <OrderClient 
      106 -               canSeeRates={canSeeRates}
      107 -               data={orders.map(o => ({
      108 -   ...
      109 -               }))} 
      110 -             />
      111 - 
      112 -           <form className="flex flex-col md:flex-row gap-4">
      113 -             <input
      114 -               type="text"
      115 -               name="q"
      116 -               defaultValue={query}
      117 -               placeholder="🔍 Поиск: email, ссылка, ID заказа..."
      118 -               className="flex-1 px-4 py-2 text-sm border border-slate-200       
          rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none"     
      119 -             />
      120 -             <select
      121 -               name="status"
      122 -               defaultValue={statusFilter}
      123 -               className="px-4 py-2 text-sm border border-slate-200
          rounded-md bg-white"
      124 -             >
      125 -               {Object.entries(STATUS_LABELS).map(([value, label]) => (

  ✓  WriteFile  columns.tsx → Accepted (+235, -232)

        1 - 'use client';
        2 - 
        3 - import { ColumnDef } from '@tanstack/react-table';
        4 - import { Chip, Checkbox } from '@heroui/react';
        5 - import Link from 'next/link';
        6 - 
        7 - export type OrderColumn = {
        8 -   id: string;
        9 -   numericId: number;
       10 -   externalId: string | null;
       11 -   link: string;
       12 -   quantity: number;
       13 -   remains: number;
       14 -   status: string;
       15 -   charge: number;
       16 -   providerCost: number;
       17 -   createdAt: Date;
       18 -   isDripFeed: boolean;
       19 -   runs: number | null;
       20 -   interval: number | null;
       21 -   currentRun: number;
       22 -   error: string | null;
       23 -   user: { email: string };
       24 -   service: { 
       25 -     name: string;
       26 -     category: {
       27 -       name: string;
       28 -       network: { name: string } | null;
       29 -     };
       30 -   };
       31 - };
       32 - 
       33 - const STATUS_STYLES: Record<string, "default" | "primary" | "secondary" |       
          "success" | "warning" | "danger"> = {
       34 -   AWAITING_PAYMENT: 'warning',
       35 -   PENDING: 'default',
       36 -   IN_PROGRESS: 'primary',
       37 -   COMPLETED: 'success',
       38 -   PARTIAL: 'warning',
       39 -   CANCELED: 'default',
       40 -   ERROR: 'danger',
       41 - };
       42 - 
       43 - const STATUS_LABELS: Record<string, string> = {
       44 -   ALL: 'Все',
       45 -   AWAITING_PAYMENT: 'Ожидает',
       46 -   PENDING: 'В очереди',
       47 -   IN_PROGRESS: 'В работе',
       48 -   COMPLETED: 'Выполнен',
       49 -   PARTIAL: 'Частичный',
       50 -   CANCELED: 'Отменён',
       51 -   ERROR: 'Ошибка',
       52 - };
       53 - 
       54 - export const columns: ColumnDef<OrderColumn>[] = [
       55 -   {
       56 -     id: 'select',
       57 -     header: ({ table }) => (
       58 -       <input
       59 -         type="checkbox"
       60 -         className="w-4 h-4 rounded border-slate-300 text-indigo-600
          focus:ring-indigo-600"
       61 -         checked={table.getIsAllPageRowsSelected()}
       62 -         onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}     
       63 -         aria-label="Select all"
       64 -       />
       65 -     ),
       66 -     cell: ({ row }) => (
       67 -       <input
       68 -         type="checkbox"
       69 -         className="w-4 h-4 rounded border-slate-300 text-indigo-600
          focus:ring-indigo-600"
       70 -         checked={row.getIsSelected()}
       71 -         onChange={(e) => row.toggleSelected(e.target.checked)}
       72 -         aria-label="Select row"
       73 -       />
       74 -     ),
       75 -     enableSorting: false,
       76 -     enableHiding: false,
       77 -   },
       78 -   {
       79 -     accessorKey: 'numericId',
       80 -     header: 'ID',
       81 -     cell: ({ row }) => (
       82 -       <div className="flex flex-col text-xs leading-snug tabular-nums
          tracking-tight">
       83 -         <span className="font-bold text-slate-800 whitespace-nowrap">
       84 -           {row.original.numericId}
       85 -         </span>
       86 -         {row.original.externalId && (
       87 -           <span className="text-slate-400 font-normal whitespace-nowrap">       
       88 -             ({row.original.externalId})
       89 -           </span>
       90 -         )}
       91 -       </div>
       92 -     ),
       93 -   },
       94 -   {
       95 -     accessorKey: 'user.email',
       96 -     header: 'Клиент',
       97 -     cell: ({ row }) => {
       98 -       const email = row.original.user.email;
       99 -       return (
      100 -         <Link
      101 -           href={`/admin/clients?q=${encodeURIComponent(email)}`}
      102 -           className="text-sky-600 hover:text-sky-800 hover:underline text-xs    
          whitespace-nowrap"
      103 -         >
      104 -           {email}
      105 -         </Link>
      106 -       );
      107 -     },
      108 -   },
      109 -   {
      110 -     id: 'info',
      111 -     header: 'Информация',
      112 -     cell: ({ row }) => {
      113 -       const order = row.original;
      114 -       return (
      115 -         <div className="flex flex-col text-xs py-1.5 leading-snug">
      116 -           <div className="flex items-center gap-2 mb-1">
      117 -             <span className="font-bold text-slate-900 truncate
          max-w-[200px]" title={order.service.name}>
      118 -               {order.service.name}
      119 -             </span>
      120 -             <span className="px-1.5 py-0.5 rounded-md bg-slate-100
          text-slate-600 font-bold tabular-nums text-[10px]">
      121 -               x{order.quantity.toLocaleString('ru-RU')}
      122 -             </span>
      123 -           </div>
      124 -
      125 -           <div className="text-[11px] text-slate-500 mb-1.5 font-medium flex    
          items-center gap-1.5 flex-wrap">
      126 -             <span>{order.service.category.network?.name || 'Без
          сети'}</span>
      127 -             <span className="text-slate-300">•</span>
      128 -             <span className="truncate
          max-w-[150px]">{order.service.category.name}</span>
      129 -           </div>

  ✓  WriteFile  order-client.tsx → Accepted (+22, -12)

        1   'use client';
        2
        3   /**
        4 -  * OrderClient v2 — Sprint 1.5
        4 +  * OrderClient v2.1 — RBAC & Polish
        5    *
        6 -  * - Batch action bar: bulk cancel с реальным Server Action
        7 -  * - Drawer с реальными действиями: setStatus, forceComplete, restart,
          cancel
        8 -  * - Partial delivery: поле remains при PARTIAL статусе
        9 -  * - Строгий тип OrderColumn (без any)
        6 +  * - canSeeRates support (hides provider cost for Support role)
        7 +  * - Memoized columns logic
        8    */
        9
       10   import * as React from 'react';
      ══════════════════════════════════════════════════════════════════════════════════    
       37
       38   interface OrderClientProps {
       39     data: OrderColumn[];
       40 +   canSeeRates?: boolean;
       41   }
       42
       43  // ── Sub: Order Drawer
           ───────────────────────────────────────────────────────
       44   function OrderDrawer({
       45     order,
       46     onClose,
       47 +   canSeeRates = true,
       48   }: {
       49     order: OrderColumn | null;
       50     onClose: () => void;
       51 +   canSeeRates?: boolean;
       52   }) {
       53     const [selectedStatus, setSelectedStatus] = useState(order?.status ?? '');    
       54     const [remains, setRemains] = useState(order?.remains ?? 0);
      ══════════════════════════════════════════════════════════════════════════════════    
      157
      158           <div className="p-6 space-y-6">
      159             {/* Info Grid */}
      159 -           <div className="grid grid-cols-2 gap-3">
      160 +           <div className="grid grid-cols-2 gap-3 text-xs">
      161               {[
      162                 { label: 'Услуга', value: order.service.name },
      163                 { label: 'Категория', value: order.service.category.name },       
      ══════════════════════════════════════════════════════════════════════════════════    
      171                  <div className="text-sm font-medium text-foreground truncate"    
           title={value}>{value}</div>
      172                 </div>
      173               ))}
      174 +             {canSeeRates && (
      175 +                <div className="bg-amber-50 border border-amber-100
          rounded-xl p-3">
      176 +                  <div className="text-[10px] text-amber-600 uppercase
          font-bold mb-1">Себестоимость</div>
      177 +                  <div className="text-sm font-mono font-bold
          text-amber-900">{(order.providerCost / 100).toFixed(2)} ₽</div>
      178 +                </div>
      179 +             )}
      180             </div>
      181
      182             {/* Link */}
      ══════════════════════════════════════════════════════════════════════════════════    
      197             )}
      198
      199             {/* Status control */}
      193 -           <div className="bg-card border border-border rounded-xl p-4
          space-y-4">
      ══════════════════════════════════════════════════════════════════════════════════    
      200 +           <div className="bg-card border border-border rounded-xl p-4
          space-y-4 shadow-sm">
      201              <h3 className="text-sm font-semibold text-foreground">🎛️
           Управление статусом</h3>
      202
      203               <div className="space-y-3">
      ══════════════════════════════════════════════════════════════════════════════════    
      230                       className="w-full px-3 py-2 text-sm font-mono rounded-lg    
            border border-border bg-background text-foreground outline-none
            focus:border-primary transition-all duration-200"
      231                     />
      232                     {remains > 0 && (
      226 -                     <p className="text-xs text-amber-600 mt-1">
      ══════════════════════════════════════════════════════════════════════════════════    
      233 +                     <p className="text-xs text-amber-600 mt-1 font-medium">     
      234                         Возврат: {((remains / order.quantity) * order.charge /    
            100).toFixed(2)} ₽
      235                       </p>
      236                     )}
      239
      240                 <button
      241                   onClick={handleSetStatus}
      235 -                 disabled={isPending || selectedStatus === order.status}
      ══════════════════════════════════════════════════════════════════════════════════    
      242 +                 disabled={isPending || (selectedStatus === order.status &&      
          selectedStatus !== 'PARTIAL')}
      243                   aria-label="Применить новый статус"
      244                  className="w-full px-4 py-2 rounded-lg text-sm font-medium       
           bg-primary text-primary-foreground hover:opacity-90 transition-all
           duration-200 disabled:opacity-50"
      245                 >
      ══════════════════════════════════════════════════════════════════════════════════    
      296   }
      297
      298  // ── Main Component
           ──────────────────────────────────────────────────────────
      292 - export function OrderClient({ data }: OrderClientProps) {
      ══════════════════════════════════════════════════════════════════════════════════    
      299 + export function OrderClient({ data, canSeeRates = true }: OrderClientProps)     
          {
      300     const searchParams = useSearchParams();
      301     const router = useRouter();
      302     const pathname = usePathname();
      ══════════════════════════════════════════════════════════════════════════════════    
      309
      310     const [isPendingBulk, startBulkTransition] = useTransition();
      311
      312 +   // Memoize columns to pass canSeeRates
      313 +   const memoColumns = React.useMemo(() => columns(canSeeRates),
          [canSeeRates]);
      314 + 
      315     function closeDrawer() {
      316       const params = new URLSearchParams(searchParams.toString());
      317       params.delete('edit_order_id');
      ══════════════════════════════════════════════════════════════════════════════════    
      337     return (
      338       <div className="relative">
      339         <DataTable
      330 -         columns={columns}
      ══════════════════════════════════════════════════════════════════════════════════    
      340 +         columns={memoColumns}
      341           data={data}
      342           searchKey="user_email"
      343           searchPlaceholder="Фильтр по email на этой странице..."
      ══════════════════════════════════════════════════════════════════════════════════    
      383         />
      384
      385         {/* Order detail drawer */}
      376 -       <OrderDrawer order={selectedOrder} onClose={closeDrawer} />
      ══════════════════════════════════════════════════════════════════════════════════    

  ✓  WriteFile  page.tsx → Accepted (+163, -149)

        1 - import { db } from '@/lib/db';
        2 - import { Card, CardContent, CardHeader, CardTitle } from
          '@/components/ui/card';
        3 - import Link from 'next/link';
        4 - 
        5 - export const dynamic = 'force-dynamic';
        6 - 
        7 - const STATUS_STYLES: Record<string, string> = {
        8 -   PENDING: 'bg-blue-100 text-blue-800',
        9 -   IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
       10 -   COMPLETED: 'bg-emerald-100 text-emerald-800',
       11 -   REJECTED: 'bg-red-100 text-red-800',
       12 -   ERROR: 'bg-rose-100 text-rose-700',
       13 - };
       14 - 
       15 - const STATUS_LABELS: Record<string, string> = {
       16 -   PENDING: 'Ожидает',
       17 -   IN_PROGRESS: 'В работе',
       18 -   COMPLETED: 'Выполнен',
       19 -   REJECTED: 'Отклонён',
       20 -   ERROR: 'Ошибка',
       21 - };
       22 - 
       23 - type Props = {
       24 -   searchParams: Promise<{ status?: string }>;
       25 - };
       26 - 
       27 - export default async function AdminRefillsPage({ searchParams }: Props) {       
       28 -   const params = await searchParams;
       29 -   const statusFilter = params.status || 'ALL';
       30 - 
       31 -   const where: Record<string, unknown> = {};
       32 -   if (statusFilter !== 'ALL') {
       33 -     where.status = statusFilter;
       34 -   }
       35 - 
       36 -   const refills = await db.refill.findMany({
       37 -     where,
       38 -     orderBy: { createdAt: 'desc' },
       39 -     take: 100,
       40 -     include: {
       41 -       order: {
       42 -         select: {
       43 -           numericId: true,
       44 -           link: true,
       45 -           quantity: true,
       46 -           user: { select: { email: true } },
       47 -           service: { select: { name: true } },
       48 -         },
       49 -       },
       50 -     },
       51 -   });
       52 - 
       53 -   const stats = {
       54 -     total: await db.refill.count(),
       55 -     pending: await db.refill.count({ where: { status: 'PENDING' } }),
       56 -     completed: await db.refill.count({ where: { status: 'COMPLETED' } }),       
       57 -   };
       58 - 
       59 -   return (
       60 -     <div className="space-y-6 w-full">
       61 -       <div>
       62 -         <h1 className="text-3xl font-bold tracking-tight">🔄 Докрутки</h1>      
       63 -         <p className="text-slate-500 mt-1">
       64 -           Всего: {stats.total} • Ожидают: {stats.pending} • Выполнены:
          {stats.completed}
       65 -         </p>
       66 -       </div>
       67 - 
       68 -       {/* Filter */}
       69 -       <Card className="rounded-2xl border-slate-100/50 shadow-sm bg-white/60    
          backdrop-blur-xl">
       70 -         <CardContent className="pt-6">
       71 -           <form className="flex gap-4">
       72 -             <select name="status" defaultValue={statusFilter}
       73 -               className="px-4 py-2.5 font-medium text-sm border
          border-slate-200 rounded-lg bg-slate-50/50 text-slate-700 outline-none
          focus:border-sky-500 transition-colors">
       74 -               <option value="ALL">Все статусы</option>
       75 -               {Object.entries(STATUS_LABELS).map(([v, l]) => (
       76 -                 <option key={v} value={v}>{l}</option>
       77 -               ))}
       78 -             </select>
       79 -             <button type="submit" className="px-5 py-2.5 text-sm
          font-semibold text-white bg-sky-500 rounded-lg hover:bg-sky-600 shadow
          hover:-translate-y-0.5 transition-all">
       80 -               Фильтр
       81 -             </button>
       82 -           </form>
       83 -         </CardContent>
       84 -       </Card>
       85 - 
       86 -       {/* Refills Table */}
       87 -       <Card className="rounded-2xl border-slate-100/50 shadow-sm bg-white/60    
          backdrop-blur-xl overflow-hidden">
       88 -         <CardHeader className="py-4 px-6 border-b border-slate-100/50
          bg-slate-50/50 rounded-t-2xl">
       89 -           <CardTitle className="text-sm font-bold uppercase tracking-widest     
          text-slate-800">Заявки на докрутку <span className="text-slate-400 font-medium    
          ml-2 tabular-nums">({refills.length})</span></CardTitle>
       90 -         </CardHeader>
       91 -         <CardContent className="p-0">
       92 -           <div className="overflow-x-auto">
       93 -             <table className="w-full text-sm font-medium text-slate-700">       
       94 -               <thead>
       95 -                 <tr className="text-left text-[11px] uppercase
          tracking-widest text-slate-400 border-b border-slate-100/60 bg-slate-50/30">      
       96 -                   <th className="py-3.5 px-6 font-bold">Refill ID</th>
       97 -                   <th className="py-3.5 px-4 font-bold">Заказ</th>
       98 -                   <th className="py-3.5 px-4 font-bold hidden
          sm:table-cell">Клиент</th>
       99 -                   <th className="py-3.5 px-4 font-bold">Услуга</th>
      100 -                   <th className="py-3.5 px-4 font-bold hidden
          md:table-cell">Ссылка</th>
      101 -                   <th className="py-3.5 px-4 font-bold
          text-right">Статус</th>
      102 -                   <th className="py-3.5 px-6 font-bold text-right hidden        
          lg:table-cell">Дата</th>
      103 -                 </tr>
      104 -               </thead>
      105 -               <tbody>
      106 -                 {refills.map(r => (
      107 -                   <tr key={r.id} className="border-b border-slate-100/30        
          hover:bg-slate-50/80 even:bg-slate-50/30 transition-colors last:border-0
          group">
      108 -                     <td className="py-3.5 px-6 font-mono text-xs font-bold      
          text-slate-900 group-hover:text-sky-700 transition-colors">#{r.numericId}</td>    
      109 -                     <td className="py-3.5 px-4">
      110 -                       <Link href={`/admin/orders?q=${r.order.numericId}`}       
      111 -                         className="text-sky-600 hover:text-sky-800 text-xs      
          font-mono font-bold tracking-tight">
      112 -                         #{r.order.numericId}
      113 -                       </Link>
      114 -                     </td>
      115 -                     <td className="py-3.5 px-4 text-xs font-mono
          tracking-tight text-slate-500 hidden sm:table-cell">{r.order.user.email}</td>     
      116 -                     <td className="py-3.5 px-4 text-xs font-semibold
          truncate max-w-[180px] text-slate-800">{r.order.service.name}</td>
      117 -                     <td className="py-3.5 px-4 text-xs truncate

  ✓  WriteFile  page.tsx → Accepted (+235, -224)

        1 - import { adminUserService, getVolumeTier } from
          '@/services/admin/user.service';
        2 - import { updateBalanceAction, banUserAction, unbanUserAction, loginAsAction     
          } from '@/actions/admin/users';
        3 - import { Card, CardContent, CardHeader, CardTitle } from
          '@/components/ui/card';
        4 - import { Button } from '@/components/ui/button';
        5 - import { Input } from '@/components/ui/input';
        6 - import Link from 'next/link';
        7 - import { AdminPageHeader } from '@/components/admin/page-header';
        8 - import { ClientTable } from './components/client-table';
        9 - import { Users, Download, Search, Key, Ban, UserCheck, CreditCard,
          ShoppingBag } from 'lucide-react';
       10 - import { SubmitButton } from '@/components/admin/submit-button';
       11 - import { ActionForm } from '@/components/admin/action-form';
       12 - 
       13 - export const dynamic = 'force-dynamic';
       14 - 
       15 - const ROLE_LABELS: Record<string, { label: string; color: string }> = {
       16 -   OWNER:   { label: 'Владелец', color: 'bg-indigo-500/10 text-indigo-700        
          border-indigo-200' },
       17 -   ADMIN:   { label: 'Админ',   color: 'bg-sky-500/10 text-sky-700
          border-sky-200' },
       18 -   MANAGER: { label: 'Менеджер', color: 'bg-emerald-500/10 text-emerald-700      
          border-emerald-200' },
       19 -   SUPPORT: { label: 'Саппорт', color: 'bg-slate-500/10 text-slate-700
          border-slate-200' },
       20 -   USER:    { label: 'Клиент',  color: 'bg-white border-slate-200
          text-slate-700' },
       21 -   BANNED:  { label: 'Забанен', color: 'bg-rose-500/10 text-rose-700
          border-rose-200' },
       22 - };
       23 - 
       24 - type Props = {
       25 -   searchParams: Promise<{
       26 -     q?: string;
       27 -     cursor?: string;
       28 -     userId?: string;
       29 -   }>;
       30 - };
       31 - 
       32 - export default async function AdminClientsPage({ searchParams }: Props) {       
       33 -   const params = await searchParams;
       34 -   const search = params.q || '';
       35 -   const cursor = params.cursor || undefined;
       36 -   const selectedUserId = params.userId;
       37 - 
       38 -   const { items: users, nextCursor, hasMore } = await
          adminUserService.listUsers({
       39 -     search: search || undefined,
       40 -     cursor,
       41 -     pageSize: 50,
       42 -   });
       43 - 
       44 -   const stats = await adminUserService.getUserStats();
       45 - 
       46 -   // If a user is selected, load their full card
       47 -   const userCard = selectedUserId ? await
          adminUserService.getUserCard(selectedUserId).catch(() => null) : null;
       48 - 
       49 -   return (
       50 -     <div className="space-y-6 w-full animate-in fade-in duration-500
          ease-out sm:px-2 md:px-0 bg-slate-50/50 min-h-full pb-10">
       51 -       <AdminPageHeader
       52 -         icon={Users}
       53 -         title="Клиенты платформы"
       54 -         description={
       55 -           <>
       56 -             <span className="flex items-center gap-1.5"><div
          className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>Всего:
          {stats.total}</span>
       57 -             <span className="flex items-center gap-1.5"><div
          className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>Активные:
          {stats.active}</span>
       58 -             <span className="flex items-center gap-1.5"><div
          className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>Забанены:
          {stats.banned}</span>
       59 -             <span className="flex items-center gap-1.5"><div
          className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>Liability: <span
          className="tabular-nums font-bold">{(stats.totalLiability /
          100).toLocaleString('ru-RU')} ₽</span></span>
       60 -           </>
       61 -         }
       62 -         action={(
       63 -           <a
       64 -
          href={`/api/admin/export?type=users&q=${encodeURIComponent(search)}`}
       65 -             className="inline-flex items-center gap-2 px-4 py-2.5 text-sm       
          font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm
          rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors"
       66 -           >
       67 -             <Download className="w-4 h-4" /> Экспорт CSV
       68 -           </a>
       69 -         )}
       70 -       />
       71 - 
       72 -       {/* Search */}
       73 -       <Card>
       74 -         <CardContent className="pt-6">
       75 -           <form className="flex gap-4">
       76 -             <input
       77 -               type="text"
       78 -               name="q"
       79 -               defaultValue={search}
       80 -               placeholder="🔍 Поиск по email..."
       81 -               className="flex-1 px-4 py-2 text-sm border border-slate-200       
          rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
          outline-none"
       82 -             />
       83 -             <Button type="submit">Найти</Button>
       84 -           </form>
       85 -         </CardContent>
       86 -       </Card>
       87 - 
       88 -       <Card>
       89 -         <CardContent className="pt-6">
       90 -           <ClientTable 
       91 -             data={users.map(u => ({
       92 -               ...u,
       93 -               tier: getVolumeTier(u.totalSpent)
       94 -             })) as any}
       95 -           >
       96 -             {userCard ? (
       97 -               <div className="space-y-4">
       98 -                 {/* Profile Card */}
       99 -                 <Card className="shadow-none border-none bg-transparent">       
      100 -                   <CardContent className="p-0 space-y-4">
      101 -                     <div className="grid grid-cols-2 gap-3 text-xs">
      102 -                       <div className="bg-white border border-slate-200
          rounded-lg p-3 shadow-sm">
      103 -                         <div className="text-slate-500 mb-1">Баланс</div>       
      104 -                         <div className="font-bold text-lg
          text-slate-900">{(userCard.balance / 100).toFixed(2)} ₽</div>
      105 -                       </div>
      106 -                       <div className="bg-white border border-slate-200
          rounded-lg p-3 shadow-sm">
      107 -                         <div className="text-slate-500 mb-1">LTV</div>
      108 -                         <div className="font-bold text-lg
          text-slate-900">{(userCard.totalSpent / 100).toLocaleString('ru-RU')} ₽</div>     

  ✓  ReadFolder  src/actions/admin → Found 15 item(s).
  ✓  ReadFile  src\actions\admin\users.ts
  ✓  ReadFile  src\...\admin\orders-extended.ts
  ✓  ReadFile  src\actions\admin\users.ts
  ✓  WriteFile  users.ts → Accepted (+167, -196)

        1 - 'use server';
        2 - 
        3 - import { verifySession } from '@/lib/session';
        4 - import { db } from '@/lib/db';
        5 - import { adminUserService } from '@/services/admin/user.service';
        6 - import { escrowService } from '@/services/admin/escrow.service';
        7 - import { auditAdmin } from '@/lib/admin-audit';
        8 - import { revalidatePath } from 'next/cache';
        9 - import { cookies, headers } from 'next/headers';
       10 - import { SignJWT } from 'jose';
       11 - import { z } from 'zod';
       12 - import { updateBalanceSchema, userIdSchema, entryIdSchema } from
          '@/validators/admin.validators';
       13 - 
       14 - const STAFF_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];
       15 - const secretKey = process.env.JWT_SECRET ||
          'fallback-secret-for-dev-only-v2';
       16 - const encodedKey = new TextEncoder().encode(secretKey);
       17 - 
       18 - async function requireStaff() {
       19 -   const session = await verifySession();
       20 -   if (!session) throw new Error('Unauthorized');
       21 -   const user = await db.user.findUnique({ where: { id: session.userId } });     
       22 -   if (!user || !STAFF_ROLES.includes(user.role)) throw new
          Error('Forbidden');
       23 -   return { session, user };
       24 - }
       25 - 
       26 - export async function updateBalanceAction(formData: FormData) {
       27 -   const { user: admin } = await requireStaff();
       28 -   const payload = Object.fromEntries(formData.entries());
       29 -   const parsed = updateBalanceSchema.safeParse(payload);
       30 -   
       31 -   if (!parsed.success) {
       32 -     throw new Error('userId, amount (копейки) и reason обязательны');
       33 -   }
       34 - 
       35 -   const { userId, amount, reason } = parsed.data;
       36 - 
       37 -   const reqHeaders = await headers();
       38 -   const ipAddress = reqHeaders.get('x-forwarded-for') ||
          reqHeaders.get('x-real-ip') || 'unknown';
       39 - 
       40 -   await escrowService.evaluateBalanceAdjustment(
       41 -     userId,
       42 -     amount,
       43 -     reason.trim(),
       44 -     admin
       45 -   );
       46 - 
       47 -   auditAdmin({
       48 -     adminId: admin.id,
       49 -     adminEmail: admin.email,
       50 -     action: 'UPDATE_BALANCE_REQUEST',
       51 -     target: userId,
       52 -     targetType: 'USER',
       53 -     newValue: { amountCents: amount, reason: reason.trim() },
       54 -     ipAddress
       55 -   });
       56 - 
       57 -   revalidatePath('/admin/clients');
       58 - }
       59 - 
       60 - export async function banUserAction(formData: FormData) {
       61 -   const { user: admin } = await requireStaff();
       62 -   const parsed =
          userIdSchema.safeParse(Object.fromEntries(formData.entries()));
       63 -   if (!parsed.success) throw new Error('Missing userId');
       64 -   
       65 -   const { userId } = parsed.data;
       66 - 
       67 -   const reqHeaders = await headers();
       68 -   const ipAddress = reqHeaders.get('x-forwarded-for') ||
          reqHeaders.get('x-real-ip') || 'unknown';
       69 - 
       70 -   await adminUserService.banUser(userId, {
       71 -     id: admin.id,
       72 -     email: admin.email,
       73 -   });
       74 - 
       75 -   auditAdmin({
       76 -     adminId: admin.id,
       77 -     adminEmail: admin.email,
       78 -     action: 'BAN_USER',
       79 -     target: userId,
       80 -     targetType: 'USER',
       81 -     ipAddress
       82 -   });
       83 - 
       84 -   revalidatePath('/admin/clients');
       85 - }
       86 - 
       87 - export async function unbanUserAction(formData: FormData) {
       88 -   const { user: admin } = await requireStaff();
       89 -   const parsed =
          userIdSchema.safeParse(Object.fromEntries(formData.entries()));
       90 -   if (!parsed.success) throw new Error('Missing userId');
       91 -   
       92 -   const { userId } = parsed.data;
       93 - 
       94 -   const reqHeaders = await headers();
       95 -   const ipAddress = reqHeaders.get('x-forwarded-for') ||
          reqHeaders.get('x-real-ip') || 'unknown';
       96 - 
       97 -   await adminUserService.unbanUser(userId, {
       98 -     id: admin.id,
       99 -     email: admin.email,
      100 -   });
      101 - 
      102 -   auditAdmin({
      103 -     adminId: admin.id,
      104 -     adminEmail: admin.email,
      105 -     action: 'UNBAN_USER',
      106 -     target: userId,
      107 -     targetType: 'USER',
      108 -     ipAddress
      109 -   });
      110 - 
      111 -   revalidatePath('/admin/clients');
      112 - }
      113 - 
      114 - /**
      115 -  * Login-As: creates a temporary session for the target user.
      116 -  * Critical security action — always writes to AdminAuditLog.
      117 -  */
      118 - export async function loginAsAction(formData: FormData) {
      119 -   const { user: admin } = await requireStaff();
      120 -   const parsed =
          userIdSchema.safeParse(Object.fromEntries(formData.entries()));
      121 -   if (!parsed.success) throw new Error('Missing userId');
      122 -   
      123 -   const { userId } = parsed.data;
      124 - 
      125 -   // Only OWNER and ADMIN can impersonate
      126 -   if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      127 -     throw new Error('Только Владелец и Админ могут входить как клиент');        
      128 -   }
      129 - 
      130 -   const targetUser = await db.user.findUniqueOrThrow({ where: { id: userId }    

  ✓  ReadFile  src\actions\admin\orders.ts
  ✓  WriteFile  orders.ts → Accepted (+39, -46)

       1 - 'use server';
       2 - 
       3 - import { verifySession } from '@/lib/session';
       4 - import { db } from '@/lib/db';
       5 - import { adminOrderService } from '@/services/admin/order.service';
       6 - import { revalidatePath } from 'next/cache';
       7 - import { z } from 'zod';
       8 - import { orderIdSchema } from '@/validators/admin.validators';
       9 - 
      10 - const STAFF_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];
      11 - 
      12 - async function requireStaff() {
      13 -   const session = await verifySession();
      14 -   if (!session) throw new Error('Unauthorized');
      15 -   const user = await db.user.findUnique({ where: { id: session.userId } });      
      16 -   if (!user || !STAFF_ROLES.includes(user.role)) throw new
         Error('Forbidden');
      17 -   return { session, user };
      18 - }
      19 - 
      20 - export async function cancelOrderAction(formData: FormData) {
      21 -   const { user } = await requireStaff();
      22 -   const parsed =
         orderIdSchema.safeParse(Object.fromEntries(formData.entries()));
      23 -   if (!parsed.success) throw new Error('Missing orderId');
      24 -   const { orderId } = parsed.data;
      25 - 
      26 -   await adminOrderService.cancelOrder(orderId, {
      27 -     id: user.id,
      28 -     email: user.email,
      29 -   });
      30 - 
      31 -   revalidatePath('/admin/orders');
      32 - }
      33 - 
      34 - export async function restartOrderAction(formData: FormData) {
      35 -   const { user } = await requireStaff();
      36 -   const parsed =
         orderIdSchema.safeParse(Object.fromEntries(formData.entries()));
      37 -   if (!parsed.success) throw new Error('Missing orderId');
      38 -   const { orderId } = parsed.data;
      39 - 
      40 -   await adminOrderService.restartOrder(orderId, {
      41 -     id: user.id,
      42 -     email: user.email,
      43 -   });
      44 - 
      45 -   revalidatePath('/admin/orders');
      46 - }
       1 + 'use server';
       2 + 
       3 + import { db } from '@/lib/db';
       4 + import { adminOrderService } from '@/services/admin/order.service';
       5 + import { revalidatePath } from 'next/cache';
       6 + import { orderIdSchema } from '@/validators/admin.validators';
       7 + import { requireStaffPermission } from '@/lib/server/rbac';
       8 + 
       9 + export async function cancelOrderAction(formData: FormData) {
      10 +   return requireStaffPermission('orders', 'edit', async (admin) => {
      11 +     const parsed =
         orderIdSchema.safeParse(Object.fromEntries(formData.entries()));
      12 +     if (!parsed.success) return { success: false as const, error: 'Missing       
         orderId' };
      13 +     const { orderId } = parsed.data;
      14 + 
      15 +     await adminOrderService.cancelOrder(orderId, {
      16 +       id: admin.id,
      17 +       email: admin.email,
      18 +     });
      19 + 
      20 +     revalidatePath('/admin/orders');
      21 +     return { success: true as const };
      22 +   });
      23 + }
      24 + 
      25 + export async function restartOrderAction(formData: FormData) {
      26 +   return requireStaffPermission('orders', 'edit', async (admin) => {
      27 +     const parsed =
         orderIdSchema.safeParse(Object.fromEntries(formData.entries()));
      28 +     if (!parsed.success) return { success: false as const, error: 'Missing       
         orderId' };
      29 +     const { orderId } = parsed.data;
      30 + 
      31 +     await adminOrderService.restartOrder(orderId, {
      32 +       id: admin.id,
      33 +       email: admin.email,
      34 +     });
      35 + 
      36 +     revalidatePath('/admin/orders');
      37 +     return { success: true as const };
      38 +   });
      39 + }

  ✓  FindFiles  '**/middleware.ts' → No files found
  ✓  FindFiles  '**/middleware.*' → No files found
  Завершение рефакторинга навигации и RBAC: 
  Completing the Admin Panel v3.0 navigation and RBAC refactoring.

  ✓  WriteFile  STATE.md → Accepted (+20, -7)

       1 - ## Current Position
       2 - 
       3 - Milestone: v3.0 Admin Panel MVP
       4 - Phase: 0. Foundation (Schema + Infrastructure)
       5 - Plan: See task.md in conversation artifacts
       6 - Status: IN_PROGRESS
       7 - Last activity: 2026-04-18 — Starting Phase 0: Schema migration + utility
         creation.
       1 + ## Current Position
       2 + 
       3 + Milestone: v3.0 Admin Panel MVP
       4 + Phase: 1. Navigation & RBAC Core (Completed)
       5 + Status: COMPLETED
       6 + Last activity: 2026-04-30 — Sidebar grouping, Catalog RUB pricing,
         Orders/Refills tabs, RBAC hiding for SUPPORT role.
       7 + 
       8 + ### Done:
       9 + - [x] Sidebar grouping (Operations, Finance, Core, System).
      10 + - [x] Catalog: Denormalized RUB pricing with "Beautiful Rounding".
      11 + - [x] Catalog: RBAC support (hide provider rates for SUPPORT).
      12 + - [x] Orders: Sub-navigation Tabs (Orders/Refills).
      13 + - [x] Orders: RBAC support (hide cost for SUPPORT).
      14 + - [x] Clients: RBAC support (hide balance/LTV/adjustments for SUPPORT).
      15 + - [x] Server Actions: Unified `requireStaffPermission` security.
      16 + 
      17 + ### Next:
      18 + - [ ] Refine Marketing tools (Promocodes dashboard).
      19 + - [ ] Financial Billing Dashboard overhaul.
      20 + - [ ] System Settings UI cleanup.


✦ Приношу извинения за использование английского в предыдущем ответе. Я исправил это и      
  полностью перешел на русский язык.

  Я завершил важный этап рефакторинга Админ-панели v3.0, сфокусировавшись на удобстве работы  и безопасности (RBAC).

  ✅ Что сделано:

   1. Группировка меню (Сайдбар):
       * Теперь навигация разделена на логические секции: Операционка, Финансы, Каталог и   
         Система.
       * Обновлен дизайн: добавлены заголовки групп и улучшена визуальная иерархия.
   2. Каталог и Ценообразование:
       * Human-Readable цены: Теперь цены редактируются напрямую в рублях. Система сама     
         рассчитывает нужный множитель (markup) и сохраняет его.
       * Красивое округление: Интегрирована функция applyBeautifulRounding, чтобы цены в    
         базе всегда соответствовали тому, что видит клиент.
       * Денормализация: Цены теперь дублируются в поле pricePer1000Cents для быстрой       
         сортировки и фильтрации.
   3. Объединение Заказов и Докруток:
       * На страницы заказов (/admin/orders) и докруток (/admin/refills) добавлены вкладки  
         (Tabs). Теперь между ними можно переключаться мгновенно, не теряя контекст
         "Операционки".
   4. Разграничение прав (RBAC) для роли SUPPORT:
       * Каталог: Скрыты закупочные цены провайдеров и инструменты массового изменения      
         маржи.
       * Заказы: Скрыта себестоимость в деталях заказа.
       * Клиенты: Скрыты балансы, LTV и инструменты корректировки баланса.
       * Безопасность: Все ключевые действия (Server Actions) переведены на строгую проверку         прав через requireStaffPermission.

  🔍 Что дальше?
  Согласно плану, следующие шаги:
   * Обновление инструментов Маркетинга (промокоды).
   * Переработка Финансового дашборда (Billing).
   * Чистка Системных настроек.

  Продолжаем по списку или есть приоритетная задача?
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ > продолжай
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
  Рефакторинг модуля Маркетинга: 
  Implementing the Marketing (Promocodes) dashboard enhancements.

  ✓  ReadFolder  src/app/admin/marketing → Found 4 item(s).
  ✓  ReadFile  src\app\admin\marketing\page.tsx
  ✓  ReadFolder  src/app/admin/marketing → Found 4 item(s).
  ✓  ReadFile  src\actions\admin\marketing.ts
  ✓  ReadFile  src\...\admin\marketing.service.ts