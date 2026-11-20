'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Theme-aware count charts; the existing data tables remain the accessible alternative. */
export const SERIES = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)'] as const;
const AXIS = { stroke: 'var(--color-border-strong)', tick: { fill: 'var(--color-subtle)', fontSize: 12 } };
const GRID = 'var(--color-chart-grid)';

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
}

function TooltipBox({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-ui border border-border bg-page px-3 py-2.5 text-xs shadow-pop">
      <p className="mb-1 font-medium text-subtle">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-fg">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          <strong className="tabular">{Number(p.value).toLocaleString()}</strong>
          <span className="text-subtle">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

/** The chart's numbers as a table, for screen readers and anyone who prefers exact values. */
export function ChartTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">Show data table</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-ui border border-border">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface">
            <tr>
              {columns.map((c, i) => (
                <th key={c} scope="col" className={`px-3 py-2 font-semibold text-subtle ${i ? 'text-right' : 'text-left'}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((v, j) => (
                  <td key={j} className={`px-3 py-1.5 ${j ? 'text-right tabular' : ''}`}>
                    {typeof v === 'number' ? v.toLocaleString() : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Two count series over days (same unit, one axis). */
export function DailyLineChart({
  data,
  series,
  formatDay,
  height = 260,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; name: string }[];
  formatDay: (d: string) => string;
  height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label={`Line chart of ${series.map((s) => s.name).join(' and ')} per day`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDay} {...AXIS} tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<TooltipBox labelFormatter={formatDay} />} cursor={{ stroke: 'var(--color-subtle)', strokeWidth: 1 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--color-muted)', paddingTop: 4 }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={SERIES[i]}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--color-page)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One series of named magnitudes as horizontal bars. */
export function HorizontalBarChart({ data, valueName, height }: { data: { name: string; value: number }[]; valueName: string; height?: number }) {
  const h = height ?? Math.max(160, data.length * 36 + 24);
  return (
    <div style={{ height: h }} role="img" aria-label={`Bar chart of ${valueName}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...AXIS} tickLine={false} />
          <YAxis type="category" dataKey="name" width={140} {...AXIS} tickLine={false} axisLine={false} interval={0} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: 'var(--color-tint)' }} />
          <Bar dataKey="value" name={valueName} fill={SERIES[0]} radius={[0, 6, 6, 0]} maxBarSize={20} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * One series over ordered categories as vertical bars. `colors` (per bar, same order as `data`) is for
 * categories with a meaning of their own, such as stock status; otherwise every bar uses the first series.
 */
export function ColumnChart({ data, valueName, height = 220, colors }: { data: { name: string; value: number }[]; valueName: string; height?: number; colors?: string[] }) {
  return (
    <div style={{ height }} role="img" aria-label={`Column chart of ${valueName}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={12}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" {...AXIS} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: 'var(--color-tint)' }} />
          <Bar dataKey="value" name={valueName} fill={SERIES[0]} radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
            {colors && data.map((entry, i) => <Cell key={entry.name} fill={colors[i] ?? SERIES[0]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
