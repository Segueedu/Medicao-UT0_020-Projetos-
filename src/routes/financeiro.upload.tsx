import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { parseExcel, type ApontamentoRow } from "@/lib/excel-utils";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/financeiro/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload de planilha — Medição OBR" }] }),
});

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ApontamentoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const qc = useQueryClient();

  const handleFile = async (f: File) => {
    setFile(f);
    setDone(null);
    try {
      const rows = await parseExcel(f);
      setPreview(rows);
      toast.success(`${rows.length} linhas detectadas`);
    } catch (e: any) {
      toast.error("Falha ao ler planilha: " + e.message);
    }
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setUploading(true);
    try {
      // Para cada mês representado, apaga e re-insere (re-importação idempotente)
      const meses = Array.from(new Set(preview.map((r) => r.mes_ano)));
      for (const m of meses) {
        await supabase.from("apontamentos").delete().eq("mes_ano", m);
      }
      // Insere em lotes de 500
      const chunkSize = 500;
      for (let i = 0; i < preview.length; i += chunkSize) {
        const chunk = preview.slice(i, i + chunkSize);
        const { error } = await supabase.from("apontamentos").insert(chunk);
        if (error) throw error;
      }
      // Upsert técnicos
      const tecs = Array.from(
        new Map(preview.map((r) => [r.tecnico_codigo || r.tecnico_nome, {
          codigo: r.tecnico_codigo || r.tecnico_nome,
          nome: r.tecnico_nome,
          equipe: r.equipe,
          especialidade: r.especialidade,
        }])).values()
      );
      if (tecs.length) await supabase.from("tecnicos").upsert(tecs, { onConflict: "codigo" });

      setDone(preview.length);
      qc.invalidateQueries();
      toast.success(`${preview.length} apontamentos importados`);
    } catch (e: any) {
      toast.error("Erro ao importar: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <Link to="/financeiro" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold">Upload de Planilha</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe o arquivo <code className="px-1 py-0.5 bg-muted rounded text-xs">MEDICÃO_OBR_PRJ.xlsx</code>. Os dados do mês são substituídos a cada nova importação.
        </p>
      </header>

      <label className="block rounded-xl border-2 border-dashed border-border bg-card hover:border-secondary transition-colors cursor-pointer p-12 text-center">
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <FileSpreadsheet className="h-12 w-12 mx-auto text-secondary" />
        <p className="mt-3 font-display font-medium">
          {file ? file.name : "Clique para selecionar o arquivo Excel"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">.xlsx ou .xls — primeira aba é usada</p>
      </label>

      {preview.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-display font-semibold">{preview.length} linhas prontas para importar</p>
              <p className="text-xs text-muted-foreground">
                Meses: {Array.from(new Set(preview.map((r) => r.mes_ano))).join(", ")}
              </p>
            </div>
            <Button onClick={handleImport} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" /> {uploading ? "Importando…" : "Confirmar importação"}
            </Button>
          </div>

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
                {preview.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5 font-mono">{r.numero_os}</td>
                    <td className="px-2 py-1.5">{r.tecnico_nome}</td>
                    <td className="px-2 py-1.5">{r.equipe}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.horas_decimais.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.valor_mao_obra.toFixed(2)}</td>
                    <td className="px-2 py-1.5">{r.mes_ano}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="p-2 text-center text-xs text-muted-foreground">… +{preview.length - 50} linhas</p>
            )}
          </div>
        </div>
      )}

      {done && (
        <div className="rounded-lg border border-success/40 bg-success/5 p-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <div>
            <p className="font-display font-semibold">Importação concluída</p>
            <p className="text-sm text-muted-foreground">{done} apontamentos salvos com sucesso.</p>
          </div>
        </div>
      )}
    </div>
  );
}
