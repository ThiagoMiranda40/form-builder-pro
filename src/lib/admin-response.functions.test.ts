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

// Mock de supabaseAdmin e Resend
const mockSupabaseAdmin = {
  from: vi.fn(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { id: "requireSupabaseAuth" },
}));

const mockSendConfirmationEmail = vi.fn();
vi.mock("@/lib/confirmation-email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/confirmation-email")>();
  return {
    ...actual,
    sendConfirmationEmail: (...args: any[]) => mockSendConfirmationEmail(...args),
  };
});

import {
  adminUpdateResponse,
  resendEditLink,
} from "./admin-response.functions";

const RESPONSE_ID = "11111111-1111-4111-a111-111111111111";
const FORM_ID = "22222222-2222-4222-a222-222222222222";

describe("admin-response.functions (T-23, SEC-22, SEC-23)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Configuração de métodos e autenticação", () => {
    it("adminUpdateResponse deve ser POST e exigir autenticação", () => {
      expect((adminUpdateResponse as any).method).toBe("POST");
    });

    it("resendEditLink deve ser POST e exigir autenticação", () => {
      expect((resendEditLink as any).method).toBe("POST");
    });
  });

  describe("adminUpdateResponse", () => {
    it("retorna erro genérico quando o usuário autenticado NÃO é o dono do formulário", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: RESPONSE_ID,
                    form_id: FORM_ID,
                    answers: { "q-nome": "Fulano" },
                    identifier: "52998224725",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "another-user", // outro dono!
                    title: "Formulário Secreto",
                    status: "published",
                    closes_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (adminUpdateResponse as any)({
        data: {
          responseId: RESPONSE_ID,
          answers: { "q-nome": "Fulano" },
        },
        context: { userId: "owner-123" },
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBe("Inscrição não encontrada.");
    });

    it("retorna exatamente o MESMO erro genérico quando a inscrição não existe", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
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

      const res = await (adminUpdateResponse as any)({
        data: {
          responseId: RESPONSE_ID,
          answers: { "q-nome": "Fulano" },
        },
        context: { userId: "owner-123" },
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBe("Inscrição não encontrada.");
    });

    it("recusa alteração de dígitos do CPF com erro identifier_locked", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: RESPONSE_ID,
                    form_id: FORM_ID,
                    answers: { "q-cpf": "529.982.247-25" },
                    identifier: "52998224725",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    title: "Formulário",
                    status: "published",
                    closes_at: null,
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
                      id: "q-cpf",
                      label: "CPF",
                      field_type: "cpf",
                      required: true,
                      options: [],
                      position: 0,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (adminUpdateResponse as any)({
        data: {
          responseId: RESPONSE_ID,
          answers: { "q-cpf": "111.222.333-44" }, // CPF alterado!
        },
        context: { userId: "owner-123" },
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBe("O CPF não pode ser alterado.");
    });

    it("recusa validação se campo obrigatório estiver vazio ou e-mail inválido", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: RESPONSE_ID,
                    form_id: FORM_ID,
                    answers: { "q-nome": "Maria", "q-email": "maria@teste.com" },
                    identifier: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    title: "Formulário",
                    status: "published",
                    closes_at: null,
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
                      id: "q-nome",
                      label: "Nome",
                      field_type: "text",
                      required: true,
                      options: [],
                      position: 0,
                    },
                    {
                      id: "q-email",
                      label: "E-mail",
                      field_type: "email",
                      required: true,
                      options: [],
                      position: 1,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      // Obrigatório vazio
      const resVazio = await (adminUpdateResponse as any)({
        data: {
          responseId: RESPONSE_ID,
          answers: { "q-nome": "", "q-email": "maria@teste.com" },
        },
        context: { userId: "owner-123" },
      });
      expect(resVazio.ok).toBe(false);

      // E-mail inválido
      const resEmailInvalido = await (adminUpdateResponse as any)({
        data: {
          responseId: RESPONSE_ID,
          answers: { "q-nome": "Maria", "q-email": "email_invalido" },
        },
        context: { userId: "owner-123" },
      });
      expect(resEmailInvalido.ok).toBe(false);
    });

    it("permite ao dono editar formulário ENCERRADO ou com prazo vencido", async () => {
      const updateSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: RESPONSE_ID,
                    form_id: FORM_ID,
                    answers: { "q-nome": "Fulano", "q-dist": "5 km" },
                    identifier: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: updateSpy,
          };
        }
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    title: "Formulário Encerrado",
                    status: "closed", // formulário encerrado!
                    closes_at: "2020-01-01T00:00:00Z", // prazo vencido!
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
                      id: "q-nome",
                      label: "Nome",
                      field_type: "text",
                      required: true,
                      options: [],
                      position: 0,
                    },
                    {
                      id: "q-dist",
                      label: "Distância",
                      field_type: "single_choice",
                      required: true,
                      options: ["5 km", "10 km"],
                      position: 1,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (adminUpdateResponse as any)({
        data: {
          responseId: RESPONSE_ID,
          answers: { "q-nome": "Fulano", "q-dist": "10 km" },
        },
        context: { userId: "owner-123" },
      });

      expect(res.ok).toBe(true);
      // Verifica que o update atualizou apenas answers e updated_at
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          answers: { "q-nome": "Fulano", "q-dist": "10 km" },
          updated_at: expect.any(String),
        }),
      );
      // Garante que identifier, edit_token e submitted_at NÃO foram passados no update
      const updateArg = updateSpy.mock.calls[0]?.[0];
      expect(updateArg).not.toHaveProperty("identifier");
      expect(updateArg).not.toHaveProperty("edit_token");
      expect(updateArg).not.toHaveProperty("submitted_at");
      expect(updateArg).not.toHaveProperty("consented_at");
    });

    it("nunca registra e-mail nem CPF nos logs em caso de erro", async () => {
      mockSupabaseAdmin.from.mockImplementation(() => {
        throw new Error("Erro de banco inesperado");
      });

      const res = await (adminUpdateResponse as any)({
        data: {
          responseId: RESPONSE_ID,
          answers: { "q-nome": "Sensível", "q-cpf": "529.982.247-25", "q-email": "secreto@teste.com" },
        },
        context: { userId: "owner-123" },
      });

      expect(res.ok).toBe(false);
      const allLogs = consoleErrorSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join(" ");
      expect(allLogs).not.toContain("52998224725");
      expect(allLogs).not.toContain("529.982.247-25");
      expect(allLogs).not.toContain("secreto@teste.com");
    });
  });

  describe("resendEditLink", () => {
    it("recusa requisição se usuário não for o dono", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: RESPONSE_ID,
                    form_id: FORM_ID,
                    answers: { "q-email": "maria@teste.com" },
                    edit_token: "token123",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "other-user",
                    title: "Formulário",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (resendEditLink as any)({
        data: { responseId: RESPONSE_ID },
        context: { userId: "owner-123" },
      });

      expect(res.sent).toBe(false);
      expect(res.error).toBe("Inscrição não encontrada.");
    });

    it("retorna erro no_email se inscrição não possuir pergunta de e-mail preenchida", async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: RESPONSE_ID,
                    form_id: FORM_ID,
                    answers: { "q-nome": "Maria" },
                    edit_token: "token123",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    title: "Formulário",
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
                    { id: "q-nome", label: "Nome", field_type: "text", position: 0 },
                    { id: "q-email", label: "E-mail", field_type: "email", position: 1 },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (resendEditLink as any)({
        data: { responseId: RESPONSE_ID },
        context: { userId: "owner-123" },
      });

      expect(res.sent).toBe(false);
      expect(res.code).toBe("no_email");
    });

    it("retorna erro genérico quando o provedor falha (sem expor erro do provedor)", async () => {
      mockSendConfirmationEmail.mockResolvedValueOnce(false);

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: RESPONSE_ID,
                    form_id: FORM_ID,
                    answers: { "q-email": "maria@teste.com" },
                    edit_token: "token123",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    title: "Formulário",
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
                    { id: "q-email", label: "E-mail", field_type: "email", position: 0 },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (resendEditLink as any)({
        data: { responseId: RESPONSE_ID },
        context: { userId: "owner-123" },
      });

      expect(res.sent).toBe(false);
      expect(res.error).toBe("Não foi possível enviar o e-mail. Tente novamente.");
    });

    it("envia e-mail com sucesso e link canônico", async () => {
      mockSendConfirmationEmail.mockResolvedValueOnce(true);

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === "responses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: RESPONSE_ID,
                    form_id: FORM_ID,
                    answers: { "q-email": "maria@teste.com" },
                    edit_token: "token123",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "forms") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: FORM_ID,
                    owner_id: "owner-123",
                    title: "Formulário de Corrida",
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
                    { id: "q-email", label: "E-mail", field_type: "email", position: 0 },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await (resendEditLink as any)({
        data: { responseId: RESPONSE_ID },
        context: { userId: "owner-123" },
      });

      expect(res.sent).toBe(true);
      expect(mockSendConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "maria@teste.com",
          html: expect.stringContaining("https://inscricoes.corretime.com.br/editar/token123"),
        }),
      );
    });
  });
});
