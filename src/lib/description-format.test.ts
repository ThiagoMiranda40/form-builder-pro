import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX_LENGTH,
  insertLink,
  toggleInlineMarker,
  toggleLinePrefix,
} from "./description-format";

describe("description-format (T-66)", () => {
  it("exporta a constante DESCRIPTION_MAX_LENGTH igual a 5000", () => {
    expect(DESCRIPTION_MAX_LENGTH).toBe(5000);
  });

  describe("toggleInlineMarker", () => {
    it("sem seleção, insere marker + 'texto' + marker com 'texto' selecionado", () => {
      const res = toggleInlineMarker("Olá ", 4, 4, "**");
      expect(res.text).toBe("Olá **texto**");
      expect(res.start).toBe(6);
      expect(res.end).toBe(11);
      expect(res.text.slice(res.start, res.end)).toBe("texto");
    });

    it("com seleção não cercada, envolve a seleção com o marcador", () => {
      const text = "Corrida da Estação";
      // Seleciona "Estação" (índices 11 a 18)
      const res = toggleInlineMarker(text, 11, 18, "**");
      expect(res.text).toBe("Corrida da **Estação**");
      expect(res.start).toBe(13);
      expect(res.end).toBe(20);
      expect(res.text.slice(res.start, res.end)).toBe("Estação");
    });

    it("com seleção já cercada por marcador externo, remove o marcador", () => {
      const text = "Corrida da **Estação**";
      // Seleciona "Estação" (índices 13 a 20) com ** em volta
      const res = toggleInlineMarker(text, 13, 20, "**");
      expect(res.text).toBe("Corrida da Estação");
      expect(res.start).toBe(11);
      expect(res.end).toBe(18);
    });

    it("com seleção que inclui os marcadores nas pontas, remove o marcador", () => {
      const text = "Corrida da **Estação**";
      // Seleciona "**Estação**" (índices 11 a 22)
      const res = toggleInlineMarker(text, 11, 22, "**");
      expect(res.text).toBe("Corrida da Estação");
      expect(res.start).toBe(11);
      expect(res.end).toBe(18);
    });

    it("funciona com itálico (*)", () => {
      const text = "Texto *italico* normal";
      const res = toggleInlineMarker(text, 7, 14, "*");
      expect(res.text).toBe("Texto italico normal");
    });
  });

  describe("toggleLinePrefix", () => {
    it("aplica prefixo '- ' em todas as linhas da seleção", () => {
      const text = "5k\n10k\n21k";
      const res = toggleLinePrefix(text, 0, text.length, "- ");
      expect(res.text).toBe("- 5k\n- 10k\n- 21k");
    });

    it("remove prefixo '- ' se todas as linhas já têm", () => {
      const text = "- 5k\n- 10k\n- 21k";
      const res = toggleLinePrefix(text, 0, text.length, "- ");
      expect(res.text).toBe("5k\n10k\n21k");
    });

    it("acrescenta prefixo nas linhas que faltam se algumas já tinham", () => {
      const text = "- 5k\n10k\n- 21k";
      const res = toggleLinePrefix(text, 0, text.length, "- ");
      expect(res.text).toBe("- 5k\n- 10k\n- 21k");
    });

    it("funciona com centralizar (:: )", () => {
      const text = "Inscreva-se!";
      const res = toggleLinePrefix(text, 0, text.length, ":: ");
      expect(res.text).toBe(":: Inscreva-se!");

      const remove = toggleLinePrefix(":: Inscreva-se!", 0, 15, ":: ");
      expect(remove.text).toBe("Inscreva-se!");
    });
  });

  describe("insertLink", () => {
    it("sem seleção, insere [texto do link](https://) com https:// selecionado", () => {
      const text = "Acesse ";
      const res = insertLink(text, 7, 7);
      expect(res.text).toBe("Acesse [texto do link](https://)");
      expect(res.start).toBe(23);
      expect(res.end).toBe(31);
      expect(res.text.slice(res.start, res.end)).toBe("https://");
    });

    it("com seleção, insere [seleção](https://) com https:// selecionado", () => {
      const text = "Acesse o site oficial aqui";
      // Seleciona "o site oficial" (índices 7 a 21)
      const res = insertLink(text, 7, 21);
      expect(res.text).toBe("Acesse [o site oficial](https://) aqui");
      expect(res.start).toBe(24);
      expect(res.end).toBe(32);
      expect(res.text.slice(res.start, res.end)).toBe("https://");
    });
  });
});
