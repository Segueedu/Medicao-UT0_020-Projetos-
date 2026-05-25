import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { Download, Upload, AlertTriangle } from "lucide-react";
import { useApontamentosMes } from "@/hooks/use-apontamentos";
import { currentMonthKey, exportToCSV, EQUIPES } from "@/lib/excel-utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/financeiro/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard Financeiro — Medição PROJETOS" }] }),
});

const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)",
];

function monthOptions() {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function Dashboard() {
  const [mes, setMes] = useState(currentMonthKey());
  const [equipeFiltro, setEquipeFiltro] = useState<string>("");
  const [unFiltro, setUnFiltro] = useState<string>("");
  const { data: rows = [], isLoading } = useApontamentosMes(mes);

  // Need full data including financial — re-query via supabase happens in hook already (selecting only needed cols).
  // For the financial dashboard we need preco_hora & valor_mao_obra — use a separate fetch.
  const { data: fullRows = [] } = useFinanceData(mes);

  const filtered = useMemo(
    () => fullRows.filter((r) =>
      (!equipeFiltro || r.equipe === equipeFiltro) &&
      (!unFiltro || r.unidade_negocio === unFiltro)
    ),
    [fullRows, equipeFiltro, unFiltro]
  );

  const horasPorTecnico = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.tecnico_nome, (m.get(r.tecnico_nome) ?? 0) + Number(r.horas_decimais));
    return Array.from(m, ([nome, horas]) => ({ nome, horas: Math.round(horas * 10) / 10 }))
      .sort((a, b) => b.horas - a.horas).slice(0, 10);
  }, [filtered]);

  const horasPorEquipe = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.equipe, (m.get(r.equipe) ?? 0) + Number(r.horas_decimais));
    return Array.from(m, ([equipe, horas]) => ({ equipe, horas: Math.round(horas) }))
      .sort((a, b) => b.horas - a.horas);
  }, [filtered]);

  const valorPorTecnico = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.tecnico_nome, (m.get(r.tecnico_nome) ?? 0) + Number(r.valor_mao_obra ?? 0));
    return Array.from(m, ([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filtered]);

  const valorPorEquipe = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.equipe, (m.get(r.equipe) ?? 0) + Number(r.valor_mao_obra ?? 0));
    return Array.from(m, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [filtered]);

  const evolucaoSemanal = useMemo(() => {
    const top5 = horasPorTecnico.slice(0, 5).map((t) => t.nome);
    const semanas = [1, 2, 3, 4].map((s) => {
      const obj: Record<string, number | string> = { semana: `S${s}` };
      for (const nome of top5) {
        const h = filtered
          .filter((r) => r.tecnico_nome === nome && r.semana_do_mes === s)
          .reduce((sum, r) => sum + Number(r.horas_decimais), 0);
        obj[nome] = Math.round(h * 10) / 10;
      }
      return obj;
    });
    return { semanas, top5 };
  }, [filtered, horasPorTecnico]);

  const abaixoMeta = useMemo(() => {
    const m = new Map<string, { nome: string; equipe: string; horas: number }>();
    for (const r of filtered) {
      const k = r.tecnico_nome;
      const cur = m.get(k) ?? { nome: r.tecnico_nome, equipe: r.equipe, horas: 0 };
      cur.horas += Number(r.horas_decimais);
      m.set(k, cur);
    }
    return Array.from(m.values()).filter((t) => t.horas < 150).sort((a, b) => a.horas - b.horas);
  }, [filtered]);

  const porUnidade = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.unidade_negocio || "—", (m.get(r.unidade_negocio || "—") ?? 0) + Number(r.valor_mao_obra ?? 0));
    return Array.from(m, ([unidade, valor]) => ({ unidade, valor: Math.round(valor) }));
  }, [filtered]);

  const unidades = useMemo(() => Array.from(new Set(fullRows.map((r) => r.unidade_negocio).filter(Boolean))), [fullRows]);

  const totais = useMemo(() => ({
    horas: filtered.reduce((s, r) => s + Number(r.horas_decimais), 0),
    valor: filtered.reduce((s, r) => s + Number(r.valor_mao_obra ?? 0), 0),
    tecnicos: new Set(filtered.map((r) => r.tecnico_nome)).size,
    os: new Set(filtered.map((r) => r.numero_os).filter(Boolean)).size,
  }), [filtered]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Indicadores de produtividade e mão de obra</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/financeiro/upload">
            <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" /> Upload Excel</Button>
          </Link>
          <Button
            size="sm"
            onClick={() => exportToCSV(filtered as any, `medicao-${mes}.csv`)}
            disabled={!filtered.length}
          >
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
        <select value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
          {monthOptions().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={equipeFiltro} onChange={(e) => setEquipeFiltro(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
          <option value="">Todas as equipes</option>
          {EQUIPES.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
        </select>
        <select value={unFiltro} onChange={(e) => setUnFiltro(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
          <option value="">Todas unidades</option>
          {unidades.map((u) => <option key={u as string} value={u as string}>{u as string}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Horas totais" value={totais.horas.toFixed(0)} />
        <Kpi label="Valor mão de obra" value={fmtMoney(totais.valor)} />
        <Kpi label="Técnicos" value={String(totais.tecnicos)} />
        <Kpi label="OS executadas" value={String(totais.os)} />
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Carregando…</div>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Top 10 técnicos por horas">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={horasPorTecnico} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis dataKey="nome" type="category" width={140} stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="horas" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Horas por equipe">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={horasPorEquipe}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="equipe" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="horas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Valor MO por técnico (top 8)">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={valorPorTecnico} dataKey="value" nameKey="name" outerRadius={110} label={(e: any) => e.name}>
                {valorPorTecnico.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Valor MO por equipe">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={valorPorEquipe} dataKey="value" nameKey="name" outerRadius={110} label={(e: any) => e.name}>
                {valorPorEquipe.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Evolução semanal — top 5 técnicos">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={evolucaoSemanal.semanas}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="semana" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {evolucaoSemanal.top5.map((nome, i) => (
                <Line key={nome} type="monotone" dataKey={nome} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Faturamento por unidade de negócio">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={porUnidade}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="unidade" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="valor" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Abaixo da meta */}
      <Card title={`Técnicos abaixo da meta de 150h (${abaixoMeta.length})`}>
        {abaixoMeta.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os técnicos atingiram a meta. 🎉</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {abaixoMeta.map((t) => (
              <div key={t.nome} className="rounded-md border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{t.nome}</p>
                  <p className="text-xs text-muted-foreground">{t.equipe} · {t.horas.toFixed(1)}h ({((t.horas / 150) * 100).toFixed(0)}%)</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// Full-data hook (com campos financeiros)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
function useFinanceData(mes: string) {
  return useQuery({
    queryKey: ["apontamentos-full", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apontamentos")
        .select("*")
        .eq("mes_ano", mes)
        .limit(10000);
      if (error) throw error;
      return data ?? [];
    },
  });
}
