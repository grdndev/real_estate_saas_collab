"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TreasuryChartMonth {
  label: string;
  income: number;
  expense: number;
}

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function TreasuryChart({ data }: { data: TreasuryChartMonth[] }) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const yDomain = [0, Math.ceil(max * 1.1)];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e2e8f0"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={yDomain}
          tickFormatter={(v: number) =>
            v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`
          }
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value) => eur.format(Number(value))}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        />
        <Legend
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Bar
          dataKey="income"
          name="Entrées"
          fill="#16a34a"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="expense"
          name="Dépenses"
          fill="#dc2626"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
