const KNOWN_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "globo.com",
  "ig.com.br",
] as const;

function damerauLevenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return 2;

  const d: number[][] = Array.from({ length: la + 1 }, () =>
    new Array<number>(lb + 1).fill(0)
  );

  for (let i = 0; i <= la; i++) {
    const row = d[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= lb; j++) {
    const row = d[0];
    if (row) row[j] = j;
  }

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const dRow = d[i]!;
      const dPrevRow = d[i - 1]!;

      dRow[j] = Math.min(
        dPrevRow[j]! + 1, // deletion
        dRow[j - 1]! + 1, // insertion
        dPrevRow[j - 1]! + cost, // substitution
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        const dPrevPrevRow = d[i - 2]!;
        dRow[j] = Math.min(dRow[j]!, dPrevPrevRow[j - 2]! + 1); // transposition
      }
    }
  }

  return d[la]?.[lb] ?? 2;
}

/**
 * Sugere correção de domínio para erros de digitação comuns de provedores conhecidos.
 * Retorna o e-mail sugerido ou null se não houver sugestão aplicável.
 */
export function suggestEmail(email: string): string | null {
  if (!email || typeof email !== "string") return null;

  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null;

  const user = trimmed.slice(0, atIndex).trim().toLowerCase();
  const domain = trimmed.slice(atIndex + 1).trim().toLowerCase();

  if (!user || !domain) return null;

  // Se o domínio já é exatamente um dos conhecidos, nunca sugere
  if ((KNOWN_DOMAINS as readonly string[]).includes(domain)) {
    return null;
  }

  // 1. Trocas de terminação (.con, .cm, .com.br colocado em domínio que só existe como .com)
  if (domain.endsWith(".com.br")) {
    const candidate = domain.slice(0, -3); // remove .br -> .com
    if ((KNOWN_DOMAINS as readonly string[]).includes(candidate)) {
      return `${user}@${candidate}`;
    }
  }

  if (domain.endsWith(".con")) {
    const candidate = domain.slice(0, -1) + "m"; // troca .con por .com
    if ((KNOWN_DOMAINS as readonly string[]).includes(candidate)) {
      return `${user}@${candidate}`;
    }
  }

  if (domain.endsWith(".cm")) {
    const candidate = domain.slice(0, -2) + "com"; // troca .cm por .com
    if ((KNOWN_DOMAINS as readonly string[]).includes(candidate)) {
      return `${user}@${candidate}`;
    }
  }

  // 2. Distância de edição de no máximo 1 (Damerau-Levenshtein)
  for (const known of KNOWN_DOMAINS) {
    if (damerauLevenshtein(domain, known) <= 1) {
      return `${user}@${known}`;
    }
  }

  return null;
}
