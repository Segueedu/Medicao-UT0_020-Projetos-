import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertTriangle, CalendarDays, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { parseExcel, type ApontamentoRow, currentMonthKey } from "@/lib/excel-utils";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/financeiro/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload de planilha — Medição PROJETOS" }] }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-05" → "Maio/2026" */
function formatMesAno(key: string): string {
  const [year, month] = key.split("-");
  return `${MESES_PT[Number(month) - 1]}/${year}`;
}

/** Gera opções do mês atual até Dezembro do ano corrente */
function buildMonthOptions(): string[] {
  const out: string[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  for (let m = currentMonth; m <= 11; m++) {
    out.push(`${currentYear}-${String(m + 1).padStart(2, "0")}`);
  }
  return out;
}

// ─── Componente ───────────────────────────────────────────────────────────────

function UploadPage() {
  const [mesAlvo, setMesAlvo] = useState(currentMonthKey());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ApontamentoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  // Linhas da planilha que pertencem ao mês selecionado
  const rowsDoMes = useMemo(
    () => preview.filter((r) => r.mes_ano === mesAlvo),
    [preview, mesAlvo]
  );

  // Meses extras presentes na planilha (excluindo o mês alvo)
  const mesesExtras = useMemo(() => {
    const todos = Array.from(new Set(preview.map((r) => r.mes_ano)));
    return todos.filter((m) => m !== mesAlvo);
  }, [preview, mesAlvo]);

  const handleFile = async (f: File) => {
    setFile(f);
    setDone(null);
    try {
      const rows = await parseExcel(f);
      setPreview(rows);
      toast.success(`${rows.length} linhas detectadas na planilha`);
    } catch (e: any) {
      toast.error("Falha ao ler planilha: " + e.message);
    }
  };

  const handleImport = async () => {
    if (!rowsDoMes.length) return;
    setUploading(true);
    setConfirmOpen(false);
    try {
      // REGRA #1 — deleta APENAS o mês selecionado
      const { error: deleteError } = await supabase
        .from("apontamentos")
        .delete()
        .eq("mes_ano", mesAlvo);
      if (deleteError) throw deleteError;

      // Insere em lotes de 500 apenas as linhas do mês selecionado
      const chunkSize = 500;
      for (let i = 0; i < rowsDoMes.length; i += chunkSize) {
        const chunk = rowsDoMes.slice(i, i + chunkSize);
        const { error } = await supabase.from("apontamentos").insert(chunk);
        if (error) throw error;
      }

      // Upsert de técnicos
      const tecs = Array.from(
        new Map(
          rowsDoMes.map((r) => [
            r.tecnico_codigo || r.tecnico_nome,
            {
              codigo: r.tecnico_codigo || r.tecnico_nome,
              nome: r.tecnico_nome,
              equipe: r.equipe,
              especialidade: r.especialidade,
            },
          ])
        ).values()
      );
      if (tecs.length) {
        await supabase.from("tecnicos").upsert(tecs, { onConflict: "codigo" });
      }

      setDone(rowsDoMes.length);
      qc.invalidateQueries();
      toast.success(`${rowsDoMes.length} apontamentos de ${formatMesAno(mesAlvo)} importados com sucesso!`);
    } catch (e: any) {
      toast.error("Erro ao importar: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      {/* Navegação */}
      <Link
        to="/financeiro"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
      </Link>

      {/* Cabeçalho */}
      <header>
        <h1 className="font-display text-3xl font-semibold">Upload de Planilha</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe o arquivo{" "}
          <code className="px-1 py-0.5 bg-muted rounded text-xs">MEDIÇÃO_OBR_PRJ.xlsx</code>.
          Os dados do mês selecionado são substituídos; os demais meses permanecem intactos.
        </p>
      </header>

      {/* ── PASSO 1: Seletor de Mês ── */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-secondary" />
          Passo 1 — Selecione o mês de referência
        </div>
        <p className="text-xs text-muted-foreground">
          Somente os dados deste mês serão substituídos no banco. Os demais meses não são afetados.
        </p>
        <Select value={mesAlvo} onValueChange={(v) => { setMesAlvo(v); setDone(null); }}>
          <SelectTrigger className="w-52" id="seletor-mes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMesAno(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* ── PASSO 2: Upload do Arquivo ── */}
      <section className="space-y-2">
        <p className="text-sm font-semibold flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-secondary" />
          Passo 2 — Selecione o arquivo Excel
        </p>
        <label className="block rounded-xl border-2 border-dashed border-border bg-card hover:border-secondary transition-colors cursor-pointer p-12 text-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            id="input-arquivo-excel"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <FileSpreadsheet className="h-12 w-12 mx-auto text-secondary" />
          <p className="mt-3 font-display font-medium">
            {file ? file.name : "Clique para selecionar o arquivo Excel"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">.xlsx ou .xls — primeira aba é usada</p>
        </label>
      </section>

      {/* ── PASSO 3: Preview ── */}
      {preview.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          {/* Cabeçalho do preview */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-semibold">
                Passo 3 — Confirmar importação
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rowsDoMes.length > 0
                  ? `${rowsDoMes.length} linhas para ${formatMesAno(mesAlvo)}`
                  : `Nenhuma linha encontrada para ${formatMesAno(mesAlvo)} nesta planilha`}
                {preview.length !== rowsDoMes.length && (
                  <span className="ml-1 text-muted-foreground/70">
                    ({preview.length - rowsDoMes.length} linha{preview.length - rowsDoMes.length !== 1 ? "s" : ""} de outros meses serão ignoradas)
                  </span>
                )}
              </p>
            </div>
            <Button
              id="btn-abrir-confirmacao"
              onClick={() => setConfirmOpen(true)}
              disabled={uploading || rowsDoMes.length === 0}
            >
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "Importando…" : "Confirmar importação"}
            </Button>
          </div>

          {/* Aviso de inconsistência de meses */}
          {mesesExtras.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-warning">Meses extras detectados na planilha</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A planilha contém dados de:{" "}
                  <strong>{mesesExtras.map(formatMesAno).join(", ")}</strong>.
                  Apenas as linhas de <strong>{formatMesAno(mesAlvo)}</strong> serão importadas.
                </p>
              </div>
            </div>
          )}

          {/* Aviso quando nenhuma linha corresponde ao mês */}
          {rowsDoMes.length === 0 && preview.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <Info className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">Nenhuma linha para {formatMesAno(mesAlvo)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verifique se o mês selecionado está correto. A planilha contém dados de:{" "}
                  <strong>{Array.from(new Set(preview.map((r) => r.mes_ano))).map(formatMesAno).join(", ")}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Tabela de preview */}
          {rowsDoMes.length > 0 && (
            <div className="overflow-auto max-h-96 border border-border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">OS</th>
                    <th className="px-2 py-2 text-left">Técnico</th>
                    <th className="px-2 py-2 text-left">Equipe</th>
                    <th className="px-2 py-2 text-right">Horas</th>
                    <th className="px-2 py-2 text-right">Valor MO</th>
                    <th className="px-2 py-2 text-left">Mês</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsDoMes.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5 font-mono">{r.numero_os}</td>
                      <td className="px-2 py-1.5">{r.tecnico_nome}</td>
                      <td className="px-2 py-1.5">{r.equipe}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.horas_decimais.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.valor_mao_obra.toFixed(2)}</td>
                      <td className="px-2 py-1.5">{formatMesAno(r.mes_ano)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rowsDoMes.length > 50 && (
                <p className="p-2 text-center text-xs text-muted-foreground">
                  … +{rowsDoMes.length - 50} linhas
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Mensagem de sucesso ── */}
      {done && (
        <div className="rounded-lg border border-success/40 bg-success/5 p-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <div>
            <p className="font-display font-semibold">Importação concluída</p>
            <p className="text-sm text-muted-foreground">
              {done} apontamentos de <strong>{formatMesAno(mesAlvo)}</strong> salvos com sucesso.
              Os dados de outros meses permanecem intactos.
            </p>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmação (shadcn Dialog) ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md" id="modal-confirmacao-importacao">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar Importação
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                {/* Mês alvo */}
                <div className="rounded-md border border-border bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Mês de referência</p>
                  <p className="font-display text-xl font-semibold mt-1">
                    📅 {formatMesAno(mesAlvo).toUpperCase()}
                  </p>
                </div>

                {/* Alertas */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <p>
                      Os <strong>{rowsDoMes.length} registros</strong> existentes de{" "}
                      <strong>{formatMesAno(mesAlvo)}</strong> serão{" "}
                      <strong className="text-warning">SUBSTITUÍDOS</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/5 p-2.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <p>
                      Os dados de <strong>todos os outros meses</strong> permanecerão{" "}
                      <strong className="text-green-600 dark:text-green-400">intactos</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              id="btn-cancelar-importacao"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              id="btn-confirmar-importacao"
              onClick={handleImport}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "Importando…" : "Confirmar importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
