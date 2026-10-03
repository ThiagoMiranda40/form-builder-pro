import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateShareToken, isValidShareToken } from "./share";

const createShareSchema = z.object({
  formId: z.string().uuid(),
  regenerate: z.boolean().optional(),
});

const revokeShareSchema = z.object({
  formId: z.string().uuid(),
});

const getSharedSchema = z.object({
  token: z.string(),
});

export type CreateShareResult =
  | { ok: true; shareToken: string }
  | { ok: false; error: string };

export type RevokeShareResult =
  | { ok: true }
  | { ok: false; error: string };

export type SharedQuestion = {
  id: string;
  label: string;
  field_type: string;
  position: number;
};

export type SharedResponse = {
  id: string;
  answers: Record<string, string | string[]>;
  submitted_at: string;
  updated_at: string | null;
};

export type SharedResponsesPayload =
  | {
      state: "ok";
      form: {
        title: string;
        max_responses: number | null;
        closes_at: string | null;
        status: string;
        responses_count: number;
      };
      questions: SharedQuestion[];
      responses: SharedResponse[];
    }
  | { state: "not_found" };

/**
 * Cria ou recupera o link do cliente (somente leitura).
 * Autenticada pelo middleware, confere que o usuário é dono do formulário.
 */
export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createShareSchema.parse(data))
  .handler(async ({ data, context }): Promise<CreateShareResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as any)?.userId;

    if (!userId) {
      return { ok: false, error: "Formulário não encontrado." };
    }

    try {
      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select("id, owner_id, share_token")
        .eq("id", data.formId)
        .maybeSingle();

      if (formError || !form || form.owner_id !== userId) {
        if (formError) {
          console.error(
            `Erro ao buscar form para share_token: código=${formError.code ?? "UNKNOWN"} formId=${data.formId}`
          );
        }
        return { ok: false, error: "Formulário não encontrado." };
      }

      // Se já existe e não pediu regeneração, devolve o existente
      if (form.share_token && !data.regenerate) {
        return { ok: true, shareToken: form.share_token };
      }

      // Gera novo token seguro e grava filtrando por id e owner_id
      const newToken = generateShareToken();
      const { error: updateError } = await supabaseAdmin
        .from("forms")
        .update({ share_token: newToken })
        .eq("id", data.formId)
        .eq("owner_id", userId);

      if (updateError) {
        console.error(
          `Erro ao atualizar share_token: código=${updateError.code ?? "UNKNOWN"} formId=${data.formId}`
        );
        return { ok: false, error: "Não foi possível gerar o link de compartilhamento." };
      }

      return { ok: true, shareToken: newToken };
    } catch (err: any) {
      console.error(
        `Exceção ao criar share_token: código=EXCEPTION formId=${data.formId}`
      );
      return { ok: false, error: "Não foi possível gerar o link de compartilhamento." };
    }
  });

/**
 * Revoga o link do cliente, definindo share_token = null.
 * Autenticada pelo middleware, confere que o usuário é dono do formulário.
 */
export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => revokeShareSchema.parse(data))
  .handler(async ({ data, context }): Promise<RevokeShareResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as any)?.userId;

    if (!userId) {
      return { ok: false, error: "Formulário não encontrado." };
    }

    try {
      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select("id, owner_id")
        .eq("id", data.formId)
        .maybeSingle();

      if (formError || !form || form.owner_id !== userId) {
        if (formError) {
          console.error(
            `Erro ao buscar form para revogar share_token: código=${formError.code ?? "UNKNOWN"} formId=${data.formId}`
          );
        }
        return { ok: false, error: "Formulário não encontrado." };
      }

      const { error: updateError } = await supabaseAdmin
        .from("forms")
        .update({ share_token: null })
        .eq("id", data.formId)
        .eq("owner_id", userId);

      if (updateError) {
        console.error(
          `Erro ao revogar share_token: código=${updateError.code ?? "UNKNOWN"} formId=${data.formId}`
        );
        return { ok: false, error: "Não foi possível desativar o link." };
      }

      return { ok: true };
    } catch (err: any) {
      console.error(
        `Exceção ao revogar share_token: código=EXCEPTION formId=${data.formId}`
      );
      return { ok: false, error: "Não foi possível desativar o link." };
    }
  });

/**
 * Consulta pública de respostas via share_token.
 * Não autenticada (pública), valida token e busca respostas com lista explícita de colunas.
 */
export const getSharedResponses = createServerFn({ method: "POST" })
  .validator((data: unknown) => getSharedSchema.parse(data))
  .handler(async ({ data }): Promise<SharedResponsesPayload> => {
    // 1. Validação estrita de formato sem consultar o banco
    if (!isValidShareToken(data.token)) {
      return { state: "not_found" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      // 2. Busca formulário por share_token (lista explícita)
      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select("id, title, max_responses, closes_at, status")
        .eq("share_token", data.token)
        .maybeSingle();

      if (formError) {
        console.error(
          `Erro ao buscar form por share_token: código=${formError.code ?? "UNKNOWN"}`
        );
        throw new Error("Não foi possível carregar os dados.");
      }

      if (!form) {
        return { state: "not_found" };
      }

      // 3. Busca perguntas ordenadas por posição (lista explícita)
      const { data: questions, error: questionsError } = await supabaseAdmin
        .from("questions")
        .select("id, label, field_type, position")
        .eq("form_id", form.id)
        .order("position", { ascending: true });

      if (questionsError) {
        console.error(
          `Erro ao buscar perguntas por share_token: código=${questionsError.code ?? "UNKNOWN"} formId=${form.id}`
        );
        throw new Error("Não foi possível carregar os dados.");
      }

      // 4. Busca respostas (lista explícita, ordenada por submitted_at desc, limitada a 5000)
      const { data: responses, error: respError } = await supabaseAdmin
        .from("responses")
        .select("id, answers, submitted_at, updated_at")
        .eq("form_id", form.id)
        .order("submitted_at", { ascending: false })
        .limit(5000);

      if (respError) {
        console.error(
          `Erro ao buscar respostas por share_token: código=${respError.code ?? "UNKNOWN"} formId=${form.id}`
        );
        throw new Error("Não foi possível carregar os dados.");
      }

      // 5. Total de respostas
      const { count, error: countError } = await supabaseAdmin
        .from("responses")
        .select("id", { count: "exact", head: true })
        .eq("form_id", form.id);

      if (countError) {
        console.error(
          `Erro ao contar respostas por share_token: código=${countError.code ?? "UNKNOWN"} formId=${form.id}`
        );
        throw new Error("Não foi possível carregar os dados.");
      }

      const normalizedQuestions: SharedQuestion[] = (questions ?? []).map((q: any) => ({
        id: q.id,
        label: q.label,
        field_type: q.field_type,
        position: q.position,
      }));

      const normalizedResponses: SharedResponse[] = (responses ?? []).map((r: any) => ({
        id: r.id,
        answers: (r.answers ?? {}) as Record<string, string | string[]>,
        submitted_at: r.submitted_at,
        updated_at: r.updated_at,
      }));

      return {
        state: "ok",
        form: {
          title: form.title,
          max_responses: form.max_responses,
          closes_at: form.closes_at,
          status: form.status,
          responses_count: count ?? normalizedResponses.length,
        },
        questions: normalizedQuestions,
        responses: normalizedResponses,
      };
    } catch (err: any) {
      if (err.message === "Não foi possível carregar os dados.") {
        throw err;
      }
      console.error(
        `Exceção ao carregar shared responses: código=EXCEPTION`
      );
      throw new Error("Não foi possível carregar os dados.");
    }
  });
