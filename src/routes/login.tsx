import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Área financeira" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/financeiro" },
        });
        if (error) throw error;
        toast.success("Conta criada. Peça a um admin para liberar seu acesso financeiro.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo!");
        navigate({ to: "/financeiro" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-md grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Área financeira</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito · admin / financeiro</p>
          </div>
        </div>

        <form onSubmit={handle} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="hover:text-foreground">
            {mode === "login" ? "Criar conta" : "Já tenho conta"}
          </button>
          <Link to="/" className="hover:text-foreground">← Voltar ao ranking</Link>
        </div>
      </div>
    </div>
  );
}
