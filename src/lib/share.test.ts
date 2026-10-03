import { describe, it, expect } from "vitest";
import { generateShareToken, isValidShareToken, buildShareUrl } from "./share";

describe("share.ts - funções puras de link do cliente (T-25 / M-20)", () => {
  describe("generateShareToken", () => {
    it("deve gerar uma string de 64 caracteres hexadecimais minúsculos", () => {
      const token = generateShareToken();
      expect(typeof token).toBe("string");
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("dois tokens gerados em sequência devem ser diferentes", () => {
      const token1 = generateShareToken();
      const token2 = generateShareToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("isValidShareToken", () => {
    it("deve aceitar string com exatamente 64 caracteres hexadecimais minúsculos", () => {
      const validToken = "a".repeat(64);
      expect(isValidShareToken(validToken)).toBe(true);
      expect(isValidShareToken("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")).toBe(true);
    });

    it("deve rejeitar string vazia", () => {
      expect(isValidShareToken("")).toBe(false);
    });

    it("deve rejeitar string com tamanho menor que 64", () => {
      expect(isValidShareToken("a".repeat(63))).toBe(false);
      expect(isValidShareToken("12345")).toBe(false);
    });

    it("deve rejeitar string com tamanho maior que 64", () => {
      expect(isValidShareToken("a".repeat(65))).toBe(false);
    });

    it("deve rejeitar letras maiúsculas", () => {
      const upperToken = "A".repeat(64);
      expect(isValidShareToken(upperToken)).toBe(false);
      expect(isValidShareToken("0123456789ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef")).toBe(false);
    });

    it("deve rejeitar caracteres fora do alfabeto hexadecimal", () => {
      const invalidChars = "g".repeat(64);
      expect(isValidShareToken(invalidChars)).toBe(false);
      expect(isValidShareToken("z".repeat(64))).toBe(false);
      expect(isValidShareToken("a".repeat(63) + "-")).toBe(false);
    });

    it("deve rejeitar tipos que não são string (número, objeto, nulo, indefinido, booleano)", () => {
      expect(isValidShareToken(null)).toBe(false);
      expect(isValidShareToken(undefined)).toBe(false);
      expect(isValidShareToken(123456789)).toBe(false);
      expect(isValidShareToken({})).toBe(false);
      expect(isValidShareToken([])).toBe(false);
      expect(isValidShareToken(true)).toBe(false);
    });
  });

  describe("buildShareUrl", () => {
    it("deve construir a URL no formato origin/c/token", () => {
      const token = "a".repeat(64);
      expect(buildShareUrl("https://inscricoes.corretime.com.br", token)).toBe(
        `https://inscricoes.corretime.com.br/c/${token}`
      );
    });

    it("deve remover barras adicionais do origin se houver", () => {
      const token = "b".repeat(64);
      expect(buildShareUrl("https://inscricoes.corretime.com.br/", token)).toBe(
        `https://inscricoes.corretime.com.br/c/${token}`
      );
    });
  });
});
