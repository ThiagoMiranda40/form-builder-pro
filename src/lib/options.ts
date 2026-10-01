/**
 * Normaliza um texto de opções (uma por linha) para um array de strings:
 * - Apara os espaços de cada linha
 * - Remove linhas vazias
 * - Remove duplicatas mantendo a primeira ocorrência
 * - Preserva a ordem original
 * - Retorna array vazio para texto vazio
 */
export function normalizeOptions(texto: string): string[] {
  if (!texto) return [];

  const lines = texto.split(/\r?\n/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }

  return result;
}
