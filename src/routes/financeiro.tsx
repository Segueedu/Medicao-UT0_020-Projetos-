import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  const { user, isFinance, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!user) return null;

  if (!isFinance) {
    return (
      <div className="p-10 max-w-xl">
        <h1 className="font-display text-2xl font-semibold">Acesso pendente</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Sua conta foi criada mas ainda não tem permissão financeira. Peça a um administrador para atribuir o papel <code className="px-1 py-0.5 bg-muted rounded">financeiro</code> ou <code className="px-1 py-0.5 bg-muted rounded">admin</code> ao seu usuário.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          ID do seu usuário: <code className="font-mono">{user.id}</code>
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-secondary hover:underline">← Voltar ao ranking</Link>
      </div>
    );
  }

  return <Outlet />;
}
