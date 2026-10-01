import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { slug } from "@/lib/slug";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — FormulárioLab" },
      {
        name: "description",
        content: "Crie, acompanhe e publique seus formulários de inscrição em um só lugar.",
      },
      { property: "og:title", content: "Painel — FormulárioLab" },
      { property: "og:description", content: "Seus formulários de inscrição e respostas." },
    ],
  }),
  component: Painel,
});

type FormRow = {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: string;
  max_responses: number | null;
  closes_at: string | null;
  created_at: string;
};

function Painel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const formsQuery = useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id,title,description,slug,status,max_responses,closes_at,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FormRow[];
    },
  });

  const statsQuery = useQuery({
    queryKey: ["form-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responses")
        .select("form_id,submitted_at");
      if (error) throw error;
      return (data ?? []) as { form_id: string; submitted_at: string }[];
    },
  });

  const createForm = useMutation({
    mutationFn: async () => {
      const title = "Novo formulário";
      const { data, error } = await supabase
        .from("forms")
        .insert({
          owner_id: user!.id,
          title,
          slug: `${slug(title)}-${Math.random().toString(36).slice(2, 8)}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("questions").insert([
        { form_id: data.id, label: "Nome completo", field_type: "short_text", required: true, position: 0 },
        { form_id: data.id, label: "E-mail", field_type: "email", required: true, position: 1 },
      ]);
      return data.id as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      navigate({ to: "/formularios/$id", params: { id } });
    },
    onError: () => toast.error("Não foi possível criar o formulário."),
  });

  const removeForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Formulário excluído.");
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: () => toast.error("Não foi possível excluir."),
  });

  const forms = formsQuery.data ?? [];
  const responses = statsQuery.data ?? [];
  const countFor = (id: string) => responses.filter((r) => r.form_id === id).length;

  const published = forms.filter((f) => f.status === "published").length;
  const closingSoon = forms.filter(
    (f) =>
      f.closes_at &&
      new Date(f.closes_at).getTime() > Date.now() &&
      new Date(f.closes_at).getTime() < Date.now() + 3 * 864e5,
  ).length;

  const perDay = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - i));
    const next = new Date(day.getTime() + 864e5);
    return {
      label: ["D", "S", "T", "Q", "Q", "S", "S"][day.getDay()]!,
      total: responses.filter((r) => {
        const t = new Date(r.submitted_at).getTime();
        return t >= day.getTime() && t < next.getTime();
      }).length,
    };
  });
  const peak = Math.max(1, ...perDay.map((d) => d.total));

  return (
    <section className="rise">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Painel do administrador
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Formulários de inscrição
          </h1>
        </div>
        <button
          onClick={() => createForm.mutate()}
          disabled={createForm.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand py-2 pr-3 pl-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 transition-colors hover:bg-brand/90 disabled:opacity-60"
        >
          <span className="grid size-4 place-items-center text-lg leading-none">+</span>
          Novo formulário
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Formulários publicados" value={String(published)} hint={`${forms.length} no total`} />
        <Stat label="Respostas totais" value={String(responses.length)} hint="em todos os formulários" />
        <Stat
          label="Respostas nos 7 dias"
          value={String(perDay.reduce((a, d) => a + d.total, 0))}
          hint="última semana"
        />
        <Stat label="Prazos próximos" value={String(closingSoon)} hint="encerram em 3 dias" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Formulários</h2>
            <span className="text-xs text-muted-foreground">Mais recentes primeiro</span>
          </div>

          {formsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : forms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não criou formulários. Clique em “Novo formulário” para começar.
            </p>
          ) : (
            <div className="space-y-3">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl bg-white/70 p-3 ring-1 ring-black/5"
                >
                  <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft font-display font-semibold text-brand">
                    {form.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/formularios/$id"
                      params={{ id: form.id }}
                      className="block truncate text-sm font-medium hover:text-brand"
                    >
                      {form.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {form.max_responses ? `limite ${form.max_responses} respostas` : "sem limite"}
                      {form.closes_at
                        ? ` · encerra ${new Date(form.closes_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                        : " · sem prazo"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-base font-semibold">{countFor(form.id)}</p>
                    <p className="text-xs text-muted-foreground">respostas</p>
                  </div>
                  <StatusPill status={form.status} />
                  <div className="flex items-center gap-2 text-xs">
                    <Link
                      to="/formularios/$id/respostas"
                      params={{ id: form.id }}
                      className="font-medium text-brand hover:text-brand/80"
                    >
                      Respostas
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir “${form.title}” e todas as respostas?`))
                          removeForm.mutate(form.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="mb-4 font-display text-base font-semibold">Respostas por dia</h2>
          <div className="flex h-32 items-end gap-2">
            {perDay.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-brand"
                  style={{ height: `${Math.max(6, (d.total / peak) * 100)}%`, opacity: 0.35 + (d.total / peak) * 0.65 }}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Rascunho", className: "bg-slate-100 text-slate-500 ring-slate-200" },
    published: { label: "Aberto", className: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
    closed: { label: "Encerrado", className: "bg-amber-50 text-amber-600 ring-amber-100" },
  };
  const item = map[status] ?? map["draft"]!;
  return (
    <span className={`rounded-full px-2 py-1 text-xs ring-1 ${item.className}`}>{item.label}</span>
  );
}
