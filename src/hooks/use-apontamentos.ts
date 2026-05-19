import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentMonthKey } from "@/lib/excel-utils";

export interface TecnicoRanking {
  codigo: string;
  nome: string;
  equipe: string;
  horas: number;
  ordens: number;
}

export function useApontamentosMes(mesAno: string = currentMonthKey()) {
  return useQuery({
    queryKey: ["apontamentos", mesAno],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apontamentos")
        .select("numero_os, tecnico_codigo, tecnico_nome, equipe, unidade_negocio, horas_decimais, semana_do_mes, mes_ano, data_inicio")
        .eq("mes_ano", mesAno)
        .limit(10000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRanking(mesAno: string = currentMonthKey()) {
  const { data, isLoading } = useApontamentosMes(mesAno);
  const ranking: TecnicoRanking[] = [];
  if (data) {
    const map = new Map<string, TecnicoRanking & { osSet: Set<string> }>();
    for (const r of data) {
      const key = r.tecnico_codigo || r.tecnico_nome;
      if (!map.has(key)) {
        map.set(key, {
          codigo: r.tecnico_codigo,
          nome: r.tecnico_nome,
          equipe: r.equipe,
          horas: 0,
          ordens: 0,
          osSet: new Set(),
        });
      }
      const t = map.get(key)!;
      t.horas += Number(r.horas_decimais ?? 0);
      if (r.numero_os) t.osSet.add(r.numero_os);
    }
    for (const t of map.values()) {
      ranking.push({ codigo: t.codigo, nome: t.nome, equipe: t.equipe, horas: Math.round(t.horas * 100) / 100, ordens: t.osSet.size });
    }
    ranking.sort((a, b) => b.horas - a.horas);
  }
  return { ranking, isLoading };
}
