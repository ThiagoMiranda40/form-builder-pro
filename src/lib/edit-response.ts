import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { answersSchema, createTimedFetch, getOrigin, validateAndCleanAnswers } from "./submit-response";
import { findEmailQuestion, findIdentifierQuestion, hideDocument } from "./inscricao";
import { applyMask } from "./validators";
import {
  buildConfirmationEmail,
  isSafeRecipient,
  sendConfirmationEmail,
} from "./confirmation-email";

export const editTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/);

export const updateSchema = z.object({
  token: editTokenSchema,
  answers: answersSchema,
});

export type UpdateInput = z.infer<typeof updateSchema>;

export type EditAnswerValue = string | string[];
export type EditAnswers = Record<string, EditAnswerValue>;

export type GetForEditResult =
  | {
      state: "open";
      form: EditForm;
      questions: EditQuestion[];
      answers: EditAnswers;
    }
  | {
      state: "closed" | "not_found";
      form?: EditForm;
      questions?: EditQuestion[];
      answers?: EditAnswers;
    };

export type UpdateResult =
  | { ok: true; emailSent: boolean }
  | { ok: false; error: string; field?: string };

export interface EditForm {
  id: string;
  title: string;
  description?: string;
  status: string;
  closes_at: string | null;
  max_responses: number | null;
  theme?: {
    color?: string;
    font?: string;
    logo_url?: string | null;
  };
  success_message?: string;
  consent_text?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  event_location?: string | null;
}

export interface EditQuestion {
  id: string;
  label: string;
  help_text?: string;
  field_type: string;
  required: boolean;
  options: string[];
  position: number;
  settings?: Json;
}

export interface EditResponseRecord {
  id: string;
  answers: Record<string, unknown>;
  identifier: string | null;
  updated_at: string;
}

export interface EditGetDeps {
  loadByToken: (token: string) => Promise<{
    response: EditResponseRecord | null;
    form: EditForm | null;
    questions: EditQuestion[];
  }>;
  now?: () => number;
  logError?: (code: string | undefined, responseId?: string) => void;
}

export interface EditUpdateDeps {
  loadByToken: (token: string) => Promise<{
    response: EditResponseRecord | null;
    form: EditForm | null;
    questions: EditQuestion[];
  }>;
  rpcUpdateResponse: (args: {
    token: string;
    answers: Record<string, unknown>;
    identifier: string | null;
  }) => Promise<{
    data: { status: string; success_message?: string; response_id?: string } | null;
    error: { code?: string; message?: string } | null;
  }>;
  fetchFn: typeof fetch;
  getOrigin: () => string;
  readEnv: (key: string) => string | undefined;
  now?: () => number;
  logError: (code: string | undefined, responseId?: string) => void;
}

/**
 * Avalia se o e-mail de atualização pode ser enviado (SEC-04).
 * Retorna true somente se decorreram 10 minutos (600.000 ms) ou mais desde a última alteração/inscrição.
 * Se a data for inválida ou estiver no futuro, retorna false.
 */
export function shouldSendUpdateEmail(
  prevUpdatedAt: string | Date | number | null | undefined,
  now: number | Date,
  windowMs = 600000,
): boolean {
  if (!prevUpdatedAt) return false;
  if (typeof prevUpdatedAt === "string" && prevUpdatedAt.trim() === "") return false;

  const prevTime =
    typeof prevUpdatedAt === "number"
      ? prevUpdatedAt
      : new Date(prevUpdatedAt).getTime();
  const nowTime = typeof now === "number" ? now : new Date(now).getTime();

  if (isNaN(prevTime) || isNaN(nowTime)) return false;
  if (prevTime > nowTime) return false;

  return nowTime - prevTime >= windowMs;
}

/**
 * Carrega formulário, perguntas e respostas para a página de edição (RF-06, SEC-17, SEC-18, SEC-19, SEC-20).
 * PRIVACIDADE (SEC-17, SEC-20): Apenas respostas de perguntas existentes são devolvidas; qualquer valor
 * cujos dígitos sejam iguais ao CPF guardado é mascarado com hideDocument (ex.: ***.***.***-25),
 * e o CPF completo ou o edit_token nunca saem do servidor.
 */
export async function handleGetForEdit(
  deps: EditGetDeps,
  input: { token: string },
): Promise<GetForEditResult> {
  const parsed = editTokenSchema.safeParse(input.token);
  if (!parsed.success) {
    return { state: "not_found" };
  }

  let response: EditResponseRecord | null = null;
  let form: EditForm | null = null;
  let questions: EditQuestion[] = [];

  try {
    const loaded = await deps.loadByToken(parsed.data);
    response = loaded.response;
    form = loaded.form;
    questions = loaded.questions;
  } catch {
    deps.logError?.("EXCEPTION", "");
    throw new Error("Não foi possível carregar o formulário.");
  }

  if (!response || !form) {
    return { state: "not_found" };
  }

  const currentTime = deps.now ? deps.now() : Date.now();
  const isClosed =
    form.status !== "published" ||
    (form.closes_at !== null && new Date(form.closes_at).getTime() < currentTime);

  if (isClosed) {
    return { state: "closed" };
  }

  // Prepara as respostas (SEC-17, SEC-20):
  // 1. Devolve só respostas de perguntas que existem atualmente no formulário.
  // 2. Mascara com hideDocument qualquer valor, de qualquer tipo de pergunta, cujos dígitos sejam iguais ao identifier.
  const maskedAnswers: EditAnswers = {};
  const identifierDigits = response.identifier ? response.identifier.replace(/\D/g, "") : "";

  for (const q of questions) {
    const rawVal = response.answers?.[q.id];
    if (rawVal === undefined || rawVal === null) continue;

    if (typeof rawVal === "string") {
      const rawDigits = rawVal.replace(/\D/g, "");
      const isIdentifierMatch = identifierDigits !== "" && rawDigits === identifierDigits;
      if (isIdentifierMatch || q.field_type === "cpf") {
        maskedAnswers[q.id] = hideDocument(applyMask("cpf", rawVal));
      } else {
        maskedAnswers[q.id] = rawVal;
      }
    } else if (Array.isArray(rawVal) && rawVal.every((i) => typeof i === "string")) {
      maskedAnswers[q.id] = (rawVal as string[]).map((item) => {
        const itemDigits = item.replace(/\D/g, "");
        if (identifierDigits !== "" && itemDigits === identifierDigits) {
          return hideDocument(applyMask("cpf", item));
        }
        return item;
      });
    }
  }

  return {
    state: "open",
    form,
    questions,
    answers: maskedAnswers,
  };
}

/**
 * Atualiza as respostas do inscrito via RPC segura (RF-06, SEC-04, SEC-11, SEC-12, SEC-13, SEC-17, SEC-18, SEC-19).
 */
export async function handleUpdate(
  deps: EditUpdateDeps,
  input: { token: string; answers: Record<string, unknown> },
): Promise<UpdateResult> {
  const parsed = editTokenSchema.safeParse(input.token);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Inscrição não encontrada. Verifique se o link está correto.",
    };
  }

  let responseIdForLog = "";

  try {
    const { response, form, questions } = await deps.loadByToken(parsed.data);
    if (!response || !form) {
      return {
        ok: false,
        error: "Inscrição não encontrada. Verifique se o link está correto.",
      };
    }

    responseIdForLog = response.id;
    const prevUpdatedAt = response.updated_at;

    const currentTime = deps.now ? deps.now() : Date.now();
    const isClosed =
      form.status !== "published" ||
      (form.closes_at !== null && new Date(form.closes_at).getTime() < currentTime);

    if (isClosed) {
      return {
        ok: false,
        error: "Este formulário não aceita mais alterações.",
      };
    }

    // CPF handling (SEC-17, SEC-21): o valor do CPF enviado pelo navegador é ignorado.
    // O valor original guardado na inscrição prevalece. Toda pergunta cuja resposta guardada
    // tem dígitos iguais ao identifier da inscrição (ou seja de field_type === "cpf") é tratada como CPF.
    const identifierDigits = response.identifier ? response.identifier.replace(/\D/g, "") : "";

    const isCpfQuestion = (q: EditQuestion): boolean => {
      if (q.field_type === "cpf") return true;
      const savedVal = response.answers?.[q.id];
      if (typeof savedVal === "string") {
        const savedDigits = savedVal.replace(/\D/g, "");
        if (identifierDigits !== "" && savedDigits === identifierDigits) {
          return true;
        }
      }
      return false;
    };

    const finalAnswers: Record<string, unknown> = { ...input.answers };
    for (const q of questions) {
      if (isCpfQuestion(q)) {
        if (response.answers && response.answers[q.id] !== undefined) {
          finalAnswers[q.id] = response.answers[q.id];
        } else {
          delete finalAnswers[q.id];
        }
      }
    }

    // Na edição, a pergunta de CPF não é obrigatória para que perguntas adicionadas
    // posteriormente não travem a edição de quem se inscreveu antes.
    const questionsForValidation = questions.map((q) =>
      isCpfQuestion(q) ? { ...q, required: false } : q,
    );

    const validationResult = validateAndCleanAnswers(questionsForValidation, finalAnswers, {
      eventDate: form.event_date ?? null,
      previousAnswers: (response.answers as Record<string, unknown>) ?? undefined,
    });
    if (!validationResult.ok) {
      return {
        ok: false,
        error: validationResult.error,
        field: validationResult.field,
      };
    }

    const cleanAnswers = validationResult.cleanAnswers;
    // Garante que o CPF guardado original é mantido intacto em cleanAnswers
    for (const q of questions) {
      if (isCpfQuestion(q) && response.answers && response.answers[q.id] !== undefined) {
        cleanAnswers[q.id] = response.answers[q.id];
      }
    }

    const rpcResult = await deps.rpcUpdateResponse({
      token: parsed.data,
      answers: cleanAnswers,
      identifier: response.identifier,
    });

    if (rpcResult.error) {
      deps.logError(rpcResult.error.code ?? "RPC_ERROR", response.id);
      return {
        ok: false,
        error: "Não foi possível salvar. Tente novamente.",
      };
    }

    const status = rpcResult.data?.status;
    if (status === "not_found") {
      return {
        ok: false,
        error: "Inscrição não encontrada. Verifique se o link está correto.",
      };
    }
    if (status === "closed") {
      return {
        ok: false,
        error: "Este formulário não aceita mais alterações.",
      };
    }
    if (status === "identifier_locked") {
      const cpfQ = findIdentifierQuestion(questions);
      return {
        ok: false,
        error: "O CPF não pode ser alterado.",
        ...(cpfQ ? { field: cpfQ.id } : {}),
      };
    }
    if (status !== "ok") {
      deps.logError(status ?? "UNKNOWN_STATUS", response.id);
      return {
        ok: false,
        error: "Não foi possível salvar. Tente novamente.",
      };
    }

    // Envio condicional de e-mail de atualização (SEC-04)
    let emailSent = false;
    const now = deps.now ? deps.now() : Date.now();
    if (shouldSendUpdateEmail(prevUpdatedAt, now)) {
      const emailQ = findEmailQuestion(questions);
      const recipientEmail = emailQ ? (cleanAnswers[emailQ.id] as string | undefined) : undefined;
      const apiKey = deps.readEnv("RESEND_API_KEY");
      const from = deps.readEnv("EMAIL_FROM");
      const rawOrigin = deps.getOrigin();
      const safeOrigin = getOrigin(rawOrigin);
      const editUrl = `${safeOrigin}/editar/${parsed.data}`;

      if (recipientEmail && isSafeRecipient(recipientEmail) && apiKey && from && editUrl) {
        const emailContent = buildConfirmationEmail({
          form: { title: form.title },
          questions,
          answers: cleanAnswers,
          editUrl,
          kind: "atualizada",
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
    }

    return {
      ok: true,
      emailSent,
    };
  } catch {
    deps.logError("EXCEPTION", responseIdForLog);
    return {
      ok: false,
      error: "Não foi possível salvar. Tente novamente.",
    };
  }
}
