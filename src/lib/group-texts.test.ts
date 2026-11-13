import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUP_INVITE_TEXT,
  GROUP_PRIVACY_NOTICE,
  GROUP_TEXT_ERRORS,
  resolveGroupInviteText,
  resolveGroupNotice,
  sanitizeGroupText,
} from "./group-texts";

describe("group-texts (T-56 / RF-26 / SEC-49)", () => {
  describe("sanitizeGroupText", () => {
    it("texto simples válido retorna ok com texto aparado", () => {
      const res = sanitizeGroupText("  Aviso importante para os inscritos da corrida!  ");
      expect(res).toEqual({
        ok: true,
        text: "Aviso importante para os inscritos da corrida!",
      });
    });

    it("vazio e somente espaços retorna ok com text: null", () => {
      expect(sanitizeGroupText("")).toEqual({ ok: true, text: null });
      expect(sanitizeGroupText("   \t  \n  ")).toEqual({ ok: true, text: null });
    });

    it("quebras de linha e tabs internas viram um único espaço", () => {
      const res = sanitizeGroupText("Linha 1\n\nLinha 2\t\tLinha 3");
      expect(res).toEqual({
        ok: true,
        text: "Linha 1 Linha 2 Linha 3",
      });
    });

    it("remove caracteres bidirecionais, de largura zero e de controle", () => {
      const dirty = "Aviso \u202Eevil\u200B invisivel \u2028 quebra \uFEFF zero";
      const res = sanitizeGroupText(dirty);
      expect(res).toEqual({
        ok: true,
        text: "Aviso evil invisivel quebra zero",
      });
    });

    it("limite de tamanho: 200 caracteres ok, 201 retorna too_long", () => {
      const exact200 = "a".repeat(200);
      expect(sanitizeGroupText(exact200)).toEqual({
        ok: true,
        text: exact200,
      });

      const tooLong = "a".repeat(201);
      expect(sanitizeGroupText(tooLong)).toEqual({
        ok: false,
        reason: "too_long",
      });
    });

    it("rejeita endereços (http://, https://, www., maiúsculas/minúsculas)", () => {
      expect(sanitizeGroupText("Acesse http://x.com para ver")).toEqual({
        ok: false,
        reason: "has_url",
      });
      expect(sanitizeGroupText("Veja em HTTPS://link.me")).toEqual({
        ok: false,
        reason: "has_url",
      });
      expect(sanitizeGroupText("Entre em www.grupo.com")).toEqual({
        ok: false,
        reason: "has_url",
      });
    });

    it("rejeita tipos inválidos (número, null, undefined, objeto)", () => {
      expect(sanitizeGroupText(123)).toEqual({ ok: false, reason: "invalid" });
      expect(sanitizeGroupText(null)).toEqual({ ok: false, reason: "invalid" });
      expect(sanitizeGroupText(undefined)).toEqual({ ok: false, reason: "invalid" });
      expect(sanitizeGroupText({ text: "olá" })).toEqual({ ok: false, reason: "invalid" });
    });

    it("preserva acentuação e emojis normais", () => {
      const res = sanitizeGroupText("Atenção atletas: premiação especial! 🏃‍♂️🥇");
      expect(res).toEqual({
        ok: true,
        text: "Atenção atletas: premiação especial! 🏃‍♂️🥇",
      });
    });
  });

  describe("resolveGroupNotice", () => {
    const validLink = "https://chat.whatsapp.com/LPUC195Oj4n7Gi4v60rS3A";

    it("sem link válido devolve null mesmo com texto preenchido", () => {
      expect(resolveGroupNotice(null, "Aviso")).toBeNull();
      expect(resolveGroupNotice("", "Aviso")).toBeNull();
      expect(resolveGroupNotice("http://invalido", "Aviso")).toBeNull();
    });

    it("com link válido e texto válido devolve o texto sanitizado", () => {
      expect(resolveGroupNotice(validLink, "  Entre no grupo antes da largada  ")).toBe(
        "Entre no grupo antes da largada",
      );
    });

    it("com link válido e texto vazio devolve null", () => {
      expect(resolveGroupNotice(validLink, "")).toBeNull();
      expect(resolveGroupNotice(validLink, "   ")).toBeNull();
      expect(resolveGroupNotice(validLink, null)).toBeNull();
    });

    it("com link válido e texto com URL devolve null", () => {
      expect(resolveGroupNotice(validLink, "Acesse https://golpe.com")).toBeNull();
    });
  });

  describe("resolveGroupInviteText", () => {
    it("vazio, null, undefined ou inválido devolve o texto padrão", () => {
      expect(resolveGroupInviteText(null)).toBe(DEFAULT_GROUP_INVITE_TEXT);
      expect(resolveGroupInviteText(undefined)).toBe(DEFAULT_GROUP_INVITE_TEXT);
      expect(resolveGroupInviteText("")).toBe(DEFAULT_GROUP_INVITE_TEXT);
      expect(resolveGroupInviteText("   ")).toBe(DEFAULT_GROUP_INVITE_TEXT);
      expect(resolveGroupInviteText("Texto com https://link.com")).toBe(DEFAULT_GROUP_INVITE_TEXT);
      expect(resolveGroupInviteText(12345)).toBe(DEFAULT_GROUP_INVITE_TEXT);
    });

    it("texto válido devolve o texto sanitizado", () => {
      expect(resolveGroupInviteText("Grupo exclusivo dos 10 km! Participe.")).toBe(
        "Grupo exclusivo dos 10 km! Participe.",
      );
    });
  });

  describe("constantes e mensagens de erro exportadas", () => {
    it("mensagens de erro do editor são claras", () => {
      expect(GROUP_TEXT_ERRORS.too_long).toBe("Use no máximo 200 caracteres.");
      expect(GROUP_TEXT_ERRORS.has_url).toBe("Não coloque endereços (links) neste texto.");
      expect(GROUP_TEXT_ERRORS.invalid).toBe("Texto inválido.");
      expect(GROUP_PRIVACY_NOTICE).toBe(
        "Quem entra no grupo vê o número de WhatsApp dos outros participantes.",
      );
    });
  });
});

