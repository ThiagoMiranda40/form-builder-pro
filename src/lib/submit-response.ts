import { z } from "zod";
import { validateAnswer } from "./validators";
import {
  findEmailQuestion,
  findIdentifierQuestion,
  isHoneypotFilled,
  mapSubmitStatus,
  normalizeCPF,
} from "./inscricao";
import {
  buildConfirmationEmail,
  isSafeRecipient,
  sendConfirmationEmail,
} from "./confirmation-email";

export const ALLOWED_ORIGINS = [
  "https://inscricoes.triadetecnologiaesolucoes.com.br",
  "http://localhost:8080",
] as const;

/**
 * Valida a origem para construção do link de edição, prevenindo ataque de Host Header (SEC-04).
 * Qualquer origem fora da lista permitida é substituída pela origem padrão.
 */
export function getOrigin(rawOrigin?: string): string {
  if (!rawOrigin) return ALLOWED_ORIGINS[0];
  const cleaned = rawOrigin.replace(/\/+$/, "");
  if ((ALLOWED_ORIGINS as readonly string[]).includes(cleaned)) {
    return cleaned;
  }
  return ALLOWED_ORIGINS[0];
}

const GENERIC_SUBMIT_ERROR = "Não foi possível enviar. Verifique os campos e tente novamente.";

const answerValueSchema = z.union([
  z.string().max(10000, GENERIC_SUBMIT_ERROR),
  z.array(z.string().max(10000, GENERIC_SUBMIT_ERROR)),
]);

export const submitSchema = z
  .object({
    slug: z.string().min(1).max(120),
    answers: z.record(answerValueSchema),
    consent: z.boolean().optional().default(false),
    hp: z.string().optional().default(""),
  })
  .superRefine((data, ctx) => {
    const keys = Object.keys(data.answers);
    if (keys.length > 200) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: GENERIC_SUBMIT_ERROR,
        path: ["answers"],
      });
      return;
    }
    for (const key of keys) {
      if (key.length > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: GENERIC_SUBMIT_ERROR,
          path: ["answers", key],
        });
        return;
      }
    }
    const serialized = JSON.stringify(data.answers);
    if (serialized.length > 100 * 1024) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: GENERIC_SUBMIT_ERROR,
        path: ["answers"],
      });
      return;
    }
  });

export type SubmitInput = z.infer<typeof submitSchema>;

export type SubmitResult =
  | { ok: true; message: string; editUrl?: string; emailSent: boolean }
  | { ok: false; error: string; field?: string };

export interface SubmissionForm {
  id: string;
  title: string;
  status: string;
  closes_at: string | null;
  max_responses: number | null;
  success_message: string;
  consent_text: string | null;
}

export interface SubmissionQuestion {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  options: string[];
  position: number;
}

export interface SubmissionDeps {
  loadFormAndQuestions: (slug: string) => Promise<{
    form: SubmissionForm | null;
    questions: SubmissionQuestion[];
  }>;
  rpcSubmitResponse: (args: {
    slug: string;
    answers: Record<string, unknown>;
    identifier: string | null;
    consented: boolean;
  }) => Promise<{
    data: {
      status: string;
      edit_token?: string;
      success_message?: string;
      response_id?: string;
    } | null;
    error: { code?: string; message?: string } | null;
  }>;
  fetchFn: typeof fetch;
  getOrigin: () => string;
  readEnv: (key: string) => string | undefined;
  logError: (code: string | undefined, formId: string) => void;
}

/**
 * Cria um wrapper sobre a função fetch adicionando timeout via AbortSignal (T-09).
 */
export function createTimedFetch(
  baseFetch: typeof fetch = fetch,
  timeoutMs = 5000,
): typeof fetch {
  return (url, init) => {
    return baseFetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
    });
  };
}

/**
 * Executa o fluxo de submissão de inscrição no servidor com regras atômicas no banco (T-09).
 */
export async function handleSubmission(
  deps: SubmissionDeps,
  input: SubmitInput,
): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: GENERIC_SUBMIT_ERROR,
    };
  }
  const data = parsed.data;

  // 1. Honeypot (RF-09): responde sucesso sem gravar e sem chamar o rpc
  if (isHoneypotFilled(data.hp)) {
    return {
      ok: true,
      message: "Inscrição confirmada!",
      emailSent: false,
    };
  }

  // 2. Carrega formulário e perguntas
  const { form, questions } = await deps.loadFormAndQuestions(data.slug);
  if (!form || form.status !== "published") {
    return {
      ok: false,
      error: "Este formulário não está disponível.",
    };
  }

  // 3. Valida cada resposta com validateAnswer
  const cleanAnswers: Record<string, unknown> = {};
  for (const q of questions) {
    const raw = data.answers[q.id];
    const error = validateAnswer(q.field_type, q.required, raw);
    if (error) {
      return {
        ok: false,
        error: `${q.label}: ${error}`,
        field: q.id,
      };
    }
    if (raw !== undefined && raw !== null && raw !== "") {
      cleanAnswers[q.id] = raw;
    }
  }

  // 4. Identificador (CPF normalizado)
  const cpfQuestion = findIdentifierQuestion(questions);
  const rawCPF = cpfQuestion ? (cleanAnswers[cpfQuestion.id] as string | undefined) : undefined;
  const identifier = normalizeCPF(rawCPF);

  // 5. RPC submit_response no banco
  const { data: rpcData, error: rpcError } = await deps.rpcSubmitResponse({
    slug: data.slug,
    answers: cleanAnswers,
    identifier,
    consented: Boolean(data.consent),
  });

  if (rpcError || !rpcData) {
    // Higiene de logs (SEC-03): registra apenas código do erro e id do formulário
    deps.logError(rpcError?.code, form.id);
    return {
      ok: false,
      error: "Não foi possível concluir a inscrição. Tente novamente.",
    };
  }

  // 6. Mapeamento de status
  const mapped = mapSubmitStatus(rpcData.status);
  if (!mapped.ok) {
    let errorField = mapped.field;
    if (errorField === "cpf") {
      errorField = cpfQuestion?.id ?? "cpf";
    }
    return {
      ok: false,
      error: mapped.error ?? "Não foi possível concluir a inscrição. Tente novamente.",
      ...(errorField ? { field: errorField } : {}),
    };
  }

  // 7. Monta editUrl com origem segura
  const rawOrigin = deps.getOrigin();
  const safeOrigin = getOrigin(rawOrigin);
  const editUrl = rpcData.edit_token ? `${safeOrigin}/editar/${rpcData.edit_token}` : undefined;

  // 8. E-mail de confirmação com tempo limite
  let emailSent = false;
  const emailQuestion = findEmailQuestion(questions);
  const recipientEmail = emailQuestion ? (cleanAnswers[emailQuestion.id] as string | undefined) : undefined;
  const apiKey = deps.readEnv("RESEND_API_KEY");
  const from = deps.readEnv("EMAIL_FROM");

  if (recipientEmail && isSafeRecipient(recipientEmail) && apiKey && from && editUrl) {
    const emailContent = buildConfirmationEmail({
      form: { title: form.title },
      questions,
      answers: cleanAnswers,
      editUrl,
      kind: "confirmada",
    });

    const timedFetch = createTimedFetch(deps.fetchFn, 5000);
    try {
      emailSent = await sendConfirmationEmail({
        fetchFn: timedFetch,
        apiKey,
        from,
        to: recipientEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    } catch {
      emailSent = false;
    }
  }

  // 9. Retorno com sucesso (sem expor edit_token fora da editUrl)
  return {
    ok: true,
    message: rpcData.success_message || form.success_message || "Inscrição confirmada!",
    ...(editUrl ? { editUrl } : {}),
    emailSent,
  };
}
