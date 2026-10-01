import { describe, it, expect } from "vitest";
import { isEdited, describeResponse } from "./responses-view";

describe("isEdited", () => {
  it("devolve falso para datas iguais", () => {
    expect(isEdited("2026-10-01T10:00:00.000Z", "2026-10-01T10:00:00.000Z")).toBe(false);
  });

  it("devolve falso para diferença de até 1 segundo (+500 ms)", () => {
    expect(isEdited("2026-10-01T10:00:00.000Z", "2026-10-01T10:00:00.500Z")).toBe(false);
    expect(isEdited("2026-10-01T10:00:00.000Z", "2026-10-01T10:00:01.000Z")).toBe(false);
  });

  it("devolve verdadeiro se updated_at for mais de 1 segundo depois (+2 s)", () => {
    expect(isEdited("2026-10-01T10:00:00.000Z", "2026-10-01T10:00:02.000Z")).toBe(true);
  });

  it("devolve falso se updated_at for anterior ao envio", () => {
    expect(isEdited("2026-10-01T10:00:02.000Z", "2026-10-01T10:00:00.000Z")).toBe(false);
  });

  it("devolve falso para texto inválido", () => {
    expect(isEdited("data-invalida", "2026-10-01T10:00:00.000Z")).toBe(false);
    expect(isEdited("2026-10-01T10:00:00.000Z", "data-invalida")).toBe(false);
  });

  it("devolve falso para datas nulas ou indefinidas", () => {
    expect(isEdited(null, null)).toBe(false);
    expect(isEdited("2026-10-01T10:00:00.000Z", null)).toBe(false);
    expect(isEdited(null, "2026-10-01T10:00:00.000Z")).toBe(false);
    expect(isEdited(undefined, undefined)).toBe(false);
  });
});

describe("describeResponse (T-16 / M-9)", () => {
  it("devolve o segundo valor quando a primeira resposta é vazia e a segunda é preenchida", () => {
    const questions = [{ id: "q1" }, { id: "q2" }];
    const answers = { q1: "  ", q2: " Maria Silva " };
    expect(describeResponse(questions, answers)).toBe("Maria Silva");
  });

  it("ignora lista de escolha (multi_choice) em favor de texto", () => {
    const questions = [{ id: "q1" }, { id: "q2" }];
    const answers = { q1: ["Opção A", "Opção B"], q2: "Carlos Souza" };
    expect(describeResponse(questions, answers)).toBe("Carlos Souza");
  });

  it("devolve 'esta pessoa' quando tudo está vazio", () => {
    const questions = [{ id: "q1" }, { id: "q2" }];
    const answers = { q1: "", q2: "   " };
    expect(describeResponse(questions, answers)).toBe("esta pessoa");
  });

  it("limita a 60 caracteres com reticências quando o valor é muito longo", () => {
    const questions = [{ id: "q1" }];
    const longText = "A".repeat(80);
    const answers = { q1: longText };
    expect(describeResponse(questions, answers)).toBe("A".repeat(60) + "...");
  });

  it("devolve 'esta pessoa' quando as respostas são nulas ou ausentes", () => {
    const questions = [{ id: "q1" }];
    expect(describeResponse(questions, { q1: null })).toBe("esta pessoa");
    expect(describeResponse(questions, null)).toBe("esta pessoa");
    expect(describeResponse(null, null)).toBe("esta pessoa");
  });
});
