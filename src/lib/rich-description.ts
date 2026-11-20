/**
 * rich-description.ts — Análise e sanitização da descrição formatada do formulário (T-66 / RF-29 / SEC-50).
 *
 * Suporta marcas simples:
 * - Negrito: **texto**
 * - Itálico: *texto*
 * - Centralizar parágrafo: linha iniciada por ":: "
 * - Lista com marcadores: linhas iniciadas por "- "
 * - Link: [texto](https://...) (apenas https:// estrito <= 500 caracteres, sem espaços)
 *
 * NUNCA utiliza dangerouslySetInnerHTML. Converte a descrição em árvore de objetos
 * (RichBlock / Inline) para renderização com nós React nativos e seguros.
 */

export interface Inline {
  text: string;
  bold: boolean;
  italic: boolean;
  href: string | null;
}

export interface ParagraphBlock {
  kind: "paragraph";
  align: "left" | "center";
  lines: Inline[][];
}

export interface ListBlock {
  kind: "list";
  items: Inline[][];
}

export type RichBlock = ParagraphBlock | ListBlock;

/**
 * Valida e sanitiza uma URL para uso em links de descrição.
 * Aceita exclusivamente protocolo https://, comprimento <= 500 caracteres,
 * sem espaços em branco, com hostname válido. Rejeita javascript:, data:, http:, etc.
 */
export function sanitizeHttpsUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (/\s/.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (!url.hostname || url.hostname.trim() === "") return null;
    return trimmed;
  } catch {
    return null;
  }
}

interface Candidate {
  type: "bold" | "italic" | "link";
  start: number;
  end: number;
  inner?: string;
  label?: string;
  href?: string;
}

function findCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];

  // 1. Bold: **texto**
  let boldSearchIdx = 0;
  while (boldSearchIdx < text.length) {
    const open = text.indexOf("**", boldSearchIdx);
    if (open === -1) break;
    const close = text.indexOf("**", open + 2);
    if (close !== -1 && close > open + 2) {
      candidates.push({
        type: "bold",
        start: open,
        end: close + 2,
        inner: text.slice(open + 2, close),
      });
      boldSearchIdx = close + 2;
    } else {
      break;
    }
  }

  // 2. Link: [label](https://...)
  let linkSearchIdx = 0;
  while (linkSearchIdx < text.length) {
    const open = text.indexOf("[", linkSearchIdx);
    if (open === -1) break;
    const mid = text.indexOf("](", open + 1);
    if (mid !== -1) {
      const close = text.indexOf(")", mid + 2);
      if (close !== -1) {
        const label = text.slice(open + 1, mid);
        const rawUrl = text.slice(mid + 2, close);
        const sanitized = sanitizeHttpsUrl(rawUrl);
        if (!label.includes("[") && !label.includes("]") && sanitized) {
          candidates.push({
            type: "link",
            start: open,
            end: close + 1,
            label,
            href: sanitized,
          });
          linkSearchIdx = close + 1;
          continue;
        }
      }
    }
    linkSearchIdx = open + 1;
  }

  // 3. Italic: *texto* (não ** e não precedido/sucedido por *)
  let italicSearchIdx = 0;
  while (italicSearchIdx < text.length) {
    const open = text.indexOf("*", italicSearchIdx);
    if (open === -1) break;

    // Deve ser * único
    const isSingleOpen =
      (open === 0 || text[open - 1] !== "*") &&
      (open + 1 >= text.length || text[open + 1] !== "*");

    if (!isSingleOpen) {
      italicSearchIdx = open + 1;
      continue;
    }

    // Procura fechamento com * único
    let closeSearch = open + 1;
    let foundClose = -1;
    while (closeSearch < text.length) {
      const close = text.indexOf("*", closeSearch);
      if (close === -1) break;
      const isSingleClose =
        text[close - 1] !== "*" &&
        (close + 1 >= text.length || text[close + 1] !== "*");
      if (isSingleClose && close > open + 1) {
        foundClose = close;
        break;
      }
      closeSearch = close + 1;
    }

    if (foundClose !== -1) {
      const inner = text.slice(open + 1, foundClose);
      if (!inner.includes("\n")) {
        candidates.push({
          type: "italic",
          start: open,
          end: foundClose + 1,
          inner,
        });
        italicSearchIdx = foundClose + 1;
        continue;
      }
    }
    italicSearchIdx = open + 1;
  }

  return candidates;
}

function parseSpans(
  text: string,
  bold: boolean,
  italic: boolean,
  href: string | null
): Inline[] {
  if (!text) return [];

  const candidates = findCandidates(text);
  if (candidates.length === 0) {
    return [{ text, bold, italic, href }];
  }

  // Ordena por início mais cedo; em caso de empate, tamanho maior primeiro
  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  const picked = candidates[0];
  if (!picked) {
    return [{ text, bold, italic, href }];
  }

  const result: Inline[] = [];

  if (picked.start > 0) {
    result.push(
      ...parseSpans(text.slice(0, picked.start), bold, italic, href)
    );
  }

  if (picked.type === "bold") {
    result.push(...parseSpans(picked.inner ?? "", true, italic, href));
  } else if (picked.type === "italic") {
    result.push(...parseSpans(picked.inner ?? "", bold, true, href));
  } else if (picked.type === "link") {
    result.push(
      ...parseSpans(picked.label ?? "", bold, italic, picked.href ?? null)
    );
  }

  if (picked.end < text.length) {
    result.push(
      ...parseSpans(text.slice(picked.end), bold, italic, href)
    );
  }

  return result;
}

function parseLineInlines(line: string): Inline[] {
  const raw = parseSpans(line, false, false, null);
  // Mescla spans adjacentes idênticos e remove nós vazios
  const merged: Inline[] = [];
  for (const span of raw) {
    if (!span.text) continue;
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.bold === span.bold &&
      prev.italic === span.italic &&
      prev.href === span.href
    ) {
      prev.text += span.text;
    } else {
      merged.push({ ...span });
    }
  }

  return merged.length > 0
    ? merged
    : [{ text: "", bold: false, italic: false, href: null }];
}

/**
 * Converte o texto da descrição com formatação leve em árvore de blocos (parágrafos e listas).
 */
export function parseRichDescription(text: string | null | undefined): RichBlock[] {
  if (!text || !text.trim()) return [];

  const rawLines = text.split("\n");
  const blocks: RichBlock[] = [];

  let currentParagraphLines: string[] = [];
  let currentListItems: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length === 0) return;
    const isCenter = currentParagraphLines.some((l) => l.startsWith(":: "));
    const linesInlines: Inline[][] = currentParagraphLines.map((l) => {
      const cleanLine = l.startsWith(":: ") ? l.slice(3) : l;
      return parseLineInlines(cleanLine);
    });
    blocks.push({
      kind: "paragraph",
      align: isCenter ? "center" : "left",
      lines: linesInlines,
    });
    currentParagraphLines = [];
  };

  const flushList = () => {
    if (currentListItems.length === 0) return;
    const itemsInlines: Inline[][] = currentListItems.map((item) =>
      parseLineInlines(item)
    );
    blocks.push({
      kind: "list",
      items: itemsInlines,
    });
    currentListItems = [];
  };

  for (const line of rawLines) {
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      currentListItems.push(line.slice(2));
    } else {
      flushList();
      currentParagraphLines.push(line);
    }
  }

  flushParagraph();
  flushList();

  return blocks;
}

/**
 * Converte a descrição formatada em texto puro legível (para uso na prévia social og:description,
 * exportações e metadados). Remove marcas de negrito, itálico, centralização e converte itens de lista
 * em marcadores de ponto (•).
 */
export function descriptionToPlainText(text: string | null | undefined): string {
  if (!text) return "";

  const lines = text.split("\n");
  const processed = lines.map((line) => {
    let l = line;
    // Remove prefixo de centralização :: ou :: soltos
    l = l.replace(/(?:^|\s)::\s*/g, " ").trim();
    if (l.startsWith("- ")) {
      l = "• " + l.slice(2);
    }
    // Converte links [texto](https://...) em texto
    l = l.replace(/\[([^\]]+)\]\((?:https?:\/\/[^\s)]+|[^)]+)\)/g, "$1");
    // Remove marcas de negrito **texto** -> texto
    l = l.replace(/\*\*([^*]+)\*\*/g, "$1");
    // Remove marcas de itálico *texto* -> texto (preservando outros caracteres)
    l = l.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, "$1$2$3");
    // Se sobrar algum ** duplicado
    l = l.replace(/\*\*/g, "");
    return l;
  });

  return processed.join("\n");
}
