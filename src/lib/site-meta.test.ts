import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SITE_URL,
  SITE_TITLE,
  SITE_DESCRIPTION,
  OG_IMAGE,
  buildFormMeta,
  CLIENT_LINK_TAB_TITLE,
  CLIENT_LINK_OG_TITLE,
  CLIENT_LINK_DESCRIPTION,
  buildClientLinkMeta,
} from "./site-meta";

describe("site-meta (T-18)", () => {
  it("exporta constantes com título e descrição da Corre Time", () => {
    expect(SITE_URL).toBe("https://inscricoes.corretime.com.br");
    expect(SITE_TITLE).toBe("Inscrições | Corre Time");
    expect(SITE_DESCRIPTION).toBe(
      "Faça sua inscrição online e corrija seus dados depois pelo link que enviamos ao seu e-mail."
    );
  });

  it("OG_IMAGE é URL absoluta https para og-image.png", () => {
    expect(OG_IMAGE.startsWith("https://")).toBe(true);
    expect(OG_IMAGE).toBe("https://inscricoes.corretime.com.br/og-image.png");
  });

  it("os três arquivos de marca existem em public/", () => {
    const publicDir = path.resolve(process.cwd(), "public");
    const faviconPath = path.join(publicDir, "favicon.ico");
    const appleIconPath = path.join(publicDir, "apple-touch-icon.png");
    const ogImagePath = path.join(publicDir, "og-image.png");

    expect(fs.existsSync(faviconPath)).toBe(true);
    expect(fs.existsSync(appleIconPath)).toBe(true);
    expect(fs.existsSync(ogImagePath)).toBe(true);
  });

  it("og-image.png tem exatamente 1200x630 nos bytes 16 a 24 do cabeçalho PNG", () => {
    const ogImagePath = path.resolve(process.cwd(), "public/og-image.png");
    const buffer = fs.readFileSync(ogImagePath);

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  it("favicon.ico começa com os bytes 00 00 01 00", () => {
    const faviconPath = path.resolve(process.cwd(), "public/favicon.ico");
    const buffer = fs.readFileSync(faviconPath);
    const header = Array.from(buffer.subarray(0, 4));

    expect(header).toEqual([0x00, 0x00, 0x01, 0x00]);
  });
});

describe("buildFormMeta (T-19)", () => {
  const DEFAULT_TITLE = "Formulário de inscrição";
  const DEFAULT_DESC = "Preencha seus dados para concluir a inscrição neste formulário.";
  const DEFAULT_OG_TITLE = "Formulário de inscrição";
  const DEFAULT_OG_DESC = "Preencha seus dados para concluir a inscrição.";

  it("devolve os textos genéricos quando o payload for nulo", () => {
    const res = buildFormMeta(null);
    expect(res).toEqual({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      ogTitle: DEFAULT_OG_TITLE,
      ogDescription: DEFAULT_OG_DESC,
    });
  });

  it("devolve os textos genéricos quando o payload for undefined", () => {
    const res = buildFormMeta(undefined);
    expect(res).toEqual({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      ogTitle: DEFAULT_OG_TITLE,
      ogDescription: DEFAULT_OG_DESC,
    });
  });

  it("devolve os textos genéricos quando state for 'draft', mesmo com título preenchido", () => {
    const res = buildFormMeta({
      state: "draft",
      form: { title: "Treino Exclusivo", description: "Descrição de rascunho" },
    });
    expect(res).toEqual({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      ogTitle: DEFAULT_OG_TITLE,
      ogDescription: DEFAULT_OG_DESC,
    });
  });

  it("devolve os textos genéricos quando state for 'not_found'", () => {
    const res = buildFormMeta({ state: "not_found" });
    expect(res).toEqual({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      ogTitle: DEFAULT_OG_TITLE,
      ogDescription: DEFAULT_OG_DESC,
    });
  });

  it("devolve os textos genéricos quando o título for vazio ou só contiver espaços", () => {
    const res = buildFormMeta({
      state: "open",
      form: { title: "   ", description: "Qualquer descrição" },
    });
    expect(res).toEqual({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      ogTitle: DEFAULT_OG_TITLE,
      ogDescription: DEFAULT_OG_DESC,
    });
  });

  it("open com título e descrição curtos ('SKF Running Team' e 'CORRIDA TRACK & FIELD - SHOPPING IGUATEMI')", () => {
    const res = buildFormMeta({
      state: "open",
      form: {
        title: "SKF Running Team",
        description: "CORRIDA TRACK & FIELD - SHOPPING IGUATEMI",
      },
    });
    expect(res).toEqual({
      title: "SKF Running Team | Corre Time",
      description: "CORRIDA TRACK & FIELD - SHOPPING IGUATEMI",
      ogTitle: "SKF Running Team",
      ogDescription: "CORRIDA TRACK & FIELD - SHOPPING IGUATEMI",
    });
  });

  it("descrição de 300 caracteres é cortada em até 161 caracteres com '…' ao final sem cortar palavra no meio", () => {
    // Frase longa com palavras legíveis somando ~300 caracteres
    const longDesc =
      "Venha participar deste super treino preparatório para a maratona com toda a equipe da Corre Time reunida para superar marcas pessoais e incentivar novos corredores a darem os primeiros passos na corrida de rua com segurança e entusiasmo total neste sábado pela manhã na pista principal do parque da cidade.";
    expect(longDesc.length).toBeGreaterThan(250);

    const res = buildFormMeta({
      state: "open",
      form: {
        title: "Treino Especial",
        description: longDesc,
      },
    });

    expect(res.description.length).toBeLessThanOrEqual(161);
    expect(res.description.endsWith("…")).toBe(true);
    expect(res.ogDescription).toBe(res.description);

    // Garante que não cortou palavra no meio: o texto antes de '…' deve terminar em palavra inteira
    const textBeforeEllipsis = res.description.slice(0, -1);
    expect(longDesc.startsWith(textBeforeEllipsis)).toBe(true);
    // O caractere seguinte no texto original deve ser espaço
    expect(longDesc[textBeforeEllipsis.length]).toBe(" ");
  });

  it("descrição com quebras de linha e espaços duplos é normalizada para espaços únicos", () => {
    const res = buildFormMeta({
      state: "open",
      form: {
        title: "Treino de Sábado",
        description: "Primeira linha.\n\nSegunda linha   com   vários    espaços.",
      },
    });
    expect(res.description).toBe("Primeira linha. Segunda linha com vários espaços.");
    expect(res.ogDescription).toBe("Primeira linha. Segunda linha com vários espaços.");
  });

  it("título de 100 caracteres é cortado em 70 caracteres com '…' ao final", () => {
    const longTitle = "Corrida e Caminhada Solidária de 10km pela Conscientização e Apoio aos Jovens e Adultos Atletas 2026";
    expect(longTitle.length).toBeGreaterThan(70);

    const res = buildFormMeta({
      state: "open",
      form: {
        title: longTitle,
        description: "Descrição simples.",
      },
    });

    const expectedOgTitle = longTitle.slice(0, 70) + "…";
    expect(res.ogTitle).toBe(expectedOgTitle);
    expect(res.ogTitle.length).toBe(71);
    expect(res.title).toBe(`${expectedOgTitle} | Corre Time`);
  });

  it("closed e full usam os dados do formulário normalmente", () => {
    const resClosed = buildFormMeta({
      state: "closed",
      form: {
        title: "Corrida Encerrada",
        description: "Prazo encerrado.",
      },
    });
    expect(resClosed.ogTitle).toBe("Corrida Encerrada");
    expect(resClosed.title).toBe("Corrida Encerrada | Corre Time");
    expect(resClosed.description).toBe("Prazo encerrado.");

    const resFull = buildFormMeta({
      state: "full",
      form: {
        title: "Corrida Lotada",
        description: "Vagas esgotadas.",
      },
    });
    expect(resFull.ogTitle).toBe("Corrida Lotada");
    expect(resFull.title).toBe("Corrida Lotada | Corre Time");
    expect(resFull.description).toBe("Vagas esgotadas.");
  });
});

describe("buildClientLinkMeta (T-40)", () => {
  it("exporta constantes para o link do cliente", () => {
    expect(CLIENT_LINK_TAB_TITLE).toBe("Inscrições recebidas | Corre Time");
    expect(CLIENT_LINK_OG_TITLE).toBe(
      "NÃO COMPARTILHE: lista de inscritos | Corre Time"
    );
    expect(CLIENT_LINK_DESCRIPTION).toBe(
      "Acesso restrito, só leitura, com dados pessoais. Não é o link de inscrição."
    );
  });

  it("buildClientLinkMeta devolve valores iguais aos literais definidos", () => {
    const meta = buildClientLinkMeta();
    expect(meta.title).toBe(CLIENT_LINK_TAB_TITLE);
    expect(meta.ogTitle).toBe("NÃO COMPARTILHE: lista de inscritos | Corre Time");
    expect(meta.description).toBe(
      "Acesso restrito, só leitura, com dados pessoais. Não é o link de inscrição."
    );
    expect(meta.ogDescription).toBe(meta.description);
  });

  it("devolve textos diferentes de SITE_TITLE e SITE_DESCRIPTION", () => {
    const meta = buildClientLinkMeta();
    expect(meta.title).not.toBe(SITE_TITLE);
    expect(meta.description).not.toBe(SITE_DESCRIPTION);
    expect(meta.ogTitle).not.toBe(SITE_TITLE);
    expect(meta.ogDescription).not.toBe(SITE_DESCRIPTION);
  });

  it("ogTitle com no máximo 70 caracteres e ogDescription com no máximo 160", () => {
    const meta = buildClientLinkMeta();
    expect(meta.ogTitle.length).toBeLessThanOrEqual(70);
    expect(meta.ogDescription.length).toBeLessThanOrEqual(160);
    expect(meta.description).toBe(meta.ogDescription);
  });

  it("nenhum dos textos contém 'SKF' nem '{' (genérico)", () => {
    const meta = buildClientLinkMeta();
    for (const val of [meta.title, meta.description, meta.ogTitle, meta.ogDescription]) {
      expect(val).not.toContain("SKF");
      expect(val).not.toContain("{");
    }
  });
});
