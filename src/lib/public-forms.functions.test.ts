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
  getRequest: () => new Request("https://inscricoes.corretime.com.br/api"),
}));

import {
  getPublicForm,
  submitResponse,
  loadPublicFormAndQuestions,
} from "./public-forms.functions";

describe("public-forms.functions (QA-GAP-09, SEC-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPublicForm - tratamento de erros do banco e not_found (SEC-19)", () => {
    it("lança erro genérico quando a consulta de forms retorna erro", async () => {
      mockSupabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { message: "connection refused", code: "ECONNREFUSED" },
            }),
          }),
        }),
      });

      await expect(getPublicForm({ data: { slug: "corrida-2026" } })).rejects.toThrow(
        "Não foi possível carregar o formulário.",
      );
    });

    it("retorna { state: 'not_found' } quando o slug não existe no banco (sem erro)", async () => {
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

      const res = await getPublicForm({ data: { slug: "slug-inexistente" } });
      expect(res.state).toBe("not_found");
    });

    it("lança erro genérico quando a contagem de respostas retorna erro", async () => {
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: { id: "f-1", title: "Form", status: "published", closes_at: null, max_responses: null, theme: {} },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({
              count: null,
              error: { message: "timeout counting rows" },
            }),
          }),
        });

      await expect(getPublicForm({ data: { slug: "corrida-2026" } })).rejects.toThrow(
        "Não foi possível carregar o formulário.",
      );
    });

    it("lança erro genérico quando a consulta de perguntas retorna erro", async () => {
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: { id: "f-1", title: "Form", status: "published", closes_at: null, max_responses: null, theme: {} },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({
              count: 0,
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockResolvedValueOnce({
                data: null,
                error: { message: "error querying questions" },
              }),
            }),
          }),
        });

      await expect(getPublicForm({ data: { slug: "corrida-2026" } })).rejects.toThrow(
        "Não foi possível carregar o formulário.",
      );
    });

    it("prova que getPublicForm usa lista explícita de colunas e o payload NUNCA contém share_token nem edit_window_hours (T-25 / SEC-24)", async () => {
      let selectedCols = "";
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockImplementation((cols: string) => {
            selectedCols = cols;
            return {
              eq: vi.fn().mockReturnValueOnce({
                maybeSingle: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: "f-1",
                    title: "Form",
                    description: "Desc",
                    status: "published",
                    closes_at: null,
                    max_responses: null,
                    success_message: "Sucesso",
                    consent_text: null,
                    theme: { color: "#4f46e5", font: "body", logo_url: null },
                    // Mesmo que o banco devolvesse campos adicionais:
                    share_token: "secret-share-token-1234567890",
                    edit_window_hours: 48,
                    owner_id: "secret-owner",
                  },
                  error: null,
                }),
              }),
            };
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({
              count: 0,
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockResolvedValueOnce({
                data: [],
                error: null,
              }),
            }),
          }),
        });

      const res = await getPublicForm({ data: { slug: "corrida-2026" } });

      // Deve ter usado lista explícita de colunas, nunca '*'
      expect(selectedCols).not.toBe("*");
      expect(selectedCols).toContain("id");
      expect(selectedCols).toContain("title");
      expect(selectedCols).not.toContain("share_token");
      expect(selectedCols).not.toContain("edit_window_hours");

      // Payload nunca contém share_token nem edit_window_hours
      expect(res.state).toBe("open");
      const jsonString = JSON.stringify(res);
      expect(jsonString).not.toContain("share_token");
      expect(jsonString).not.toContain("edit_window_hours");
      expect((res.form as any)?.share_token).toBeUndefined();
      expect((res.form as any)?.edit_window_hours).toBeUndefined();
    });
  });

  describe("loadPublicFormAndQuestions - tratamento de erros na submissão (SEC-19)", () => {
    it("lança erro genérico quando a consulta de forms retorna erro", async () => {
      mockSupabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { message: "internal db error" },
            }),
          }),
        }),
      });

      await expect(loadPublicFormAndQuestions(mockSupabaseAdmin as any, "corrida-2026")).rejects.toThrow(
        "Não foi possível carregar o formulário.",
      );
    });

    it("lança erro genérico quando a consulta de questions retorna erro", async () => {
      mockSupabaseAdmin.from
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
                error: { message: "error in questions" },
              }),
            }),
          }),
        });

      await expect(loadPublicFormAndQuestions(mockSupabaseAdmin as any, "corrida-2026")).rejects.toThrow(
        "Não foi possível carregar o formulário.",
      );
    });

    it("retorna { form: null, questions: [] } quando o formulário não existe (sem erro)", async () => {
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

      const res = await loadPublicFormAndQuestions(mockSupabaseAdmin as any, "inexistente");
      expect(res.form).toBeNull();
      expect(res.questions).toEqual([]);
    });
  });
});
