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
] as const;

/**
 * Valida a origem para construção do link de edição, prevenindo ataque de Host Header (SEC-04, SEC-10).
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
 * Valida e limpa as respostas de inscrição ou edição (SEC-11, SEC-12, SEC-14, QA-GAP-05, T-09, T-11).
 * - Rejeita tipos não-texto ou listas com itens não-texto (SEC-14);
 * - Aceita lista somente em multi_choice (SEC-12);
 * - Apara espaços em branco de strings e itens de lista (QA-GAP-05);
 * - Valida contra options cadastradas para single_choice e multi_choice (SEC-11);
 * - Ignora opções não-texto e compara strings aparadas.
 */
export function validateAndCleanAnswers(
  questions: SubmissionQuestion[],
  answers: Record<string, unknown>,
):
  | { ok: true; cleanAnswers: Record<string, unknown> }
  | { ok: false; error: string; field: string } {
  const cleanAnswers: Record<string, unknown> = {};

  for (const q of questions) {
    const raw = answers[q.id];

    // Item 18 (SEC-14): rejeita qualquer valor que não seja undefined, null, string ou array de strings
    const isValidType =
      raw === undefined ||
      raw === null ||
      typeof raw === "string" ||
      (Array.isArray(raw) && raw.every((item) => typeof item === "string"));

    if (!isValidType) {
      return {
        ok: false,
        error: GENERIC_SUBMIT_ERROR,
        field: q.id,
      };
    }

    // Item 11 (SEC-12): um valor em lista só é aceito para perguntas do tipo multi_choice.
    // Para qualquer outro tipo, uma lista devolve erro genérico sem lançar exceção.
    if (Array.isArray(raw) && q.field_type !== "multi_choice") {
      return {
        ok: false,
        error: GENERIC_SUBMIT_ERROR,
        field: q.id,
      };
    }

    // Item 13 (QA-GAP-05): antes de validar, aparar (trim) todo valor de texto e cada item das listas.
    let trimmed: unknown = raw;
    if (typeof raw === "string") {
      trimmed = raw.trim();
    } else if (Array.isArray(raw)) {
      trimmed = raw.map((item) => (typeof item === "string" ? item.trim() : item));
    }

    const isEmpty =
      trimmed === undefined ||
      trimmed === null ||
      (typeof trimmed === "string" && trimmed === "") ||
      (Array.isArray(trimmed) && trimmed.length === 0);

    const error = validateAnswer(q.field_type, q.required, trimmed);
    if (error) {
      return {
        ok: false,
        error: `${q.label}: ${error}`,
        field: q.id,
      };
    }

    // Resposta vazia em pergunta não obrigatória continua aceita
    if (isEmpty) {
      continue;
    }

    // Item 16 (SEC-11): validar a escolha contra as opções cadastradas
    if (q.field_type === "single_choice" || q.field_type === "multi_choice") {
      const validOptions = Array.isArray(q.options)
        ? q.options
            .filter((opt): opt is string => typeof opt === "string")
            .map((opt) => opt.trim())
        : [];

      if (q.field_type === "single_choice") {
        if (
          typeof trimmed !== "string" ||
          validOptions.length === 0 ||
          !validOptions.includes(trimmed)
        ) {
          return {
            ok: false,
            error: `${q.label}: Selecione uma das opções disponíveis.`,
            field: q.id,
          };
        }
      } else if (q.field_type === "multi_choice") {
        if (
          !Array.isArray(trimmed) ||
          trimmed.length === 0 ||
          validOptions.length === 0 ||
          trimmed.some((item) => typeof item !== "string" || !validOptions.includes(item))
        ) {
          return {
            ok: false,
            error: `${q.label}: Selecione uma das opções disponíveis.`,
            field: q.id,
          };
        }
      }
    }

    cleanAnswers[q.id] = trimmed;
  }

  return { ok: true, cleanAnswers };
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

  // 2. Carrega formulário e perguntas com tratamento de exceção (SEC-13)
  let form: SubmissionForm | null = null;
  let questions: SubmissionQuestion[] = [];
  try {
    const loaded = await deps.loadFormAndQuestions(data.slug);
    form = loaded.form;
    questions = loaded.questions;
  } catch {
    deps.logError("EXCEPTION", "");
    return {
      ok: false,
      error: "Não foi possível concluir a inscrição. Tente novamente.",
    };
  }

  if (!form || form.status !== "published") {
    return {
      ok: false,
      error: "Este formulário não está disponível.",
    };
  }

  // 3. Valida e limpa cada resposta com validateAndCleanAnswers (SEC-11, SEC-12, QA-GAP-05, Reuso)
  const validationResult = validateAndCleanAnswers(questions, data.answers);
  if (!validationResult.ok) {
    return {
      ok: false,
      error: validationResult.error,
      field: validationResult.field,
    };
  }
  const cleanAnswers = validationResult.cleanAnswers;

  // 4. Identificador (CPF normalizado)
  const cpfQuestion = findIdentifierQuestion(questions);
  const rawCPF = cpfQuestion ? (cleanAnswers[cpfQuestion.id] as string | undefined) : undefined;
  const identifier = normalizeCPF(rawCPF);

  // 5. RPC submit_response no banco com tratamento de exceção (SEC-13)
  let rpcData: {
    status: string;
    edit_token?: string;
    success_message?: string;
    response_id?: string;
  } | null = null;
  let rpcError: { code?: string; message?: string } | null = null;

  try {
    const rpcRes = await deps.rpcSubmitResponse({
      slug: data.slug,
      answers: cleanAnswers,
      identifier,
      consented: Boolean(data.consent),
    });
    rpcData = rpcRes.data;
    rpcError = rpcRes.error;
  } catch {
    deps.logError("EXCEPTION", form.id);
    return {
      ok: false,
      error: "Não foi possível concluir a inscrição. Tente novamente.",
    };
  }

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

  // 7. Monta editUrl com origem segura (SEC-04, SEC-10)
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
