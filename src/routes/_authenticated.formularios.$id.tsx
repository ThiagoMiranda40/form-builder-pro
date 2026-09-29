import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FIELD_TYPES, type FieldType } from "@/lib/validators";
import { StatusPill } from "./_authenticated.painel";

export const Route = createFileRoute("/_authenticated/formularios/$id")({
  head: () => ({
    meta: [
      { title: "Editor de formulário — FormulárioLab" },
      {
        name: "description",
        content:
          "Monte as perguntas, escolha tipos de campo, personalize cores e defina limites de respostas e prazo.",
      },
      { property: "og:title", content: "Editor de formulário — FormulárioLab" },
      { property: "og:description", content: "Monte perguntas, personalize e publique." },
    ],
  }),
  component: Editor,
});

type Question = {
  id: string;
  label: string;
  help_text: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
  position: number;
};

type Theme = { color: string; font: string; logo_url: string | null };

type FormState = {
  title: string;
  description: string;
  slug: string;
  status: string;
  theme: Theme;
  max_responses: number | null;
  closes_at: string | null;
  success_message: string;
};

const toLocalInput = (value: string | null) =>
  value ? new Date(new Date(value).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "";

function Editor() {
  const { id } = useParams({ from: "/_authenticated/formularios/$id" });
  const [form, setForm] = useState<FormState | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"pergunta" | "aparencia" | "limites">("pergunta");
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["form", id],
    queryFn: async () => {
      const [formRes, questionsRes] = await Promise.all([
        supabase.from("forms").select("*").eq("id", id).single(),
        supabase.from("questions").select("*").eq("form_id", id).order("position"),
      ]);
      if (formRes.error) throw formRes.error;
      if (questionsRes.error) throw questionsRes.error;
      return { form: formRes.data, questions: questionsRes.data ?? [] };
    },
  });

  useEffect(() => {
    if (!query.data) return;
    const f = query.data.form as Record<string, unknown>;
    setForm({
      title: f["title"] as string,
      description: (f["description"] as string) ?? "",
      slug: f["slug"] as string,
      status: f["status"] as string,
      theme: (f["theme"] as Theme) ?? { color: "#4f46e5", font: "body", logo_url: null },
      max_responses: (f["max_responses"] as number | null) ?? null,
      closes_at: (f["closes_at"] as string | null) ?? null,
      success_message: (f["success_message"] as string) ?? "",
    });
    setQuestions(
      (query.data.questions as Record<string, unknown>[]).map((q) => ({
        id: q["id"] as string,
        label: (q["label"] as string) ?? "",
        help_text: (q["help_text"] as string) ?? "",
        field_type: q["field_type"] as FieldType,
        required: Boolean(q["required"]),
        options: ((q["options"] as string[]) ?? []) as string[],
        position: (q["position"] as number) ?? 0,
      })),
    );
    setSelected((prev) => prev ?? ((query.data.questions[0] as { id?: string } | undefined)?.id ?? null));
  }, [query.data]);

  const publicUrl = form ? `${typeof window !== "undefined" ? window.location.origin : ""}/f/${form.slug}` : "";
  const current = questions.find((q) => q.id === selected) ?? null;

  function patchQuestion(patch: Partial<Question>) {
    if (!current) return;
    setQuestions((list) => list.map((q) => (q.id === current.id ? { ...q, ...patch } : q)));
  }

  async function addQuestion() {
    const { data, error } = await supabase
      .from("questions")
      .insert({
        form_id: id,
        label: "Nova pergunta",
        field_type: "short_text",
        position: questions.length,
      })
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Não foi possível adicionar a pergunta.");
      return;
    }
    setQuestions((list) => [
      ...list,
      {
        id: data.id as string,
        label: "Nova pergunta",
        help_text: "",
        field_type: "short_text",
        required: false,
        options: [],
        position: list.length,
      },
    ]);
    setSelected(data.id as string);
    setTab("pergunta");
  }

  async function removeQuestion(questionId: string) {
    const { error } = await supabase.from("questions").delete().eq("id", questionId);
    if (error) {
      toast.error("Não foi possível excluir a pergunta.");
      return;
    }
    setQuestions((list) => list.filter((q) => q.id !== questionId));
    if (selected === questionId) setSelected(null);
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setQuestions(next.map((q, i) => ({ ...q, position: i })));
  }

  async function save(nextStatus?: string) {
    if (!form) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("forms")
        .update({
          title: form.title.trim() || "Sem título",
          description: form.description,
          theme: form.theme,
          max_responses: form.max_responses,
          closes_at: form.closes_at,
          success_message: form.success_message,
          status: nextStatus ?? form.status,
        })
        .eq("id", id);
      if (error) throw error;

      for (const q of questions) {
        const { error: qError } = await supabase
          .from("questions")
          .update({
            label: q.label.trim() || "Pergunta",
            help_text: q.help_text,
            field_type: q.field_type,
            required: q.required,
            options: q.options,
            position: q.position,
          })
          .eq("id", q.id);
        if (qError) throw qError;
      }
      if (nextStatus) setForm({ ...form, status: nextStatus });
      toast.success(
        nextStatus === "published"
          ? "Formulário publicado! O link já pode ser compartilhado."
          : nextStatus === "closed"
            ? "Formulário encerrado."
            : "Alterações salvas.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (query.isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Carregando formulário...</p>;
  }

  return (
    <section className="rise space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/painel" className="text-sm text-muted-foreground hover:text-foreground">
          ← Painel
        </Link>
        <StatusPill status={form.status} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            to="/formularios/$id/respostas"
            params={{ id }}
            className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white"
          >
            Ver respostas
          </Link>
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {form.status === "published" ? (
            <button
              onClick={() => save("closed")}
              className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white"
            >
              Encerrar
            </button>
          ) : (
            <button
              onClick={() => save("published")}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90"
            >
              Publicar
            </button>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <p className="text-xs text-muted-foreground">Link de compartilhamento</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-white/80 px-3 py-2 text-xs ring-1 ring-black/5">
            {publicUrl}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Link copiado!");
            }}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-brand/90"
          >
            Copiar link
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/70 px-3 py-2 text-xs font-medium ring-1 ring-black/5 hover:bg-white"
          >
            Abrir
          </a>
        </div>
        {form.status !== "published" && (
          <p className="mt-2 text-xs text-amber-600">
            Publique o formulário para que o link aceite respostas.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-2xl p-5">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={120}
            className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight focus:outline-none"
            placeholder="Título do formulário"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={1000}
            rows={2}
            className="mt-2 w-full resize-none bg-transparent text-sm text-muted-foreground focus:outline-none"
            placeholder="Descrição exibida para quem for se inscrever"
          />

          <div className="mt-5 space-y-3">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => {
                  setSelected(q.id);
                  setTab("pergunta");
                }}
                className={`w-full rounded-xl bg-white/70 p-4 text-left ring-1 transition-colors ${
                  selected === q.id ? "ring-brand/50" : "ring-black/5 hover:ring-black/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-brand-soft text-xs font-semibold text-brand">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {q.label || "Pergunta sem título"}
                      {q.required && <span className="ml-1 text-destructive">*</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {FIELD_TYPES.find((t) => t.value === q.field_type)?.label ?? q.field_type}
                      {q.help_text ? ` · ${q.help_text}` : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        move(index, -1);
                      }}
                      className="rounded px-1 hover:bg-black/5"
                    >
                      ↑
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        move(index, 1);
                      }}
                      className="rounded px-1 hover:bg-black/5"
                    >
                      ↓
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeQuestion(q.id);
                      }}
                      className="rounded px-1 hover:bg-black/5 hover:text-destructive"
                    >
                      ✕
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={addQuestion}
            className="mt-4 w-full rounded-xl border border-dashed border-brand/40 bg-white/40 py-3 text-sm font-medium text-brand hover:bg-white/70"
          >
            + Adicionar pergunta
          </button>
        </div>

        <aside className="glass rounded-2xl p-5">
          <div className="mb-4 flex gap-1 rounded-lg bg-white/60 p-1 text-xs">
            {(["pergunta", "aparencia", "limites"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium capitalize transition-colors ${
                  tab === key ? "bg-brand text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {key === "aparencia" ? "Aparência" : key === "limites" ? "Limites" : "Pergunta"}
              </button>
            ))}
          </div>

          {tab === "pergunta" &&
            (current ? (
              <div className="space-y-4">
                <Field label="Rótulo da pergunta">
                  <input
                    value={current.label}
                    onChange={(e) => patchQuestion({ label: e.target.value })}
                    maxLength={200}
                    className={inputClass}
                  />
                </Field>
                <Field label="Texto de ajuda">
                  <input
                    value={current.help_text}
                    onChange={(e) => patchQuestion({ help_text: e.target.value })}
                    maxLength={200}
                    className={inputClass}
                    placeholder="Opcional"
                  />
                </Field>
                <Field label="Tipo de campo">
                  <select
                    value={current.field_type}
                    onChange={(e) => patchQuestion({ field_type: e.target.value as FieldType })}
                    className={inputClass}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={current.required}
                    onChange={(e) => patchQuestion({ required: e.target.checked })}
                    className="size-4 accent-[var(--brand)]"
                  />
                  Resposta obrigatória
                </label>
                {(current.field_type === "single_choice" || current.field_type === "multi_choice") && (
                  <Field label="Opções (uma por linha)">
                    <textarea
                      rows={5}
                      value={current.options.join("\n")}
                      onChange={(e) =>
                        patchQuestion({
                          options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean),
                        })
                      }
                      className={inputClass}
                      placeholder={"Opção A\nOpção B"}
                    />
                  </Field>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione uma pergunta para editar seus detalhes.
              </p>
            ))}

          {tab === "aparencia" && (
            <div className="space-y-4">
              <Field label="Cor principal">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.theme.color}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, color: e.target.value } })}
                    className="h-9 w-12 rounded-md ring-1 ring-black/5"
                  />
                  <input
                    value={form.theme.color}
                    onChange={(e) => setForm({ ...form, theme: { ...form.theme, color: e.target.value } })}
                    className={inputClass}
                  />
                </div>
              </Field>
              <Field label="Fonte">
                <select
                  value={form.theme.font}
                  onChange={(e) => setForm({ ...form, theme: { ...form.theme, font: e.target.value } })}
                  className={inputClass}
                >
                  <option value="body">Inter (moderna)</option>
                  <option value="display">Space Grotesk (destaque)</option>
                  <option value="serif">Serifada (clássica)</option>
                </select>
              </Field>
              <Field label="URL do logotipo">
                <input
                  value={form.theme.logo_url ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, theme: { ...form.theme, logo_url: e.target.value || null } })
                  }
                  maxLength={500}
                  className={inputClass}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Mensagem de sucesso">
                <textarea
                  rows={3}
                  value={form.success_message}
                  onChange={(e) => setForm({ ...form, success_message: e.target.value })}
                  maxLength={300}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {tab === "limites" && (
            <div className="space-y-4">
              <Field label="Limite de respostas / vagas">
                <input
                  type="number"
                  min={1}
                  value={form.max_responses ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, max_responses: e.target.value ? Number(e.target.value) : null })
                  }
                  className={inputClass}
                  placeholder="Deixe vazio para ilimitado"
                />
              </Field>
              <Field label="Prazo final (data e hora)">
                <input
                  type="datetime-local"
                  value={toLocalInput(form.closes_at)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      closes_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Ao atingir o limite de respostas ou o prazo, o formulário deixa de aceitar novas
                inscrições automaticamente.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

const inputClass =
  "w-full rounded-lg bg-white/80 px-3 py-2 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
