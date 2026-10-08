import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { answersSchema, validateAndCleanAnswers, ALLOWED_ORIGINS } from "./submit-response";
import {
  buildConfirmationEmail,
  isSafeRecipient,
  sendConfirmationEmail,
} from "./confirmation-email";
import {
  hasEmailChanged,
  findEmailQuestionWithAnswer,
  isCpfDigitsEqual,
  type AdminUpdateResult,
  type AdminResendResult,
} from "./admin-response";
import type { Json } from "@/integrations/supabase/types";

const adminUpdateSchema = z.object({
  responseId: z.string().uuid(),
  answers: answersSchema,
});

const resendEditSchema = z.object({
  responseId: z.string().uuid(),
});

export const adminUpdateResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => adminUpdateSchema.parse(data))
  .handler(async ({ data, context }): Promise<AdminUpdateResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as any)?.userId;

    let responseIdForLog = data.responseId;

    try {
      if (!userId) {
        return { ok: false, error: "Inscrição não encontrada." };
      }

      // 1. Carrega resposta e formulário com chave de serviço
      const { data: response, error: respError } = await supabaseAdmin
        .from("responses")
        .select("id, form_id, answers, identifier, updated_at, edit_token")
        .eq("id", data.responseId)
        .maybeSingle();

      if (respError || !response) {
        if (respError) {
          console.error(
            `Erro ao carregar resposta para edição admin: código=${respError.code ?? "UNKNOWN"} responseId=${data.responseId}`,
          );
        }
        return { ok: false, error: "Inscrição não encontrada." };
      }

      responseIdForLog = response.id;

      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select("id, owner_id, title, status, closes_at, event_date, event_time, event_location")
        .eq("id", response.form_id)
        .maybeSingle();

      // Se não existir OU form.owner_id for diferente do usuário -> o MESMO erro genérico
      if (formError || !form || form.owner_id !== userId) {
        if (formError) {
          console.error(
            `Erro ao carregar form para edição admin: código=${formError.code ?? "UNKNOWN"} responseId=${response.id}`,
          );
        }
        return { ok: false, error: "Inscrição não encontrada." };
      }

      // 2. Carrega perguntas
      const { data: questions, error: questionsError } = await supabaseAdmin
        .from("questions")
        .select("id, label, field_type, required, options, position, settings")
        .eq("form_id", form.id)
        .order("position", { ascending: true });

      if (questionsError || !questions) {
        console.error(
          `Erro ao carregar perguntas para edição admin: código=${questionsError?.code ?? "UNKNOWN"} responseId=${response.id}`,
        );
        return { ok: false, error: "Não foi possível carregar as perguntas do formulário." };
      }

      // 3. Checagem de CPF (SEC-21, SEC-22)
      const savedIdentifierDigits = response.identifier
        ? response.identifier.replace(/\D/g, "")
        : "";

      const isCpfQuestion = (q: { id: string; field_type: string }): boolean => {
        if (q.field_type === "cpf") return true;
        const savedVal = (response.answers as Record<string, unknown>)?.[q.id];
        if (typeof savedVal === "string") {
          const savedDigits = savedVal.replace(/\D/g, "");
          if (savedIdentifierDigits !== "" && savedDigits === savedIdentifierDigits) {
            return true;
          }
        }
        return false;
      };

      for (const q of questions) {
        if (isCpfQuestion(q)) {
          const newAnswerVal = data.answers[q.id];
          if (newAnswerVal !== undefined && newAnswerVal !== null) {
            const newDigits =
              typeof newAnswerVal === "string" ? newAnswerVal.replace(/\D/g, "") : "";
            if (
              savedIdentifierDigits &&
              newDigits &&
              !isCpfDigitsEqual(newDigits, savedIdentifierDigits)
            ) {
              return {
                ok: false,
                error: "O CPF não pode ser alterado.",
                field: q.id,
              };
            }
          }
        }
      }

      // Prepara respostas garantindo integridade do CPF original
      const inputAnswers: Record<string, unknown> = { ...data.answers };
      for (const q of questions) {
        if (isCpfQuestion(q)) {
          if (
            response.answers &&
            (response.answers as Record<string, unknown>)[q.id] !== undefined
          ) {
            inputAnswers[q.id] = (response.answers as Record<string, unknown>)[q.id];
          }
        }
      }

      // 4. Validação das respostas (mesmas regras da edição, sem checagem de formulário aberto ou prazo)
      const normalizedQuestions = questions.map((q) => ({
        id: q.id,
        label: q.label,
        field_type: q.field_type,
        required: Boolean(q.required),
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
        position: q.position,
        settings: (q as any).settings,
      }));

      const validationResult = validateAndCleanAnswers(normalizedQuestions, inputAnswers, {
        eventDate: (form as any).event_date,
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

      // 5. Atualização no banco: somente answers e updated_at
      const { error: updateError } = await supabaseAdmin
        .from("responses")
        .update({
          answers: cleanAnswers as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", response.id)
        .eq("form_id", form.id);

      if (updateError) {
        console.error(
          `Erro ao atualizar resposta pelo admin: código=${updateError.code ?? "UNKNOWN"} responseId=${response.id}`,
        );
        return {
          ok: false,
          error: "Não foi possível salvar as alterações.",
        };
      }

      // 6. Verifica se o e-mail foi alterado
      const emailQ = normalizedQuestions.find((q) => q.field_type === "email");
      const emailChanged = hasEmailChanged(
        response.answers as Record<string, unknown>,
        cleanAnswers,
        emailQ?.id,
      );
      const newEmail =
        emailChanged && emailQ ? String(cleanAnswers[emailQ.id] ?? "").trim() : null;

      return {
        ok: true,
        emailChanged,
        newEmail,
      };
    } catch {
      console.error(`Erro ao atualizar resposta pelo admin: código=EXCEPTION responseId=${responseIdForLog}`);
      return {
        ok: false,
        error: "Não foi possível salvar as alterações.",
      };
    }
  });

export const resendEditLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => resendEditSchema.parse(data))
  .handler(async ({ data, context }): Promise<AdminResendResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as any)?.userId;

    let responseIdForLog = data.responseId;

    try {
      if (!userId) {
        return { sent: false, error: "Inscrição não encontrada." };
      }

      const { data: response, error: respError } = await supabaseAdmin
        .from("responses")
        .select("id, form_id, answers, identifier, edit_token")
        .eq("id", data.responseId)
        .maybeSingle();

      if (respError || !response) {
        if (respError) {
          console.error(
            `Erro ao carregar resposta para reenvio: código=${respError.code ?? "UNKNOWN"} responseId=${data.responseId}`,
          );
        }
        return { sent: false, error: "Inscrição não encontrada." };
      }

      responseIdForLog = response.id;

      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select("id, owner_id, title, event_date, event_time, event_location")
        .eq("id", response.form_id)
        .maybeSingle();

      if (formError || !form || form.owner_id !== userId) {
        if (formError) {
          console.error(
            `Erro ao carregar form para reenvio: código=${formError.code ?? "UNKNOWN"} responseId=${response.id}`,
          );
        }
        return { sent: false, error: "Inscrição não encontrada." };
      }

      const { data: questions, error: qError } = await supabaseAdmin
        .from("questions")
        .select("id, label, field_type, position")
        .eq("form_id", form.id)
        .order("position", { ascending: true });

      if (qError || !questions) {
        console.error(
          `Erro ao carregar perguntas para reenvio: código=${qError?.code ?? "UNKNOWN"} responseId=${response.id}`,
        );
        return { sent: false, error: "Não foi possível enviar o e-mail. Tente novamente." };
      }

      // Procura a primeira pergunta do tipo e-mail com resposta preenchida
      const emailInfo = findEmailQuestionWithAnswer(
        questions,
        response.answers as Record<string, unknown>,
      );

      if (!emailInfo || !isSafeRecipient(emailInfo.email)) {
        return {
          sent: false,
          code: "no_email",
          error: "Esta inscrição não possui e-mail cadastrado.",
        };
      }

      const editUrl = `${ALLOWED_ORIGINS[0]}/editar/${response.edit_token}`;
      const emailContent = buildConfirmationEmail({
        form: {
          title: form.title,
          event_date: form.event_date,
          event_time: form.event_time,
          event_location: form.event_location,
        },
        questions: questions.map((q) => ({
          id: q.id,
          label: q.label,
          field_type: q.field_type,
          position: q.position,
        })),
        answers: (response.answers ?? {}) as Record<string, unknown>,
        editUrl,
        kind: "atualizada",
      });

      const apiKey = process.env["RESEND_API_KEY"];
      const from = process.env["EMAIL_FROM"];

      const success = await sendConfirmationEmail({
        ...(apiKey ? { apiKey } : {}),
        ...(from ? { from } : {}),
        to: emailInfo.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (!success) {
        console.error(
          `Erro ao reenviar e-mail de edição: código=RESEND_FAILED responseId=${response.id}`,
        );
        return {
          sent: false,
          error: "Não foi possível enviar o e-mail. Tente novamente.",
        };
      }

      return { sent: true };
    } catch {
      console.error(`Erro ao reenviar e-mail: código=EXCEPTION responseId=${responseIdForLog}`);
      return {
        sent: false,
        error: "Não foi possível enviar o e-mail. Tente novamente.",
      };
    }
  });
