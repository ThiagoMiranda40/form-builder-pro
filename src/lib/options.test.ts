import { describe, expect, it } from "vitest";
import { normalizeOptions } from "./options";

describe("normalizeOptions", () => {
  it("apara cada linha, remove vazias e remove repetidas mantendo a primeira", () => {
    expect(normalizeOptions("A\nB\n\nB \n")).toEqual(["A", "B"]);
  });

  it("retorna lista vazia para texto apenas com espaços e quebras de linha", () => {
    expect(normalizeOptions("  \n")).toEqual([]);
  });

  it("retorna lista vazia para texto vazio", () => {
    expect(normalizeOptions("")).toEqual([]);
  });

  it("preserva a ordem das opções", () => {
    expect(normalizeOptions("Opção C\nOpção A\nOpção B\nOpção A\n")).toEqual([
      "Opção C",
      "Opção A",
      "Opção B",
    ]);
  });

  it("lida corretamente com quebras de linha CRLF", () => {
    expect(normalizeOptions("A\r\nB\r\n\r\nB \r\n")).toEqual(["A", "B"]);
  });
});
