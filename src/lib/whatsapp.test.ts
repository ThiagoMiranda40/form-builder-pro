import { describe, it, expect } from "vitest";
import {
  parseBrazilMobile,
  whatsappUrl,
  firstNameOf,
  whatsappGreeting,
} from "./whatsapp";

describe("whatsapp - parseBrazilMobile", () => {
  it("reconhece celulares brasileiros válidos com diferentes formatações e prefixos", () => {
    const expected = { ddd: "11", number: "997537235" };

    expect(parseBrazilMobile("(11) 99753-7235")).toEqual(expected);
    expect(parseBrazilMobile("11997537235")).toEqual(expected);
    expect(parseBrazilMobile("+55 11 99753-7235")).toEqual(expected);
    expect(parseBrazilMobile("5511997537235")).toEqual(expected);
    expect(parseBrazilMobile("011 99753-7235")).toEqual(expected);
  });

  it("reconhece celulares válidos em outros DDDs brasileiros permitidos", () => {
    expect(parseBrazilMobile("(21) 98765-4321")).toEqual({ ddd: "21", number: "987654321" });
    expect(parseBrazilMobile("+55 31 98888-7777")).toEqual({ ddd: "31", number: "988887777" });
    expect(parseBrazilMobile("41991234567")).toEqual({ ddd: "41", number: "991234567" });
    expect(parseBrazilMobile("71 99999-8888")).toEqual({ ddd: "71", number: "999998888" });
    expect(parseBrazilMobile("99 98111-2222")).toEqual({ ddd: "99", number: "981112222" });
  });

  it("rejeita telefones fixos (10 dígitos)", () => {
    expect(parseBrazilMobile("(11) 3333-4444")).toBeNull();
    expect(parseBrazilMobile("1133334444")).toBeNull();
    expect(parseBrazilMobile("+55 11 3333-4444")).toBeNull();
    expect(parseBrazilMobile("551133334444")).toBeNull();
  });

  it("rejeita números de 10 dígitos mesmo começando por 6 a 9", () => {
    expect(parseBrazilMobile("1198765432")).toBeNull();
    expect(parseBrazilMobile("1187654321")).toBeNull();
    expect(parseBrazilMobile("1176543210")).toBeNull();
    expect(parseBrazilMobile("1165432109")).toBeNull();
  });

  it("rejeita DDDs inválidos ou não atribuídos no Brasil", () => {
    expect(parseBrazilMobile("(00) 99999-9999")).toBeNull();
    expect(parseBrazilMobile("(10) 99999-9999")).toBeNull();
    expect(parseBrazilMobile("(20) 99999-9999")).toBeNull();
    expect(parseBrazilMobile("(23) 99999-9999")).toBeNull();
    expect(parseBrazilMobile("(25) 99999-9999")).toBeNull();
    expect(parseBrazilMobile("(30) 99999-9999")).toBeNull();
    expect(parseBrazilMobile("(50) 99999-9999")).toBeNull();
  });

  it("rejeita nono dígito diferente de 9", () => {
    expect(parseBrazilMobile("(11) 89999-9999")).toBeNull();
    expect(parseBrazilMobile("11799999999")).toBeNull();
    expect(parseBrazilMobile("+55 11 69999-9999")).toBeNull();
  });

  it("rejeita entradas curtas, longas, vazias ou só de letras", () => {
    expect(parseBrazilMobile("")).toBeNull();
    expect(parseBrazilMobile("   ")).toBeNull();
    expect(parseBrazilMobile("123")).toBeNull();
    expect(parseBrazilMobile("119975372355555")).toBeNull();
    expect(parseBrazilMobile("apenas letras")).toBeNull();
  });

  it("rejeita entradas não-string (undefined, null, número e objeto)", () => {
    expect(parseBrazilMobile(undefined)).toBeNull();
    expect(parseBrazilMobile(null)).toBeNull();
    expect(parseBrazilMobile(11997537235)).toBeNull();
    expect(parseBrazilMobile({ phone: "11997537235" })).toBeNull();
  });
});

describe("whatsapp - whatsappUrl", () => {
  it("gera url correta sem mensagem", () => {
    expect(whatsappUrl("(11) 99753-7235")).toBe("https://wa.me/5511997537235");
  });

  it("gera url com mensagem contendo acentos, aspas curvas, &, # e quebra de linha", () => {
    const message = "Olá! Sobre a inscrição em “Treino & Corrida #1”:\nConfirmamos?";
    const url = whatsappUrl("11997537235", message);
    expect(url).toBe(`https://wa.me/5511997537235?text=${encodeURIComponent(message)}`);
    expect(url).toContain(encodeURIComponent("“Treino & Corrida #1”"));
    expect(url).toContain(encodeURIComponent("\n"));
  });

  it("omite parâmetro ?text quando mensagem é vazia ou só espaços", () => {
    expect(whatsappUrl("11997537235", "")).toBe("https://wa.me/5511997537235");
    expect(whatsappUrl("11997537235", "   ")).toBe("https://wa.me/5511997537235");
    expect(whatsappUrl("11997537235", undefined)).toBe("https://wa.me/5511997537235");
  });

  it("retorna nulo para número inválido ou fixo", () => {
    expect(whatsappUrl("(11) 3333-4444", "Olá")).toBeNull();
    expect(whatsappUrl("1133334444")).toBeNull();
    expect(whatsappUrl("invalido")).toBeNull();
    expect(whatsappUrl(null)).toBeNull();
  });
});

describe("whatsapp - firstNameOf", () => {
  it("extrai e formata o primeiro nome conforme regras de maiúsculas/minúsculas", () => {
    expect(firstNameOf("WILSON DE SOUZA SOARES")).toBe("Wilson");
    expect(firstNameOf("wilson")).toBe("Wilson");
    expect(firstNameOf("João Paulo")).toBe("João");
    expect(firstNameOf("  Maria  ")).toBe("Maria");
    expect(firstNameOf("Ana-Clara Silva")).toBe("Ana-Clara");
    expect(firstNameOf("McDonald")).toBe("McDonald");
  });

  it("retorna string vazia para entradas não textuais ou vazias", () => {
    expect(firstNameOf("")).toBe("");
    expect(firstNameOf("   ")).toBe("");
    expect(firstNameOf(undefined)).toBe("");
    expect(firstNameOf(null)).toBe("");
    expect(firstNameOf(123)).toBe("");
    expect(firstNameOf({})).toBe("");
  });
});

describe("whatsapp - whatsappGreeting", () => {
  it("gera saudação com nome e título exatos", () => {
    const greeting = whatsappGreeting("Wilson", "Treino Oficial de Corrida");
    expect(greeting).toBe("Olá, Wilson! Estou entrando em contato sobre a sua inscrição em “Treino Oficial de Corrida”.");
  });

  it("gera saudação sem nome (vazio)", () => {
    const greeting = whatsappGreeting("", "Treino Oficial de Corrida");
    expect(greeting).toBe("Olá! Estou entrando em contato sobre a sua inscrição em “Treino Oficial de Corrida”.");
  });

  it("corta título longo em 80 caracteres com reticências no fim preservando aspas curvas", () => {
    const longTitle = "Formulário de Inscrição Especial Para Atletas de Alta Performance e Participantes Convidados da Edição 2026";
    expect(longTitle.length).toBeGreaterThan(80);

    const greeting = whatsappGreeting("Maria", longTitle);
    const expectedTitle = longTitle.slice(0, 80) + "…";
    expect(greeting).toBe(`Olá, Maria! Estou entrando em contato sobre a sua inscrição em “${expectedTitle}”.`);
    expect(greeting).toContain(`“${expectedTitle}”`);
  });
});
