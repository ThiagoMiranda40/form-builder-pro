import { describe, expect, it } from "vitest";
import { normalizeDescription } from "./description";

describe("normalizeDescription", () => {
  it("retorna string vazia para nulo", () => {
    expect(normalizeDescription(null)).toBe("");
  });

  it("retorna string vazia para undefined", () => {
    expect(normalizeDescription(undefined)).toBe("");
  });

  it("retorna string vazia para texto contendo apenas espacos e quebras de linha", () => {
    expect(normalizeDescription("   \n \n ")).toBe("");
  });

  it("troca CRLF por LF", () => {
    expect(normalizeDescription("Primeira linha\r\nSegunda linha")).toBe(
      "Primeira linha\nSegunda linha"
    );
  });

  it("mantem texto sem quebras inalterado", () => {
    expect(normalizeDescription("Descricao simples sem quebras")).toBe(
      "Descricao simples sem quebras"
    );
  });

  it("reduz 4 quebras seguidas a 2", () => {
    expect(normalizeDescription("Bloco 1\n\n\n\nBloco 2")).toBe(
      "Bloco 1\n\nBloco 2"
    );
  });

  it("remove espacos e tabs no fim das linhas", () => {
    expect(
      normalizeDescription("Linha com espaco no fim   \nLinha com tab\t\nLinha limpa")
    ).toBe("Linha com espaco no fim\nLinha com tab\nLinha limpa");
  });

  it("apara espacos e quebras do comeco e do fim", () => {
    expect(normalizeDescription("\n\n   Texto no meio   \n\n")).toBe(
      "Texto no meio"
    );
  });

  it("preserva uma unica quebra de linha", () => {
    expect(normalizeDescription("Linha 1\nLinha 2")).toBe("Linha 1\nLinha 2");
  });

  it("mantem o texto da SKF colado em linhas exatamente igual", () => {
    const textoSKF = "Data: 11/10/2026\nDistâncias: 5k, 10k e 21k";
    expect(normalizeDescription(textoSKF)).toBe(textoSKF);
  });
});
