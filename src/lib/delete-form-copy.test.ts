import { describe, it, expect } from "vitest";
import { deleteFormCopy } from "./delete-form-copy";

describe("deleteFormCopy (T-42)", () => {
  it("heading, confirmLabel e pendingLabel possuem valores literais corretos", () => {
    const copy = deleteFormCopy({ title: "Inscrição", responses: 0, status: "draft" });
    expect(copy.heading).toBe("Excluir este formulário?");
    expect(copy.confirmLabel).toBe("Excluir");
    expect(copy.pendingLabel).toBe("Excluindo...");
  });

  it("exibe o título entre aspas curvas “ e ”", () => {
    const copy = deleteFormCopy({ title: "Treino de Sábado", responses: 0, status: "draft" });
    expect(copy.description).toContain("“Treino de Sábado”");
  });

  it("corta título longo em 80 caracteres com '…' no fim", () => {
    const longTitle = "A".repeat(100);
    const copy = deleteFormCopy({ title: longTitle, responses: 0, status: "draft" });
    const expectedTruncated = "“" + "A".repeat(80) + "…”";
    expect(copy.description).toContain(expectedTruncated);
  });

  it("não adiciona '…' em títulos com até 80 caracteres", () => {
    const exactTitle = "B".repeat(80);
    const copy = deleteFormCopy({ title: exactTitle, responses: 0, status: "draft" });
    const expectedExact = "“" + "B".repeat(80) + "”";
    expect(copy.description).toContain(expectedExact);
    expect(copy.description).not.toContain("…”");
  });

  describe("textos de description", () => {
    it("com 0 respostas", () => {
      const copy = deleteFormCopy({ title: "Corrida 2026", responses: 0, status: "draft" });
      expect(copy.description).toBe(
        "O formulário “Corrida 2026” e as suas perguntas serão apagados. Esta ação não pode ser desfeita."
      );
    });

    it("com 1 resposta", () => {
      const copy = deleteFormCopy({ title: "Corrida 2026", responses: 1, status: "closed" });
      expect(copy.description).toBe(
        "O formulário “Corrida 2026”, as suas perguntas e a 1 resposta recebida serão apagados. Esta ação não pode ser desfeita. Se precisar dos dados, exporte as respostas antes."
      );
    });

    it("com 2 ou mais respostas (ex: 5 respostas)", () => {
      const copy = deleteFormCopy({ title: "Corrida 2026", responses: 5, status: "closed" });
      expect(copy.description).toBe(
        "O formulário “Corrida 2026”, as suas perguntas e as 5 respostas recebidas serão apagados. Esta ação não pode ser desfeita. Se precisar dos dados, exporte as respostas antes."
      );
    });

    it("com 42 respostas", () => {
      const copy = deleteFormCopy({ title: "Corrida 2026", responses: 42, status: "published" });
      expect(copy.description).toBe(
        "O formulário “Corrida 2026”, as suas perguntas e as 42 respostas recebidas serão apagados. Esta ação não pode ser desfeita. Se precisar dos dados, exporte as respostas antes."
      );
    });
  });

  describe("openWarning", () => {
    it("retorna aviso quando status for 'published'", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: 0, status: "published" });
      expect(copy.openWarning).toBe(
        "O formulário está aberto: o link de inscrição deixará de funcionar na hora."
      );
    });

    it("retorna null quando status for 'draft'", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: 0, status: "draft" });
      expect(copy.openWarning).toBeNull();
    });

    it("retorna null quando status for 'closed'", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: 0, status: "closed" });
      expect(copy.openWarning).toBeNull();
    });
  });

  describe("requireAck e ackLabel", () => {
    it("com 0 respostas: requireAck false e ackLabel null", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: 0, status: "draft" });
      expect(copy.requireAck).toBe(false);
      expect(copy.ackLabel).toBeNull();
    });

    it("com 1 resposta: requireAck true e ackLabel singular", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: 1, status: "draft" });
      expect(copy.requireAck).toBe(true);
      expect(copy.ackLabel).toBe("Entendo que a resposta recebida também será apagada");
    });

    it("com 2 ou mais respostas: requireAck true e ackLabel plural com {n}", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: 7, status: "draft" });
      expect(copy.requireAck).toBe(true);
      expect(copy.ackLabel).toBe("Entendo que as 7 respostas recebidas também serão apagadas");
    });
  });

  describe("tratamento de entradas inválidas", () => {
    it("responses negativo tratado como 0", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: -3, status: "draft" });
      expect(copy.requireAck).toBe(false);
      expect(copy.ackLabel).toBeNull();
      expect(copy.description).toBe(
        "O formulário “Corrida” e as suas perguntas serão apagados. Esta ação não pode ser desfeita."
      );
    });

    it("responses não inteiro tratado como 0", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: 2.5, status: "draft" });
      expect(copy.requireAck).toBe(false);
      expect(copy.ackLabel).toBeNull();
      expect(copy.description).toBe(
        "O formulário “Corrida” e as suas perguntas serão apagados. Esta ação não pode ser desfeita."
      );
    });

    it("responses NaN tratado como 0", () => {
      const copy = deleteFormCopy({ title: "Corrida", responses: NaN, status: "draft" });
      expect(copy.requireAck).toBe(false);
      expect(copy.ackLabel).toBeNull();
      expect(copy.description).toBe(
        "O formulário “Corrida” e as suas perguntas serão apagados. Esta ação não pode ser desfeita."
      );
    });
  });
});
