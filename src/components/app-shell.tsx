import { Link, useRouterState } from "@tanstack/react-router";
import { HardHat, LayoutDashboard, LogIn, LogOut, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Ranking", icon: HardHat, public: true },
  { to: "/financeiro", label: "Dashboard", icon: LayoutDashboard, finance: true },
  { to: "/financeiro/upload", label: "Upload", icon: Upload, finance: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isFinance } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-secondary grid place-items-center font-display font-bold text-secondary-foreground">M</div>
            <div>
              <p className="font-display font-semibold leading-tight">Medição OBR</p>
              <p className="text-xs text-sidebar-foreground/60">Gestão de equipes</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            if (item.finance && !isFinance) return null;
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          ) : (
            <Link
              to="/login"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
            >
              <LogIn className="h-4 w-4" /> Área financeira
            </Link>
          )}
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
