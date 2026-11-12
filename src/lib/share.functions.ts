import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  generateShareToken,
  isValidShareToken,
  generateAccessCode,
  generateSalt,
  hashAccessCode,
  verifyAccessCode,
  computeSessionExpiry,
  signShareSession,
  verifyShareSession,
  isLockedOut,
  shareCookieName,
  formatShareCookie,
  parseCookieHeader,
} from "./share";

const createShareSchema = z.object({
  formId: z.string().uuid(),
  regenerate: z.boolean().optional(),
});

const regenerateCodeSchema = z.object({
  formId: z.string().uuid(),
});

const revokeShareSchema = z.object({
  formId: z.string().uuid(),
});

const unlockSharedSchema = z.object({
  token: z.string(),
  code: z.string(),
});

const getSharedSchema = z.object({
  token: z.string(),
});

export type CreateShareResult =
  | { ok: true; shareToken: string; accessCode: string }
  | { ok: true; shareToken: string; protected: boolean }
  | { ok: false; error: string };

export type RegenerateAccessCodeResult =
  | { ok: true; accessCode: string }
  | { ok: false; error: string };

export type RevokeShareResult =
  | { ok: true }
  | { ok: false; error: string };

export type UnlockSharedResult =
  | { state: "ok" }
  | { state: "wrong_code" }
  | { state: "locked_out" }
  | { state: "not_found" }
  | { state: "error"; error: string };

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
  | { state: "locked" }
  | { state: "not_found" };

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Cria, recupera ou regenera o link do cliente (somente leitura) com código de acesso (T-25, T-44).
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
        .select("id, owner_id, share_token, share_code_hash, share_code_version")
        .eq("id", data.formId)
        .maybeSingle();

      if (formError || !form || form.owner_id !== userId) {
        if (formError) {
          console.error(
            `Erro ao buscar form para share_token: código=${formError.code ?? "UNKNOWN"} formId=${data.formId}`,
          );
        }
        return { ok: false, error: "Formulário não encontrado." };
      }

      // Se já existe e não pediu regeneração, devolve o token existente e o status de proteção (sem código)
      if (form.share_token && !data.regenerate) {
        return {
          ok: true,
          shareToken: form.share_token,
          protected: Boolean(form.share_code_hash),
        };
      }

      // Gera novo token + código de acesso, grava apenas hash/sal e incrementa versão
      const newToken = generateShareToken();
      const accessCode = generateAccessCode();
      const salt = generateSalt();
      const codeHash = await hashAccessCode(accessCode, salt);
      const nextVersion = (form.share_code_version ?? 0) + 1;

      const { error: updateError } = await supabaseAdmin
        .from("forms")
        .update({
          share_token: newToken,
          share_code_hash: codeHash,
          share_code_salt: salt,
          share_code_version: nextVersion,
          share_failed_attempts: 0,
          share_locked_until: null,
        })
        .eq("id", data.formId)
        .eq("owner_id", userId);

      if (updateError) {
        console.error(
          `Erro ao atualizar share_token: código=${updateError.code ?? "UNKNOWN"} formId=${data.formId}`,
        );
        return { ok: false, error: "Não foi possível gerar o link de compartilhamento." };
      }

      return { ok: true, shareToken: newToken, accessCode };
    } catch {
      console.error(`Exceção ao criar share_token: código=EXCEPTION formId=${data.formId}`);
      return { ok: false, error: "Não foi possível gerar o link de compartilhamento." };
    }
  });

/**
 * Gera um novo código de acesso mantendo o mesmo share_token (ou protege um link legado) (T-44).
 * Incrementa share_code_version (invalida sessões ativas) e zera falhas/bloqueio.
 */
export const regenerateAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => regenerateCodeSchema.parse(data))
  .handler(async ({ data, context }): Promise<RegenerateAccessCodeResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as any)?.userId;

    if (!userId) {
      return { ok: false, error: "Formulário não encontrado." };
    }

    try {
      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select("id, owner_id, share_token, share_code_version")
        .eq("id", data.formId)
        .maybeSingle();

      if (formError || !form || form.owner_id !== userId) {
        if (formError) {
          console.error(
            `Erro ao buscar form para regenerar código: código=${formError.code ?? "UNKNOWN"} formId=${data.formId}`,
          );
        }
        return { ok: false, error: "Formulário não encontrado." };
      }

      if (!form.share_token) {
        return { ok: false, error: "Este formulário ainda não possui um link do cliente." };
      }

      const accessCode = generateAccessCode();
      const salt = generateSalt();
      const codeHash = await hashAccessCode(accessCode, salt);
      const nextVersion = (form.share_code_version ?? 0) + 1;

      const { error: updateError } = await supabaseAdmin
        .from("forms")
        .update({
          share_code_hash: codeHash,
          share_code_salt: salt,
          share_code_version: nextVersion,
          share_failed_attempts: 0,
          share_locked_until: null,
        })
        .eq("id", data.formId)
        .eq("owner_id", userId);

      if (updateError) {
        console.error(
          `Erro ao atualizar código de acesso: código=${updateError.code ?? "UNKNOWN"} formId=${data.formId}`,
        );
        return { ok: false, error: "Não foi possível gerar o código de acesso." };
      }

      return { ok: true, accessCode };
    } catch {
      console.error(`Exceção ao regenerar código de acesso: código=EXCEPTION formId=${data.formId}`);
      return { ok: false, error: "Não foi possível gerar o código de acesso." };
    }
  });

/**
 * Revoga o link do cliente, limpando share_token, hash, sal, falhas, bloqueio e incrementando a versão (T-25, T-44).
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
        .select("id, owner_id, share_code_version")
        .eq("id", data.formId)
        .maybeSingle();

      if (formError || !form || form.owner_id !== userId) {
        if (formError) {
          console.error(
            `Erro ao buscar form para revogar share_token: código=${formError.code ?? "UNKNOWN"} formId=${data.formId}`,
          );
        }
        return { ok: false, error: "Formulário não encontrado." };
      }

      const nextVersion = (form.share_code_version ?? 0) + 1;

      const { error: updateError } = await supabaseAdmin
        .from("forms")
        .update({
          share_token: null,
          share_code_hash: null,
          share_code_salt: null,
          share_code_version: nextVersion,
          share_failed_attempts: 0,
          share_locked_until: null,
        })
        .eq("id", data.formId)
        .eq("owner_id", userId);

      if (updateError) {
        console.error(
          `Erro ao revogar share_token: código=${updateError.code ?? "UNKNOWN"} formId=${data.formId}`,
        );
        return { ok: false, error: "Não foi possível desativar o link." };
      }

      return { ok: true };
    } catch {
      console.error(`Exceção ao revogar share_token: código=EXCEPTION formId=${data.formId}`);
      return { ok: false, error: "Não foi possível desativar o link." };
    }
  });

/**
 * Verifica o código de acesso de um link protegido e emite cookie de sessão assinado (T-44).
 * Pública, com proteção contra força bruta (5 erros consecutivos bloqueiam por 15 minutos).
 */
export const unlockSharedLink = createServerFn({ method: "POST" })
  .validator((data: unknown) => unlockSharedSchema.parse(data))
  .handler(async ({ data }): Promise<UnlockSharedResult> => {
    // 1. Valida formato do token sem consultar o banco
    if (!isValidShareToken(data.token)) {
      return { state: "not_found" };
    }

    // 2. Confere segredo de sessão no servidor (falha segura se ausente)
    const secret = process.env["SHARE_SESSION_SECRET"];
    if (!secret || !secret.trim()) {
      console.error("Erro ao verificar código do link: código=MISSING_SHARE_SESSION_SECRET");
      return {
        state: "error",
        error: "Não foi possível verificar o código agora. Tente novamente.",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setResponseHeader } = await import("@tanstack/react-start/server");

    try {
      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select(
          "id, closes_at, share_code_hash, share_code_salt, share_code_version, share_failed_attempts, share_locked_until",
        )
        .eq("share_token", data.token)
        .maybeSingle();

      if (formError) {
        console.error(
          `Erro ao buscar form em unlockSharedLink: código=${formError.code ?? "UNKNOWN"}`,
        );
        return {
          state: "error",
          error: "Não foi possível verificar o código agora. Tente novamente.",
        };
      }

      if (!form || !form.share_code_hash || !form.share_code_salt) {
        return { state: "not_found" };
      }

      const now = new Date();

      // 3. Verifica se está bloqueado por excesso de tentativas
      if (isLockedOut(form.share_locked_until, now)) {
        return { state: "locked_out" };
      }

      // 4. Verifica o código em tempo constante
      const isCodeValid = await verifyAccessCode(
        data.code,
        form.share_code_salt,
        form.share_code_hash,
      );

      if (!isCodeValid) {
        const hadExpiredLock =
          form.share_locked_until !== null &&
          !isLockedOut(form.share_locked_until, now) &&
          (form.share_failed_attempts ?? 0) >= MAX_FAILED_ATTEMPTS;
        const baseAttempts = hadExpiredLock ? 0 : (form.share_failed_attempts ?? 0);
        const nextAttempts = baseAttempts + 1;
        const willLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
        const lockedUntil = willLock
          ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
          : null;

        const { error: failUpdateError } = await supabaseAdmin
          .from("forms")
          .update({
            share_failed_attempts: nextAttempts,
            share_locked_until: lockedUntil,
          })
          .eq("id", form.id);

        if (failUpdateError) {
          console.error(
            `Erro ao registrar falha de código: código=${failUpdateError.code ?? "UNKNOWN"} formId=${form.id}`,
          );
        }

        return { state: willLock ? "locked_out" : "wrong_code" };
      }

      // 5. Código correto: zera falhas/bloqueio e emite cookie de sessão com Path=/
      if ((form.share_failed_attempts ?? 0) > 0 || form.share_locked_until !== null) {
        const { error: resetError } = await supabaseAdmin
          .from("forms")
          .update({
            share_failed_attempts: 0,
            share_locked_until: null,
          })
          .eq("id", form.id);

        if (resetError) {
          console.error(
            `Erro ao zerar falhas de código: código=${resetError.code ?? "UNKNOWN"} formId=${form.id}`,
          );
        }
      }

      const expiryDate = computeSessionExpiry(form.closes_at, now);
      const expSeconds = Math.floor(expiryDate.getTime() / 1000);
      const maxAgeSeconds = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000));

      const sessionToken = await signShareSession(
        {
          f: form.id,
          v: form.share_code_version ?? 0,
          exp: expSeconds,
        },
        secret,
      );

      const cookieName = await shareCookieName(data.token);
      const cookieHeader = formatShareCookie(cookieName, sessionToken, maxAgeSeconds);
      setResponseHeader("Set-Cookie", cookieHeader);

      return { state: "ok" };
    } catch {
      console.error("Exceção ao verificar código do link: código=EXCEPTION");
      return {
        state: "error",
        error: "Não foi possível verificar o código agora. Tente novamente.",
      };
    }
  });

/**
 * Consulta pública de respostas via share_token.
 * Formulários legados retornam dados diretamente; formulários protegidos exigem cookie de sessão válido.
 */
export const getSharedResponses = createServerFn({ method: "POST" })
  .validator((data: unknown) => getSharedSchema.parse(data))
  .handler(async ({ data }): Promise<SharedResponsesPayload> => {
    // 1. Validação estrita de formato sem consultar o banco
    if (!isValidShareToken(data.token)) {
      return { state: "not_found" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequest } = await import("@tanstack/react-start/server");

    try {
      // 2. Busca formulário por share_token (lista explícita)
      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select("id, title, max_responses, closes_at, status, share_code_hash, share_code_version")
        .eq("share_token", data.token)
        .maybeSingle();

      if (formError) {
        console.error(
          `Erro ao buscar form por share_token: código=${formError.code ?? "UNKNOWN"}`,
        );
        throw new Error("Não foi possível carregar os dados.");
      }

      if (!form) {
        return { state: "not_found" };
      }

      // 3. Se o link é protegido (tem share_code_hash), exige cookie de sessão válido
      if (form.share_code_hash) {
        const secret = process.env["SHARE_SESSION_SECRET"];
        if (!secret || !secret.trim()) {
          return { state: "locked" };
        }

        let cookieHeader: string | null = null;
        try {
          const req = getRequest();
          cookieHeader = req?.headers?.get("cookie") ?? null;
        } catch {
          cookieHeader = null;
        }

        const cookieName = await shareCookieName(data.token);
        const cookieVal = parseCookieHeader(cookieHeader, cookieName);
        const session = await verifyShareSession(cookieVal, secret, new Date(), {
          formId: form.id,
          version: form.share_code_version ?? 0,
        });

        if (!session) {
          return { state: "locked" };
        }
      }

      // 4. Busca perguntas ordenadas por posição (lista explícita)
      const { data: questions, error: questionsError } = await supabaseAdmin
        .from("questions")
        .select("id, label, field_type, position")
        .eq("form_id", form.id)
        .order("position", { ascending: true });

      if (questionsError) {
        console.error(
          `Erro ao buscar perguntas por share_token: código=${questionsError.code ?? "UNKNOWN"} formId=${form.id}`,
        );
        throw new Error("Não foi possível carregar os dados.");
      }

      // 5. Busca respostas (lista explícita, ordenada por submitted_at desc, limitada a 5000)
      const { data: responses, error: respError } = await supabaseAdmin
        .from("responses")
        .select("id, answers, submitted_at, updated_at")
        .eq("form_id", form.id)
        .order("submitted_at", { ascending: false })
        .limit(5000);

      if (respError) {
        console.error(
          `Erro ao buscar respostas por share_token: código=${respError.code ?? "UNKNOWN"} formId=${form.id}`,
        );
        throw new Error("Não foi possível carregar os dados.");
      }

      // 6. Total de respostas
      const { count, error: countError } = await supabaseAdmin
        .from("responses")
        .select("id", { count: "exact", head: true })
        .eq("form_id", form.id);

      if (countError) {
        console.error(
          `Erro ao contar respostas por share_token: código=${countError.code ?? "UNKNOWN"} formId=${form.id}`,
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
      console.error("Exceção ao carregar shared responses: código=EXCEPTION");
      throw new Error("Não foi possível carregar os dados.");
    }
  });
