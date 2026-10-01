import { describe, it, expect, vi, beforeEach } from "vitest";

// Simula @tanstack/react-start para testar as funções de servidor (QA-GAP-09)
vi.mock("@tanstack/react-start", () => {
  return {
    createServerFn: (options?: { method?: string }) => {
      return {
        options,
        validator: (validatorFn: (data: unknown) => unknown) => ({
          handler: (handlerFn: (ctx: { data: unknown }) => unknown) => {
            const fn = async (args?: { data?: unknown }) => {
              const validated = validatorFn ? validatorFn(args?.data) : args?.data;
              return handlerFn({ data: validated });
            };
            (fn as any).method = options?.method;
            (fn as any).options = options;
            return fn;
          },
        }),
      };
    },
  };
});

// Mock de supabaseAdmin e getRequest
const mockSupabaseAdmin = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://inscricoes.triadetecnologiaesolucoes.com.br/api"),
}));

import {
  getResponseForEdit,
  updateResponseByToken,
  loadResponseForEditByToken,
} from "./edit-response.functions";

const VALID_TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("edit-response.functions (QA-GAP-09, SEC-18, SEC-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuração de método HTTP (QA-GAP-09, SEC-18)", () => {
    it("getResponseForEdit deve usar method: 'POST'", () => {
      expect((getResponseForEdit as any).method).toBe("POST");
    });

    it("updateResponseByToken deve usar method: 'POST'", () => {
      expect((updateResponseByToken as any).method).toBe("POST");
    });
  });

  describe("Carregamento compartilhado por token e tratamento de erros do banco (SEC-19)", () => {
    it("lança erro genérico quando a consulta de responses retorna erro do banco", async () => {
      mockSupabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { message: "connection timeout", code: "57014" },
            }),
          }),
        }),
      });

      await expect(loadResponseForEditByToken(mockSupabaseAdmin as any, VALID_TOKEN)).rejects.toThrow(
        "Não foi possível carregar os dados da inscrição.",
      );
    });

    it("lança erro genérico quando a consulta de forms retorna erro do banco", async () => {
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: { id: "r-1", form_id: "f-1", answers: {}, identifier: "52998224725", updated_at: "2026-01-01" },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: null,
                error: { message: "deadlock detected", code: "40P01" },
              }),
            }),
          }),
        });

      await expect(loadResponseForEditByToken(mockSupabaseAdmin as any, VALID_TOKEN)).rejects.toThrow(
        "Não foi possível carregar os dados da inscrição.",
      );
    });

    it("lança erro genérico quando a consulta de questions retorna erro do banco", async () => {
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: { id: "r-1", form_id: "f-1", answers: {}, identifier: "52998224725", updated_at: "2026-01-01" },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: { id: "f-1", title: "Form", status: "published", closes_at: null, max_responses: null },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockResolvedValueOnce({
                data: null,
                error: { message: "query failed", code: "XX000" },
              }),
            }),
          }),
        });

      await expect(loadResponseForEditByToken(mockSupabaseAdmin as any, VALID_TOKEN)).rejects.toThrow(
        "Não foi possível carregar os dados da inscrição.",
      );
    });

    it("retorna { response: null, form: null, questions: [] } quando o token não existe (sem erro)", async () => {
      mockSupabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const res = await loadResponseForEditByToken(mockSupabaseAdmin as any, VALID_TOKEN);
      expect(res.response).toBeNull();
      expect(res.form).toBeNull();
      expect(res.questions).toEqual([]);
    });
  });

  describe("Execução das server functions através do handler simulado", () => {
    it("getResponseForEdit rejeita com erro genérico quando ocorre falha no banco (não vira not_found)", async () => {
      mockSupabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { message: "database offline" },
            }),
          }),
        }),
      });

      await expect(getResponseForEdit({ data: { token: VALID_TOKEN } })).rejects.toThrow(
        "Não foi possível carregar o formulário.",
      );
    });

    it("updateResponseByToken retorna erro amigável quando ocorre falha no banco (não vira not_found)", async () => {
      mockSupabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { message: "database offline" },
            }),
          }),
        }),
      });

      const res = await updateResponseByToken({
        data: {
          token: VALID_TOKEN,
          answers: { "q-1": "test" },
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Não foi possível salvar. Tente novamente.");
        expect(res.error).not.toContain("database offline");
      }
    });
  });
});
