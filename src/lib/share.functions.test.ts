import { describe, it, expect, vi, beforeEach } from "vitest";

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
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { id: "requireSupabaseAuth" },
}));

import {
  createShareLink,
  revokeShareLink,
  getSharedResponses,
} from "./share.functions";

const FORM_ID = "22222222-2222-4222-a222-222222222222";
const VALID_TOKEN = "a".repeat(64);
const VALID_TOKEN_2 = "b".repeat(64);

describe("share.functions (T-25, SEC-24, SEC-25)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Configuração de métodos e autenticação", () => {
    it("createShareLink deve ser POST e exigir autenticação", () => {
      expect((createShareLink as any).method).toBe("POST");
      expect((createShareLink as any).middlewareList).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "requireSupabaseAuth" })])
      );
    });

    it("revokeShareLink deve ser POST e exigir autenticação", () => {
      expect((revokeShareLink as any).method).toBe("POST");
      expect((revokeShareLink as any).middlewareList).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "requireSupabaseAuth" })])
      );
    });

    it("getSharedResponses deve ser POST e pública (sem requireSupabaseAuth)", () => {
      expect((getSharedResponses as any).method).toBe("POST");
      expect((getSharedResponses as any).middlewareList ?? []).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "requireSupabaseAuth" })])
      );
    });
  });

  describe("createShareLink", () => {
    it("retorna erro genérico quando o formulário não existe ou pertence a outro dono", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "other-user", // outro dono
                    share_token: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (createShareLink as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });

      expect(res).toEqual({ ok: false, error: "Formulário não encontrado." });
    });

    it("se já existe token e regenerate não for verdadeiro, devolve o token existente sem atualizar", async () => {
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

      expect(res).toEqual({ ok: true, shareToken: VALID_TOKEN });
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("gera token de 64 hex minúsculos e grava com filtro de id E owner_id", async () => {
      let savedToken: string | null = null;
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
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              savedToken = payload.share_token;
              const chain: any = {
                eq: vi.fn().mockImplementation((col: string, val: any) => {
                  eqCalls.push([col, val]);
                  return chain;
                }),
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
      expect(savedToken).toBe(res.shareToken);
      expect(eqCalls).toEqual(
        expect.arrayContaining([
          ["id", FORM_ID],
          ["owner_id", "owner-123"],
        ])
      );
    });

    it("com regenerate: true, gera um novo token diferente do existente", async () => {
      let savedToken: string | null = null;
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
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              savedToken = payload.share_token;
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
      expect(res.shareToken).toMatch(/^[0-9a-f]{64}$/);
      expect(res.shareToken).not.toBe(VALID_TOKEN);
      expect(savedToken).toBe(res.shareToken);
    });
  });

  describe("revokeShareLink", () => {
    it("retorna erro genérico quando o formulário não existe ou não pertence ao usuário", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (revokeShareLink as any)({
        data: { formId: FORM_ID },
        context: { userId: "owner-123" },
      });

      expect(res).toEqual({ ok: false, error: "Formulário não encontrado." });
    });

    it("se for o dono, grava share_token = null com filtro de id e owner_id", async () => {
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
      expect(updatePayload).toEqual({ share_token: null });
      expect(eqCalls).toEqual(
        expect.arrayContaining([
          ["id", FORM_ID],
          ["owner_id", "owner-123"],
        ])
      );
    });
  });

  describe("getSharedResponses", () => {
    it("com token inválido (curto, formato errado, caracteres especiais), não chama o banco e devolve not_found", async () => {
      const fromFn = mockSupabaseAdmin.from;

      const res1 = await (getSharedResponses as any)({ data: { token: "token-invalido" } });
      const res2 = await (getSharedResponses as any)({ data: { token: "" } });
      const res3 = await (getSharedResponses as any)({ data: { token: "A".repeat(64) } }); // maiúsculas

      expect(res1).toEqual({ state: "not_found" });
      expect(res2).toEqual({ state: "not_found" });
      expect(res3).toEqual({ state: "not_found" });
      expect(fromFn).not.toHaveBeenCalled();
    });

    it("com token desconhecido ou revogado no banco, devolve o mesmo not_found", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (getSharedResponses as any)({ data: { token: VALID_TOKEN } });
      expect(res).toEqual({ state: "not_found" });
    });

    it("retorna payload 'ok' ordenado, com contagem e sem expor campos sensíveis", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    title: "Corrida SKF",
                    max_responses: 50,
                    closes_at: "2026-12-31T23:59:59Z",
                    status: "published",
                    // campos que NÃO devem vazar
                    owner_id: "secret-owner",
                    share_token: VALID_TOKEN,
                    edit_window_hours: 24,
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
                      required: true,
                      options: [],
                    },
                    {
                      id: "q-2",
                      label: "CPF",
                      field_type: "cpf",
                      position: 2,
                      required: true,
                      options: [],
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
            select: vi.fn().mockImplementation((cols: string, opts?: any) => {
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
                          // campos sensíveis que o banco pode conter
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
      expect(res.form).toEqual({
        title: "Corrida SKF",
        max_responses: 50,
        closes_at: "2026-12-31T23:59:59Z",
        status: "published",
        responses_count: 1,
      });

      // Confere lista exata de perguntas
      expect(res.questions).toEqual([
        { id: "q-1", label: "Nome Completo", field_type: "text", position: 1 },
        { id: "q-2", label: "CPF", field_type: "cpf", position: 2 },
      ]);

      // Confere respostas
      expect(res.responses).toHaveLength(1);
      expect(res.responses[0]).toEqual({
        id: "resp-1",
        answers: { "q-1": "Carlos Silva", "q-2": "529.982.247-25" },
        submitted_at: "2026-10-01T10:00:00Z",
        updated_at: "2026-10-01T12:00:00Z",
      });

      // PROVA DE SEGURANÇA: Nenhum campo sensível deve existir no payload
      const FORBIDDEN_KEYS = ["edit_token", "identifier", "consented_at", "share_token", "owner_id"];
      const jsonString = JSON.stringify(res);
      for (const key of FORBIDDEN_KEYS) {
        expect(jsonString).not.toContain(`"${key}"`);
      }

      // Confere formato de chaves permitidas na resposta
      expect(Object.keys(res.form).sort()).toEqual(
        ["closes_at", "max_responses", "responses_count", "status", "title"].sort()
      );
      expect(Object.keys(res.questions[0]).sort()).toEqual(
        ["field_type", "id", "label", "position"].sort()
      );
      expect(Object.keys(res.responses[0]).sort()).toEqual(
        ["answers", "id", "submitted_at", "updated_at"].sort()
      );
    });

    it("higiene de logs: nenhum log registra dado pessoal em caso de exceção", async () => {
      mockSupabaseAdmin.from.mockImplementation(() => {
        throw new Error("Falha de conexão com o banco");
      });

      await expect(
        (getSharedResponses as any)({ data: { token: VALID_TOKEN } })
      ).rejects.toThrow("Não foi possível carregar os dados.");

      // Confere que logs não têm dados pessoais
      for (const call of consoleErrorSpy.mock.calls) {
        const logContent = call.join(" ");
        expect(logContent).not.toMatch(/@/); // sem email
        expect(logContent).not.toMatch(/\d{11}/); // sem CPF
      }
    });
  });
});
