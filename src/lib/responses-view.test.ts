import { describe, it, expect } from "vitest";
import { isEdited } from "./responses-view";

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
