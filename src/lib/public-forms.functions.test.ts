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

    it("T-24c: getPublicForm inclui event_date, event_time, event_location e settings das perguntas", async () => {
      let formCols = "";
      let questionCols = "";
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockImplementation((cols: string) => {
            formCols = cols;
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
                    theme: {},
                    event_date: "2026-10-10",
                    event_time: "07:30",
                    event_location: "Parque",
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
          select: vi.fn().mockImplementation((cols: string) => {
            questionCols = cols;
            return {
              eq: vi.fn().mockReturnValueOnce({
                order: vi.fn().mockResolvedValueOnce({
                  data: [
                    {
                      id: "q-1",
                      label: "Nasc",
                      help_text: "",
                      field_type: "birthdate",
                      required: true,
                      options: [],
                      position: 0,
                      settings: { minAge: 18, maxAge: null },
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }),
        });

      const res = await getPublicForm({ data: { slug: "corrida-2026" } });
      expect(formCols).toContain("event_date");
      expect(formCols).toContain("event_time");
      expect(formCols).toContain("event_location");
      expect(questionCols).toContain("settings");

      expect(res.form?.event_date).toBe("2026-10-10");
      expect(res.form?.event_time).toBe("07:30");
      expect(res.form?.event_location).toBe("Parque");
      expect(res.questions?.[0]?.settings).toEqual({ minAge: 18, maxAge: null });
    });
  });

  describe("T-51 (M-46): Coluna whatsapp_group_link e isolamento de carregamento público", () => {
    const validGroupLink = "https://chat.whatsapp.com/LPUC195Oj4n7Gi4v60rS3A";

    it("(a) loadPublicFormAndQuestions devolve whatsapp_group_link no objeto form e o select contém a coluna", async () => {
      let selectCols = "";
      const fakeSupabase = {
        from: (table: string) => {
          if (table === "forms") {
            return {
              select: (cols: string) => {
                selectCols = cols;
                return {
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: "form-abc",
                        title: "Form Teste",
                        status: "published",
                        closes_at: null,
                        max_responses: null,
                        success_message: "OK",
                        consent_text: null,
                        whatsapp_group_link: validGroupLink,
                      },
                      error: null,
                    }),
                  }),
                };
              },
            };
          }
          if (table === "questions") {
            return {
              select: () => ({
                eq: () => ({
                  order: async () => ({ data: [], error: null }),
                }),
              }),
            };
          }
          throw new Error(`Tabela inesperada: ${table}`);
        },
      };

      const res = await loadPublicFormAndQuestions(fakeSupabase as any, "form-teste");
      expect(selectCols).toContain("whatsapp_group_link");
      expect(selectCols).toContain("whatsapp_group_notice_text");
      expect(selectCols).toContain("whatsapp_group_invite_text");
      expect(res.form?.whatsapp_group_link).toBe(validGroupLink);
    });

    it("(b) getPublicForm com link válido e aviso preenchido devolve groupNotice mas NÃO expõe link no payload (T-50 / T-56 / SEC-46)", async () => {
      let selectColsUsed = "";
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn((cols: string) => {
            selectColsUsed = cols;
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
                    theme: {},
                    whatsapp_group_link: validGroupLink,
                    whatsapp_group_notice_text: "Temos grupo de avisos no WhatsApp.",
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

      // O select do getPublicForm contém whatsapp_group_link e whatsapp_group_notice_text no servidor
      expect(selectColsUsed).toContain("whatsapp_group_link");
      expect(selectColsUsed).toContain("whatsapp_group_notice_text");

      // groupNotice vem com o texto sanitizado
      expect(res.state).toBe("open");
      expect(res.form?.groupNotice).toBe("Temos grupo de avisos no WhatsApp.");

      // A serialização do retorno NÃO deve conter o link real nem dados vazados
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain("chat.whatsapp.com");
      expect(serialized).not.toContain("whatsapp_group_link");
      expect(serialized).not.toContain("groupLink");
      expect(serialized).not.toContain("hasGroupInvite");
    });

    it("(c) getPublicForm com aviso preenchido mas link nulo ou inválido devolve groupNotice: null (T-56 / SEC-46)", async () => {
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
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
                  theme: {},
                  whatsapp_group_link: null,
                  whatsapp_group_notice_text: "Temos grupo de avisos no WhatsApp.",
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({ count: 0, error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        });

      const res = await getPublicForm({ data: { slug: "corrida-2026" } });
      expect(res.state).toBe("open");
      expect(res.form?.groupNotice).toBeNull();
    });

    it("(d) getPublicForm com link válido mas aviso vazio ou contendo URL devolve groupNotice: null (T-56 / SEC-49)", async () => {
      mockSupabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
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
                  theme: {},
                  whatsapp_group_link: validGroupLink,
                  whatsapp_group_notice_text: "Acesse https://malicious.com para ver",
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockResolvedValueOnce({ count: 0, error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
        });

      const res = await getPublicForm({ data: { slug: "corrida-2026" } });
      expect(res.state).toBe("open");
      expect(res.form?.groupNotice).toBeNull();
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
