import { describe, it, expect } from "vitest";
import {
  todayInSaoPaulo,
  birthdateBounds,
  isValidIsoDate,
  validateBirthdate,
  dateInputAttrs,
} from "./birthdate";


describe("birthdate (T-24)", () => {
  describe("isValidIsoDate", () => {
    it("valida datas ISO válidas", () => {
      expect(isValidIsoDate("1981-12-20")).toBe(true);
      expect(isValidIsoDate("2026-10-02")).toBe(true);
      expect(isValidIsoDate("1900-01-01")).toBe(true);
      expect(isValidIsoDate("2024-02-29")).toBe(true); // bissexto
    });

    it("recusa formatos inválidos e datas inexistentes no calendário", () => {
      expect(isValidIsoDate("2026-02-30")).toBe(false);
      expect(isValidIsoDate("2026-13-01")).toBe(false);
      expect(isValidIsoDate("2023-02-29")).toBe(false); // não bissexto
      expect(isValidIsoDate("abc")).toBe(false);
      expect(isValidIsoDate("")).toBe(false);
      expect(isValidIsoDate("2026/10/02")).toBe(false);
      expect(isValidIsoDate("02-10-2026")).toBe(false);
    });
  });

  describe("todayInSaoPaulo & birthdateBounds", () => {
    it("calcula hoje e os limites no fuso fixo de São Paulo", () => {
      // 2026-10-03T02:00:00Z -> UTC-3 é 2026-10-02 23:00 (ainda 02/10 em SP)
      const now1 = new Date("2026-10-03T02:00:00Z");
      expect(todayInSaoPaulo(now1)).toBe("2026-10-02");
      expect(birthdateBounds(now1)).toEqual({
        min: "1900-01-01",
        max: "2026-10-01",
      });

      // 2026-10-03T03:30:00Z -> UTC-3 é 2026-10-03 00:30 (já 03/10 em SP)
      const now2 = new Date("2026-10-03T03:30:00Z");
      expect(todayInSaoPaulo(now2)).toBe("2026-10-03");
      expect(birthdateBounds(now2)).toEqual({
        min: "1900-01-01",
        max: "2026-10-02",
      });
    });
  });

  describe("validateBirthdate", () => {
    const fixedNow = new Date("2026-10-02T15:00:00-03:00"); // hoje em SP = 2026-10-02

    it("ontem -> ok (null)", () => {
      expect(validateBirthdate("2026-10-01", fixedNow)).toBeNull();
    });

    it("hoje -> mensagem de hoje/futura", () => {
      expect(validateBirthdate("2026-10-02", fixedNow)).toBe(
        "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura.",
      );
    });

    it("amanhã -> mensagem de hoje/futura", () => {
      expect(validateBirthdate("2026-10-03", fixedNow)).toBe(
        "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura.",
      );
    });

    it("1900-01-01 -> ok (null)", () => {
      expect(validateBirthdate("1900-01-01", fixedNow)).toBeNull();
    });

    it("1899-12-31 -> inválida", () => {
      expect(validateBirthdate("1899-12-31", fixedNow)).toBe(
        "Data de nascimento inválida.",
      );
    });

    it("2026-02-30 -> inválida", () => {
      expect(validateBirthdate("2026-02-30", fixedNow)).toBe(
        "Data de nascimento inválida.",
      );
    });

    it("abc e vazio -> inválida", () => {
      expect(validateBirthdate("abc", fixedNow)).toBe(
        "Data de nascimento inválida.",
      );
      expect(validateBirthdate("", fixedNow)).toBe(
        "Data de nascimento inválida.",
      );
    });

    it("com now = 2026-10-03T02:00:00Z (ainda 02/10 em SP), 2026-10-02 é HOJE -> erro", () => {
      const now1 = new Date("2026-10-03T02:00:00Z");
      expect(validateBirthdate("2026-10-02", now1)).toBe(
        "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura.",
      );
    });

    it("com now = 2026-10-03T03:30:00Z (já 03/10 em SP), 2026-10-02 é ontem -> ok", () => {
      const now2 = new Date("2026-10-03T03:30:00Z");
      expect(validateBirthdate("2026-10-02", now2)).toBeNull();
    });
  });

  describe("dateInputAttrs (T-24b)", () => {
    const fixedNow = new Date("2026-10-02T15:00:00-03:00");

    it("retorna null para tipos que não são data", () => {
      expect(dateInputAttrs("text", fixedNow)).toBeNull();
      expect(dateInputAttrs("short_text", fixedNow)).toBeNull();
      expect(dateInputAttrs("email", fixedNow)).toBeNull();
      expect(dateInputAttrs("cpf", fixedNow)).toBeNull();
    });

    it("retorna { type: 'date' } para o tipo date", () => {
      expect(dateInputAttrs("date", fixedNow)).toEqual({ type: "date" });
    });

    it("retorna atributos completos para birthdate nos dois horários de teste", () => {
      // 2026-10-03T02:00:00Z -> hoje em SP é 2026-10-02, max = 2026-10-01
      const now1 = new Date("2026-10-03T02:00:00Z");
      expect(dateInputAttrs("birthdate", now1)).toEqual({
        type: "date",
        min: "1900-01-01",
        max: "2026-10-01",
        autoComplete: "bday",
      });

      // 2026-10-03T03:30:00Z -> hoje em SP é 2026-10-03, max = 2026-10-02
      const now2 = new Date("2026-10-03T03:30:00Z");
      expect(dateInputAttrs("birthdate", now2)).toEqual({
        type: "date",
        min: "1900-01-01",
        max: "2026-10-02",
        autoComplete: "bday",
      });
    });
  });
});

