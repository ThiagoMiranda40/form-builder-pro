import { describe, it, expect, vi } from "vitest";
import {
  editTokenSchema,
  updateSchema,
  shouldSendUpdateEmail,
  handleGetForEdit,
  handleUpdate,
  type EditGetDeps,
  type EditUpdateDeps,
} from "./edit-response";

const VALID_TOKEN = "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890";
const INVALID_TOKEN = "not-a-valid-token";

describe("T-11: Edição pelo link", () => {
  describe("editTokenSchema e updateSchema (SEC-01, SEC-18)", () => {
    it("aceita token hexadecimal de 64 caracteres em minúsculas", () => {
      const res = editTokenSchema.safeParse(VALID_TOKEN);
      expect(res.success).toBe(true);
    });

    it("rejeita tokens com formato inválido (tamanho, caracteres, maiúsculas)", () => {
      expect(editTokenSchema.safeParse("abc").success).toBe(false);
      expect(editTokenSchema.safeParse(VALID_TOKEN + "0").success).toBe(false);
      expect(editTokenSchema.safeParse(VALID_TOKEN.slice(1)).success).toBe(false);
      expect(editTokenSchema.safeParse(VALID_TOKEN.toUpperCase()).success).toBe(false);
      expect(editTokenSchema.safeParse("z".repeat(64)).success).toBe(false);
    });

    it("updateSchema aceita token e respostas válidas", () => {
      const res = updateSchema.safeParse({
        token: VALID_TOKEN,
        answers: { q1: "10 km", q2: ["Opção A"] },
      });
      expect(res.success).toBe(true);
    });

    it("updateSchema rejeita token inválido", () => {
      const res = updateSchema.safeParse({
        token: INVALID_TOKEN,
        answers: { q1: "10 km" },
      });
      expect(res.success).toBe(false);
    });

    it("updateSchema rejeita answers com mais de 200 chaves (limite de answersSchema)", () => {
      const answers: Record<string, string> = {};
      for (let i = 1; i <= 201; i++) {
        answers[`k_${i}`] = `val_${i}`;
      }
      const res = updateSchema.safeParse({
        token: VALID_TOKEN,
        answers,
      });
      expect(res.success).toBe(false);
    });
  });

  describe("shouldSendUpdateEmail (SEC-04, TC-EDIT-01 a TC-EDIT-05)", () => {
    const baseTime = 1700000000000;

    it("retorna true quando decorreram exatamente 10 minutos (600.000 ms)", () => {
      const prevUpdatedAt = new Date(baseTime - 600000).toISOString();
      expect(shouldSendUpdateEmail(prevUpdatedAt, baseTime)).toBe(true);
    });

    it("retorna true quando decorreram mais de 10 minutos (11 min)", () => {
      const prevUpdatedAt = new Date(baseTime - 660000).toISOString();
      expect(shouldSendUpdateEmail(prevUpdatedAt, baseTime)).toBe(true);
    });

    it("retorna false aos 9 min 59 s (599.000 ms)", () => {
      const prevUpdatedAt = new Date(baseTime - 599000).toISOString();
      expect(shouldSendUpdateEmail(prevUpdatedAt, baseTime)).toBe(false);
    });

    it("retorna false quando a data anterior é nula, indefinida ou inválida", () => {
      expect(shouldSendUpdateEmail(null, baseTime)).toBe(false);
      expect(shouldSendUpdateEmail(undefined, baseTime)).toBe(false);
      expect(shouldSendUpdateEmail("invalid-date", baseTime)).toBe(false);
      expect(shouldSendUpdateEmail("", baseTime)).toBe(false);
    });

    it("retorna false quando a data anterior está no futuro", () => {
      const futureDate = new Date(baseTime + 10000).toISOString();
      expect(shouldSendUpdateEmail(futureDate, baseTime)).toBe(false);
    });

    it("retorna false menos de 10 minutos após a inscrição (TC-EDIT-05)", () => {
      const signupTime = new Date(baseTime - 120000).toISOString();
      expect(shouldSendUpdateEmail(signupTime, baseTime)).toBe(false);
    });
  });

  describe("handleGetForEdit (RF-06, SEC-17, SEC-18)", () => {
    const baseForm = {
      id: "form-1",
      title: "Corrida SKF 2026",
      description: "Edição 2026",
      status: "published",
      closes_at: null,
      max_responses: 3,
      theme: { color: "#ffff00", font: "display", logo_url: "https://example.com/logo.png" },
      success_message: "Salvo!",
      consent_text: "Termo",
    };

    const baseQuestions = [
      { id: "q-cpf", label: "CPF", field_type: "cpf", required: true, options: [], position: 1 },
      { id: "q-nome", label: "Nome", field_type: "short_text", required: true, options: [], position: 2 },
      { id: "q-dist", label: "Distância", field_type: "single_choice", required: true, options: ["5 km", "10 km"], position: 3 },
    ];

    it("retorna not_found para token com formato inválido", async () => {
      const loadByToken = vi.fn();
      const res = await handleGetForEdit({ loadByToken }, { token: INVALID_TOKEN });
      expect(res.state).toBe("not_found");
      expect(loadByToken).not.toHaveBeenCalled();
    });

    it("retorna not_found para token desconhecido", async () => {
      const loadByToken = vi.fn().mockResolvedValue({ response: null, form: null, questions: [] });
      const res = await handleGetForEdit({ loadByToken }, { token: VALID_TOKEN });
      expect(res.state).toBe("not_found");
      expect(loadByToken).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it("retorna closed quando o formulário não está publicado (draft ou archived)", async () => {
      const loadByToken = vi.fn().mockResolvedValue({
        response: { id: "r1", answers: {}, identifier: "52998224725", updated_at: new Date().toISOString() },
        form: { ...baseForm, status: "draft" },
        questions: baseQuestions,
      });
      const res = await handleGetForEdit({ loadByToken }, { token: VALID_TOKEN });
      expect(res.state).toBe("closed");
    });

    it("retorna closed quando o prazo de encerramento venceu", async () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      const loadByToken = vi.fn().mockResolvedValue({
        response: { id: "r1", answers: {}, identifier: "52998224725", updated_at: new Date().toISOString() },
        form: { ...baseForm, closes_at: past },
        questions: baseQuestions,
      });
      const res = await handleGetForEdit({ loadByToken, now: () => Date.now() }, { token: VALID_TOKEN });
      expect(res.state).toBe("closed");
    });

    it("retorna open quando vagas estão esgotadas (vagas não impedem edição)", async () => {
      const loadByToken = vi.fn().mockResolvedValue({
        response: { id: "r1", answers: { "q-cpf": "529.982.247-25" }, identifier: "52998224725", updated_at: new Date().toISOString() },
        form: { ...baseForm, max_responses: 1 },
        questions: baseQuestions,
      });
      const res = await handleGetForEdit({ loadByToken }, { token: VALID_TOKEN });
      expect(res.state).toBe("open");
    });

    it("mascara o CPF na leitura e nunca expõe o CPF completo nem o token (SEC-17)", async () => {
      const loadByToken = vi.fn().mockResolvedValue({
        response: {
          id: "r1",
          answers: { "q-cpf": "52998224725", "q-nome": "Maria Santos", "q-dist": "5 km" },
          identifier: "52998224725",
          updated_at: new Date().toISOString(),
        },
        form: baseForm,
        questions: baseQuestions,
      });

      const res = await handleGetForEdit({ loadByToken }, { token: VALID_TOKEN });
      expect(res.state).toBe("open");
      expect(res.answers?.["q-cpf"]).toBe("***.***.***-25");

      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain("52998224725");
      expect(serialized).not.toContain("529.982.247-25");
      expect(serialized).not.toContain(VALID_TOKEN);
    });
  });

  const baseForm = {
    id: "form-1",
    title: "Corrida SKF 2026",
    description: "Edição 2026",
    status: "published",
    closes_at: null,
    max_responses: 3,
    theme: { color: "#ffff00", font: "display", logo_url: null },
    success_message: "Salvo com sucesso!",
  };

  const baseQuestions = [
    { id: "q-cpf", label: "CPF", field_type: "cpf", required: true, options: [], position: 1 },
    { id: "q-nome", label: "Nome", field_type: "short_text", required: true, options: [], position: 2 },
    { id: "q-dist", label: "Distância", field_type: "single_choice", required: true, options: ["5 km", "10 km"], position: 3 },
    { id: "q-email", label: "E-mail", field_type: "email", required: true, options: [], position: 4 },
  ];

  const baseSavedResponse = {
    id: "resp-123",
    answers: {
      "q-cpf": "529.982.247-25",
      "q-nome": "Maria da Silva",
      "q-dist": "5 km",
      "q-email": "maria@example.com",
    },
    identifier: "52998224725",
    updated_at: new Date(1700000000000 - 700000).toISOString(),
  };

  function createMockDeps(overrides: Partial<EditUpdateDeps> = {}): EditUpdateDeps {
    return {
      loadByToken: vi.fn().mockResolvedValue({
        response: { ...baseSavedResponse },
        form: { ...baseForm },
        questions: [...baseQuestions],
      }),
      rpcUpdateResponse: vi.fn().mockResolvedValue({
        data: { status: "ok", success_message: "Alterações salvas!", response_id: "resp-123" },
        error: null,
      }),
      fetchFn: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "email-1" }),
      } as Response),
      getOrigin: () => "https://inscricoes.corretime.com.br",
      readEnv: (key: string) => {
        if (key === "RESEND_API_KEY") return "re_test_key";
        if (key === "EMAIL_FROM") return "inscricoes@envio.corretime.com.br";
        return undefined;
      },
      now: () => 1700000000000,
      logError: vi.fn(),
      ...overrides,
    };
  }

  describe("handleUpdate (RF-06, SEC-04, SEC-11, SEC-12, SEC-13, SEC-17, SEC-18)", () => {

    it("rejeita token com formato inválido", async () => {
      const deps = createMockDeps();
      const res = await handleUpdate(deps, {
        token: INVALID_TOKEN,
        answers: { "q-dist": "10 km" },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Inscrição não encontrada. Verifique se o link está correto.");
      }
    });

    it("rejeita token desconhecido", async () => {
      const deps = createMockDeps({
        loadByToken: vi.fn().mockResolvedValue({ response: null, form: null, questions: [] }),
      });
      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: { "q-dist": "10 km" },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Inscrição não encontrada. Verifique se o link está correto.");
      }
    });

    it("mapeia status closed do RPC (formulário encerrado ou prazo vencido)", async () => {
      const deps = createMockDeps({
        rpcUpdateResponse: vi.fn().mockResolvedValue({
          data: { status: "closed" },
          error: null,
        }),
      });
      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria Silva",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Este formulário não aceita mais alterações.");
      }
    });

    it("o CPF enviado pelo navegador é IGNORADO: o guardado prevalece (SEC-17)", async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: { status: "ok", success_message: "Alterações salvas!", response_id: "resp-123" },
        error: null,
      });
      const deps = createMockDeps({ rpcUpdateResponse: rpcMock });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-cpf": "111.444.777-35",
          "q-nome": "Maria Silva",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });

      expect(res.ok).toBe(true);
      expect(rpcMock).toHaveBeenCalled();
      const callArgs = rpcMock.mock.calls[0]?.[0];
      expect(callArgs?.identifier).toBe("52998224725");
      expect(callArgs?.answers["q-cpf"]).toBe("529.982.247-25");
    });

    it("pergunta de CPF adicionada depois da inscrição não trava a edição", async () => {
      const savedWithoutCpf = {
        id: "resp-old",
        answers: { "q-nome": "Carlos", "q-dist": "5 km", "q-email": "carlos@example.com" },
        identifier: null,
        updated_at: new Date(1700000000000 - 700000).toISOString(),
      };
      const deps = createMockDeps({
        loadByToken: vi.fn().mockResolvedValue({
          response: savedWithoutCpf,
          form: baseForm,
          questions: baseQuestions,
        }),
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Carlos Atualizado",
          "q-dist": "10 km",
          "q-email": "carlos@example.com",
        },
      });

      expect(res.ok).toBe(true);
    });

    it("opção removida ou inválida em escolha única devolve erro de validação (SEC-11)", async () => {
      const deps = createMockDeps();
      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria Silva",
          "q-dist": "42 km",
          "q-email": "maria@example.com",
        },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Selecione uma das opções disponíveis.");
        expect(res.field).toBe("q-dist");
      }
    });

    it("lista em campo de texto devolve erro genérico sem lançar exceção (SEC-12)", async () => {
      const deps = createMockDeps();
      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": ["Maria", "Silva"] as unknown as string,
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Não foi possível enviar. Verifique os campos e tente novamente.");
        expect(res.field).toBe("q-nome");
      }
    });

    it("janela de 10 min: 9 min 59 s salva sem e-mail (emailSent: false) (SEC-04)", async () => {
      const now = 1700000000000;
      const deps = createMockDeps({
        now: () => now,
        loadByToken: vi.fn().mockResolvedValue({
          response: {
            ...baseSavedResponse,
            updated_at: new Date(now - 599000).toISOString(),
          },
          form: baseForm,
          questions: baseQuestions,
        }),
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria Silva",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });

    it("janela de 10 min: 10 min 00 s envia e-mail (emailSent: true) (SEC-04)", async () => {
      const now = 1700000000000;
      const deps = createMockDeps({
        now: () => now,
        loadByToken: vi.fn().mockResolvedValue({
          response: {
            ...baseSavedResponse,
            updated_at: new Date(now - 600000).toISOString(),
          },
          form: baseForm,
          questions: baseQuestions,
        }),
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria Silva",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(true);
      }
      expect(deps.fetchFn).toHaveBeenCalled();
    });

    it("falha do Resend (status 500) não derruba a edição (emailSent: false)", async () => {
      const deps = createMockDeps({
        fetchFn: vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ message: "Internal error" }),
        } as Response),
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria Silva",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
    });

    it("exceção no envio de e-mail não derruba a edição (emailSent: false)", async () => {
      const deps = createMockDeps({
        fetchFn: vi.fn().mockRejectedValue(new Error("Network timeout")),
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria Silva",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
    });

    it("falta de RESEND_API_KEY salva sem enviar e-mail (emailSent: false)", async () => {
      const deps = createMockDeps({
        readEnv: () => undefined,
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria Silva",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });

    it("formulário sem campo de e-mail salva com emailSent: false", async () => {
      const questionsNoEmail = baseQuestions.filter((q) => q.field_type !== "email");
      const savedNoEmail = {
        ...baseSavedResponse,
        answers: { "q-cpf": "529.982.247-25", "q-nome": "Maria", "q-dist": "5 km" },
      };
      const deps = createMockDeps({
        loadByToken: vi.fn().mockResolvedValue({
          response: savedNoEmail,
          form: baseForm,
          questions: questionsNoEmail,
        }),
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: { "q-nome": "Maria", "q-dist": "10 km" },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(false);
      }
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });

    it("exceção do RPC devolve erro genérico e loga EXCEPTION com ID da inscrição (SEC-13)", async () => {
      const logErrorMock = vi.fn();
      const deps = createMockDeps({
        rpcUpdateResponse: vi.fn().mockRejectedValue(new Error("DB connection crash")),
        logError: logErrorMock,
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Não foi possível salvar. Tente novamente.");
      }
      expect(logErrorMock).toHaveBeenCalledWith("EXCEPTION", "resp-123");
      expect(logErrorMock).not.toHaveBeenCalledWith(expect.stringContaining(VALID_TOKEN), expect.anything());
    });

    it("o e-mail usa a origem permitida (SEC-04, SEC-10)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "email-1" }),
      } as Response);

      const deps = createMockDeps({
        getOrigin: () => "http://evil-attacker.com",
        fetchFn: fetchMock,
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: {
          "q-nome": "Maria Silva",
          "q-dist": "10 km",
          "q-email": "maria@example.com",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(true);
      }
      expect(fetchMock).toHaveBeenCalled();
      const fetchBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
      expect(fetchBody.html).toContain("https://inscricoes.corretime.com.br/editar/");
      expect(fetchBody.html).not.toContain("evil-attacker.com");
    });
  });

  describe("Ajuste pós-revisão (SEC-19, SEC-20)", () => {
    it("SEC-20: devolve só as respostas de perguntas que existem no formulário (pergunta apagada)", async () => {
      const deps = createMockDeps({
        loadByToken: async () => ({
          response: {
            id: "resp-1",
            answers: {
              "q-nome": "João da Silva",
              "q-cpf-antiga": "52998224725",
              "q-removida": "dado fantasma",
            },
            identifier: "52998224725",
            updated_at: new Date(Date.now() - 3600000).toISOString(),
          },
          form: {
            id: "form-1",
            title: "Formulário Ativo",
            status: "published",
            closes_at: null,
            max_responses: null,
          },
          // A pergunta q-removida e q-cpf-antiga foram apagadas pelo organizador
          questions: [
            {
              id: "q-nome",
              label: "Nome completo",
              field_type: "text",
              required: true,
              options: [],
              position: 1,
            },
          ],
        }),
      });

      const res = await handleGetForEdit(deps, { token: VALID_TOKEN });
      expect(res.state).toBe("open");
      if (res.state === "open") {
        expect(res.answers).toHaveProperty("q-nome", "João da Silva");
        expect(res.answers).not.toHaveProperty("q-removida");
        expect(res.answers).not.toHaveProperty("q-cpf-antiga");
      }
    });

    it("SEC-20: mascara com hideDocument qualquer valor cujos dígitos sejam iguais ao identifier mesmo se o tipo for alterado para text", async () => {
      const deps = createMockDeps({
        loadByToken: async () => ({
          response: {
            id: "resp-1",
            answers: {
              "q-documento": "52998224725",
            },
            identifier: "52998224725",
            updated_at: new Date(Date.now() - 3600000).toISOString(),
          },
          form: {
            id: "form-1",
            title: "Formulário Ativo",
            status: "published",
            closes_at: null,
            max_responses: null,
          },
          questions: [
            {
              id: "q-documento",
              label: "Documento de Identificação",
              field_type: "text", // Tipo alterado pelo organizador para text
              required: true,
              options: [],
              position: 1,
            },
          ],
        }),
      });

      const res = await handleGetForEdit(deps, { token: VALID_TOKEN });
      expect(res.state).toBe("open");
      if (res.state === "open") {
        expect(res.answers["q-documento"]).toBe("***.***.***-25");
      }
    });

    it("SEC-20: mascara valor com pontuação cujos dígitos batem com o identifier", async () => {
      const deps = createMockDeps({
        loadByToken: async () => ({
          response: {
            id: "resp-1",
            answers: {
              "q-cpf-formatado": "529.982.247-25",
            },
            identifier: "52998224725",
            updated_at: new Date(Date.now() - 3600000).toISOString(),
          },
          form: {
            id: "form-1",
            title: "Formulário Ativo",
            status: "published",
            closes_at: null,
            max_responses: null,
          },
          questions: [
            {
              id: "q-cpf-formatado",
              label: "CPF",
              field_type: "text",
              required: true,
              options: [],
              position: 1,
            },
          ],
        }),
      });

      const res = await handleGetForEdit(deps, { token: VALID_TOKEN });
      expect(res.state).toBe("open");
      if (res.state === "open") {
        expect(res.answers["q-cpf-formatado"]).toBe("***.***.***-25");
      }
    });

    it("SEC-20: um valor que não é o CPF não é mascarado", async () => {
      const deps = createMockDeps({
        loadByToken: async () => ({
          response: {
            id: "resp-1",
            answers: {
              "q-telefone": "11987654321",
              "q-nome": "52998224726", // 1 dígito diferente
            },
            identifier: "52998224725",
            updated_at: new Date(Date.now() - 3600000).toISOString(),
          },
          form: {
            id: "form-1",
            title: "Formulário Ativo",
            status: "published",
            closes_at: null,
            max_responses: null,
          },
          questions: [
            {
              id: "q-telefone",
              label: "Telefone",
              field_type: "phone",
              required: true,
              options: [],
              position: 1,
            },
            {
              id: "q-nome",
              label: "Outro número",
              field_type: "text",
              required: true,
              options: [],
              position: 2,
            },
          ],
        }),
      });

      const res = await handleGetForEdit(deps, { token: VALID_TOKEN });
      expect(res.state).toBe("open");
      if (res.state === "open") {
        expect(res.answers["q-telefone"]).toBe("11987654321");
        expect(res.answers["q-nome"]).toBe("52998224726");
      }
    });

    it("SEC-19: handleGetForEdit relança erro genérico sem mensagem original do banco quando loadByToken falha (não vira not_found)", async () => {
      const logErrorMock = vi.fn();
      const deps = {
        loadByToken: vi.fn().mockRejectedValue(new Error("PGRST500: Database connection failure")),
        logError: logErrorMock,
      };

      await expect(handleGetForEdit(deps as any, { token: VALID_TOKEN })).rejects.toThrow(
        "Não foi possível carregar o formulário.",
      );
      expect(logErrorMock).toHaveBeenCalledWith("EXCEPTION", "");
    });

    it("SEC-19: handleGetForEdit registra EXCEPTION e o ID no log sem expor o token", async () => {
      const logErrorMock = vi.fn();
      const deps = {
        loadByToken: vi.fn().mockImplementation(async () => {
          throw new Error("Fatal network error in query");
        }),
        logError: logErrorMock,
      };

      try {
        await handleGetForEdit(deps as any, { token: VALID_TOKEN });
      } catch (err: any) {
        expect(err.message).toBe("Não foi possível carregar o formulário.");
        expect(err.message).not.toContain("Fatal network error");
      }

      expect(logErrorMock).toHaveBeenCalledWith("EXCEPTION", "");
      expect(logErrorMock).not.toHaveBeenCalledWith(expect.stringContaining(VALID_TOKEN), expect.anything());
    });

    it("SEC-19: handleUpdate trata erro do banco no loadByToken sem virar not_found e registrando EXCEPTION sem o token", async () => {
      const logErrorMock = vi.fn();
      const deps = createMockDeps({
        loadByToken: vi.fn().mockRejectedValue(new Error("Supabase internal error")),
        logError: logErrorMock,
      });

      const res = await handleUpdate(deps, {
        token: VALID_TOKEN,
        answers: { "q-nome": "Carlos" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Não foi possível salvar. Tente novamente.");
        expect(res.error).not.toContain("Supabase internal error");
      }
      expect(logErrorMock).toHaveBeenCalledWith("EXCEPTION", "");
      expect(logErrorMock).not.toHaveBeenCalledWith(expect.stringContaining(VALID_TOKEN), expect.anything());
    });

    describe("SEC-21: CPF guardado preservado quando o tipo da pergunta muda", () => {
      it("tipo alterado para texto e a pessoa salva o que a leitura devolveu (mascarado) -> o valor guardado NÃO muda", async () => {
        const rpcMock = vi.fn().mockResolvedValue({
          data: { status: "ok", success_message: "Alterações salvas!", response_id: "resp-1" },
          error: null,
        });

        const deps = createMockDeps({
          loadByToken: async () => ({
            response: {
              id: "resp-1",
              answers: {
                "q-cpf-alterada": "52998224725",
                "q-dist": "5 km",
              },
              identifier: "52998224725",
              updated_at: new Date(Date.now() - 700000).toISOString(),
            },
            form: { ...baseForm },
            questions: [
              {
                id: "q-cpf-alterada",
                label: "Documento",
                field_type: "text", // Tipo alterado pelo organizador para texto
                required: true,
                options: [],
                position: 1,
              },
              {
                id: "q-dist",
                label: "Distância",
                field_type: "single_choice",
                required: true,
                options: ["5 km", "10 km"],
                position: 2,
              },
            ],
          }),
          rpcUpdateResponse: rpcMock,
        });

        // O navegador envia o que a leitura devolveu (mascarado: ***.***.***-25)
        const res = await handleUpdate(deps, {
          token: VALID_TOKEN,
          answers: {
            "q-cpf-alterada": "***.***.***-25",
            "q-dist": "10 km",
          },
        });

        expect(res.ok).toBe(true);
        expect(rpcMock).toHaveBeenCalled();
        const rpcPayload = rpcMock.mock.calls[0]![0];
        // O valor guardado original (52998224725) DEVE ser preservado, não o mascarado
        expect(rpcPayload.answers["q-cpf-alterada"]).toBe("52998224725");
        expect(rpcPayload.answers["q-dist"]).toBe("10 km");
      });

      it("valor forjado no campo cujo valor guardado é o CPF é ignorado e vale o guardado", async () => {
        const rpcMock = vi.fn().mockResolvedValue({
          data: { status: "ok", success_message: "Alterações salvas!", response_id: "resp-1" },
          error: null,
        });

        const deps = createMockDeps({
          loadByToken: async () => ({
            response: {
              id: "resp-1",
              answers: {
                "q-doc": "529.982.247-25",
              },
              identifier: "52998224725",
              updated_at: new Date(Date.now() - 700000).toISOString(),
            },
            form: { ...baseForm },
            questions: [
              {
                id: "q-doc",
                label: "Documento",
                field_type: "text",
                required: true,
                options: [],
                position: 1,
              },
            ],
          }),
          rpcUpdateResponse: rpcMock,
        });

        // O atacante tenta enviar outro CPF ou valor forjado
        const res = await handleUpdate(deps, {
          token: VALID_TOKEN,
          answers: {
            "q-doc": "111.444.777-35",
          },
        });

        expect(res.ok).toBe(true);
        expect(rpcMock).toHaveBeenCalled();
        const rpcPayload = rpcMock.mock.calls[0]![0];
        // O valor guardado original prevalece
        expect(rpcPayload.answers["q-doc"]).toBe("529.982.247-25");
      });

      it("uma pergunta comum de texto não é afetada", async () => {
        const rpcMock = vi.fn().mockResolvedValue({
          data: { status: "ok", success_message: "Alterações salvas!", response_id: "resp-1" },
          error: null,
        });

        const deps = createMockDeps({
          loadByToken: async () => ({
            response: {
              id: "resp-1",
              answers: {
                "q-cidade": "São Paulo",
              },
              identifier: "52998224725",
              updated_at: new Date(Date.now() - 700000).toISOString(),
            },
            form: { ...baseForm },
            questions: [
              {
                id: "q-cidade",
                label: "Cidade",
                field_type: "text",
                required: true,
                options: [],
                position: 1,
              },
            ],
          }),
          rpcUpdateResponse: rpcMock,
        });

        const res = await handleUpdate(deps, {
          token: VALID_TOKEN,
          answers: {
            "q-cidade": "Campinas",
          },
        });

        expect(res.ok).toBe(true);
        expect(rpcMock).toHaveBeenCalled();
        const rpcPayload = rpcMock.mock.calls[0]![0];
        // Pergunta comum aceita a nova resposta normalmente
        expect(rpcPayload.answers["q-cidade"]).toBe("Campinas");
      });

      it("pergunta de CPF de tipo cpf continua protegida como antes", async () => {
        const rpcMock = vi.fn().mockResolvedValue({
          data: { status: "ok", success_message: "Alterações salvas!", response_id: "resp-1" },
          error: null,
        });

        const deps = createMockDeps({
          loadByToken: async () => ({
            response: {
              id: "resp-1",
              answers: {
                "q-cpf": "529.982.247-25",
              },
              identifier: "52998224725",
              updated_at: new Date(Date.now() - 700000).toISOString(),
            },
            form: { ...baseForm },
            questions: [
              {
                id: "q-cpf",
                label: "CPF",
                field_type: "cpf",
                required: true,
                options: [],
                position: 1,
              },
            ],
          }),
          rpcUpdateResponse: rpcMock,
        });

        const res = await handleUpdate(deps, {
          token: VALID_TOKEN,
          answers: {
            "q-cpf": "000.000.000-00",
          },
        });

        expect(res.ok).toBe(true);
        expect(rpcMock).toHaveBeenCalled();
        const rpcPayload = rpcMock.mock.calls[0]![0];
        expect(rpcPayload.answers["q-cpf"]).toBe("529.982.247-25");
      });

      it("T-24c: edição que NÃO altera data de nascimento passa mesmo com data fora da nova janela", async () => {
        const rpcMock = vi.fn().mockResolvedValue({
          data: { status: "ok", success_message: "Alterações salvas!", response_id: "resp-1" },
          error: null,
        });

        const deps = createMockDeps({
          loadByToken: async () => ({
            response: {
              id: "resp-1",
              answers: {
                "q-nasc": "2008-10-15", // 17 anos no evento
                "q-nome": "Nome Antigo",
              },
              identifier: "52998224725",
              updated_at: new Date(Date.now() - 700000).toISOString(),
            },
            form: {
              ...baseForm,
              event_date: "2026-10-10",
            },
            questions: [
              {
                id: "q-nasc",
                label: "Nascimento",
                field_type: "birthdate",
                required: true,
                options: [],
                position: 1,
                settings: { minAge: 18, maxAge: 60 },
              },
              {
                id: "q-nome",
                label: "Nome",
                field_type: "short_text",
                required: true,
                options: [],
                position: 2,
              },
            ],
          }),
          rpcUpdateResponse: rpcMock,
        });

        // Altera apenas o nome, mantém a data de nascimento
        const res = await handleUpdate(deps, {
          token: VALID_TOKEN,
          answers: {
            "q-nasc": "2008-10-15",
            "q-nome": "Nome Novo",
          },
        });

        expect(res.ok).toBe(true);
      });

      it("T-24c: edição que ALTERA data de nascimento para fora da janela é recusada", async () => {
        const rpcMock = vi.fn().mockResolvedValue({
          data: { status: "ok", success_message: "Alterações salvas!", response_id: "resp-1" },
          error: null,
        });

        const deps = createMockDeps({
          loadByToken: async () => ({
            response: {
              id: "resp-1",
              answers: {
                "q-nasc": "2000-01-01",
              },
              identifier: "52998224725",
              updated_at: new Date(Date.now() - 700000).toISOString(),
            },
            form: {
              ...baseForm,
              event_date: "2026-10-10",
            },
            questions: [
              {
                id: "q-nasc",
                label: "Nascimento",
                field_type: "birthdate",
                required: true,
                options: [],
                position: 1,
                settings: { minAge: 18, maxAge: 60 },
              },
            ],
          }),
          rpcUpdateResponse: rpcMock,
        });

        // Altera data de nascimento para fora da janela
        const res = await handleUpdate(deps, {
          token: VALID_TOKEN,
          answers: {
            "q-nasc": "2008-10-15",
          },
        });

        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error).toBe("Nascimento: Este evento aceita participantes de 18 a 60 anos.");
        }
      });
    });
  });
});

