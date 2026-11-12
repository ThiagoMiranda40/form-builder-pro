import { describe, it, expect } from "vitest";
import {
  generateShareToken,
  isValidShareToken,
  buildShareUrl,
  ACCESS_CODE_ALPHABET,
  generateAccessCode,
  normalizeAccessCode,
  generateSalt,
  hashAccessCode,
  verifyAccessCode,
  computeSessionExpiry,
  signShareSession,
  verifyShareSession,
  isLockedOut,
} from "./share";

describe("share.ts - funções puras de link do cliente (T-25 / M-20 / T-44 / M-44)", () => {
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
      expect(
        isValidShareToken("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
      ).toBe(true);
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
      expect(
        isValidShareToken("0123456789ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef"),
      ).toBe(false);
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
        `https://inscricoes.corretime.com.br/c/${token}`,
      );
    });

    it("deve remover barras adicionais do origin se houver", () => {
      const token = "b".repeat(64);
      expect(buildShareUrl("https://inscricoes.corretime.com.br/", token)).toBe(
        `https://inscricoes.corretime.com.br/c/${token}`,
      );
    });
  });

  describe("generateAccessCode (T-44)", () => {
    it("tem exatamente 10 caracteres do alfabeto ABCDEFGHJKLMNPQRSTUVWXYZ23456789 sem I, O, 0 ou 1", () => {
      expect(ACCESS_CODE_ALPHABET).toBe("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
      expect(ACCESS_CODE_ALPHABET).toHaveLength(32);

      const code = generateAccessCode();
      expect(code).toHaveLength(10);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
      expect(code).not.toMatch(/[IO01]/);
    });

    it("1000 gerações não têm repetição e cobrem todos os 32 símbolos do alfabeto (sem caractere impossível)", () => {
      const seenCodes = new Set<string>();
      const seenChars = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const code = generateAccessCode();
        expect(code).toHaveLength(10);
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
        seenCodes.add(code);
        for (const ch of code) {
          seenChars.add(ch);
        }
      }

      expect(seenCodes.size).toBe(1000);
      for (const ch of ACCESS_CODE_ALPHABET) {
        expect(seenChars.has(ch)).toBe(true);
      }
    });
  });

  describe("normalizeAccessCode (T-44)", () => {
    it("converte minúsculas para maiúsculas e remove espaços e hífens", () => {
      expect(normalizeAccessCode("abcd-efgh-23")).toBe("ABCDEFGH23");
      expect(normalizeAccessCode("  ab cd ef gh 23  ")).toBe("ABCDEFGH23");
      expect(normalizeAccessCode("aBcD - eFgH – 23 —")).toBe("ABCDEFGH23");
      expect(normalizeAccessCode("")).toBe("");
    });
  });

  describe("hashAccessCode e verifyAccessCode (T-44)", () => {
    it("mesmo código + sal confere (inclusive com minúsculas/hífens na verificação)", async () => {
      const salt = generateSalt();
      expect(salt).toMatch(/^[0-9a-f]{32}$/);

      const code = "ABCDEFGH23";
      const hash = await hashAccessCode(code, salt);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);

      expect(await verifyAccessCode("ABCDEFGH23", salt, hash)).toBe(true);
      expect(await verifyAccessCode("abcd-efgh-23", salt, hash)).toBe(true);
    });

    it("código errado, sal diferente e hash adulterado falham", async () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const code = "ABCDEFGH23";
      const hash = await hashAccessCode(code, salt1);

      expect(await verifyAccessCode("ABCDEFGH24", salt1, hash)).toBe(false);
      expect(await verifyAccessCode(code, salt2, hash)).toBe(false);

      const tamperedHash =
        (hash[0] === "a" ? "b" : "a") + hash.slice(1);
      expect(await verifyAccessCode(code, salt1, tamperedHash)).toBe(false);
      expect(await verifyAccessCode(code, salt1, "hash-curto")).toBe(false);
      expect(await verifyAccessCode("", salt1, hash)).toBe(false);
    });
  });

  describe("computeSessionExpiry (T-44)", () => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    it("closes_at futuro -> retorna closes_at + 30 dias", () => {
      const now = new Date("2026-11-12T12:00:00Z");
      const closesAt = "2026-11-20T23:59:00Z";
      const expiry = computeSessionExpiry(closesAt, now);
      expect(expiry.getTime()).toBe(new Date(closesAt).getTime() + THIRTY_DAYS_MS);
    });

    it("closes_at nulo -> retorna agora + 30 dias", () => {
      const now = new Date("2026-11-12T12:00:00Z");
      const expiry = computeSessionExpiry(null, now);
      expect(expiry.getTime()).toBe(now.getTime() + THIRTY_DAYS_MS);
    });

    it("closes_at com mais de 30 dias no passado -> retorna agora + 30 dias", () => {
      const now = new Date("2026-11-12T12:00:00Z");
      const closesAt = "2026-09-01T23:59:00Z";
      const expiry = computeSessionExpiry(closesAt, now);
      expect(expiry.getTime()).toBe(now.getTime() + THIRTY_DAYS_MS);
    });
  });

  describe("signShareSession e verifyShareSession (T-44)", () => {
    const secret = "segredo-de-teste-32-bytes-1234567890";
    const now = new Date("2026-11-12T12:00:00Z");
    const exp = Math.floor(now.getTime() / 1000) + 3600;
    const basePayload = {
      f: "22222222-2222-4222-a222-222222222222",
      v: 3,
      exp,
    };

    it("sessão válida passa e devolve o payload", async () => {
      const token = await signShareSession(basePayload, secret);
      const verified = await verifyShareSession(token, secret, now, {
        formId: basePayload.f,
        version: basePayload.v,
      });
      expect(verified).toEqual(basePayload);
    });

    it("assinatura adulterada falha", async () => {
      const token = await signShareSession(basePayload, secret);
      const [body, sig] = token.split(".");
      const badSig = (sig![0] === "a" ? "b" : "a") + sig!.slice(1);
      const verified = await verifyShareSession(`${body}.${badSig}`, secret, now, {
        formId: basePayload.f,
        version: basePayload.v,
      });
      expect(verified).toBeNull();
    });

    it("payload alterado mantendo assinatura antiga falha", async () => {
      const token = await signShareSession(basePayload, secret);
      const [, sig] = token.split(".");
      const fakeBody = Buffer.from(
        JSON.stringify({ ...basePayload, v: 99 }),
        "utf-8",
      ).toString("base64url");
      const verified = await verifyShareSession(`${fakeBody}.${sig}`, secret, now);
      expect(verified).toBeNull();
    });

    it("outro formulário falha", async () => {
      const token = await signShareSession(basePayload, secret);
      const verified = await verifyShareSession(token, secret, now, {
        formId: "99999999-9999-4999-a999-999999999999",
        version: basePayload.v,
      });
      expect(verified).toBeNull();
    });

    it("outra versão falha", async () => {
      const token = await signShareSession(basePayload, secret);
      const verified = await verifyShareSession(token, secret, now, {
        formId: basePayload.f,
        version: basePayload.v + 1,
      });
      expect(verified).toBeNull();
    });

    it("sessão expirada falha", async () => {
      const token = await signShareSession(basePayload, secret);
      const afterExpiry = new Date((exp + 1) * 1000);
      const verified = await verifyShareSession(token, secret, afterExpiry, {
        formId: basePayload.f,
        version: basePayload.v,
      });
      expect(verified).toBeNull();
    });

    it("segredo diferente falha", async () => {
      const token = await signShareSession(basePayload, secret);
      const verified = await verifyShareSession(
        token,
        "outro-segredo-diferente-1234567890",
        now,
        {
          formId: basePayload.f,
          version: basePayload.v,
        },
      );
      expect(verified).toBeNull();
    });
  });

  describe("isLockedOut (T-44)", () => {
    it("retorna true quando lockedUntil é maior que agora e false caso contrário", () => {
      const now = new Date("2026-11-12T12:00:00Z");
      expect(isLockedOut("2026-11-12T12:15:00Z", now)).toBe(true);
      expect(isLockedOut("2026-11-12T12:00:00Z", now)).toBe(false);
      expect(isLockedOut("2026-11-12T11:59:59Z", now)).toBe(false);
      expect(isLockedOut(null, now)).toBe(false);
      expect(isLockedOut(undefined, now)).toBe(false);
      expect(isLockedOut("data-invalida", now)).toBe(false);
    });
  });
});
