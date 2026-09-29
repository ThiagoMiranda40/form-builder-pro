import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPublicForm, submitResponse } from "@/lib/public-forms.functions";
import { applyMask, validateAnswer, type FieldType } from "@/lib/validators";

export const Route = createFileRoute("/f/$slug")({
  head: () => ({
    meta: [
      { title: "Formulário de inscrição" },
      {
        name: "description",
        content: "Preencha seus dados para concluir a inscrição neste formulário.",
      },
      { property: "og:title", content: "Formulário de inscrição" },
      { property: "og:description", content: "Preencha seus dados para concluir a inscrição." },
    ],
  }),
  component: PublicForm,
});

type Answers = Record<string, string | string[]>;

function PublicForm() {
  const { slug } = useParams({ from: "/f/$slug" });
  const fetchForm = useServerFn(getPublicForm);
  const send = useServerFn(submitResponse);

  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["public-form", slug],
    queryFn: () => fetchForm({ data: { slug } }),
  });

  if (query.isLoading) {
    return <Frame>
      <p className="text-sm text-muted-foreground">Carregando formulário...</p>
    </Frame>;
  }

  const data = query.data;
  if (!data || data.state !== "open") {
    const messages: Record<string, { title: string; body: string }> = {
      not_found: { title: "Formulário não encontrado", body: "Verifique se o link está correto." },
      draft: {
        title: "Formulário indisponível",
        body: "Este formulário ainda não foi publicado pelo organizador.",
      },
      closed: { title: "Inscrições encerradas", body: "O prazo para este formulário já terminou." },
      full: {
        title: "Vagas esgotadas",
        body: "O limite de inscrições deste formulário já foi atingido.",
      },
    };
    const item = messages[data?.state ?? "not_found"] ?? messages["not_found"]!;
    return (
      <Frame>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{item.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
      </Frame>
    );
  }

  const { form, questions } = data;
  const theme = form.theme as { color: string; font: string; logo_url: string | null };
  const accent = theme?.color || "#4f46e5";
  const fontClass =
    theme?.font === "display" ? "font-display" : theme?.font === "serif" ? "font-serif" : "font-body";

  if (done) {
    return (
      <Frame>
        <div className="text-center">
          <div
            className="mx-auto grid size-12 place-items-center rounded-full text-xl text-white"
            style={{ backgroundColor: accent }}
          >
            ✓
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Tudo certo!</h1>
          <p className="mt-2 text-sm text-muted-foreground">{done}</p>
        </div>
      </Frame>
    );
  }

  function setValue(id: string, type: FieldType, raw: string) {
    setAnswers((prev) => ({ ...prev, [id]: applyMask(type, raw) }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  }

  function toggleMulti(id: string, option: string) {
    setAnswers((prev) => {
      const list = Array.isArray(prev[id]) ? [...(prev[id] as string[])] : [];
      const index = list.indexOf(option);
      if (index >= 0) list.splice(index, 1);
      else list.push(option);
      return { ...prev, [id]: list };
    });
    setErrors((prev) => ({ ...prev, [id]: "" }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const q of questions) {
      const message = validateAnswer(q.field_type as FieldType, q.required, answers[q.id]);
      if (message) nextErrors[q.id] = message;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSending(true);
    try {
      const result = await send({ data: { slug, answers } });
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: result.error ?? "Resposta inválida." });
        else setErrors({ __form: result.error ?? "Não foi possível enviar." });
        return;
      }
      setDone(result.success_message ?? "Inscrição enviada com sucesso!");
    } catch {
      setErrors({ __form: "Não foi possível enviar sua inscrição. Tente novamente." });
    } finally {
      setSending(false);
    }
  }

  const remaining =
    form.max_responses != null ? Math.max(0, form.max_responses - form.responses_count) : null;

  return (
    <Frame>
      <div className={fontClass}>
        {theme?.logo_url && (
          <img src={theme.logo_url} alt="" className="mb-5 h-12 w-auto object-contain" />
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {form.title}
        </h1>
        {form.description && (
          <p className="mt-2 text-sm text-muted-foreground">{form.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {remaining != null && (
            <span className="rounded-full bg-white/70 px-2.5 py-1 ring-1 ring-black/5">
              {remaining} vaga(s) restante(s)
            </span>
          )}
          {form.closes_at && (
            <span className="rounded-full bg-white/70 px-2.5 py-1 ring-1 ring-black/5">
              Prazo:{" "}
              {new Date(form.closes_at).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {questions.map((q) => {
            const type = q.field_type as FieldType;
            const value = answers[q.id];
            const error = errors[q.id];
            return (
              <div key={q.id}>
                <label className="mb-1.5 block text-sm font-medium">
                  {q.label}
                  {q.required && <span className="ml-1" style={{ color: accent }}>*</span>}
                </label>
                {q.help_text && (
                  <p className="mb-1.5 text-xs text-muted-foreground">{q.help_text}</p>
                )}

                {type === "long_text" ? (
                  <textarea
                    rows={4}
                    value={(value as string) ?? ""}
                    onChange={(e) => setValue(q.id, type, e.target.value)}
                    maxLength={2000}
                    className={fieldClass}
                  />
                ) : type === "single_choice" ? (
                  <div className="space-y-2">
                    {(q.options as string[]).map((option) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2.5 text-sm ring-1 ring-black/5"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={value === option}
                          onChange={() => {
                            setAnswers((prev) => ({ ...prev, [q.id]: option }));
                            setErrors((prev) => ({ ...prev, [q.id]: "" }));
                          }}
                          className="size-4"
                          style={{ accentColor: accent }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : type === "multi_choice" ? (
                  <div className="space-y-2">
                    {(q.options as string[]).map((option) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2.5 text-sm ring-1 ring-black/5"
                      >
                        <input
                          type="checkbox"
                          checked={Array.isArray(value) && value.includes(option)}
                          onChange={() => toggleMulti(q.id, option)}
                          className="size-4"
                          style={{ accentColor: accent }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type={type === "date" ? "date" : type === "number" ? "number" : "text"}
                    inputMode={
                      type === "number" || type === "phone" || type === "cpf" ? "numeric" : undefined
                    }
                    value={(value as string) ?? ""}
                    onChange={(e) => setValue(q.id, type, e.target.value)}
                    maxLength={255}
                    placeholder={placeholders[type]}
                    className={fieldClass}
                  />
                )}

                {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
              </div>
            );
          })}

          {errors["__form"] && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors["__form"]}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-lg py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            {sending ? "Enviando..." : "Enviar inscrição"}
          </button>
        </form>
      </div>
    </Frame>
  );
}

const fieldClass =
  "w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none";

const placeholders: Partial<Record<FieldType, string>> = {
  cpf: "000.000.000-00",
  phone: "(11) 99999-9999",
  rg: "00.000.000-0",
  email: "voce@exemplo.com",
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center px-5 py-10 sm:py-16">
      <div className="glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8">{children}</div>
    </div>
  );
}
