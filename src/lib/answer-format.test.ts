import { describe, it, expect } from "vitest";
import { formatAnswer } from "./answer-format";

describe("formatAnswer (T-22 / Item 1)", () => {
  it("converte data válida YYYY-MM-DD para dd/mm/aaaa quando fieldType for date", () => {
    expect(formatAnswer("date", "1981-12-20")).toBe("20/12/1981");
    expect(formatAnswer("date", "2026-10-02")).toBe("02/10/2026");
  });

  it("converte data válida YYYY-MM-DD para dd/mm/aaaa quando fieldType for birthdate (T-24)", () => {
    expect(formatAnswer("birthdate", "1981-12-20")).toBe("20/12/1981");
    expect(formatAnswer("birthdate", "2026-10-02")).toBe("02/10/2026");
    expect(formatAnswer("birthdate", null)).toBe("");
    expect(formatAnswer("birthdate", undefined)).toBe("");
  });


  it("data inválida que não seja YYYY-MM-DD volta igual (ex.: 'abc')", () => {
    expect(formatAnswer("date", "abc")).toBe("abc");
  });

  it("data com padrão YYYY-MM-DD mas valores numéricos inválidos (ex.: '2026-13-45') pode passar formatada ou como veio", () => {
    const formatted = formatAnswer("date", "2026-13-45");
    expect(["2026-13-45", "45/13/2026"]).toContain(formatted);
  });

  it("tipo de texto (short_text, long_text) com valor parecido com data NÃO é convertido", () => {
    expect(formatAnswer("short_text", "1981-12-20")).toBe("1981-12-20");
    expect(formatAnswer("long_text", "2026-10-02")).toBe("2026-10-02");
    expect(formatAnswer(undefined, "2026-10-02")).toBe("2026-10-02");
  });

  it("lista de valores é unida por vírgula e espaço", () => {
    expect(formatAnswer("multi_choice", ["5 km", "10 km"])).toBe("5 km, 10 km");
    expect(formatAnswer("single_choice", ["Opção A"])).toBe("Opção A");
  });

  it("nulo ou indefinido retorna string vazia", () => {
    expect(formatAnswer("date", null)).toBe("");
    expect(formatAnswer("date", undefined)).toBe("");
    expect(formatAnswer(undefined, null)).toBe("");
    expect(formatAnswer(undefined, undefined)).toBe("");
  });

  it("string vazia retorna string vazia", () => {
    expect(formatAnswer("date", "")).toBe("");
    expect(formatAnswer("short_text", "")).toBe("");
  });
});
