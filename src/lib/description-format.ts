/**
 * description-format.ts — Utilitários de manipulação de texto para a barra de ferramentas
 * do editor de formulários (T-66 / RF-29).
 *
 * Exporta a constante de limite (5.000 caracteres) e funções puras para aplicar
 * ou alternar negrito, itálico, listas, centralização e links na seleção.
 */

export const DESCRIPTION_MAX_LENGTH = 5000;

export interface TextFormatResult {
  text: string;
  start: number;
  end: number;
}

/**
 * Aplica ou remove marcadores inline (negrito ** ou itálico *).
 *
 * - Sem seleção: insere marker + "texto" + marker com "texto" selecionado.
 * - Com seleção não cercada: envolve a seleção com o marcador.
 * - Com seleção já cercada externamente ou incluindo os marcadores: desfaz o marcador.
 */
export function toggleInlineMarker(
  text: string,
  start: number,
  end: number,
  marker: "**" | "*"
): TextFormatResult {
  const markerLen = marker.length;

  // Caso 1: sem seleção
  if (start === end) {
    const placeholder = "texto";
    const inserted = `${marker}${placeholder}${marker}`;
    const newText = text.slice(0, start) + inserted + text.slice(start);
    return {
      text: newText,
      start: start + markerLen,
      end: start + markerLen + placeholder.length,
    };
  }

  // Caso 2: seleção inclui os marcadores nas pontas (ex: "**texto**")
  if (
    end - start >= markerLen * 2 &&
    text.slice(start, start + markerLen) === marker &&
    text.slice(end - markerLen, end) === marker
  ) {
    const inner = text.slice(start + markerLen, end - markerLen);
    const newText = text.slice(0, start) + inner + text.slice(end);
    return {
      text: newText,
      start,
      end: start + inner.length,
    };
  }

  // Caso 3: seleção está cercada pelos marcadores do lado de fora (ex: "**" + "texto" + "**")
  if (
    start >= markerLen &&
    text.slice(start - markerLen, start) === marker &&
    text.slice(end, end + markerLen) === marker
  ) {
    const selected = text.slice(start, end);
    const newText =
      text.slice(0, start - markerLen) + selected + text.slice(end + markerLen);
    return {
      text: newText,
      start: start - markerLen,
      end: start - markerLen + selected.length,
    };
  }

  // Caso 4: seleção não cercada -> aplica marcador
  const selected = text.slice(start, end);
  const newText =
    text.slice(0, start) + marker + selected + marker + text.slice(end);
  return {
    text: newText,
    start: start + markerLen,
    end: start + markerLen + selected.length,
  };
}

/**
 * Aplica ou remove prefixo de linha ("- " para lista ou ":: " para centralizar).
 *
 * - Se todas as linhas da seleção já têm o prefixo, remove de todas.
 * - Se nenhuma ou apenas algumas têm, adiciona nas que faltam.
 */
export function toggleLinePrefix(
  text: string,
  start: number,
  end: number,
  prefix: "- " | ":: "
): TextFormatResult {
  // Localiza o início da primeira linha e o fim da última linha da seleção
  const firstLineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;

  let lastLineEnd: number;
  if (end === 0) {
    lastLineEnd = text.indexOf("\n", 0);
    if (lastLineEnd === -1) lastLineEnd = text.length;
  } else {
    // Se o cursor estiver exatamente no início de uma nova linha e end > start, não pega a linha seguinte
    const searchFrom = end > start && text[end - 1] === "\n" ? end - 1 : end;
    const nextNewline = text.indexOf("\n", searchFrom);
    lastLineEnd = nextNewline === -1 ? text.length : nextNewline;
  }

  const before = text.slice(0, firstLineStart);
  const targetRegion = text.slice(firstLineStart, lastLineEnd);
  const after = text.slice(lastLineEnd);

  const lines = targetRegion.split("\n");
  const allPrefixed = lines.length > 0 && lines.every((line) => line.startsWith(prefix));

  let modifiedLines: string[];
  if (allPrefixed) {
    // Remove o prefixo
    modifiedLines = lines.map((line) =>
      line.startsWith(prefix) ? line.slice(prefix.length) : line
    );
  } else {
    // Adiciona o prefixo nas linhas que não têm
    modifiedLines = lines.map((line) =>
      line.startsWith(prefix) ? line : `${prefix}${line}`
    );
  }

  const modifiedRegion = modifiedLines.join("\n");
  const newText = before + modifiedRegion + after;

  return {
    text: newText,
    start: firstLineStart,
    end: firstLineStart + modifiedRegion.length,
  };
}

/**
 * Insere a sintaxe de link markdown [label](https://).
 * Posiciona o cursor/seleção sobre "https://" para que o usuário possa digitar ou colar a URL.
 */
export function insertLink(
  text: string,
  start: number,
  end: number
): TextFormatResult {
  const urlPlaceholder = "https://";

  if (start === end) {
    const label = "texto do link";
    const snippet = `[${label}](${urlPlaceholder})`;
    const newText = text.slice(0, start) + snippet + text.slice(start);
    const urlStart = start + 1 + label.length + 2; // após "[label]("
    return {
      text: newText,
      start: urlStart,
      end: urlStart + urlPlaceholder.length,
    };
  }

  const selected = text.slice(start, end);
  const snippet = `[${selected}](${urlPlaceholder})`;
  const newText = text.slice(0, start) + snippet + text.slice(end);
  const urlStart = start + 1 + selected.length + 2;
  return {
    text: newText,
    start: urlStart,
    end: urlStart + urlPlaceholder.length,
  };
}
