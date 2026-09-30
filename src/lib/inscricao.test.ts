import { describe, it, expect } from "vitest";
import {
  normalizeCPF,
  findIdentifierQuestion,
  findEmailQuestion,
  hideDocument,
  isHoneypotFilled,
  mapSubmitStatus,
} from "./inscricao";

describe("inscricao (T-08)", () => {
  describe("normalizeCPF", () => {
    it("deve normalizar CPF formatado para apenas dígitos", () => {
      expect(normalizeCPF("529.982.247-25")).toBe("52998224725");
      expect(normalizeCPF("52998224725")).toBe("52998224725");
    });

    it("deve retornar null para strings vazias, espaços ou sem dígitos", () => {
      expect(normalizeCPF("")).toBeNull();
      expect(normalizeCPF("   ")).toBeNull();
      expect(normalizeCPF("abc-def")).toBeNull();
    });
  });

  describe("findIdentifierQuestion e findEmailQuestion", () => {
    const questions = [
      { id: "q1", field_type: "short_text", position: 1 },
      { id: "q2", field_type: "email", position: 2 },
      { id: "q3", field_type: "cpf", position: 3 },
      { id: "q4", field_type: "cpf", position: 4 },
      { id: "q5", field_type: "email", position: 5 },
    ];

    it("deve encontrar a primeira pergunta do tipo cpf ordenada por position", () => {
      const unordered = [...questions].reverse();
      const cpfQ = findIdentifierQuestion(unordered);
      expect(cpfQ?.id).toBe("q3");
    });

    it("deve retornar undefined se não houver pergunta do tipo cpf", () => {
      const noCpf = questions.filter((q) => q.field_type !== "cpf");
      expect(findIdentifierQuestion(noCpf)).toBeUndefined();
    });

    it("deve encontrar a primeira pergunta do tipo email ordenada por position", () => {
      const unordered = [...questions].reverse();
      const emailQ = findEmailQuestion(unordered);
      expect(emailQ?.id).toBe("q2");
    });

    it("deve retornar undefined se não houver pergunta do tipo email", () => {
      const noEmail = questions.filter((q) => q.field_type !== "email");
      expect(findEmailQuestion(noEmail)).toBeUndefined();
    });
  });

  describe("hideDocument", () => {
    it("deve mascarar CPF mantendo a pontuação e os últimos 2 alfanuméricos", () => {
      expect(hideDocument("529.982.247-25")).toBe("***.***.***-25");
    });

    it("deve mascarar RG mantendo a pontuação e os últimos 2 alfanuméricos", () => {
      expect(hideDocument("12.345.678-9")).toBe("**.***.**8-9");
    });

    it("deve retornar string vazia se entrada for vazia", () => {
      expect(hideDocument("")).toBe("");
    });

    it("deve mascarar todos os caracteres alfanuméricos se houver 2 ou menos", () => {
      expect(hideDocument("12")).toBe("**");
      expect(hideDocument("1")).toBe("*");
      expect(hideDocument("1-2")).toBe("*-*");
    });
  });

  describe("isHoneypotFilled", () => {
    it("deve retornar false para valores vazios, espaços ou nulos", () => {
      expect(isHoneypotFilled("")).toBe(false);
      expect(isHoneypotFilled("  ")).toBe(false);
      expect(isHoneypotFilled(undefined)).toBe(false);
      expect(isHoneypotFilled(null)).toBe(false);
    });

    it("deve retornar true quando o campo invisível for preenchido por robô", () => {
      expect(isHoneypotFilled("http://spam")).toBe(true);
      expect(isHoneypotFilled("bot")).toBe(true);
    });
  });

  describe("mapSubmitStatus", () => {
    it("deve mapear status ok", () => {
      expect(mapSubmitStatus("ok")).toEqual({ ok: true });
    });

    it("deve mapear status duplicate com mensagem e field cpf", () => {
      expect(mapSubmitStatus("duplicate")).toEqual({
        ok: false,
        error:
          "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador.",
        field: "cpf",
      });
    });

    it("deve mapear status consent_required com mensagem e field __consent", () => {
      expect(mapSubmitStatus("consent_required")).toEqual({
        ok: false,
        error: "É necessário aceitar o termo para continuar.",
        field: "__consent",
      });
    });

    it("deve mapear status full, closed e unavailable", () => {
      expect(mapSubmitStatus("full")).toEqual({
        ok: false,
        error: "O limite de inscrições foi atingido.",
      });
      expect(mapSubmitStatus("closed")).toEqual({
        ok: false,
        error: "O prazo de preenchimento encerrou.",
      });
      expect(mapSubmitStatus("unavailable")).toEqual({
        ok: false,
        error: "Este formulário não está disponível.",
      });
    });

    it("deve mapear status desconhecido para erro genérico", () => {
      expect(mapSubmitStatus("unknown_status")).toEqual({
        ok: false,
        error: "Não foi possível concluir a inscrição. Tente novamente.",
      });
    });
  });
});
