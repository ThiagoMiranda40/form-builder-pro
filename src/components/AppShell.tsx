import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { initials, useAuth } from "@/hooks/useAuth";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 glass-strong ring-1 ring-black/5">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-5 sm:px-8">
          <Link to="/painel" className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-[10px] bg-brand font-display text-sm font-semibold text-primary-foreground">
              F
            </div>
            <span className="font-display text-[15px] font-semibold tracking-tight">
              Formulário<span className="text-brand">Lab</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 text-sm md:flex">
            <Link
              to="/painel"
              className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
              activeProps={{ className: "rounded-lg px-3 py-1.5 bg-white/70 font-medium text-foreground ring-1 ring-black/5" }}
              activeOptions={{ exact: true }}
            >
              Painel
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sair
            </button>
            <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-xs font-semibold text-white">
              {initials(user?.email)}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] space-y-8 px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
