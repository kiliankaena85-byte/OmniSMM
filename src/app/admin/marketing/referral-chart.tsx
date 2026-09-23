'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { formatRubles } from '@/utils/format-price';

interface ChartDataPoint {
  name: string;
  total: number;
}

interface ReferralEconomicsChartProps {
  data: ChartDataPoint[];
}

export function ReferralEconomicsChart({ data }: ReferralEconomicsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground text-sm">
        Нет данных для отображения
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full min-w-0 mt-4">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.6} />
          <XAxis 
            dataKey="name" 
            stroke="var(--color-muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="var(--color-muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatRubles(Number(value) || 0)}
          />
          <Tooltip 
            cursor={{ fill: 'var(--color-muted)', opacity: 0.2 }}
            contentStyle={{ 
              borderRadius: '12px', 
              border: '1px solid var(--color-border)', 
              backgroundColor: 'var(--color-card)',
              color: 'var(--color-foreground)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.08)'
            }}
            formatter={(value: unknown) => [formatRubles(Number(value) || 0), 'Выплачено']}
            labelStyle={{ color: 'var(--color-foreground)', fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Legend 
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
            formatter={() => <span className="text-muted-foreground font-medium text-xs">Выплаты комиссий (₽)</span>}
          />
          <Bar 
            dataKey="total" 
            fill="currentColor" 
            radius={[6, 6, 0, 0]} 
            className="fill-primary"
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
