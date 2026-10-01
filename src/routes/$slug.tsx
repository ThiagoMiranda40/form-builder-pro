import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { getPublicForm, submitResponse } from "@/lib/public-forms.functions";
import { applyMask, validateAnswer, type FieldType } from "@/lib/validators";
import { readableTextColor } from "@/lib/theme";
import { findEmailQuestion } from "@/lib/inscricao";
import {
  suggestEmail,
  checkEmailConfirmation,
  shouldSyncConfirmation,
} from "@/lib/email-hints";
import { buildFormMeta } from "@/lib/site-meta";
import { normalizeDescription } from "@/lib/description";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    try {
      return await getPublicForm({ data: { slug: params.slug } });
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const meta = buildFormMeta(loaderData);
    return {
      meta: [
        { title: meta.title },
        {
          name: "description",
          content: meta.description,
        },
        { property: "og:title", content: meta.ogTitle },
        { property: "og:description", content: meta.ogDescription },
      ],
    };
  },
  component: PublicForm,
});

type Answers = Record<string, string | string[]>;

type DoneState = {
  message: string;
  editUrl?: string | undefined;
  emailSent: boolean;
};

function PublicForm() {
  const { slug } = useParams({ from: "/$slug" });
  const fetchForm = useServerFn(getPublicForm);
  const send = useServerFn(submitResponse);

  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailSuggestions, setEmailSuggestions] = useState<Record<string, string | null>>({});
  const [emailConfirmations, setEmailConfirmations] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<DoneState | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const successTitleRef = useRef<HTMLHeadingElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (done) {
      successTitleRef.current?.focus();
    }
  }, [done]);

  const query = useQuery({
    queryKey: ["public-form", slug],
    queryFn: () => fetchForm({ data: { slug } }),
  });

  if (query.isLoading) {
    return (
      <Frame>
        <p className="text-sm text-muted-foreground">Carregando formulário...</p>
      </Frame>
    );
  }

  if (query.isError) {
    return (
      <Frame>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Não foi possível carregar o formulário
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente.
        </p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-brand/90"
        >
          Tentar de novo
        </button>
      </Frame>
    );
  }

  const data = query.data;
  if (!data || data.state !== "open" || !data.form || !data.questions) {
    const messages: Record<string, { title: string; body: string }> = {
      not_found: { title: "Formulário não encontrado", body: "Verifique se o link está correto." },
      draft: {
        title: "Formulário indisponível",
        body: "Este formulário ainda não foi publicado pelo organizador.",
      },
      closed: { title: "Inscrições encerradas", body: "Este formulário não está mais recebendo inscrições." },
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

  async function handleCopy() {
    if (!done?.editUrl) return;
    setCopyError(false);
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(done.editUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  if (done) {
    const emailQuestion = findEmailQuestion(questions);
    const emailAddress = emailQuestion
      ? String(answers[emailQuestion.id] ?? "").trim()
      : "";

    return (
      <Frame>
        <div role="status" className={`text-center ${fontClass}`}>
          <div
            className="mx-auto grid size-12 place-items-center rounded-full text-xl font-bold"
            style={{ backgroundColor: accent, color: readableTextColor(accent) }}
          >
            ✓
          </div>
          <h1
            ref={successTitleRef}
            tabIndex={-1}
            className="mt-4 font-display text-2xl font-semibold tracking-tight outline-none"
          >
            Tudo certo!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{done.message}</p>

          {done.emailSent && emailQuestion && (
            <div className="mt-6 rounded-xl bg-emerald-50 p-5 text-left ring-1 ring-emerald-200">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 size-5 shrink-0 text-emerald-800"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-emerald-950">
                    Enviamos um resumo e o link para o seu e-mail.
                  </p>
                  <p className="text-sm text-emerald-900">
                    Enviado para: <strong className="font-bold break-all">{emailAddress}</strong>
                  </p>
                  <p className="text-xs text-emerald-800">
                    Não chegou? Procure na caixa de spam ou lixo eletrônico.
                  </p>
                </div>
              </div>
            </div>
          )}

          {done.editUrl && (
            <div className="mt-6 rounded-xl bg-white/70 p-5 text-left ring-1 ring-black/5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Link para editar sua inscrição:
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 rounded-lg bg-white/80 p-2.5 font-mono text-xs text-foreground ring-1 ring-black/5 break-all select-all">
                  {done.editUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg bg-brand px-3 py-2.5 text-xs font-medium text-primary-foreground hover:bg-brand/90 shrink-0"
                >
                  {copied ? "Link copiado!" : "Copiar link"}
                </button>
              </div>
              {copyError && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  Não foi possível copiar. Selecione o link acima e copie manualmente.
                </p>
              )}
              <div className="mt-4 rounded-lg bg-amber-50/80 p-3 text-xs text-amber-900 ring-1 ring-amber-200/60">
                <span className="font-semibold">Guarde este link.</span> Ele é a única forma de você corrigir seus dados caso precise.
              </div>
            </div>
          )}

          {!done.emailSent && emailQuestion && (
            <div className="mt-4 rounded-lg bg-amber-50/80 p-3 text-left text-xs text-amber-900 ring-1 ring-amber-200/60">
              Não conseguimos enviar o e-mail agora. Guarde o link acima: é a sua forma de corrigir seus dados.
            </div>
          )}
        </div>
      </Frame>
    );
  }

  function setValue(id: string, type: FieldType, raw: string) {
    setAnswers((prev) => ({ ...prev, [id]: applyMask(type, raw) }));
    setErrors((prev) => ({ ...prev, [id]: "", [`confirm-${id}`]: "" }));
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
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      const nextErrors: Record<string, string> = {};
      for (const q of questions) {
        const message = validateAnswer(q.field_type as FieldType, q.required, answers[q.id]);
        if (message) nextErrors[q.id] = message;

        if (q.field_type === "email") {
          const emailVal = ((answers[q.id] as string) || "").trim();
          const confirmVal = (emailConfirmations[q.id] || "").trim();
          const mismatch = checkEmailConfirmation(emailVal, confirmVal);
          if (mismatch) {
            nextErrors[`confirm-${q.id}`] = mismatch;
          }
        }
      }
      if (form.consent_text && !consent) {
        nextErrors["__consent"] = "É necessário aceitar o termo para continuar.";
      }
      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        const firstFieldId = Object.keys(nextErrors)[0];
        if (firstFieldId === "__consent") {
          document.getElementById("consent-checkbox")?.focus();
        } else if (firstFieldId?.startsWith("confirm-")) {
          document.getElementById(`field-${firstFieldId}`)?.focus();
        } else if (firstFieldId) {
          document.getElementById(`field-${firstFieldId}`)?.focus();
        }
        return;
      }

      setSending(true);
      const result = await send({ data: { slug, answers, consent, hp } });
      if (!result.ok) {
        const isKnownField =
          Boolean(result.field) &&
          (result.field === "__consent" || questions.some((q) => q.id === result.field));

        if (isKnownField && result.field) {
          setErrors({ [result.field]: result.error ?? "Resposta inválida." });
          if (result.field === "__consent") {
            document.getElementById("consent-checkbox")?.focus();
          } else {
            document.getElementById(`field-${result.field}`)?.focus();
          }
        } else {
          setErrors({ __form: result.error ?? "Não foi possível enviar." });
          query.refetch();
        }
        return;
      }
      setDone({
        message: result.message || "Inscrição confirmada!",
        editUrl: result.editUrl,
        emailSent: Boolean(result.emailSent),
      });
    } catch {
      setErrors({ __form: "Não foi possível enviar sua inscrição. Tente novamente." });
    } finally {
      isSubmittingRef.current = false;
      setSending(false);
    }
  }

  const remaining =
    form.max_responses != null ? Math.max(0, form.max_responses - form.responses_count) : null;
  const description = normalizeDescription(form.description);

  return (
    <Frame>
      <div className={fontClass}>
        {theme?.logo_url && (
          <img
            src={theme.logo_url}
            alt=""
            referrerPolicy="no-referrer"
            className="mb-5 h-12 w-auto object-contain"
          />
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {form.title}
        </h1>
        {description && (
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">
            {description}
          </p>
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
          {/* Campo invisível armadilha anti-robô (RF-09, SEC-09, T-10) */}
          <input
            type="text"
            name="hp"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              opacity: 0,
              height: 0,
              width: 0,
              pointerEvents: "none",
            }}
          />

          {questions.map((q) => {
            const type = q.field_type as FieldType;
            const value = answers[q.id];
            const error = errors[q.id];
            const fieldId = `field-${q.id}`;
            const errorId = `error-${q.id}`;
            const labelId = `label-${q.id}`;
            const isChoice = type === "single_choice" || type === "multi_choice";

            return (
              <div key={q.id}>
                {isChoice ? (
                  <span id={labelId} className="mb-1.5 block text-sm font-medium">
                    {q.label}
                    {q.required && <span className="ml-1" style={{ color: accent }}>*</span>}
                  </span>
                ) : (
                  <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium">
                    {q.label}
                    {q.required && <span className="ml-1" style={{ color: accent }}>*</span>}
                  </label>
                )}
                {q.help_text && (
                  <p className="mb-1.5 text-xs text-muted-foreground">{q.help_text}</p>
                )}

                {type === "long_text" ? (
                  <textarea
                    id={fieldId}
                    rows={4}
                    value={(value as string) ?? ""}
                    onChange={(e) => setValue(q.id, type, e.target.value)}
                    maxLength={2000}
                    className={fieldClass}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                  />
                ) : type === "single_choice" ? (
                  <div
                    className="space-y-2"
                    role="radiogroup"
                    aria-labelledby={labelId}
                    aria-describedby={error ? errorId : undefined}
                  >
                    {(q.options as string[]).map((option, optIdx) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2.5 text-sm ring-1 ring-black/5"
                      >
                        <input
                          id={optIdx === 0 ? fieldId : undefined}
                          type="radio"
                          name={q.id}
                          checked={value === option}
                          onChange={() => {
                            setAnswers((prev) => ({ ...prev, [q.id]: option }));
                            setErrors((prev) => ({ ...prev, [q.id]: "" }));
                          }}
                          className="size-4"
                          style={{ accentColor: accent }}
                          aria-invalid={Boolean(error)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : type === "multi_choice" ? (
                  <div
                    className="space-y-2"
                    role="group"
                    aria-labelledby={labelId}
                    aria-describedby={error ? errorId : undefined}
                  >
                    {(q.options as string[]).map((option, optIdx) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2.5 text-sm ring-1 ring-black/5"
                      >
                        <input
                          id={optIdx === 0 ? fieldId : undefined}
                          type="checkbox"
                          checked={Array.isArray(value) && value.includes(option)}
                          onChange={() => toggleMulti(q.id, option)}
                          className="size-4"
                          style={{ accentColor: accent }}
                          aria-invalid={Boolean(error)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    id={fieldId}
                    type={
                      type === "date"
                        ? "date"
                        : type === "number"
                          ? "number"
                          : type === "email"
                            ? "email"
                            : "text"
                    }
                    inputMode={
                      type === "number" || type === "phone" || type === "cpf" ? "numeric" : undefined
                    }
                    value={(value as string) ?? ""}
                    onChange={(e) => {
                      setValue(q.id, type, e.target.value);
                      if (type === "email") {
                        setEmailSuggestions((prev) => ({ ...prev, [q.id]: null }));
                      }
                    }}
                    onBlur={(e) => {
                      if (type === "email") {
                        const hint = suggestEmail(e.target.value);
                        setEmailSuggestions((prev) => ({ ...prev, [q.id]: hint }));
                      }
                    }}
                    maxLength={255}
                    placeholder={placeholders[type]}
                    className={fieldClass}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                  />
                )}

                {type === "email" && emailSuggestions[q.id] && (
                  <div
                    aria-live="polite"
                    className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span>
                      Você quis dizer{" "}
                      <strong className="font-semibold text-foreground">
                        {emailSuggestions[q.id]}
                      </strong>
                      ?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = emailSuggestions[q.id];
                        if (suggested) {
                          const prevMain = (answers[q.id] as string) || "";
                          const prevConfirm = emailConfirmations[q.id] || "";
                          setValue(q.id, type, suggested);
                          if (shouldSyncConfirmation(prevMain, prevConfirm)) {
                            setEmailConfirmations((prev) => ({ ...prev, [q.id]: suggested }));
                          }
                          setEmailSuggestions((prev) => ({ ...prev, [q.id]: null }));
                        }
                      }}
                      className="font-medium underline hover:text-foreground"
                      style={{ color: accent }}
                    >
                      Usar este endereço
                    </button>
                  </div>
                )}

                {error && (
                  <p id={errorId} role="alert" className="mt-1.5 text-xs text-destructive">
                    {error}
                  </p>
                )}

                {type === "email" && (
                  <div className="mt-3">
                    <label
                      htmlFor={`field-confirm-${q.id}`}
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Confirme seu e-mail
                      {q.required && (
                        <span className="ml-1" style={{ color: accent }}>
                          *
                        </span>
                      )}
                    </label>
                    <input
                      id={`field-confirm-${q.id}`}
                      type="email"
                      value={emailConfirmations[q.id] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEmailConfirmations((prev) => ({ ...prev, [q.id]: val }));
                        setErrors((prev) => ({ ...prev, [`confirm-${q.id}`]: "" }));
                      }}
                      placeholder={placeholders[type]}
                      className={fieldClass}
                      aria-invalid={Boolean(errors[`confirm-${q.id}`])}
                      aria-describedby={
                        errors[`confirm-${q.id}`] ? `error-confirm-${q.id}` : undefined
                      }
                    />
                    {errors[`confirm-${q.id}`] && (
                      <p
                        id={`error-confirm-${q.id}`}
                        role="alert"
                        className="mt-1.5 text-xs text-destructive"
                      >
                        {errors[`confirm-${q.id}`]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Caixa de consentimento (RF-08, T-10, T-17) */}
          {form.consent_text && (
            <div className="rounded-xl bg-white/70 p-4 ring-1 ring-black/5">
              <p className="mb-2 text-xs text-muted-foreground whitespace-pre-line">
                {form.consent_text}
              </p>
              <p className="mb-3 text-xs text-slate-700">
                Leia os{" "}
                <a
                  href="/legal/termos-de-uso"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-slate-900 underline hover:text-foreground"
                >
                  Termos de Uso
                  <span className="sr-only"> (abre em outra aba)</span>
                </a>{" "}
                e a{" "}
                <a
                  href="/legal/politica-de-privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-slate-900 underline hover:text-foreground"
                >
                  Política de Privacidade
                  <span className="sr-only"> (abre em outra aba)</span>
                </a>
                .
              </p>
              <label htmlFor="consent-checkbox" className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  id="consent-checkbox"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    setErrors((prev) => ({ ...prev, __consent: "" }));
                  }}
                  className="mt-0.5 size-4"
                  style={{ accentColor: accent }}
                  aria-invalid={Boolean(errors["__consent"])}
                  aria-describedby={errors["__consent"] ? "error-consent" : undefined}
                />
                <span>
                  Declaro que li e concordo com os termos acima, com os Termos de Uso e com a Política de Privacidade.
                  <span className="ml-1" style={{ color: accent }}>*</span>
                </span>
              </label>
              {errors["__consent"] && (
                <p id="error-consent" role="alert" className="mt-1.5 text-xs text-destructive">
                  {errors["__consent"]}
                </p>
              )}
            </div>
          )}

          {errors["__form"] && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-red-800">
              {errors["__form"]}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-lg py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: accent, color: readableTextColor(accent) }}
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
    <div className="flex min-h-screen flex-col items-center justify-start px-5 py-10 sm:py-16">
      <div className="glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8">{children}</div>
      <nav aria-label="Documentos legais" className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <a
          href="/legal/termos-de-uso"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Termos de Uso
          <span className="sr-only"> (abre em outra aba)</span>
        </a>
        <span>·</span>
        <a
          href="/legal/politica-de-privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Política de Privacidade
          <span className="sr-only"> (abre em outra aba)</span>
        </a>
      </nav>
    </div>
  );
}
