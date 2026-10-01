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

/**
 * Domínios reais legítimos que NUNCA devem receber sugestão (T-17 item 7).
 */
const EXCLUDED_REAL_DOMAINS = [
  "mail.com",
  "ymail.com",
  "rocketmail.com",
  "gmx.com",
  "gmx.net",
  "googlemail.com",
  "me.com",
  "mac.com",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "yandex.com",
  "fastmail.com",
  "hey.com",
  "tutanota.com",
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

  // Se o domínio é um domínio real legítimo excluído, nunca sugere (T-17 item 7)
  if ((EXCLUDED_REAL_DOMAINS as readonly string[]).includes(domain)) {
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

/**
 * Verifica se a confirmação de e-mail deve ser sincronizada ao aplicar sugestão (T-17 item 6).
 * Se o campo de confirmação continha o mesmo valor (aparado, sem diferenciar maiúsculas) que o principal, retorna true.
 */
export function shouldSyncConfirmation(mainBefore: string, confirmBefore: string): boolean {
  const m = (mainBefore || "").trim().toLowerCase();
  const c = (confirmBefore || "").trim().toLowerCase();
  return Boolean(m && c && m === c);
}

/**
 * Valida se os campos de e-mail e confirmação conferem (T-17 item 6).
 * Se a confirmação estiver preenchida e o campo principal vazio, ou se divergirem, bloqueia o envio.
 */
export function checkEmailConfirmation(mainEmail: string, confirmEmail: string): string | null {
  const m = (mainEmail || "").trim().toLowerCase();
  const c = (confirmEmail || "").trim().toLowerCase();

  if (m !== c) {
    if (m || c) {
      return "Os e-mails não são iguais.";
    }
  }

  return null;
}

