import { describe, expect, it } from "vitest";
import { resolvePublicState } from "./form-state";

describe("resolvePublicState", () => {
  const baseForm = {
    status: "published",
    closes_at: null,
    max_responses: null,
  };
  const now = new Date("2026-10-01T12:00:00Z");

  it("retorna draft para status draft", () => {
    expect(
      resolvePublicState({ ...baseForm, status: "draft" }, 0, now)
    ).toBe("draft");
  });

  it("retorna closed para status closed", () => {
    expect(
      resolvePublicState({ ...baseForm, status: "closed" }, 0, now)
    ).toBe("closed");
  });

  it("retorna closed para status published com prazo vencido", () => {
    expect(
      resolvePublicState(
        { ...baseForm, status: "published", closes_at: "2026-10-01T11:59:59Z" },
        0,
        now
      )
    ).toBe("closed");
  });

  it("retorna full para status published lotado", () => {
    expect(
      resolvePublicState(
        { ...baseForm, status: "published", max_responses: 50 },
        50,
        now
      )
    ).toBe("full");

    expect(
      resolvePublicState(
        { ...baseForm, status: "published", max_responses: 50 },
        55,
        now
      )
    ).toBe("full");
  });

  it("retorna closed para status published com prazo vencido E lotado", () => {
    expect(
      resolvePublicState(
        {
          ...baseForm,
          status: "published",
          closes_at: "2026-10-01T11:59:59Z",
          max_responses: 50,
        },
        50,
        now
      )
    ).toBe("closed");
  });

  it("retorna open para status published normal", () => {
    expect(
      resolvePublicState(
        {
          ...baseForm,
          status: "published",
          closes_at: "2026-10-01T12:00:01Z",
          max_responses: 50,
        },
        49,
        now
      )
    ).toBe("open");
  });

  it("retorna draft para status desconhecido", () => {
    expect(
      resolvePublicState({ ...baseForm, status: "archived" }, 0, now)
    ).toBe("draft");
    expect(
      resolvePublicState({ ...baseForm, status: "unknown" }, 0, now)
    ).toBe("draft");
  });
});
