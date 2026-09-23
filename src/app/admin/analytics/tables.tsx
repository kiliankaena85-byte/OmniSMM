import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TopService {
  name: string;
  clicks: number;
}

interface ProfitabilityItem {
  categoryName: string;
  ordersCount: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
}

interface ServiceProfitabilityItem extends ProfitabilityItem {
  serviceName: string;
}

export function TopServicesTable({ topServices }: { topServices: TopService[] }) {
  return (
    <Table aria-label="Топ услуг по кликам" className="w-full text-xs table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[80%] px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-widest">Услуга</TableHead>
          <TableHead className="w-[20%] px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-widest">Кликов</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {topServices.length === 0 ? (
          <TableRow>
            <TableCell colSpan={2} className="px-4 py-12 text-center text-muted-foreground font-medium">Нет данных</TableCell>
          </TableRow>
        ) : (
          topServices.map((srv, idx) => (
            <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
              <TableCell className="px-4 py-3 font-bold text-foreground">{srv.name}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums font-black text-primary">{srv.clicks}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function ProfitCategoriesTable({ categories, fmt }: { categories: ProfitabilityItem[], fmt: (v: number) => string }) {
  return (
    <Table aria-label="Рентабельность по категориям" className="w-full text-xs table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[35%] px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-widest">Категория</TableHead>
          <TableHead className="w-[15%] px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-widest">Заказов</TableHead>
          <TableHead className="w-[15%] px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-widest">Выручка</TableHead>
          <TableHead className="w-[10%] px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-widest">Себест.</TableHead>
          <TableHead className="w-[15%] px-4 py-3 text-right font-bold text-foreground uppercase tracking-widest">Прибыль</TableHead>
          <TableHead className="w-[10%] px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-widest">Маржа %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Нет данных о продажах</TableCell>
          </TableRow>
        ) : (
          categories.map((c, i) => (
            <TableRow key={i} className="hover:bg-muted/30 transition-colors">
              <TableCell className="px-4 py-3 font-bold text-foreground">{c.categoryName}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{c.ordersCount}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(c.revenue)}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(c.cogs)}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums font-black text-success">{fmt(c.profit)}</TableCell>
              <TableCell className="px-4 py-3 text-right">
                 <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${c.marginPct > 40 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                   {c.marginPct.toFixed(1)}%
                 </span>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function ProfitServicesTable({ services, fmt }: { services: ServiceProfitabilityItem[], fmt: (v: number) => string }) {
  return (
    <Table aria-label="Рентабельность по услугам (Топ 15)" className="w-full text-xs table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[45%] px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-widest">Услуга</TableHead>
          <TableHead className="w-[15%] px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-widest">Заказов</TableHead>
          <TableHead className="w-[15%] px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-widest">Выручка</TableHead>
          <TableHead className="w-[15%] px-4 py-3 text-right font-bold text-foreground uppercase tracking-widest">Прибыль</TableHead>
          <TableHead className="w-[10%] px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-widest">Маржа %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">Нет данных о продажах</TableCell>
          </TableRow>
        ) : (
          services.slice(0, 15).map((s, i) => (
            <TableRow key={i} className="hover:bg-muted/30 transition-colors">
              <TableCell className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">{s.serviceName}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">{s.categoryName}</span>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{s.ordersCount}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(s.revenue)}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums font-black text-primary">{fmt(s.profit)}</TableCell>
              <TableCell className="px-4 py-3 text-right">
                 <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${s.marginPct > 50 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                   {s.marginPct.toFixed(1)}%
                 </span>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
