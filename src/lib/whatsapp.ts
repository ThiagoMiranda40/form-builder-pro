export const VALID_BRAZIL_DDDS = new Set([
  // SP
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  // RJ / ES
  "21", "22", "24", "27", "28",
  // MG
  "31", "32", "33", "34", "35", "37", "38",
  // PR / SC
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  // RS
  "51", "53", "54", "55",
  // DF / GO / TO / MT / MS
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  // BA / SE
  "71", "73", "74", "75", "77", "79",
  // PE / AL / PB / RN
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  // CE / PI / MA / PA / AP / AM / RR / AC / RO
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

/**
 * Faz o parse e a validação de um número de celular brasileiro.
 * Exige 11 dígitos, DDD nacional válido e nono dígito igual a 9.
 * Trata prefixos 55 e 0. Rejeita telefones fixos (10 dígitos).
 */
export function parseBrazilMobile(raw: unknown): { ddd: string; number: string } | null {
  if (typeof raw !== "string") return null;

  let digits = raw.replace(/\D/g, "");

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length === 12 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length !== 11) return null;

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);

  if (!VALID_BRAZIL_DDDS.has(ddd)) return null;
  if (number[0] !== "9") return null;

  return { ddd, number };
}

/**
 * Monta o link wa.me para abertura de conversa no WhatsApp.
 * Retorna nulo se o número não for um celular brasileiro válido.
 */
export function whatsappUrl(raw: unknown, message?: string): string | null {
  const parsed = parseBrazilMobile(raw);
  if (!parsed) return null;

  const base = `https://wa.me/55${parsed.ddd}${parsed.number}`;
  const trimmed = typeof message === "string" ? message.trim() : "";
  if (!trimmed) return base;

  return `${base}?text=${encodeURIComponent(trimmed)}`;
}

/**
 * Extrai o primeiro nome de um nome completo e aplica capitalização
 * adequada caso o nome esteja todo em maiúsculas ou minúsculas.
 */
export function firstNameOf(fullName: unknown): string {
  if (typeof fullName !== "string") return "";
  const trimmed = fullName.trim();
  if (!trimmed) return "";

  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord) return "";

  if (firstWord === firstWord.toUpperCase() || firstWord === firstWord.toLowerCase()) {
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }

  return firstWord;
}

/**
 * Gera o texto de saudação inicial para o WhatsApp.
 * O título é cortado em 80 caracteres com "…" no fim se for maior.
 */
export function whatsappGreeting(firstName: string, formTitle: string): string {
  const title = typeof formTitle === "string" ? formTitle : "";
  const truncated = title.length > 80 ? title.slice(0, 80) + "…" : title;
  const name = typeof firstName === "string" ? firstName.trim() : "";

  if (name) {
    return `Olá, ${name}! Estou entrando em contato sobre a sua inscrição em “${truncated}”.`;
  }

  return `Olá! Estou entrando em contato sobre a sua inscrição em “${truncated}”.`;
}
