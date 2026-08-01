"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRankingComunas } from "@/lib/api/queries";
import type { PesosAhp } from "@/types/rankingComuna";

function nivelColor(score: number): string {
  if (score >= 0.5) return "var(--color-critical)";
  if (score >= 0.25) return "var(--color-warning)";
  return "var(--color-vegetation)";
}

export function RankingScoreChart({ pesos }: { pesos: PesosAhp }) {
  const rankingQuery = useRankingComunas(pesos);

  const data = useMemo(() => {
    if (!rankingQuery.data) return [];
    return [...rankingQuery.data]
      .sort((a, b) => b.score_total - a.score_total)
      .map((r) => ({ comuna: r.comuna, score: r.score_total }));
  }, [rankingQuery.data]);

  if (rankingQuery.isLoading) return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  if (rankingQuery.isError) {
    return (
      <p className="text-sm text-critical">
        No se pudo cargar la gráfica: {(rankingQuery.error as Error).message}
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="comuna"
            angle={-40}
            textAnchor="end"
            interval={0}
            height={70}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          />
          <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
          <Tooltip
            formatter={(value) => [Number(value).toFixed(4), "Score AHP"]}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.comuna} fill={nivelColor(d.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
