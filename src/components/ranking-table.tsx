import { Medal, Trophy } from "lucide-react";
import type { TecnicoRanking } from "@/hooks/use-apontamentos";
import { cn } from "@/lib/utils";

const META = 150;

function MedalIcon({ pos }: { pos: number }) {
  const cls = pos === 1 ? "text-gold" : pos === 2 ? "text-silver" : "text-bronze";
  return <Medal className={cn("h-5 w-5", cls)} />;
}

export function RankingTable({
  ranking,
  highlightSub150 = false,
  title,
}: {
  ranking: TecnicoRanking[];
  highlightSub150?: boolean;
  title?: string;
}) {
  if (!ranking.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        Sem apontamentos para este filtro.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
      {title && (
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-secondary" />
          <h3 className="font-display font-semibold text-sm">{title}</h3>
        </div>
      )}
      <div className="divide-y divide-border">
        {ranking.map((t, i) => {
          const pos = i + 1;
          const pct = Math.min(100, (t.horas / META) * 100);
          const showMedal = highlightSub150 && pos <= 3;
          return (
            <div key={t.codigo + t.nome} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                {showMedal ? <MedalIcon pos={pos} /> : <span className="w-5 text-center">{pos}</span>}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{t.nome}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{t.equipe}</span>
                  <span>{t.ordens} OS</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full transition-all", t.horas >= META ? "bg-success" : "bg-secondary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-semibold tabular-nums">{t.horas.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">{((t.horas / META) * 100).toFixed(0)}% da meta</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
