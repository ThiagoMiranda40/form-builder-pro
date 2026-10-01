import { describe, expect, it, vi } from "vitest";
import {
  ALLOWED_ORIGINS,
  getOrigin,
  handleSubmission,
  submitSchema,
  createTimedFetch,
  type SubmissionDeps,
  type SubmitInput,
} from "./submit-response";

describe("T-09: Servidor de inscrição via banco", () => {
  describe("submitSchema e limites do answers (SEC-02)", () => {
    it("aceita payload com 3 chaves", () => {
      const valid = {
        slug: "corrida-2026",
        answers: {
          q1: "João Silva",
          q2: "11999999999",
          q3: ["Opção 1", "Opção 2"],
        },
      };
      const res = submitSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it("aceita payload com exatamente 200 chaves", () => {
      const answers: Record<string, string> = {};
      for (let i = 1; i <= 200; i++) {
        answers[`q_${i}`] = `resposta_${i}`;
      }
      const res = submitSchema.safeParse({ slug: "corrida-2026", answers });
      expect(res.success).toBe(true);
    });

    it("rejeita payload com 201 chaves com mensagem genérica", () => {
      const answers: Record<string, string> = {};
      for (let i = 1; i <= 201; i++) {
        answers[`q_${i}`] = `resposta_${i}`;
      }
      const res = submitSchema.safeParse({ slug: "corrida-2026", answers });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe(
          "Não foi possível enviar. Verifique os campos e tente novamente.",
        );
      }
    });

    it("rejeita chave com 101 caracteres com mensagem genérica", () => {
      const longKey = "a".repeat(101);
      const res = submitSchema.safeParse({
        slug: "corrida-2026",
        answers: { [longKey]: "teste" },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe(
          "Não foi possível enviar. Verifique os campos e tente novamente.",
        );
      }
    });

    it("rejeita valor de texto com 10001 caracteres com mensagem genérica", () => {
      const longValue = "x".repeat(10001);
      const res = submitSchema.safeParse({
        slug: "corrida-2026",
        answers: { q1: longValue },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe(
          "Não foi possível enviar. Verifique os campos e tente novamente.",
        );
      }
    });

    it("rejeita tamanho total serializado acima de 100 KB com mensagem genérica", () => {
      // 12 chaves com 9000 caracteres cada ~ 108 KB > 100 KB
      const answers: Record<string, string> = {};
      for (let i = 1; i <= 12; i++) {
        answers[`k${i}`] = "y".repeat(9000);
      }
      const res = submitSchema.safeParse({ slug: "corrida-2026", answers });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe(
          "Não foi possível enviar. Verifique os campos e tente novamente.",
        );
      }
    });
  });

  describe("getOrigin e origens permitidas (SEC-04)", () => {
    it("contém as origens permitidas esperadas", () => {
      expect(ALLOWED_ORIGINS).toContain("https://inscricoes.triadetecnologiaesolucoes.com.br");
      expect(ALLOWED_ORIGINS).toContain("http://localhost:8080");
    });

    it("troca origem estranha pela primeira origem permitida", () => {
      expect(getOrigin("https://evil-site.workers.dev")).toBe(ALLOWED_ORIGINS[0]);
      expect(getOrigin("http://malicious.com")).toBe(ALLOWED_ORIGINS[0]);
      expect(getOrigin(undefined)).toBe(ALLOWED_ORIGINS[0]);
    });

    it("mantém origens da lista permitida", () => {
      expect(getOrigin("https://inscricoes.triadetecnologiaesolucoes.com.br")).toBe(
        "https://inscricoes.triadetecnologiaesolucoes.com.br",
      );
      expect(getOrigin("http://localhost:8080")).toBe("http://localhost:8080");
    });
  });

  describe("handleSubmission e fluxo de inscrição", () => {
    const mockForm = {
      id: "form-123",
      title: "Corrida SKF 2026",
      status: "published",
      closes_at: null,
      max_responses: 100,
      success_message: "Inscrição realizada com sucesso!",
      consent_text: "Concordo com os termos da LGPD.",
    };

    const mockQuestions = [
      {
        id: "q-cpf",
        label: "CPF",
        field_type: "cpf",
        required: true,
        options: [],
        position: 1,
      },
      {
        id: "q-email",
        label: "E-mail",
        field_type: "email",
        required: true,
        options: [],
        position: 2,
      },
      {
        id: "q-nome",
        label: "Nome completo",
        field_type: "short_text",
        required: true,
        options: [],
        position: 0,
      },
    ];

    function createMockDeps(overrides: Partial<SubmissionDeps> = {}): SubmissionDeps {
      return {
        loadFormAndQuestions: vi.fn().mockResolvedValue({
          form: mockForm,
          questions: mockQuestions,
        }),
        rpcSubmitResponse: vi.fn().mockResolvedValue({
          data: {
            status: "ok",
            edit_token: "tok_secret_1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
            success_message: mockForm.success_message,
          },
          error: null,
        }),
        fetchFn: vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
        getOrigin: vi.fn().mockReturnValue("https://inscricoes.triadetecnologiaesolucoes.com.br"),
        readEnv: vi.fn((key: string) => {
          if (key === "RESEND_API_KEY") return "re_12345678901234567890";
          if (key === "EMAIL_FROM") return "inscricoes@triadetecnologiaesolucoes.com.br";
          return undefined;
        }),
        logError: vi.fn(),
        ...overrides,
      };
    }

    const validSubmission: SubmitInput = {
      slug: "corrida-skf",
      answers: {
        "q-nome": "Maria Souza",
        "q-cpf": "529.982.247-25",
        "q-email": "maria@example.com",
      },
      consent: true,
      hp: "",
    };

    it("honeypot preenchido responde sucesso sem gravar e sem chamar rpc", async () => {
      const deps = createMockDeps();
      const res = await handleSubmission(deps, {
        ...validSubmission,
        hp: "http://spam-bot.com",
      });

      expect(res).toEqual({
        ok: true,
        message: "Inscrição confirmada!",
        emailSent: false,
      });
      expect(deps.loadFormAndQuestions).not.toHaveBeenCalled();
      expect(deps.rpcSubmitResponse).not.toHaveBeenCalled();
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });

    it("valida respostas e retorna erro por campo se inválido sem chamar rpc", async () => {
      const deps = createMockDeps();
      const res = await handleSubmission(deps, {
        ...validSubmission,
        answers: {
          ...validSubmission.answers,
          "q-cpf": "111.111.111-11", // CPF inválido
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.field).toBe("q-cpf");
        expect(res.error).toContain("CPF inválido");
      }
      expect(deps.rpcSubmitResponse).not.toHaveBeenCalled();
    });

    it("normaliza CPF e chama rpc com identifier correto", async () => {
      const deps = createMockDeps();
      const res = await handleSubmission(deps, validSubmission);

      expect(res.ok).toBe(true);
      expect(deps.rpcSubmitResponse).toHaveBeenCalledWith({
        slug: "corrida-skf",
        answers: validSubmission.answers,
        identifier: "52998224725",
        consented: true,
      });
    });

    it("mapeia erro duplicate do rpc trocando 'cpf' pelo id da pergunta CPF", async () => {
      const deps = createMockDeps({
        rpcSubmitResponse: vi.fn().mockResolvedValue({
          data: { status: "duplicate" },
          error: null,
        }),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res).toEqual({
        ok: false,
        error: "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador.",
        field: "q-cpf",
      });
    });

    it("mapeia status consent_required do rpc com field __consent", async () => {
      const deps = createMockDeps({
        rpcSubmitResponse: vi.fn().mockResolvedValue({
          data: { status: "consent_required" },
          error: null,
        }),
      });
      const res = await handleSubmission(deps, { ...validSubmission, consent: false });

      expect(res).toEqual({
        ok: false,
        error: "É necessário aceitar o termo para continuar.",
        field: "__consent",
      });
    });

    it("higiene de logs (SEC-03): logError recebe apenas código e formId, sem CPF nem respostas", async () => {
      const deps = createMockDeps({
        rpcSubmitResponse: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "Erro fatal no postgres" },
        }),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res.ok).toBe(false);
      expect(deps.logError).toHaveBeenCalledWith("P0001", "form-123");

      const logCalls = JSON.stringify(vi.mocked(deps.logError).mock.calls);
      expect(logCalls).not.toContain("52998224725");
      expect(logCalls).not.toContain("529.982.247-25");
      expect(logCalls).not.toContain("maria@example.com");
      expect(logCalls).not.toContain("Maria Souza");
    });

    it("o edit_token NÃO aparece em nenhum campo do resultado além de editUrl", async () => {
      const token = "tok_secret_1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";
      const deps = createMockDeps({
        rpcSubmitResponse: vi.fn().mockResolvedValue({
          data: { status: "ok", edit_token: token, success_message: "OK" },
          error: null,
        }),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.editUrl).toBe(
          `https://inscricoes.triadetecnologiaesolucoes.com.br/editar/${token}`,
        );
        const withoutEditUrl = { ...res, editUrl: undefined };
        expect(JSON.stringify(withoutEditUrl)).not.toContain(token);
      }
    });

    it("envia e-mail com timeout signal e retorna emailSent: true no sucesso", async () => {
      const deps = createMockDeps();
      const res = await handleSubmission(deps, validSubmission);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(true);
      }
      expect(deps.fetchFn).toHaveBeenCalled();
      const fetchCall = vi.mocked(deps.fetchFn).mock.calls[0];
      const fetchOpts = fetchCall?.[1] as RequestInit | undefined;
      expect(fetchOpts?.signal).toBeDefined();
    });

    it("retorna emailSent: false quando envio de e-mail responde 500 sem quebrar a inscrição", async () => {
      const deps = createMockDeps({
        fetchFn: vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 })),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
    });

    it("retorna emailSent: false quando fetchFn lança exceção sem quebrar a inscrição", async () => {
      const deps = createMockDeps({
        fetchFn: vi.fn().mockRejectedValue(new Error("Timeout de rede")),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
    });

    it("retorna emailSent: false quando falta a chave RESEND_API_KEY", async () => {
      const deps = createMockDeps({
        readEnv: vi.fn(() => undefined),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });

    it("retorna emailSent: false quando o formulário não tem campo de e-mail", async () => {
      const deps = createMockDeps({
        loadFormAndQuestions: vi.fn().mockResolvedValue({
          form: mockForm,
          questions: mockQuestions.filter((q) => q.field_type !== "email"),
        }),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("createTimedFetch", () => {
    it("adiciona signal com timeout na chamada de fetch", async () => {
      const mockBase = vi.fn().mockResolvedValue(new Response("ok"));
      const timed = createTimedFetch(mockBase, 5000);
      await timed("https://api.resend.com/emails", { method: "POST" });

      expect(mockBase).toHaveBeenCalled();
      const call = mockBase.mock.calls[0];
      const opts = call?.[1] as RequestInit | undefined;
      expect(opts?.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
