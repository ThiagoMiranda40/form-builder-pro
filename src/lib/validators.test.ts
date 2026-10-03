import { describe, it, expect } from "vitest";
import {
  isValidCPF,
  isValidRG,
  isValidPhoneBR,
  isValidEmail,
  validateAnswer,
} from "./validators";

describe("validators (caracterização T-01)", () => {
  describe("CPF", () => {
    it("deve validar CPFs válidos (formatados ou apenas dígitos)", () => {
      expect(isValidCPF("529.982.247-25")).toBe(true);
      expect(isValidCPF("52998224725")).toBe(true);
      expect(validateAnswer("cpf", true, "529.982.247-25")).toBeNull();
      expect(validateAnswer("cpf", true, "52998224725")).toBeNull();
    });

    it("deve rejeitar CPFs inválidos ou com dígitos repetidos", () => {
      expect(isValidCPF("111.111.111-11")).toBe(false);
      expect(isValidCPF("529.982.247-26")).toBe(false);
      expect(validateAnswer("cpf", true, "111.111.111-11")).not.toBeNull();
      expect(validateAnswer("cpf", true, "529.982.247-26")).not.toBeNull();
    });
  });

  describe("Telefone", () => {
    it("deve validar celular e fixo válidos", () => {
      expect(isValidPhoneBR("(11) 91234-5678")).toBe(true);
      expect(isValidPhoneBR("(11) 1234-5678")).toBe(true);
      expect(validateAnswer("phone", true, "(11) 91234-5678")).toBeNull();
      expect(validateAnswer("phone", true, "(11) 1234-5678")).toBeNull();
    });

    it("deve rejeitar celular de 11 dígitos sem o 9 inicial e DDD inválido 00", () => {
      expect(isValidPhoneBR("(11) 81234-5678")).toBe(false);
      expect(isValidPhoneBR("(00) 91234-5678")).toBe(false);
      expect(validateAnswer("phone", true, "(11) 81234-5678")).not.toBeNull();
      expect(validateAnswer("phone", true, "(00) 91234-5678")).not.toBeNull();
    });
  });

  describe("E-mail", () => {
    it("deve validar e-mail válido", () => {
      expect(isValidEmail("a@b.co")).toBe(true);
      expect(validateAnswer("email", true, "a@b.co")).toBeNull();
    });

    it("deve rejeitar e-mail inválido sem TLD de 2+ letras", () => {
      expect(isValidEmail("a@b")).toBe(false);
      expect(validateAnswer("email", true, "a@b")).not.toBeNull();
    });
  });

  describe("RG", () => {
    it("deve validar RG válido formatado", () => {
      expect(isValidRG("12.345.678-9")).toBe(true);
      expect(validateAnswer("rg", true, "12.345.678-9")).toBeNull();
    });

    it("deve rejeitar RG com caracteres repetidos ou tamanho insuficiente", () => {
      expect(isValidRG("111111111")).toBe(false);
      expect(isValidRG("123")).toBe(false);
      expect(validateAnswer("rg", true, "111111111")).not.toBeNull();
      expect(validateAnswer("rg", true, "123")).not.toBeNull();
    });
  });

  describe("FIELD_TYPES", () => {
    it("FIELD_TYPES contém birthdate logo depois de date", async () => {
      const { FIELD_TYPES } = await import("./validators");
      const dateIndex = FIELD_TYPES.findIndex((f) => f.value === "date");
      expect(dateIndex).toBeGreaterThanOrEqual(0);
      expect(FIELD_TYPES[dateIndex + 1]).toEqual({
        value: "birthdate",
        label: "Data de nascimento",
        hint: "Não aceita hoje nem datas futuras",
      });
    });
  });

  describe("Date e Birthdate", () => {
    const fixedNow = new Date("2026-10-02T15:00:00-03:00");

    it("date valida calendário real sem limite de ano e rejeita data inexistente", () => {
      expect(validateAnswer("date", true, "2026-10-02")).toBeNull();
      expect(validateAnswer("date", true, "1850-01-01")).toBeNull();
      expect(validateAnswer("date", true, "2050-01-01")).toBeNull();
      expect(validateAnswer("date", false, "")).toBeNull();
      expect(validateAnswer("date", false, null)).toBeNull();
      expect(validateAnswer("date", true, "")).toBe("Este campo é obrigatório.");
      expect(validateAnswer("date", true, "2026-02-30")).toBe("Data inválida.");
      expect(validateAnswer("date", true, "abc")).toBe("Data inválida.");
    });

    it("birthdate valida nascimento com regra de hoje/futura e calendário", () => {
      expect(validateAnswer("birthdate", true, "2026-10-01", fixedNow)).toBeNull();
      expect(validateAnswer("birthdate", false, "", fixedNow)).toBeNull();
      expect(validateAnswer("birthdate", false, null, fixedNow)).toBeNull();
      expect(validateAnswer("birthdate", true, "", fixedNow)).toBe("Este campo é obrigatório.");
      expect(validateAnswer("birthdate", true, "2026-10-02", fixedNow)).toBe(
        "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura.",
      );
      expect(validateAnswer("birthdate", true, "2026-10-03", fixedNow)).toBe(
        "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura.",
      );
      expect(validateAnswer("birthdate", true, "1899-12-31", fixedNow)).toBe(
        "Data de nascimento inválida.",
      );
      expect(validateAnswer("birthdate", true, "2026-02-30", fixedNow)).toBe(
        "Data de nascimento inválida.",
      );
    });
  });
});

