import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { getResponseForEdit, updateResponseByToken } from "@/lib/edit-response.functions";
import { QuestionField } from "@/components/QuestionField";
import { validateAnswer } from "@/lib/validators";
import { readableTextColor } from "@/lib/theme";
import type { EditQuestion } from "@/lib/edit-response";

export const Route = createFileRoute("/editar/$token")({
  head: () => ({
    meta: [
      { title: "Editar inscrição" },
      { name: "referrer", content: "no-referrer" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EditFormPage,
});

type Answers = Record<string, string | string[]>;

function EditFormPage() {
  const { token } = useParams({ from: "/editar/$token" });
  const fetchEditData = useServerFn(getResponseForEdit);
  const saveEditData = useServerFn(updateResponseByToken);

  const query = useQuery({
    queryKey: ["edit-response", token],
    queryFn: () => fetchEditData({ data: { token } }),
    staleTime: 0,
    retry: 1,
  });

  const [answers, setAnswers] = useState<Answers>({});
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ emailSent: boolean } | null>(null);

  const successBannerRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (query.data?.state === "open" && !initialized) {
      setAnswers((query.data.answers ?? {}) as Answers);
      setInitialized(true);
    }
  }, [query.data, initialized]);

  useEffect(() => {
    if (success) {
      successBannerRef.current?.focus();
    }
  }, [success]);

  if (query.isLoading) {
    return (
      <Frame>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Carregando dados da inscrição...</p>
        </div>
      </Frame>
    );
  }

  if (query.isError) {
    return (
      <Frame>
        <div className="py-8 text-center">
          <h1 className="font-display text-2xl font-bold">Não foi possível carregar o formulário</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifique sua conexão e tente novamente.
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Tentar de novo
          </button>
        </div>
      </Frame>
    );
  }

  if (query.data?.state === "not_found") {
    return (
      <Frame>
        <div className="py-8 text-center">
          <h1 className="font-display text-2xl font-bold">Inscrição não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifique se o link está correto.
          </p>
        </div>
      </Frame>
    );
  }

  if (query.data?.state === "closed") {
    return (
      <Frame>
        <div className="py-8 text-center">
          <div
            className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-xl select-none"
            aria-hidden="true"
          >
            ⏱
          </div>
          <h1 className="font-display text-2xl font-bold">Edição encerrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este formulário não aceita mais alterações.
          </p>
        </div>
      </Frame>
    );
  }

  if (!query.data || query.data.state !== "open") {
    return null;
  }

  const { form, questions = [] } = query.data;
  const theme = form.theme as { color?: string; font?: string; logo_url?: string | null };
  const accent = theme?.color || "#4f46e5";
  const fontClass =
    theme?.font === "display" ? "font-display" : theme?.font === "serif" ? "font-serif" : "font-body";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setErrors({});
    setSuccess(null); // UX-08: limpar o banner de sucesso anterior ao iniciar um salvamento

    const newErrors: Record<string, string> = {};
    for (const q of questions) {
      if (q.field_type === "cpf") continue; // CPF é somente leitura
      const err = validateAnswer(q.field_type, q.required, answers[q.id]);
      if (err) {
        newErrors[q.id] = err;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstQ = questions.find((q: EditQuestion) => Boolean(newErrors[q.id]));
      if (firstQ) {
        const el = document.getElementById(`field-${firstQ.id}`);
        el?.focus();
      }
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      const res = await saveEditData({
        data: {
          token,
          answers: answers as Record<string, string | string[]>,
        },
      });

      if (res.ok) {
        setSuccess({ emailSent: res.emailSent });
      } else {
        if (res.field && questions.some((q: EditQuestion) => q.id === res.field)) {
          setErrors({ [res.field]: res.error });
          const el = document.getElementById(`field-${res.field}`);
          el?.focus();
        } else {
          // Erro com campo desconhecido ou geral (SEC-16)
          setErrors({ __form: res.error });
          query.refetch();
        }
      }
    } catch {
      setErrors({ __form: "Não foi possível salvar. Tente novamente." });
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Frame>
      <div className={fontClass}>
        {theme?.logo_url && (
          <img
            src={theme.logo_url}
            referrerPolicy="no-referrer"
            alt=""
            className="mx-auto mb-6 max-h-16 w-auto object-contain"
          />
        )}

        <div className="mb-6">
          <span className="inline-block rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Editando inscrição
          </span>
          <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{form.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Altere os campos desejados e clique em &apos;Salvar alterações&apos;.
          </p>
        </div>

        {success && (
          <div
            ref={successBannerRef}
            tabIndex={-1}
            role="status"
            className="mb-6 rounded-xl bg-emerald-500/10 p-4 text-emerald-800 ring-1 ring-emerald-500/20 focus:outline-none"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-base font-bold text-emerald-600" aria-hidden="true">
                ✓
              </span>
              <div>
                <p className="font-semibold text-emerald-900">
                  {success.emailSent
                    ? "Alterações salvas! Enviamos um resumo atualizado para o seu e-mail."
                    : "Alterações salvas!"}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {questions.map((q: EditQuestion) => {
            const isCpf = q.field_type === "cpf";
            return (
              <QuestionField
                key={q.id}
                question={q}
                value={answers[q.id]}
                error={errors[q.id]}
                accent={accent}
                readOnly={isCpf}
                readOnlyNotice={isCpf ? "O CPF não pode ser alterado." : undefined}
                onChange={(val: string | string[]) => {
                  setAnswers((prev) => ({ ...prev, [q.id]: val }));
                  setErrors((prev) => ({ ...prev, [q.id]: "" }));
                }}
              />
            );
          })}

          {errors["__form"] && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-red-800">
              {errors["__form"]}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: accent, color: readableTextColor(accent) }}
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center px-5 py-10 sm:py-16">
      <div className="glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8">{children}</div>
    </div>
  );
}
