import { describe, it, expect } from "vitest";
import { suggestEmail } from "./email-hints";

describe("suggestEmail", () => {
  it("sugere gmail.com para erro de digitação comum", () => {
    expect(suggestEmail("maria@gmial.com")).toBe("maria@gmail.com");
  });

  it("sugere hotmail.com para erro de digitação comum", () => {
    expect(suggestEmail("joao@hotmial.com")).toBe("joao@hotmail.com");
  });

  it("sugere gmail.com para terminação .con", () => {
    expect(suggestEmail("ana@gmail.con")).toBe("ana@gmail.com");
  });

  it("sugere gmail.com para .com.br em domínio que só existe como .com", () => {
    expect(suggestEmail("carlos@gmail.com.br")).toBe("carlos@gmail.com");
  });

  it("retorna null para domínios que já estão corretos na lista", () => {
    expect(suggestEmail("x@gmail.com")).toBeNull();
    expect(suggestEmail("x@hotmail.com.br")).toBeNull();
    expect(suggestEmail("x@outlook.com.br")).toBeNull();
    expect(suggestEmail("x@yahoo.com.br")).toBeNull();
    expect(suggestEmail("x@uol.com.br")).toBeNull();
  });

  it("retorna null para domínios desconhecidos distantes da lista", () => {
    expect(suggestEmail("x@empresa.com.br")).toBeNull();
    expect(suggestEmail("x@meudominio.org")).toBeNull();
  });

  it("retorna null para entrada vazia ou sem @", () => {
    expect(suggestEmail("")).toBeNull();
    expect(suggestEmail("   ")).toBeNull();
    expect(suggestEmail("mariagmail.com")).toBeNull();
    expect(suggestEmail("@gmail.com")).toBeNull();
    expect(suggestEmail("maria@")).toBeNull();
  });

  it("trata maiúsculas e espaços nas pontas sem quebrar", () => {
    expect(suggestEmail("  MARIA@GMIAL.COM  ")).toBe("maria@gmail.com");
    expect(suggestEmail("  carlos@GMAIL.COM.BR ")).toBe("carlos@gmail.com");
    expect(suggestEmail("  X@GMAIL.COM  ")).toBeNull();
  });
});
