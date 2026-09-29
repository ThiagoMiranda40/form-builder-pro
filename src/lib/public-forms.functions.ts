import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { validateAnswer } from "./validators";

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
    responses_count: number;
  };
  questions?: PublicQuestion[];
};

const slugSchema = z.object({ slug: z.string().min(1).max(120) });

export const getPublicForm = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }): Promise<PublicFormPayload> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: form } = await supabaseAdmin
      .from("forms")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!form) return { state: "not_found" };
    if (form.status !== "published") return { state: "draft" };

    const { count } = await supabaseAdmin
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("form_id", form.id);

    const responsesCount = count ?? 0;
    const theme = (form.theme ?? {}) as Record<string, unknown>;

    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id,label,help_text,field_type,required,options,position")
      .eq("form_id", form.id)
      .order("position", { ascending: true });

    let state: PublicFormPayload["state"] = "open";
    if (form.closes_at && new Date(form.closes_at).getTime() < Date.now()) state = "closed";
    else if (form.max_responses !== null && responsesCount >= form.max_responses) state = "full";

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
        responses_count: responsesCount,
      },
      questions: (questions ?? []).map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
      })),
    };
  });

const submitSchema = z.object({
  slug: z.string().min(1).max(120),
  answers: z.record(z.union([z.string().max(5000), z.array(z.string().max(500)).max(50)])),
});

export const submitResponse = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(
    async ({ data }): Promise<{ ok: boolean; error?: string; message?: string }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: form } = await supabaseAdmin
        .from("forms")
        .select("*")
        .eq("slug", data.slug)
        .maybeSingle();

      if (!form || form.status !== "published")
        return { ok: false, error: "Este formulário não está disponível." };

      if (form.closes_at && new Date(form.closes_at).getTime() < Date.now())
        return { ok: false, error: "O prazo de preenchimento encerrou." };

      const { count } = await supabaseAdmin
        .from("responses")
        .select("id", { count: "exact", head: true })
        .eq("form_id", form.id);

      if (form.max_responses !== null && (count ?? 0) >= form.max_responses)
        return { ok: false, error: "O limite de inscrições foi atingido." };

      const { data: questions } = await supabaseAdmin
        .from("questions")
        .select("id,label,field_type,required,options")
        .eq("form_id", form.id);

      const clean: Record<string, string | string[]> = {};
      for (const q of questions ?? []) {
        const raw = data.answers[q.id];
        const error = validateAnswer(q.field_type, q.required, raw);
        if (error) return { ok: false, error: `${q.label}: ${error}` };
        if (raw !== undefined && raw !== null && raw !== "") clean[q.id] = raw;
      }

      const { error: insertError } = await supabaseAdmin
        .from("responses")
        .insert({ form_id: form.id, answers: clean });

      if (insertError) return { ok: false, error: "Não foi possível salvar sua resposta." };

      return { ok: true, message: form.success_message };
    },
  );
