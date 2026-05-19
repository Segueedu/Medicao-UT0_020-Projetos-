import * as XLSX from "xlsx";

export const EQUIPES = [
  "HIDRÁULICA",
  "PINTURA",
  "ELÉTRICA",
  "CIVIL",
  "MARCENARIA",
  "SERRALHERIA",
  "SERVIÇOS GERAIS",
] as const;

export type Equipe = (typeof EQUIPES)[number];

export interface ApontamentoRow {
  numero_os: string;
  tecnico_codigo: string;
  tecnico_nome: string;
  especialidade: string;
  equipe: string;
  tipo_solicitacao: string;
  unidade_negocio: string;
  data_inicio: string | null;
  data_fim: string | null;
  horas_decimais: number;
  preco_hora: number;
  valor_mao_obra: number;
  mes_ano: string;
  semana_do_mes: number;
}

/** "8:30:00" or "08:30" -> 8.5 */
export function timeToDecimal(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") {
    // Excel stores duration as fraction of a day
    if (v < 10) return Math.round(v * 24 * 100) / 100;
    return v;
  }
  const s = String(v).trim();
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  const [h = 0, m = 0, sec = 0] = parts;
  return Math.round((h + m / 60 + sec / 3600) * 100) / 100;
}

function excelDateToISO(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S)).toISOString();
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function weekOfMonth(d: Date): number {
  const day = d.getDate();
  return Math.min(4, Math.ceil(day / 7));
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.trim().toLowerCase() === k.trim().toLowerCase()) return row[rk];
    }
  }
  return undefined;
}

export async function parseExcel(file: File): Promise<ApontamentoRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows
    .map((r) => {
      const dataInicio = excelDateToISO(pick(r, "Data Início Trabalho", "Data Inicio Trabalho"));
      const horas = timeToDecimal(pick(r, "Tempo Trabalho Feedback M.Obra", "Tempo Trabalho"));
      const precoHora = Number(pick(r, "Preço Hora", "Preco Hora")) || 0;
      const valorMO = Number(pick(r, "Valor Mão-de-Obra", "Valor Mao-de-Obra", "Valor Mao de Obra")) || horas * precoHora;
      const dateObj = dataInicio ? new Date(dataInicio) : new Date();
      const mes_ano = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

      return {
        numero_os: String(pick(r, "Número OS", "Numero OS") ?? "").trim(),
        tecnico_codigo: String(pick(r, "Técnico", "Tecnico") ?? "").trim(),
        tecnico_nome: String(pick(r, "Denominação Técnico", "Denominacao Tecnico") ?? "").trim(),
        especialidade: String(pick(r, "Denominação Especialidade", "Denominacao Especialidade") ?? "").trim(),
        equipe: String(pick(r, "Denominação Oficina", "Denominacao Oficina") ?? "").trim().toUpperCase(),
        tipo_solicitacao: String(pick(r, "Denominação Tipo Solicitação Serviço", "Denominacao Tipo Solicitacao Servico") ?? "").trim(),
        unidade_negocio: String(pick(r, "Denominação Unidade Negócio", "Denominacao Unidade Negocio") ?? "").trim().toUpperCase(),
        data_inicio: dataInicio,
        data_fim: excelDateToISO(pick(r, "Data Final Trabalho", "Data Fim Trabalho")),
        horas_decimais: horas,
        preco_hora: precoHora,
        valor_mao_obra: valorMO,
        mes_ano,
        semana_do_mes: weekOfMonth(dateObj),
      } satisfies ApontamentoRow;
    })
    .filter((r) => r.tecnico_nome && r.equipe);
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentWeekOfMonth(d = new Date()): number {
  return Math.min(4, Math.ceil(d.getDate() / 7));
}

export function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
