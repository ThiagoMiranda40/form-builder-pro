export interface InlineNode {
  text: string;
  bold: boolean;
}

/**
 * Separa o texto por marcadores de negrito **...**.
 * Marcadores sem par permanecem como texto literal.
 * Nunca gera HTML (evita injeção XSS / sem dangerouslySetInnerHTML).
 */
export function parseInline(text: string): InlineNode[] {
  if (!text) return [];
  if (!text.includes("**")) {
    return [{ text, bold: false }];
  }

  const parts = text.split("**");
  const hasUnpaired = parts.length % 2 === 0;
  const pairedLimit = hasUnpaired ? parts.length - 1 : parts.length;

  const nodes: InlineNode[] = [];

  for (let i = 0; i < pairedLimit; i++) {
    const isBold = i % 2 === 1;
    const content = parts[i];
    if (content) {
      nodes.push({ text: content, bold: isBold });
    }
  }

  if (hasUnpaired) {
    const lastContent = "**" + (parts[parts.length - 1] ?? "");
    nodes.push({ text: lastContent, bold: false });
  }

  // Mescla nós adjacentes com o mesmo valor de negrito
  const merged: InlineNode[] = [];
  for (const node of nodes) {
    if (merged.length > 0 && merged[merged.length - 1]!.bold === node.bold) {
      merged[merged.length - 1]!.text += node.text;
    } else {
      merged.push({ ...node });
    }
  }

  return merged;
}
