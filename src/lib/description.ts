/**
 * Normaliza a descrição de um formulário para exibição e armazenamento:
 * - Troca CRLF e CR por LF
 * - Remove espaços e tabs no fim de cada linha
 * - Reduz 3 ou mais quebras de linha seguidas a 2
 * - Remove espaços e quebras do começo e do fim
 * - Devolve string vazia para nulo, indefinido ou texto contendo apenas espaços/quebras
 */
export function normalizeDescription(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  const withLf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const linesTrimmed = withLf
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");

  const collapsedNewlines = linesTrimmed.replace(/\n{3,}/g, "\n\n");

  return collapsedNewlines.trim();
}
