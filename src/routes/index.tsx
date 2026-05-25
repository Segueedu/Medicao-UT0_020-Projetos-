import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trophy, Users, Clock, Target, Sparkles } from "lucide-react";
import { useRanking } from "@/hooks/use-apontamentos";
import { RankingTable } from "@/components/ranking-table";
import { EQUIPES, currentMonthKey, currentWeekOfMonth } from "@/lib/excel-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Ranking de Técnicos — Medição PROJETOS" },
      { name: "description", content: "Acompanhe em tempo real o ranking de horas apontadas pelos técnicos de manutenção predial." },
    ],
  }),
});

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function HomePage() {
  const mes = currentMonthKey();
  const { ranking, isLoading } = useRanking(mes);
  const [equipeFiltro, setEquipeFiltro] = useState<string | null>(null);
  const semana = currentWeekOfMonth();

  const totalHoras = useMemo(() => ranking.reduce((s, t) => s + t.horas, 0), [ranking]);
  const totalOS = useMemo(() => ranking.reduce((s, t) => s + t.ordens, 0), [ranking]);
  const acimaMeta = useMemo(() => ranking.filter((t) => t.horas >= 150).length, [ranking]);
  const vencedor = ranking[0];
  const rankingEquipe = useMemo(
    () => (equipeFiltro ? ranking.filter((t) => t.equipe === equipeFiltro) : []),
    [equipeFiltro, ranking]
  );
  const ganhadorEquipe = rankingEquipe[0];

  const mesLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Hero */}
      <header
        className="px-6 md:px-10 py-10 text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="max-w-6xl mx-auto">

          <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold">Ranking de Técnicos</h1>
          <p className="mt-2 text-primary-foreground/80 capitalize">{mesLabel} · Meta: 150h por técnico</p>

          {semana >= 4 && vencedor && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-lg bg-warning/95 text-warning-foreground px-4 py-3 shadow-[var(--shadow-elevated)]">
              <Sparkles className="h-5 w-5" />
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold">Prêmio mensal — semana final</p>
                <p className="font-display font-semibold">{vencedor.nome} lidera com {vencedor.horas.toFixed(1)}h</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 space-y-8">
        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Técnicos ativos" value={String(ranking.length)} />
          <StatCard icon={Clock} label="Horas totais" value={totalHoras.toFixed(0)} hint="no mês" />
          <StatCard icon={Trophy} label="Acima da meta" value={`${acimaMeta}/${ranking.length}`} hint="≥ 150h" />
          <StatCard icon={Target} label="OS executadas" value={String(totalOS)} />
        </section>

        {/* Filtro por equipe */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold">Filtrar por equipe</h2>
            {equipeFiltro && (
              <button
                onClick={() => setEquipeFiltro(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar filtro
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {EQUIPES.map((eq) => (
              <button
                key={eq}
                onClick={() => setEquipeFiltro(equipeFiltro === eq ? null : eq)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm border transition-colors",
                  equipeFiltro === eq
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:border-secondary"
                )}
              >
                {eq}
              </button>
            ))}
          </div>

          {equipeFiltro && ganhadorEquipe && (
            <div className="mt-4 rounded-lg border border-secondary/40 bg-secondary/5 p-4 flex items-center gap-3">
              <Trophy className="h-6 w-6 text-secondary" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Líder da equipe {equipeFiltro}</p>
                <p className="font-display font-semibold text-lg">
                  {ganhadorEquipe.nome} · {ganhadorEquipe.horas.toFixed(1)}h
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Rankings */}
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            Carregando ranking…
          </div>
        ) : equipeFiltro ? (
          <RankingTable title={`Ranking — ${equipeFiltro}`} ranking={rankingEquipe} />
        ) : (
          <div className="space-y-6">
            <RankingTable title="Ranking geral" ranking={ranking} />
          </div>
        )}

        {!ranking.length && !isLoading && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Ainda não há apontamentos para o mês atual. A equipe financeira precisa fazer o upload da planilha.
          </div>
        )}
      </div>
    </div>
  );
}
