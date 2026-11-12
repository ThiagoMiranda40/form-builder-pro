import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Simula @tanstack/react-start com suporte a middleware de autenticação
vi.mock("@tanstack/react-start", () => {
  return {
    createServerFn: (options?: { method?: string }) => {
      let middlewareList: any[] = [];
      const builder: any = {
        options,
        middleware: (mw: any[]) => {
          middlewareList = mw;
          return builder;
        },
        validator: (validatorFn: (data: unknown) => unknown) => ({
          handler: (handlerFn: (ctx: { data: unknown; context: any }) => unknown) => {
            const fn = async (args?: { data?: unknown; context?: any }) => {
              const validated = validatorFn ? validatorFn(args?.data) : args?.data;
              return handlerFn({
                data: validated,
                context: args?.context ?? { userId: "owner-123" },
              });
            };
            (fn as any).method = options?.method;
            (fn as any).options = options;
            (fn as any).middlewareList = middlewareList;
            return fn;
          },
        }),
      };
      return builder;
    },
    createMiddleware: () => ({
      server: (fn: any) => fn,
    }),
  };
});

// Mock de supabaseAdmin
const mockSupabaseAdmin = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { id: "requireSupabaseAuth" },
}));

const mockSetResponseHeader = vi.fn();
let mockRequestHeaders = new Headers();

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("https://inscricoes.corretime.com.br/_serverFn/share", {
      headers: mockRequestHeaders,
    }),
  getRequestHeader: (name: string) => mockRequestHeaders.get(name) ?? undefined,
  setResponseHeader: (...args: any[]) => mockSetResponseHeader(...args),
}));

import {
  createShareLink,
  regenerateAccessCode,
  revokeShareLink,
  unlockSharedLink,
  getSharedResponses,
} from "./share.functions";
import {
  generateSalt,
  hashAccessCode,
  signShareSession,
  shareCookieName,
} from "./share";

const FORM_ID = "22222222-2222-4222-a222-222222222222";
const OTHER_FORM_ID = "99999999-9999-4999-a999-999999999999";
const VALID_TOKEN = "a".repeat(64);
const VALID_TOKEN_2 = "b".repeat(64);
const TEST_SECRET = "segredo-sessao-cliente-32-bytes-teste-1234";

describe("share.functions (T-25, T-44, SEC-24, SEC-30..36)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalEnvSecret = process.env["SHARE_SESSION_SECRET"];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestHeaders = new Headers();
    process.env["SHARE_SESSION_SECRET"] = TEST_SECRET;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalEnvSecret === undefined) {
      delete process.env["SHARE_SESSION_SECRET"];
    } else {
      process.env["SHARE_SESSION_SECRET"] = originalEnvSecret;
    }
  });

  describe("Configuração de métodos e autenticação", () => {
    it("createShareLink deve ser POST e exigir autenticação", () => {
      expect((createShareLink as any).method).toBe("POST");
      expect((createShareLink as any).middlewareList).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "requireSupabaseAuth" })]),
      );
    });

    it("regenerateAccessCode deve ser POST e exigir autenticação", () => {
      expect((regenerateAccessCode as any).method).toBe("POST");
      expect((regenerateAccessCode as any).middlewareList).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "requireSupabaseAuth" })]),
      );
    });

    it("revokeShareLink deve ser POST e exigir autenticação", () => {
      expect((revokeShareLink as any).method).toBe("POST");
      expect((revokeShareLink as any).middlewareList).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "requireSupabaseAuth" })]),
      );
    });

    it("unlockSharedLink deve ser POST e pública (sem requireSupabaseAuth)", () => {
      expect((unlockSharedLink as any).method).toBe("POST");
      expect((unlockSharedLink as any).middlewareList ?? []).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "requireSupabaseAuth" })]),
      );
    });

    it("getSharedResponses deve ser POST e pública (sem requireSupabaseAuth)", () => {
      expect((getSharedResponses as any).method).toBe("POST");
      expect((getSharedResponses as any).middlewareList ?? []).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "requireSupabaseAuth" })]),
      );
    });
  });

  describe("createShareLink (T-44)", () => {
    it("retorna erro genérico quando o usuário não é dono e nada muda", async () => {
      const updateFn = vi.fn();
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "other-user",
                    share_token: null,
                    share_code_hash: null,
                    share_code_version: 0,
                  },
                  error: null,
                }),
              }),
            }),
            update: updateFn,
          };
        }
        return {};
      });

      const res = await (createShareLink as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });

      expect(res).toEqual({ ok: false, error: "Formulário não encontrado." });
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("se já existe token e regenerate não for verdadeiro, devolve shareToken e protected sem devolver código", async () => {
      const updateFn = vi.fn();
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    share_token: VALID_TOKEN,
                    share_code_hash: "c".repeat(64),
                    share_code_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
            update: updateFn,
          };
        }
        return {};
      });

      const res = await (createShareLink as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });

      expect(res).toEqual({ ok: true, shareToken: VALID_TOKEN, protected: true });
      expect((res as any).accessCode).toBeUndefined();
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("ao criar link novo: devolve accessCode de 10 caracteres, incrementa versão e grava só hash/sal (nunca o código puro)", async () => {
      let savedPayload: any = null;
      let eqCalls: Array<[string, any]> = [];

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    share_token: null,
                    share_code_hash: null,
                    share_code_version: 0,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              savedPayload = payload;
              const chain: any = {
                eq: vi.fn().mockImplementation((col: string, val: any) => {
                  eqCalls.push([col, val]);
                  return chain;
                }),
                error: null,
              };
              return chain;
            }),
          };
        }
        return {};
      });

      const res = await (createShareLink as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });

      expect(res.ok).toBe(true);
      expect(res.shareToken).toMatch(/^[0-9a-f]{64}$/);
      expect(res.accessCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);

      expect(savedPayload).toBeDefined();
      expect(savedPayload.share_token).toBe(res.shareToken);
      expect(savedPayload.share_code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(savedPayload.share_code_salt).toMatch(/^[0-9a-f]{32}$/);
      expect(savedPayload.share_code_version).toBe(1);
      expect(savedPayload.share_failed_attempts).toBe(0);
      expect(savedPayload.share_locked_until).toBeNull();

      // O código em texto puro NUNCA aparece no payload gravado nem nos logs
      expect(JSON.stringify(savedPayload)).not.toContain(res.accessCode);
      for (const call of consoleErrorSpy.mock.calls) {
        expect(call.join(" ")).not.toContain(res.accessCode);
      }

      // Hash gravado corresponde exatamente ao accessCode + salt
      const expectedHash = await hashAccessCode(res.accessCode, savedPayload.share_code_salt);
      expect(savedPayload.share_code_hash).toBe(expectedHash);

      expect(eqCalls).toEqual(
        expect.arrayContaining([
          ["id", FORM_ID],
          ["owner_id", "owner-123"],
        ]),
      );
    });

    it("com regenerate: true, gera novo token e novo código e incrementa share_code_version", async () => {
      let savedPayload: any = null;
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    share_token: VALID_TOKEN,
                    share_code_hash: "d".repeat(64),
                    share_code_version: 4,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              savedPayload = payload;
              const chain: any = {};
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.error = null;
              return chain;
            }),
          };
        }
        return {};
      });

      const res = await (createShareLink as any)({
        data: { formId: FORM_ID, regenerate: true },
        context: { userId: "owner-123" },
      });

      expect(res.ok).toBe(true);
      expect(res.shareToken).not.toBe(VALID_TOKEN);
      expect(res.accessCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
      expect(savedPayload.share_code_version).toBe(5);
      expect(savedPayload.share_failed_attempts).toBe(0);
      expect(savedPayload.share_locked_until).toBeNull();
    });
  });

  describe("regenerateAccessCode (T-44)", () => {
    it("para o dono: mantém o mesmo share_token, gera novo código, incrementa versão e zera falhas/bloqueio", async () => {
      let savedPayload: any = null;
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    share_token: VALID_TOKEN,
                    share_code_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              savedPayload = payload;
              const chain: any = {};
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.error = null;
              return chain;
            }),
          };
        }
        return {};
      });

      const res = await (regenerateAccessCode as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });

      expect(res.ok).toBe(true);
      expect(res.accessCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
      expect(savedPayload.share_token).toBeUndefined();
      expect(savedPayload.share_code_version).toBe(3);
      expect(savedPayload.share_failed_attempts).toBe(0);
      expect(savedPayload.share_locked_until).toBeNull();
      expect(JSON.stringify(savedPayload)).not.toContain(res.accessCode);
    });

    it("para usuário que não é dono: retorna erro genérico e não atualiza", async () => {
      const updateFn = vi.fn();
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "other-owner",
                    share_token: VALID_TOKEN,
                    share_code_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
            update: updateFn,
          };
        }
        return {};
      });

      const res = await (regenerateAccessCode as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });

      expect(res).toEqual({ ok: false, error: "Formulário não encontrado." });
      expect(updateFn).not.toHaveBeenCalled();
    });
  });

  describe("revokeShareLink (T-44)", () => {
    it("limpa share_token, hash, sal, falhas, bloqueio e incrementa share_code_version", async () => {
      let updatePayload: any = null;
      let eqCalls: Array<[string, any]> = [];

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    share_token: VALID_TOKEN,
                    share_code_version: 7,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              updatePayload = payload;
              const chain: any = {
                eq: vi.fn().mockImplementation((col: string, val: any) => {
                  eqCalls.push([col, val]);
                  return chain;
                }),
                error: null,
              };
              return chain;
            }),
          };
        }
        return {};
      });

      const res = await (revokeShareLink as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });

      expect(res).toEqual({ ok: true });
      expect(updatePayload).toEqual({
        share_token: null,
        share_code_hash: null,
        share_code_salt: null,
        share_code_version: 8,
        share_failed_attempts: 0,
        share_locked_until: null,
      });
      expect(eqCalls).toEqual(
        expect.arrayContaining([
          ["id", FORM_ID],
          ["owner_id", "owner-123"],
        ]),
      );
    });
  });

  describe("unlockSharedLink (T-44)", () => {
    it("token inválido -> devolve not_found sem consultar o banco", async () => {
      const res = await (unlockSharedLink as any)({
        data: { token: "token-invalido", code: "ABCDEFGH23" },
      });
      expect(res).toEqual({ state: "not_found" });
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
      expect(mockSetResponseHeader).not.toHaveBeenCalled();
    });

    it("SHARE_SESSION_SECRET ausente -> falha segura sem emitir cookie e sem vazar dados no log", async () => {
      delete process.env["SHARE_SESSION_SECRET"];
      const code = "ABCDEFGH23";

      const res = await (unlockSharedLink as any)({
        data: { token: VALID_TOKEN, code },
      });

      expect(res.state).toBe("error");
      expect(mockSetResponseHeader).not.toHaveBeenCalled();
      for (const call of consoleErrorSpy.mock.calls) {
        const log = call.join(" ");
        expect(log).not.toContain(VALID_TOKEN);
        expect(log).not.toContain(code);
      }
    });

    it("código certo -> retorna ok, zera falhas e define cookie com HttpOnly, Secure, SameSite=Lax, Path=/ e Max-Age", async () => {
      const salt = generateSalt();
      const rightCode = "ABCDEFGH23";
      const hash = await hashAccessCode(rightCode, salt);
      let updatedRow: any = null;

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    closes_at: null,
                    share_code_hash: hash,
                    share_code_salt: salt,
                    share_code_version: 3,
                    share_failed_attempts: 2,
                    share_locked_until: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              updatedRow = payload;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        return {};
      });

      const res = await (unlockSharedLink as any)({
        data: { token: VALID_TOKEN, code: "abcd-efgh 23" },
      });

      expect(res).toEqual({ state: "ok" });
      expect(updatedRow).toEqual({
        share_failed_attempts: 0,
        share_locked_until: null,
      });

      expect(mockSetResponseHeader).toHaveBeenCalledTimes(1);
      const [headerName, headerVal] = mockSetResponseHeader.mock.calls[0]!;
      expect(headerName).toBe("Set-Cookie");
      expect(headerVal).toContain("HttpOnly");
      expect(headerVal).toContain("Secure");
      expect(headerVal).toContain("SameSite=Lax");
      expect(headerVal).toContain("Path=/");
      expect(headerVal).not.toContain("Path=/c/");
      expect(headerVal).toMatch(/Max-Age=259\d{4}/); // ~30 dias (2592000s)
    });

    it("código errado -> retorna wrong_code sem emitir cookie e incrementa falhas", async () => {
      const salt = generateSalt();
      const hash = await hashAccessCode("ABCDEFGH23", salt);
      let updatedRow: any = null;

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    closes_at: null,
                    share_code_hash: hash,
                    share_code_salt: salt,
                    share_code_version: 1,
                    share_failed_attempts: 0,
                    share_locked_until: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              updatedRow = payload;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        return {};
      });

      const res = await (unlockSharedLink as any)({
        data: { token: VALID_TOKEN, code: "ZZZZZZZZ99" },
      });

      expect(res).toEqual({ state: "wrong_code" });
      expect(mockSetResponseHeader).not.toHaveBeenCalled();
      expect(updatedRow.share_failed_attempts).toBe(1);
      expect(updatedRow.share_locked_until).toBeNull();
    });

    it("5 erros seguidos -> bloqueia por 15 minutos (locked_out), e durante o bloqueio nem o código certo libera; acerto após desbloqueio zera falhas", async () => {
      const salt = generateSalt();
      const rightCode = "ABCDEFGH23";
      const hash = await hashAccessCode(rightCode, salt);

      let failedAttempts = 0;
      let lockedUntil: string | null = null;

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(async () => ({
                  data: {
                    id: FORM_ID,
                    closes_at: null,
                    share_code_hash: hash,
                    share_code_salt: salt,
                    share_code_version: 1,
                    share_failed_attempts: failedAttempts,
                    share_locked_until: lockedUntil,
                  },
                  error: null,
                })),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              if (payload.share_failed_attempts !== undefined) {
                failedAttempts = payload.share_failed_attempts;
              }
              if (payload.share_locked_until !== undefined) {
                lockedUntil = payload.share_locked_until;
              }
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        return {};
      });

      // Tentativas 1 a 4 -> wrong_code
      for (let i = 1; i <= 4; i++) {
        const r = await (unlockSharedLink as any)({
          data: { token: VALID_TOKEN, code: "WRONGCODE9" },
        });
        expect(r).toEqual({ state: "wrong_code" });
        expect(failedAttempts).toBe(i);
        expect(lockedUntil).toBeNull();
      }

      // 5ª tentativa errada -> locked_out por 15 minutos
      const r5 = await (unlockSharedLink as any)({
        data: { token: VALID_TOKEN, code: "WRONGCODE9" },
      });
      expect(r5).toEqual({ state: "locked_out" });
      expect(failedAttempts).toBe(5);
      expect(lockedUntil).not.toBeNull();
      const lockDiffMs = new Date(lockedUntil!).getTime() - Date.now();
      expect(lockDiffMs).toBeGreaterThan(14 * 60 * 1000);
      expect(lockDiffMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);

      // Mesmo com o código certo durante o bloqueio -> continua locked_out e não emite cookie
      const rRightWhileLocked = await (unlockSharedLink as any)({
        data: { token: VALID_TOKEN, code: rightCode },
      });
      expect(rRightWhileLocked).toEqual({ state: "locked_out" });
      expect(mockSetResponseHeader).not.toHaveBeenCalled();

      // Após expirar o bloqueio -> código certo libera e zera falhas
      lockedUntil = new Date(Date.now() - 1000).toISOString();
      const rAfterLock = await (unlockSharedLink as any)({
        data: { token: VALID_TOKEN, code: rightCode },
      });
      expect(rAfterLock).toEqual({ state: "ok" });
      expect(failedAttempts).toBe(0);
      expect(lockedUntil).toBeNull();
      expect(mockSetResponseHeader).toHaveBeenCalledTimes(1);
    });
  });

  describe("getSharedResponses (T-25 e T-44)", () => {
    it("com token inválido, não chama o banco e devolve not_found", async () => {
      const res1 = await (getSharedResponses as any)({ data: { token: "token-invalido" } });
      const res2 = await (getSharedResponses as any)({ data: { token: "" } });
      const res3 = await (getSharedResponses as any)({ data: { token: "A".repeat(64) } });

      expect(res1).toEqual({ state: "not_found" });
      expect(res2).toEqual({ state: "not_found" });
      expect(res3).toEqual({ state: "not_found" });
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("protegido sem cookie -> devolve locked SEM título, SEM perguntas e SEM respostas", async () => {
      const questionsFn = vi.fn();
      const responsesFn = vi.fn();

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    title: "Evento Confidencial",
                    max_responses: 50,
                    closes_at: null,
                    status: "published",
                    share_code_hash: "e".repeat(64),
                    share_code_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "questions") {
          questionsFn();
        }
        if (table === "responses") {
          responsesFn();
        }
        return {};
      });

      const res = await (getSharedResponses as any)({ data: { token: VALID_TOKEN } });
      expect(res).toEqual({ state: "locked" });
      expect(JSON.stringify(res)).not.toContain("Evento Confidencial");
      expect(questionsFn).not.toHaveBeenCalled();
      expect(responsesFn).not.toHaveBeenCalled();
    });

    it("protegido com cookie de outro formulário, cookie expirado ou versão diferente -> devolve locked", async () => {
      const cookieName = await shareCookieName(VALID_TOKEN);
      const nowSec = Math.floor(Date.now() / 1000);

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    title: "Evento Confidencial",
                    max_responses: 50,
                    closes_at: null,
                    status: "published",
                    share_code_hash: "e".repeat(64),
                    share_code_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      // 1. Cookie de outro formulário
      const wrongFormSession = await signShareSession(
        { f: OTHER_FORM_ID, v: 2, exp: nowSec + 3600 },
        TEST_SECRET,
      );
      mockRequestHeaders.set("cookie", `${cookieName}=${wrongFormSession}`);
      expect(await (getSharedResponses as any)({ data: { token: VALID_TOKEN } })).toEqual({
        state: "locked",
      });

      // 2. Cookie expirado
      const expiredSession = await signShareSession(
        { f: FORM_ID, v: 2, exp: nowSec - 10 },
        TEST_SECRET,
      );
      mockRequestHeaders.set("cookie", `${cookieName}=${expiredSession}`);
      expect(await (getSharedResponses as any)({ data: { token: VALID_TOKEN } })).toEqual({
        state: "locked",
      });

      // 3. Código regenerado (versão diferente)
      const oldVersionSession = await signShareSession(
        { f: FORM_ID, v: 1, exp: nowSec + 3600 },
        TEST_SECRET,
      );
      mockRequestHeaders.set("cookie", `${cookieName}=${oldVersionSession}`);
      expect(await (getSharedResponses as any)({ data: { token: VALID_TOKEN } })).toEqual({
        state: "locked",
      });
    });

    it("protegido com cookie válido -> devolve ok com dados e sem campos sensíveis", async () => {
      const cookieName = await shareCookieName(VALID_TOKEN);
      const nowSec = Math.floor(Date.now() / 1000);
      const validSession = await signShareSession(
        { f: FORM_ID, v: 2, exp: nowSec + 3600 },
        TEST_SECRET,
      );
      mockRequestHeaders.set("cookie", `${cookieName}=${validSession}`);

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    title: "Corrida Protegida",
                    max_responses: 50,
                    closes_at: "2026-12-31T23:59:59Z",
                    status: "published",
                    share_code_hash: "e".repeat(64),
                    share_code_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "questions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: "q-1", label: "Nome", field_type: "text", position: 0 }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "responses") {
          return {
            select: vi.fn().mockImplementation((_cols: string, opts?: any) => {
              if (opts?.head) {
                return {
                  eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "resp-1",
                          answers: { "q-1": "Ana" },
                          submitted_at: "2026-10-01T10:00:00Z",
                          updated_at: null,
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              };
            }),
          };
        }
        return {};
      });

      const res = await (getSharedResponses as any)({ data: { token: VALID_TOKEN } });
      expect(res.state).toBe("ok");
      expect(res.form.title).toBe("Corrida Protegida");
      expect(res.responses).toHaveLength(1);

      const jsonString = JSON.stringify(res);
      expect(jsonString).not.toContain("share_code_hash");
      expect(jsonString).not.toContain("share_code_salt");
      expect(jsonString).not.toContain("share_code_version");
    });

    it("legado (sem share_code_hash) -> devolve ok sem exigir cookie", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    title: "Corrida SKF Legado",
                    max_responses: 50,
                    closes_at: "2026-12-31T23:59:59Z",
                    status: "published",
                    share_code_hash: null,
                    share_code_version: 0,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "questions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "q-1",
                      label: "Nome Completo",
                      field_type: "text",
                      position: 1,
                    },
                    {
                      id: "q-2",
                      label: "CPF",
                      field_type: "cpf",
                      position: 2,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "responses") {
          return {
            select: vi.fn().mockImplementation((_cols: string, opts?: any) => {
              if (opts?.head) {
                return {
                  eq: vi.fn().mockResolvedValue({
                    count: 1,
                    error: null,
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "resp-1",
                          answers: { "q-1": "Carlos Silva", "q-2": "529.982.247-25" },
                          submitted_at: "2026-10-01T10:00:00Z",
                          updated_at: "2026-10-01T12:00:00Z",
                          edit_token: "secret-edit-token-111111111111",
                          identifier: "52998224725",
                          consented_at: "2026-10-01T10:00:00Z",
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              };
            }),
          };
        }
        return {};
      });

      const res = await (getSharedResponses as any)({ data: { token: VALID_TOKEN } });
      expect(res.state).toBe("ok");
      expect(res.form.title).toBe("Corrida SKF Legado");
    });

    it("higiene de logs: nenhum console.error de qualquer fluxo contém token completo, código ou cookie", async () => {
      const secretCode = "ABCDEFGH23";
      const fakeCookieVal = "cookie-secreto-assinado-999999";
      mockRequestHeaders.set("cookie", `fbp_share_1234=${fakeCookieVal}`);

      mockSupabaseAdmin.from.mockImplementation(() => {
        throw new Error("Falha de conexão com o banco");
      });

      await (createShareLink as any)({
        data: { formId: FORM_ID, regenerate: true },
        context: { userId: "owner-123" },
      });
      await (regenerateAccessCode as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });
      await (revokeShareLink as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });
      await (unlockSharedLink as any)({
        data: { token: VALID_TOKEN, code: secretCode },
      });
      await expect(
        (getSharedResponses as any)({ data: { token: VALID_TOKEN } }),
      ).rejects.toThrow("Não foi possível carregar os dados.");

      expect(consoleErrorSpy).toHaveBeenCalled();
      for (const call of consoleErrorSpy.mock.calls) {
        const logContent = call.join(" ");
        expect(logContent).not.toContain(VALID_TOKEN);
        expect(logContent).not.toContain(VALID_TOKEN_2);
        expect(logContent).not.toContain(secretCode);
        expect(logContent).not.toContain(fakeCookieVal);
      }
    });
  });
});
