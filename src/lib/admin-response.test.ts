import { describe, it, expect } from "vitest";
import {
  hasEmailChanged,
  findEmailQuestionWithAnswer,
  isCpfDigitsEqual,
} from "./admin-response";

describe("admin-response (lógica pura)", () => {
  describe("hasEmailChanged", () => {
    it("devolve true se o e-mail mudou", () => {
      const prev = { "q-email": "antigo@teste.com" };
      const next = { "q-email": "novo@teste.com" };
      expect(hasEmailChanged(prev, next, "q-email")).toBe(true);
    });

    it("devolve false se o e-mail for idêntico (ignorando maiúsculas e espaços)", () => {
      const prev = { "q-email": "contato@teste.com" };
      const next = { "q-email": " CONTATO@teste.com " };
      expect(hasEmailChanged(prev, next, "q-email")).toBe(false);
    });

    it("devolve false se não houver pergunta de e-mail ou campos forem nulos", () => {
      expect(hasEmailChanged({}, {}, undefined)).toBe(false);
      expect(hasEmailChanged(null, null, "q-email")).toBe(false);
    });

    it("devolve true se o e-mail não existia antes e agora existe", () => {
      expect(hasEmailChanged({}, { "q-email": "novo@teste.com" }, "q-email")).toBe(true);
    });
  });

  describe("findEmailQuestionWithAnswer", () => {
    it("encontra a primeira pergunta do tipo e-mail com resposta preenchida", () => {
      const questions = [
        { id: "q-1", field_type: "text" },
        { id: "q-2", field_type: "email" },
        { id: "q-3", field_type: "email" },
      ];
      const answers = {
        "q-1": "Nome",
        "q-2": "maria@teste.com",
        "q-3": "outro@teste.com",
      };

      const result = findEmailQuestionWithAnswer(questions, answers);
      expect(result).toEqual({ questionId: "q-2", email: "maria@teste.com" });
    });

    it("ignora perguntas de e-mail com resposta vazia ou nula", () => {
      const questions = [
        { id: "q-1", field_type: "email" },
        { id: "q-2", field_type: "email" },
      ];
      const answers = {
        "q-1": "   ",
        "q-2": "valido@teste.com",
      };

      const result = findEmailQuestionWithAnswer(questions, answers);
      expect(result).toEqual({ questionId: "q-2", email: "valido@teste.com" });
    });

    it("retorna null se não houver pergunta de e-mail com resposta preenchida", () => {
      const questions = [{ id: "q-1", field_type: "text" }];
      const answers = { "q-1": "Nome" };
      expect(findEmailQuestionWithAnswer(questions, answers)).toBeNull();
      expect(findEmailQuestionWithAnswer([], {})).toBeNull();
    });
  });

  describe("isCpfDigitsEqual", () => {
    it("compara dígitos do CPF com pontuação diferente", () => {
      expect(isCpfDigitsEqual("52998224725", "529.982.247-25")).toBe(true);
      expect(isCpfDigitsEqual("529.982.247-25", "52998224725")).toBe(true);
    });

    it("retorna false quando os dígitos são diferentes", () => {
      expect(isCpfDigitsEqual("52998224725", "11144477735")).toBe(false);
    });

    it("lida corretamente com nulos e vazios", () => {
      expect(isCpfDigitsEqual(null, "52998224725")).toBe(false);
      expect(isCpfDigitsEqual("52998224725", null)).toBe(false);
      expect(isCpfDigitsEqual("", "")).toBe(true);
    });
  });
});
