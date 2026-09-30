import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — FormulárioLab" },
      {
        name: "description",
        content: "Acesse sua área de administrador para criar e acompanhar formulários de inscrição.",
      },
      { property: "og:title", content: "Entrar — FormulárioLab" },
      {
        property: "og:description",
        content: "Acesse sua área de administrador do FormulárioLab.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/painel" });
  }, [loading, session, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/painel" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rise">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-[10px] bg-brand font-display text-sm font-semibold text-primary-foreground">
            F
          </div>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Formulário<span className="text-brand">Lab</span>
          </span>
        </Link>

        <div className="glass-strong rounded-2xl p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Área do administrador
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            Entrar
          </h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                className="w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"
                placeholder="voce@exemplo.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
