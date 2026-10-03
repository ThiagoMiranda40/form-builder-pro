import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ALLOWED_ORIGINS,
  handleSubmission,
  submitSchema,
  type SubmitResult,
} from "./submit-response";

import { resolvePublicState } from "./form-state";

import type { Json } from "@/integrations/supabase/types";

export type { SubmitResult };

export type PublicQuestion = {
  id: string;
  label: string;
  help_text: string;
  field_type: string;
  required: boolean;
  options: string[];
  position: number;
};

export type PublicFormPayload = {
  state: "open" | "closed" | "full" | "not_found" | "draft";
  form?: {
    id: string;
    title: string;
    description: string;
    theme: { color: string; font: string; logo_url: string | null };
    max_responses: number | null;
    closes_at: string | null;
    success_message: string;
    consent_text: string | null;
    responses_count: number;
  };
  questions?: PublicQuestion[];
};

const slugSchema = z.object({ slug: z.string().min(1).max(120) });

/**
 * Carrega formulário e perguntas para a submissão pública (SEC-19).
 * Lança erro genérico caso o banco devolva erro, sem expor mensagens internas.
 */
export async function loadPublicFormAndQuestions(
  supabase: any,
  slug: string,
): Promise<{
  form: {
    id: string;
    title: string;
    status: string;
    closes_at: string | null;
    max_responses: number | null;
    success_message: string;
    consent_text: string | null;
  } | null;
  questions: PublicQuestion[];
}> {
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, title, status, closes_at, max_responses, success_message, consent_text")
    .eq("slug", slug)
    .maybeSingle();

  if (formError) {
    throw new Error("Não foi possível carregar o formulário.");
  }

  if (!form) return { form: null, questions: [] };

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, label, help_text, field_type, required, options, position")
    .eq("form_id", form.id)
    .order("position", { ascending: true });

  if (questionsError) {
    throw new Error("Não foi possível carregar o formulário.");
  }

  return {
    form: {
      id: form.id,
      title: form.title,
      status: form.status,
      closes_at: form.closes_at,
      max_responses: form.max_responses,
      success_message: form.success_message,
      consent_text: (form.consent_text as string | null) ?? null,
    },
    questions: (questions ?? []).map((q: any) => ({
      id: q.id,
      label: q.label,
      help_text: q.help_text ?? "",
      field_type: q.field_type,
      required: Boolean(q.required),
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      position: q.position,
    })),
  };
}

export const getPublicForm = createServerFn({ method: "GET" })
  .validator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }): Promise<PublicFormPayload> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: form, error: formError } = await supabaseAdmin
      .from("forms")
      .select("id, title, description, status, closes_at, max_responses, theme, success_message, consent_text")
      .eq("slug", data.slug)
      .maybeSingle();

    if (formError) {
      throw new Error("Não foi possível carregar o formulário.");
    }

    if (!form) return { state: "not_found" };
    if (form.status !== "published") {
      return { state: resolvePublicState(form, 0, new Date()) };
    }

    const { count, error: countError } = await supabaseAdmin
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("form_id", form.id);

    if (countError) {
      throw new Error("Não foi possível carregar o formulário.");
    }

    const responsesCount = count ?? 0;
    const theme = (form.theme ?? {}) as Record<string, unknown>;

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id,label,help_text,field_type,required,options,position")
      .eq("form_id", form.id)
      .order("position", { ascending: true });

    if (questionsError) {
      throw new Error("Não foi possível carregar o formulário.");
    }

    const state = resolvePublicState(form, responsesCount, new Date());

    return {
      state,
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        theme: {
          color: typeof theme["color"] === "string" ? (theme["color"] as string) : "#4f46e5",
          font: typeof theme["font"] === "string" ? (theme["font"] as string) : "body",
          logo_url: typeof theme["logo_url"] === "string" ? (theme["logo_url"] as string) : null,
        },
        max_responses: form.max_responses,
        closes_at: form.closes_at,
        success_message: form.success_message,
        consent_text: (form.consent_text as string | null) ?? null,
        responses_count: responsesCount,
      },
      questions: (questions ?? []).map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
      })),
    };
  });

export const submitResponse = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequest } = await import("@tanstack/react-start/server");

    return handleSubmission(
      {
        loadFormAndQuestions: (slug: string) => loadPublicFormAndQuestions(supabaseAdmin, slug),
        rpcSubmitResponse: async ({ slug, answers, identifier, consented }) => {
          const { data: resData, error } = await supabaseAdmin.rpc("submit_response", {
            p_slug: slug,
            p_answers: answers as unknown as Json,
            p_identifier: identifier,
            p_consented: consented,
          });

          return {
            data: resData as {
              status: string;
              edit_token?: string;
              success_message?: string;
              response_id?: string;
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
        logError: (code, formId) => {
          console.error(`Erro ao gravar resposta: código=${code ?? "UNKNOWN"} formId=${formId}`);
        },
      },
      data,
    );
  });
