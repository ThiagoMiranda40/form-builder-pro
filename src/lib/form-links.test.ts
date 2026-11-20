import { describe, expect, it } from "vitest";
import { publicFormUrl } from "./form-links";

describe("publicFormUrl (T-65 / RF-28)", () => {
  it("monta o link público a partir da origem e do slug", () => {
    expect(publicFormUrl("https://x.com", "corrida-2026")).toBe(
      "https://x.com/corrida-2026",
    );
  });

  it("não duplica a barra quando a origem termina com barra", () => {
    expect(publicFormUrl("https://x.com/", "corrida-2026")).toBe(
      "https://x.com/corrida-2026",
    );
    expect(publicFormUrl("https://x.com///", "corrida-2026")).toBe(
      "https://x.com/corrida-2026",
    );
  });

  it("codifica caracteres fora de a-z0-9- no slug", () => {
    expect(publicFormUrl("https://x.com", "corrida 2026")).toBe(
      "https://x.com/corrida%202026",
    );
    expect(publicFormUrl("https://x.com", "etapa/verão")).toBe(
      "https://x.com/etapa%2Fver%C3%A3o",
    );
  });

  it("não explode com slug vazio e devolve origin + '/'", () => {
    expect(publicFormUrl("https://x.com", "")).toBe("https://x.com/");
    expect(publicFormUrl("https://x.com/", "")).toBe("https://x.com/");
  });
});
