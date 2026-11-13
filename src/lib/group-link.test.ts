import { describe, expect, it } from "vitest";
import { hasValidGroupLink, validateGroupLink } from "./group-link";

describe("group-link — T-51 (M-46): hasValidGroupLink", () => {
  it("retorna verdadeiro para links válidos do WhatsApp", () => {
    expect(hasValidGroupLink("https://chat.whatsapp.com/AbC123")).toBe(true);
    expect(hasValidGroupLink("   https://chat.whatsapp.com/GrupoCorrida2026XYZ987   ")).toBe(true);
    const exact200 = `https://chat.whatsapp.com/${"a".repeat(174)}`;
    expect(hasValidGroupLink(exact200)).toBe(true);
  });

  it("retorna falso para vazio, espaços, nulo, indefinido e outros tipos", () => {
    expect(hasValidGroupLink("")).toBe(false);
    expect(hasValidGroupLink("   \t  ")).toBe(false);
    expect(hasValidGroupLink(null)).toBe(false);
    expect(hasValidGroupLink(undefined)).toBe(false);
    expect(hasValidGroupLink(12345)).toBe(false);
    expect(hasValidGroupLink({ link: "https://chat.whatsapp.com/AbC123" })).toBe(false);
  });

  it("retorna falso para links fora do padrão seguro (http, outro domínio, query, espaço, 201 chars, etc.)", () => {
    expect(hasValidGroupLink("http://chat.whatsapp.com/x")).toBe(false);
    expect(hasValidGroupLink("https://chat.whatsapp.com.evil.com/x")).toBe(false);
    expect(hasValidGroupLink("https://evil.com/chat.whatsapp.com/x")).toBe(false);
    expect(hasValidGroupLink("https://chat.whatsapp.com/x?a=1")).toBe(false);
    expect(hasValidGroupLink("https://chat.whatsapp.com/x y")).toBe(false);
    expect(hasValidGroupLink("https://chat.whatsapp.com/@x")).toBe(false);
    expect(hasValidGroupLink("javascript:alert(1)")).toBe(false);
    expect(hasValidGroupLink(`https://chat.whatsapp.com/${"a".repeat(175)}`)).toBe(false);
  });
});
