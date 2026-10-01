import { describe, it, expect } from "vitest";
import { termosDeUso, politicaDePrivacidade } from "../content/legal";

describe("legal-content (T-17)", () => {
  it("ambos os documentos contêm o CNPJ e o e-mail de contato", () => {
    const cnpj = "43.425.201/0001-43";
    const email = "contato@triadetecnologiaesolucoes.com.br";

    const termosText = termosDeUso.paragraphs.join(" ");
    const politicaText = politicaDePrivacidade.paragraphs.join(" ");

    expect(termosText).toContain(cnpj);
    expect(termosText).toContain(email);
    expect(politicaText).toContain(cnpj);
    expect(politicaText).toContain(email);
  });

  it("Termos de Uso contém Cajamar/SP e exatamente 10 itens", () => {
    const termosText = termosDeUso.paragraphs.join(" ");
    expect(termosText).toContain("Cajamar/SP");
    expect(termosDeUso.paragraphs).toHaveLength(10);
  });

  it("Política de Privacidade contém 30 dias e 15 dias e exatamente 11 itens", () => {
    const politicaText = politicaDePrivacidade.paragraphs.join(" ");
    expect(politicaText).toContain("30 dias");
    expect(politicaText).toContain("15 dias");
    expect(politicaDePrivacidade.paragraphs).toHaveLength(11);
  });

  it("nenhum dos documentos contém colchetes [ nem ]", () => {
    const termosText = termosDeUso.paragraphs.join(" ");
    const politicaText = politicaDePrivacidade.paragraphs.join(" ");

    expect(termosText).not.toContain("[");
    expect(termosText).not.toContain("]");
    expect(politicaText).not.toContain("[");
    expect(politicaText).not.toContain("]");
  });

  it("updatedAt é 01/10/2026 em ambos os documentos", () => {
    expect(termosDeUso.updatedAt).toBe("01/10/2026");
    expect(politicaDePrivacidade.updatedAt).toBe("01/10/2026");
  });
});
