import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";

// Brand palette only: verde leads, bronze is the premium second, muted ink
// third. Everything after is a tint of those three — never a rainbow.
const COLORS = ["#1F7048", "#8A661B", "#5C6360", "#4E7A63", "#B08A5E", "#8A9A90", "#2C6B57"];

function monthLabel(ym, lang) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const loc = lang === "en" ? "en-GB" : "ro-RO";
  return d.toLocaleDateString(loc, { month: "short", year: "2-digit" });
}

function ChartCard({ title, subtitle, iconSrc, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-soft">
          <img src={iconSrc} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
        </span>
        <div className="min-w-0">
          <h3 className="font-heading text-base font-bold text-navy dark:text-foreground">{title}</h3>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function OwnerCharts({ ownerId, lang }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isEn = lang === "en";

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) { setLoading(false); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke("GetOwnerAnalytics", { owner_id: ownerId });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ownerId]);

  if (loading) {
    return (
      <div className="mt-5 grid gap-4 sm:mt-8 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
    );
  }
  if (!data || !data.properties || data.properties.length === 0) return null;

  const viewsData = data.months.map((m, i) => {
    const row = { month: monthLabel(m, lang) };
    data.properties.forEach((p) => { row[p.title] = data.views[p.id]?.[i] || 0; });
    return row;
  });
  const inqData = data.months.map((m, i) => {
    const row = { month: monthLabel(m, lang) };
    data.properties.forEach((p) => { row[p.title] = data.inquiries[p.id]?.[i] || 0; });
    return row;
  });

  const TooltipStyle = {
    contentStyle: {
      borderRadius: 16,
      border: "1px solid hsl(var(--border))",
      background: "hsl(var(--card))",
      color: "hsl(var(--foreground))",
      fontSize: 12,
    },
    itemStyle: { color: "hsl(var(--foreground))" },
    labelStyle: { fontWeight: 700, color: "hsl(var(--foreground))" },
  };

  return (
    <div className="mt-5 sm:mt-8">
      <h2 className="mb-3 font-heading text-xl font-bold text-navy dark:text-foreground">
        {isEn ? "Performance analytics" : "Analiză performanță"}
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          iconSrc="/images/generated/icon-gauge.png"
          title={isEn ? "Monthly views" : "Vizionări / lună"}
          subtitle={isEn ? "Views per listing, last 6 months" : "Vizionări pe anunț, ultimele 6 luni"}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={viewsData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...TooltipStyle} />
              {data.properties.length <= 5 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {data.properties.map((p, i) => (
                <Bar key={p.id} dataKey={p.title} fill={COLORS[i % COLORS.length]} radius={[8, 8, 0, 0]} maxBarSize={26} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          iconSrc="/images/generated/icon-chat.png"
          title={isEn ? "Inquiries evolution" : "Cereri primite / lună"}
          subtitle={isEn ? "Inquiries per listing, last 6 months" : "Cereri pe anunț, ultimele 6 luni"}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={inqData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...TooltipStyle} />
              {data.properties.length <= 5 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {data.properties.map((p, i) => (
                <Line
                  key={p.id}
                  type="monotone"
                  dataKey={p.title}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}