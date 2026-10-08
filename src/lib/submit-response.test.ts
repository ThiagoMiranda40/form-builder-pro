import { describe, expect, it, vi } from "vitest";
import * as confirmationEmailModule from "./confirmation-email";
import {
  ALLOWED_ORIGINS,
  getOrigin,
  handleSubmission,
  submitSchema,
  createTimedFetch,
  validateAndCleanAnswers,
  type SubmissionDeps,
  type SubmissionQuestion,
  type SubmitInput,
} from "./submit-response";

describe("T-09: Servidor de inscrição via banco", () => {
  describe("submitSchema e limites do answers (SEC-02, QA-GAP-01, QA-GAP-04)", () => {
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

    it("aceita chave com exatamente 100 caracteres (QA-GAP-04 limite positivo)", () => {
      const exactKey = "k".repeat(100);
      const res = submitSchema.safeParse({
        slug: "corrida-2026",
        answers: { [exactKey]: "teste" },
      });
      expect(res.success).toBe(true);
    });

    it("aceita valor de texto com exatamente 10000 caracteres (QA-GAP-04 limite positivo)", () => {
      const exactValue = "v".repeat(10000);
      const res = submitSchema.safeParse({
        slug: "corrida-2026",
        answers: { q1: exactValue },
      });
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

  describe("getOrigin e origens permitidas (SEC-04, SEC-10)", () => {
    it("contém somente a origem oficial de produção (SEC-10)", () => {
      expect(ALLOWED_ORIGINS).toEqual([
        "https://inscricoes.corretime.com.br",
      ]);
      expect(ALLOWED_ORIGINS).not.toContain("http://localhost:8080");
      expect(ALLOWED_ORIGINS).not.toContain("https://inscricoes.triadetecnologiaesolucoes.com.br");
    });

    it("troca origem estranha pela primeira origem permitida", () => {
      expect(getOrigin("https://evil-site.workers.dev")).toBe("https://inscricoes.corretime.com.br");
      expect(getOrigin("http://malicious.com")).toBe("https://inscricoes.corretime.com.br");
      expect(getOrigin(undefined)).toBe("https://inscricoes.corretime.com.br");
    });

    it("getOrigin com o domínio antigo, com http://localhost:8080, com uma origem forjada e sem origem devolve SEMPRE https://inscricoes.corretime.com.br", () => {
      expect(getOrigin("https://inscricoes.triadetecnologiaesolucoes.com.br")).toBe(
        "https://inscricoes.corretime.com.br",
      );
      expect(getOrigin("http://localhost:8080")).toBe(
        "https://inscricoes.corretime.com.br",
      );
      expect(getOrigin("https://forjada.com")).toBe(
        "https://inscricoes.corretime.com.br",
      );
      expect(getOrigin("")).toBe(
        "https://inscricoes.corretime.com.br",
      );
      expect(getOrigin(undefined)).toBe(
        "https://inscricoes.corretime.com.br",
      );
    });

    it("mantém a origem de produção", () => {
      expect(getOrigin("https://inscricoes.corretime.com.br")).toBe(
        "https://inscricoes.corretime.com.br",
      );
    });
  });

  describe("validateAndCleanAnswers (SEC-11, SEC-12, QA-GAP-05, Reuso)", () => {
    const sampleQuestions: SubmissionQuestion[] = [
      {
        id: "q-single",
        label: "Opção única",
        field_type: "single_choice",
        required: true,
        options: [" Opção A ", "Opção B", "Opção C"],
        position: 0,
      },
      {
        id: "q-multi",
        label: "Múltipla escolha",
        field_type: "multi_choice",
        required: true,
        options: ["Item 1", "Item 2", "Item 3"],
        position: 1,
      },
      {
        id: "q-opt",
        label: "Opcional",
        field_type: "single_choice",
        required: false,
        options: ["Sim", "Não"],
        position: 2,
      },
    ];

    it("apara espaços e valida single_choice corretamente", () => {
      const res = validateAndCleanAnswers(sampleQuestions, {
        "q-single": "  Opção A  ",
        "q-multi": ["Item 1", "Item 2"],
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.cleanAnswers["q-single"]).toBe("Opção A");
      }
    });

    it("rejeita valor fora das opções para single_choice", () => {
      const res = validateAndCleanAnswers(sampleQuestions, {
        "q-single": "Opção Inexistente",
        "q-multi": ["Item 1"],
      });
      expect(res).toEqual({
        ok: false,
        error: "Opção única: Selecione uma das opções disponíveis.",
        field: "q-single",
      });
    });

    it("rejeita multi_choice contendo item fora da lista no meio de itens válidos", () => {
      const res = validateAndCleanAnswers(sampleQuestions, {
        "q-single": "Opção B",
        "q-multi": ["Item 1", "Item Falso", "Item 2"],
      });
      expect(res).toEqual({
        ok: false,
        error: "Múltipla escolha: Selecione uma das opções disponíveis.",
        field: "q-multi",
      });
    });

    it("aceita resposta vazia para pergunta opcional de escolha", () => {
      const res = validateAndCleanAnswers(sampleQuestions, {
        "q-single": "Opção B",
        "q-multi": ["Item 1"],
        "q-opt": "",
      });
      expect(res.ok).toBe(true);
    });

    it("rejeita qualquer valor se pergunta de escolha não tiver opções cadastradas", () => {
      const qNoOptions: SubmissionQuestion[] = [
        {
          id: "q-sem-opcoes",
          label: "Sem Opções",
          field_type: "single_choice",
          required: true,
          options: [],
          position: 0,
        },
      ];
      const res = validateAndCleanAnswers(qNoOptions, {
        "q-sem-opcoes": "Qualquer coisa",
      });
      expect(res).toEqual({
        ok: false,
        error: "Sem Opções: Selecione uma das opções disponíveis.",
        field: "q-sem-opcoes",
      });
    });

    it("rejeita lista em campo que não é multi_choice com erro genérico (SEC-12)", () => {
      const qText: SubmissionQuestion[] = [
        {
          id: "q-cpf",
          label: "CPF",
          field_type: "cpf",
          required: true,
          options: [],
          position: 0,
        },
      ];
      const res = validateAndCleanAnswers(qText, {
        "q-cpf": ["123", "456"],
      });
      expect(res).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-cpf",
      });
    });

    it("SEC-14: rejeita número, objeto, booleano e lista com número em pergunta de texto com erro genérico", () => {
      const qText: SubmissionQuestion[] = [
        {
          id: "q-nome",
          label: "Nome completo",
          field_type: "short_text",
          required: true,
          options: [],
          position: 0,
        },
      ];

      // Número
      expect(validateAndCleanAnswers(qText, { "q-nome": 12345 })).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-nome",
      });

      // Objeto
      expect(validateAndCleanAnswers(qText, { "q-nome": { injected: "obj" } })).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-nome",
      });

      // Booleano
      expect(validateAndCleanAnswers(qText, { "q-nome": true })).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-nome",
      });

      // Lista com número
      expect(validateAndCleanAnswers(qText, { "q-nome": ["Texto", 99] })).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-nome",
      });
    });

    it("SEC-14: rejeita lista com item não-texto ou aninhada em multi_choice", () => {
      const qMulti: SubmissionQuestion[] = [
        {
          id: "q-multi",
          label: "Interesses",
          field_type: "multi_choice",
          required: true,
          options: ["5K", "10K"],
          position: 0,
        },
      ];

      // Lista com número
      expect(validateAndCleanAnswers(qMulti, { "q-multi": ["5K", 10] })).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-multi",
      });

      // Lista aninhada
      expect(validateAndCleanAnswers(qMulti, { "q-multi": [["5K"]] })).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-multi",
      });
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
      {
        id: "q-camiseta",
        label: "Tamanho da Camiseta",
        field_type: "single_choice",
        required: false,
        options: ["P", "M", "G", "GG"],
        position: 3,
      },
      {
        id: "q-interesses",
        label: "Interesses",
        field_type: "multi_choice",
        required: false,
        options: ["5K", "10K", "Caminhada"],
        position: 4,
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
        getOrigin: vi.fn().mockReturnValue("https://inscricoes.corretime.com.br"),
        readEnv: vi.fn((key: string) => {
          if (key === "RESEND_API_KEY") return "re_12345678901234567890";
          if (key === "EMAIL_FROM") return "inscricoes@envio.corretime.com.br";
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

    it("SEC-12: lista em CPF, e-mail ou texto devolve erro genérico e não chama rpc", async () => {
      const deps = createMockDeps();

      // CPF como lista
      const resCpf = await handleSubmission(deps, {
        ...validSubmission,
        answers: { ...validSubmission.answers, "q-cpf": ["52998224725"] },
      });
      expect(resCpf).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-cpf",
      });
      expect(deps.rpcSubmitResponse).not.toHaveBeenCalled();

      // E-mail como lista
      const resEmail = await handleSubmission(deps, {
        ...validSubmission,
        answers: { ...validSubmission.answers, "q-email": ["maria@example.com"] },
      });
      expect(resEmail).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-email",
      });

      // Texto como lista
      const resNome = await handleSubmission(deps, {
        ...validSubmission,
        answers: { ...validSubmission.answers, "q-nome": ["Maria", "Souza"] },
      });
      expect(resNome).toEqual({
        ok: false,
        error: "Não foi possível enviar. Verifique os campos e tente novamente.",
        field: "q-nome",
      });
      expect(deps.rpcSubmitResponse).not.toHaveBeenCalled();
    });

    it("SEC-12: multi_choice com lista é aceito normalmente", async () => {
      const deps = createMockDeps();
      const res = await handleSubmission(deps, {
        ...validSubmission,
        answers: {
          ...validSubmission.answers,
          "q-interesses": ["5K", "10K"],
        },
      });
      expect(res.ok).toBe(true);
      expect(deps.rpcSubmitResponse).toHaveBeenCalled();
    });

    it("SEC-13: exceção em loadFormAndQuestions devolve erro genérico e loga EXCEPTION com id vazio", async () => {
      const deps = createMockDeps({
        loadFormAndQuestions: vi.fn().mockRejectedValue(new Error("Database connection refused")),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res).toEqual({
        ok: false,
        error: "Não foi possível concluir a inscrição. Tente novamente.",
      });
      expect(deps.logError).toHaveBeenCalledWith("EXCEPTION", "");

      const logCalls = JSON.stringify(vi.mocked(deps.logError).mock.calls);
      expect(logCalls).not.toContain("Database connection refused");
    });

    it("SEC-13: exceção em rpcSubmitResponse devolve erro genérico e loga EXCEPTION com form.id", async () => {
      const deps = createMockDeps({
        rpcSubmitResponse: vi.fn().mockRejectedValue(new Error("RPC timeout or failure")),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res).toEqual({
        ok: false,
        error: "Não foi possível concluir a inscrição. Tente novamente.",
      });
      expect(deps.logError).toHaveBeenCalledWith("EXCEPTION", "form-123");

      const logCalls = JSON.stringify(vi.mocked(deps.logError).mock.calls);
      expect(logCalls).not.toContain("RPC timeout or failure");
    });

    it("QA-GAP-05: apara espaços de texto e e-mail antes de validar, grava aparado e envia e-mail ao endereço aparado", async () => {
      const deps = createMockDeps();
      const res = await handleSubmission(deps, {
        ...validSubmission,
        answers: {
          "q-nome": "  Maria Souza  ",
          "q-cpf": "  529.982.247-25  ",
          "q-email": "  maria@example.com  ",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.emailSent).toBe(true);
      }

      // Gravado aparado
      expect(deps.rpcSubmitResponse).toHaveBeenCalledWith({
        slug: "corrida-skf",
        answers: {
          "q-nome": "Maria Souza",
          "q-cpf": "529.982.247-25",
          "q-email": "maria@example.com",
        },
        identifier: "52998224725",
        consented: true,
      });

      // E-mail enviado ao endereço aparado
      expect(deps.fetchFn).toHaveBeenCalled();
      const fetchCall = vi.mocked(deps.fetchFn).mock.calls[0];
      const body = JSON.parse(fetchCall?.[1]?.body as string);
      expect(body.to).toEqual(["maria@example.com"]);
    });

    it("QA-GAP-02: entradas que passam em isValidEmail mas são barradas por isSafeRecipient gravam a resposta mas não chamam a rede", async () => {
      const unsafeEmails = ['"a"@b.com', "ma\u0000ria@b.com"];
      const sendEmailSpy = vi.spyOn(confirmationEmailModule, "sendConfirmationEmail");

      for (const unsafeEmail of unsafeEmails) {
        sendEmailSpy.mockClear();
        const deps = createMockDeps();
        const res = await handleSubmission(deps, {
          ...validSubmission,
          answers: {
            ...validSubmission.answers,
            "q-email": unsafeEmail,
          },
        });

        // Inscrição gravada no banco
        expect(res.ok).toBe(true);
        expect(deps.rpcSubmitResponse).toHaveBeenCalled();

        // E-mail não enviado e nenhuma chamada de rede realizada
        if (res.ok) {
          expect(res.emailSent).toBe(false);
        }
        expect(sendEmailSpy).not.toHaveBeenCalled();
        expect(deps.fetchFn).not.toHaveBeenCalled();
      }

      sendEmailSpy.mockRestore();
    });

    it("QA-GAP-01: rpc com status full retorna mensagem e sem email e sem editUrl", async () => {
      const deps = createMockDeps({
        rpcSubmitResponse: vi.fn().mockResolvedValue({
          data: { status: "full" },
          error: null,
        }),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res).toEqual({
        ok: false,
        error: "O limite de inscrições foi atingido.",
      });
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });

    it("QA-GAP-01: rpc com status closed retorna mensagem e sem email e sem editUrl", async () => {
      const deps = createMockDeps({
        rpcSubmitResponse: vi.fn().mockResolvedValue({
          data: { status: "closed" },
          error: null,
        }),
      });
      const res = await handleSubmission(deps, validSubmission);

      expect(res).toEqual({
        ok: false,
        error: "O prazo de preenchimento encerrou.",
      });
      expect(deps.fetchFn).not.toHaveBeenCalled();
    });

    it("SEC-11: single_choice e multi_choice validados contra options cadastradas", async () => {
      const deps = createMockDeps();

      // Valor fora de single_choice
      const resInvalidSingle = await handleSubmission(deps, {
        ...validSubmission,
        answers: {
          ...validSubmission.answers,
          "q-camiseta": "Extra G",
        },
      });
      expect(resInvalidSingle).toEqual({
        ok: false,
        error: "Tamanho da Camiseta: Selecione uma das opções disponíveis.",
        field: "q-camiseta",
      });
      expect(deps.rpcSubmitResponse).not.toHaveBeenCalled();

      // Valor fora de multi_choice
      const resInvalidMulti = await handleSubmission(deps, {
        ...validSubmission,
        answers: {
          ...validSubmission.answers,
          "q-interesses": ["5K", "Maratona 42K"],
        },
      });
      expect(resInvalidMulti).toEqual({
        ok: false,
        error: "Interesses: Selecione uma das opções disponíveis.",
        field: "q-interesses",
      });
      expect(deps.rpcSubmitResponse).not.toHaveBeenCalled();
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
          `https://inscricoes.corretime.com.br/editar/${token}`,
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

  describe("T-24c: validateAndCleanAnswers com limites de idade", () => {
    const fixedNow = new Date("2026-10-08T15:00:00-03:00");
    const birthQuestion: SubmissionQuestion = {
      id: "q_nasc",
      label: "Data de nascimento",
      field_type: "birthdate",
      required: true,
      options: [],
      position: 1,
      settings: { minAge: 18, maxAge: 60 },
    };

    it("recusa com mensagem exata quando fora da janela (menor de 18 anos)", () => {
      // Evento em 2026-10-10. Nascido em 2008-10-11 tem 17 anos no evento.
      const res = validateAndCleanAnswers(
        [birthQuestion],
        { q_nasc: "2008-10-11" },
        { eventDate: "2026-10-10", now: fixedNow },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe(
          "Data de nascimento: Este evento aceita participantes de 18 a 60 anos.",
        );
        expect(res.field).toBe("q_nasc");
      }
    });

    it("aceita dentro da janela", () => {
      // Nascido em 2008-10-10 tem 18 anos no evento em 2026-10-10.
      const res = validateAndCleanAnswers(
        [birthQuestion],
        { q_nasc: "2008-10-10" },
        { eventDate: "2026-10-10", now: fixedNow },
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.cleanAnswers["q_nasc"]).toBe("2008-10-10");
      }
    });

    it("edição que NÃO altera a data de nascimento passa mesmo fora da janela quando previousAnswers tem o mesmo valor", () => {
      const res = validateAndCleanAnswers(
        [birthQuestion],
        { q_nasc: "2008-10-11" },
        {
          eventDate: "2026-10-10",
          now: fixedNow,
          previousAnswers: { q_nasc: "2008-10-11" },
        },
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.cleanAnswers["q_nasc"]).toBe("2008-10-11");
      }
    });

    it("edição que ALTERA para fora da janela é recusada", () => {
      const res = validateAndCleanAnswers(
        [birthQuestion],
        { q_nasc: "2008-10-11" },
        {
          eventDate: "2026-10-10",
          now: fixedNow,
          previousAnswers: { q_nasc: "2000-01-01" }, // valor anterior era diferente
        },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe(
          "Data de nascimento: Este evento aceita participantes de 18 a 60 anos.",
        );
      }
    });

    it("formulário sem event_date conta na data de inscrição (todayInSaoPaulo)", () => {
      // fixedNow é 2026-10-08 em SP. Nascido em 2008-10-09 tem 17 anos hoje -> recusa
      const res1 = validateAndCleanAnswers(
        [birthQuestion],
        { q_nasc: "2008-10-09" },
        { now: fixedNow },
      );
      expect(res1.ok).toBe(false);

      // Nascido em 2008-10-08 tem 18 anos hoje -> aceita
      const res2 = validateAndCleanAnswers(
        [birthQuestion],
        { q_nasc: "2008-10-08" },
        { now: fixedNow },
      );
      expect(res2.ok).toBe(true);
    });

    it("pergunta sem settings (formulários antigos) não muda em nada", () => {
      const oldQuestion: SubmissionQuestion = {
        id: "q_old",
        label: "Data de nascimento",
        field_type: "birthdate",
        required: true,
        options: [],
        position: 1,
      };
      // Sem settings, qualquer idade válida passa
      const res = validateAndCleanAnswers(
        [oldQuestion],
        { q_old: "2015-05-05" },
        { eventDate: "2026-10-10", now: fixedNow },
      );
      expect(res.ok).toBe(true);
    });
  });
});

