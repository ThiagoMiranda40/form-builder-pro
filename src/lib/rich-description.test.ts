import { describe, expect, it } from "vitest";
import {
  descriptionToPlainText,
  parseRichDescription,
  sanitizeHttpsUrl,
} from "./rich-description";

describe("parseRichDescription (T-66 / RF-29 / SEC-50)", () => {
  it("devolve array vazio para null, undefined ou texto vazio", () => {
    expect(parseRichDescription(null)).toEqual([]);
    expect(parseRichDescription(undefined)).toEqual([]);
    expect(parseRichDescription("")).toEqual([]);
    expect(parseRichDescription("   \n\n  ")).toEqual([]);
  });

  it("interpreta negrito simples", () => {
    const blocks = parseRichDescription("**texto em negrito**");
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        align: "left",
        lines: [
          [
            {
              text: "texto em negrito",
              bold: true,
              italic: false,
              href: null,
            },
          ],
        ],
      },
    ]);
  });

  it("interpreta itálico simples", () => {
    const blocks = parseRichDescription("*texto em itálico*");
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        align: "left",
        lines: [
          [
            {
              text: "texto em itálico",
              bold: false,
              italic: true,
              href: null,
            },
          ],
        ],
      },
    ]);
  });

  it("interpreta negrito contendo itálico dentro", () => {
    const blocks = parseRichDescription("**a *b* c**");
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        align: "left",
        lines: [
          [
            { text: "a ", bold: true, italic: false, href: null },
            { text: "b", bold: true, italic: true, href: null },
            { text: " c", bold: true, italic: false, href: null },
          ],
        ],
      },
    ]);
  });

  it("mantém marca sem par literal", () => {
    const blocks = parseRichDescription("**sem fechar");
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        align: "left",
        lines: [
          [
            {
              text: "**sem fechar",
              bold: false,
              italic: false,
              href: null,
            },
          ],
        ],
      },
    ]);

    const blocksItalic = parseRichDescription("*");
    expect(blocksItalic).toEqual([
      {
        kind: "paragraph",
        align: "left",
        lines: [
          [
            {
              text: "*",
              bold: false,
              italic: false,
              href: null,
            },
          ],
        ],
      },
    ]);

    const blocksCalc = parseRichDescription("5*3");
    expect(blocksCalc).toEqual([
      {
        kind: "paragraph",
        align: "left",
        lines: [
          [
            {
              text: "5*3",
              bold: false,
              italic: false,
              href: null,
            },
          ],
        ],
      },
    ]);
  });

  it("linha iniciada por - forma lista com marcadores (linhas consecutivas em um só bloco)", () => {
    const text = "- 5k, 10k e 21k\n- Medalha para todos\n- Camiseta inclusa";
    const blocks = parseRichDescription(text);
    expect(blocks).toEqual([
      {
        kind: "list",
        items: [
          [{ text: "5k, 10k e 21k", bold: false, italic: false, href: null }],
          [{ text: "Medalha para todos", bold: false, italic: false, href: null }],
          [{ text: "Camiseta inclusa", bold: false, italic: false, href: null }],
        ],
      },
    ]);
  });

  it("linha iniciada por :: centraliza o parágrafo", () => {
    const text = ":: *Inscreva-se já!*";
    const blocks = parseRichDescription(text);
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        align: "center",
        lines: [
          [
            {
              text: "Inscreva-se já!",
              bold: false,
              italic: true,
              href: null,
            },
          ],
        ],
      },
    ]);
  });

  it("link https válido vira href no inline", () => {
    const text = "Acesse [o site oficial](https://corretime.com.br) para mais detalhes.";
    const blocks = parseRichDescription(text);
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        align: "left",
        lines: [
          [
            { text: "Acesse ", bold: false, italic: false, href: null },
            {
              text: "o site oficial",
              bold: false,
              italic: false,
              href: "https://corretime.com.br",
            },
            { text: " para mais detalhes.", bold: false, italic: false, href: null },
          ],
        ],
      },
    ]);
  });

  it("links http, javascript, data, //, vazios ou com espaços NÃO viram link e aparecem como texto", () => {
    const text =
      "[link http](http://inseguro.com) [xss](javascript:alert(1)) [data](data:text/html,abc) [proto](//x.com) [vazio]() [espaco](https://exemplo .com)";
    const blocks = parseRichDescription(text);
    expect(blocks[0]?.kind).toBe("paragraph");
    const inlines = (blocks[0] as any).lines[0];
    for (const inline of inlines) {
      expect(inline.href).toBeNull();
    }
  });

  it("<script> e <b> viram texto literal (sem interpretação de HTML)", () => {
    const text = "<script>alert(1)</script> e <b>negrito html</b>";
    const blocks = parseRichDescription(text);
    expect(blocks[0]?.kind).toBe("paragraph");
    const inlines = (blocks[0] as any).lines[0];
    expect(inlines.map((i: any) => i.text).join("")).toBe(
      "<script>alert(1)</script> e <b>negrito html</b>",
    );
  });

  it("texto puro antigo sai igual com parágrafo e 2 linhas preservadas", () => {
    const textoSKF = "Data: 11/10/2026\nDistâncias: 5k, 10k e 21k";
    const blocks = parseRichDescription(textoSKF);
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        align: "left",
        lines: [
          [{ text: "Data: 11/10/2026", bold: false, italic: false, href: null }],
          [{ text: "Distâncias: 5k, 10k e 21k", bold: false, italic: false, href: null }],
        ],
      },
    ]);
  });

  it("processa 5.000 caracteres de * e de [ repetidos em menos de 100 ms (linear sem retrocesso)", () => {
    const starInput = "*".repeat(5000);
    const bracketInput = "[".repeat(5000);

    const startStar = performance.now();
    parseRichDescription(starInput);
    const starDuration = performance.now() - startStar;

    const startBracket = performance.now();
    parseRichDescription(bracketInput);
    const bracketDuration = performance.now() - startBracket;

    expect(starDuration).toBeLessThan(100);
    expect(bracketDuration).toBeLessThan(100);
  });
});

describe("sanitizeHttpsUrl", () => {
  it("aceita apenas URLs https válidas até 500 caracteres sem espaços", () => {
    expect(sanitizeHttpsUrl("https://exemplo.com")).toBe("https://exemplo.com");
    expect(sanitizeHttpsUrl("http://exemplo.com")).toBeNull();
    expect(sanitizeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpsUrl("data:text/html,abc")).toBeNull();
    expect(sanitizeHttpsUrl("https://exemplo .com")).toBeNull();
    expect(sanitizeHttpsUrl("")).toBeNull();
    expect(sanitizeHttpsUrl("https://" + "a".repeat(501))).toBeNull();
  });
});

describe("descriptionToPlainText", () => {
  it("remove marcas de negrito, itálico, centralização e converte lista para bullet", () => {
    const rich = "**Data:** 11/10\n:: *Inscreva-se já!*\n- 5k e 10k\n[Site](https://x.com)";
    const plain = descriptionToPlainText(rich);
    expect(plain).toBe("Data: 11/10\nInscreva-se já!\n• 5k e 10k\nSite");
  });

  it("trata descrição da SKF sem marcas", () => {
    const textoSKF = "Data: 11/10/2026\nDistâncias: 5k, 10k e 21k";
    expect(descriptionToPlainText(textoSKF)).toBe(textoSKF);
  });
});
