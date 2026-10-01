import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  handleGetForEdit,
  handleUpdate,
  updateSchema,
  type EditForm,
  type EditQuestion,
  type EditResponseRecord,
  type GetForEditResult,
  type UpdateResult,
} from "./edit-response";
import { ALLOWED_ORIGINS } from "./submit-response";
import type { Json } from "@/integrations/supabase/types";

const getEditSchema = z.object({
  token: z.string(),
});

/**
 * Função compartilhada de carregamento de inscrição, formulário e perguntas por edit_token (SEC-19).
 * Lança erro genérico caso o banco devolva erro em qualquer uma das três consultas,
 * em vez de tratar incorretamente como "não encontrado".
 */
export async function loadResponseForEditByToken(
  supabase: any,
  token: string,
): Promise<{
  response: EditResponseRecord | null;
  form: EditForm | null;
  questions: EditQuestion[];
}> {
  const { data: response, error: respError } = await supabase
    .from("responses")
    .select("id, form_id, answers, identifier, updated_at")
    .eq("edit_token", token)
    .maybeSingle();

  if (respError) {
    throw new Error("Não foi possível carregar os dados da inscrição.");
  }

  if (!response) {
    return { response: null, form: null, questions: [] };
  }

  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, title, description, status, closes_at, max_responses, theme, success_message, consent_text")
    .eq("id", response.form_id)
    .maybeSingle();

  if (formError) {
    throw new Error("Não foi possível carregar os dados da inscrição.");
  }

  if (!form) {
    return { response: null, form: null, questions: [] };
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, label, help_text, field_type, required, options, position")
    .eq("form_id", form.id)
    .order("position", { ascending: true });

  if (questionsError) {
    throw new Error("Não foi possível carregar os dados da inscrição.");
  }

  const theme = (form.theme ?? {}) as Record<string, unknown>;
  const normalizedForm: EditForm = {
    id: form.id,
    title: form.title,
    description: form.description,
    status: form.status,
    closes_at: form.closes_at,
    max_responses: form.max_responses,
    theme: {
      color: typeof theme["color"] === "string" ? (theme["color"] as string) : "#4f46e5",
      font: typeof theme["font"] === "string" ? (theme["font"] as string) : "body",
      logo_url: typeof theme["logo_url"] === "string" ? (theme["logo_url"] as string) : null,
    },
    success_message: form.success_message,
    consent_text: (form.consent_text as string | null) ?? null,
  };

  const normalizedQuestions: EditQuestion[] = (questions ?? []).map((q: any) => ({
    id: q.id,
    label: q.label,
    help_text: q.help_text,
    field_type: q.field_type,
    required: Boolean(q.required),
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    position: q.position,
  }));

  const normalizedResponse: EditResponseRecord = {
    id: response.id,
    answers: (response.answers ?? {}) as Record<string, unknown>,
    identifier: response.identifier,
    updated_at: response.updated_at,
  };

  return {
    response: normalizedResponse,
    form: normalizedForm,
    questions: normalizedQuestions,
  };
}

export const getResponseForEdit = createServerFn({ method: "POST" })
  .validator((data: unknown) => getEditSchema.parse(data))
  .handler(async ({ data }): Promise<GetForEditResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    return handleGetForEdit(
      {
        loadByToken: (token: string) => loadResponseForEditByToken(supabaseAdmin, token),
        now: () => Date.now(),
        logError: (code, responseId) => {
          console.error(
            `Erro ao carregar resposta para edição: código=${code ?? "UNKNOWN"} responseId=${responseId ?? ""}`,
          );
        },
      },
      data,
    );
  });

export const updateResponseByToken = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data }): Promise<UpdateResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequest } = await import("@tanstack/react-start/server");

    return handleUpdate(
      {
        loadByToken: (token: string) => loadResponseForEditByToken(supabaseAdmin, token),
        rpcUpdateResponse: async ({ token, answers, identifier }) => {
          const { data: resData, error } = await supabaseAdmin.rpc("update_response", {
            p_token: token,
            p_answers: answers as unknown as Json,
            p_identifier: identifier,
          });

          return {
            data: resData as {
              status: string;
              response_id?: string;
              success_message?: string;
            } | null,
            error: error ? { code: error.code, message: error.message } : null,
          };
        },
        fetchFn: fetch,
        getOrigin: () => {
          try {
            const req = getRequest();
            return new URL(req.url).origin;
          } catch {
            return ALLOWED_ORIGINS[0];
          }
        },
        readEnv: (key: string) => process.env[key],
        now: () => Date.now(),
        logError: (code, responseId) => {
          console.error(
            `Erro ao atualizar resposta: código=${code ?? "UNKNOWN"} responseId=${responseId ?? ""}`,
          );
        },
      },
      data,
    );
  });
