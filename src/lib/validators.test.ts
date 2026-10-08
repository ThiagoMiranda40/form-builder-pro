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
      expect(isValidPhoneBR("(11) 98695-5568")).toBe(true);
      expect(isValidPhoneBR("(11) 3456-7890")).toBe(true);
      expect(validateAnswer("phone", true, "(11) 98695-5568")).toBeNull();
      expect(validateAnswer("phone", true, "(11) 3456-7890")).toBeNull();
    });

    it("deve rejeitar celular de 10 dígitos com dígito faltando, fixo iniciando fora de 2-5, 9 dígitos e DDD inválido", () => {
      expect(isValidPhoneBR("(11) 9869-5568")).toBe(false); // celular com dígito faltando (10 dígitos começando com 9)
      expect(isValidPhoneBR("(11) 9456-7890")).toBe(false); // 10 dígitos começando com 9
      expect(isValidPhoneBR("(11) 8456-7890")).toBe(false); // 10 dígitos começando com 8
      expect(isValidPhoneBR("(11) 1234-5678")).toBe(false); // 10 dígitos começando com 1
      expect(isValidPhoneBR("(11) 9876-543")).toBe(false); // 9 dígitos
      expect(isValidPhoneBR("(10) 98765-4321")).toBe(false); // DDD 10 inexistente
      expect(isValidPhoneBR("(00) 91234-5678")).toBe(false);
      expect(isValidPhoneBR("(11) 81234-5678")).toBe(false); // 11 dígitos começando com 8
    });

    it("deve retornar mensagem literal exata de erro para telefone inválido", () => {
      const msg = "Telefone inválido — celular com DDD tem 11 dígitos (ex.: (11) 98765-4321) e fixo tem 10 dígitos.";
      expect(validateAnswer("phone", true, "(11) 9869-5568")).toBe(msg);
      expect(validateAnswer("phone", true, "(11) 8456-7890")).toBe(msg);
      expect(validateAnswer("phone", true, "123")).toBe(msg);
    });

    it("garante coerência com parseBrazilMobile: todo celular de 11 dígitos aceito pelo validador é reconhecido", async () => {
      const { parseBrazilMobile } = await import("./whatsapp");
      const validMobiles = [
        "(11) 98695-5568",
        "(21) 99876-5432",
        "(31) 98888-7777",
        "(85) 98765-4321",
      ];
      for (const phone of validMobiles) {
        expect(isValidPhoneBR(phone)).toBe(true);
        const parsed = parseBrazilMobile(phone);
        expect(parsed).not.toBeNull();
        expect(parsed?.ddd).toBe(phone.replace(/\D/g, "").slice(0, 2));
      }
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
        "Informe uma data de nascimento válida.",
      );
      expect(validateAnswer("birthdate", true, "2026-10-03", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
      expect(validateAnswer("birthdate", true, "1899-12-31", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
      expect(validateAnswer("birthdate", true, "2026-02-30", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
    });

    it("birthdate respeita context com ageLimits e skipAgeLimits", () => {
      // sem contexto = comportamento atual
      expect(validateAnswer("birthdate", true, "2000-01-01")).toBeNull();

      // com limites (18 a 60 anos em refDate 2026-10-10)
      const limits = { minAge: 18, maxAge: 60 };
      const ctx = { ageLimits: limits, refDate: "2026-10-10", now: fixedNow };

      // Nascido em 2008-10-10 completa 18 anos em 2026-10-10 -> válido
      expect(validateAnswer("birthdate", true, "2008-10-10", ctx)).toBeNull();

      // Nascido em 2008-10-11 tem 17 anos -> inválido
      expect(validateAnswer("birthdate", true, "2008-10-11", ctx)).toBe(
        "Este evento aceita participantes de 18 a 60 anos.",
      );

      // Nascido em 1966-10-11 tem 59 anos -> válido
      expect(validateAnswer("birthdate", true, "1966-10-11", ctx)).toBeNull();

      // Nascido em 1965-10-09 tem 61 anos -> inválido
      expect(validateAnswer("birthdate", true, "1965-10-09", ctx)).toBe(
        "Este evento aceita participantes de 18 a 60 anos.",
      );

      // Com skipAgeLimits: true -> passa mesmo com idade fora do limite
      expect(
        validateAnswer("birthdate", true, "2008-10-11", {
          ...ctx,
          skipAgeLimits: true,
        }),
      ).toBeNull();
    });
  });
});

