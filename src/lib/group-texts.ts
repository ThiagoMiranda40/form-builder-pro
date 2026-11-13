import { hasValidGroupLink } from "./group-link";

export const DEFAULT_GROUP_INVITE_TEXT =
  "Entre no grupo para receber as informações da corrida. Entrar é opcional.";

export const GROUP_PRIVACY_NOTICE =
  "Quem entra no grupo vê o número de WhatsApp dos outros participantes.";

export const MAX_GROUP_TEXT_LENGTH = 200;

export const GROUP_TEXT_ERRORS = {
  too_long: "Use no máximo 200 caracteres.",
  has_url: "Não coloque endereços (links) neste texto.",
  invalid: "Texto inválido.",
} as const;

export type GroupTextSanitizeResult =
  | { ok: true; text: string | null }
  | { ok: false; reason: "too_long" | "has_url" | "invalid" };

const URL_PATTERN = /(https?:\/\/|www\.)/i;

// Caracteres de controle proibidos (exceto whitespace básico \t, \n, \r),
// separadores de linha unicode (U+2028, U+2029),
// marcas bidirecionais (U+200E, U+200F, U+202A..U+202E, U+2066..U+2069),
// e caracteres de largura zero e BOM (U+200B, U+FEFF).
// Nota: U+200C (ZWNJ) e U+200D (ZWJ) são preservados para emojis compostos (ex.: 🏃‍♂️).
const FORBIDDEN_CHARS_REGEX =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029\u200E\u200F\u202A-\u202E\u2066-\u2069\u200B\uFEFF]/g;

/**
 * Sanitiza e valida texto livre do grupo do WhatsApp (frase de aviso ou convite).
 * Substitui sequências de espaços/quebras/tabs por um espaço, remove controles/bidi/zero-width,
 * rejeita URLs (http://, https://, www.) e limita a 200 caracteres.
 */
export function sanitizeGroupText(input: unknown): GroupTextSanitizeResult {
  if (typeof input !== "string") {
    return { ok: false, reason: "invalid" };
  }

  // 1. Substitui qualquer sequência de espaços em branco (inclusive quebras de linha e tabs) por um único espaço
  const collapsedSpaces = input.replace(/\s+/g, " ");

  // 2. Remove caracteres proibidos
  const withoutForbidden = collapsedSpaces.replace(FORBIDDEN_CHARS_REGEX, "");

  // 3. Trim final
  const trimmed = withoutForbidden.trim();

  // Vazio -> { ok: true, text: null }
  if (trimmed === "") {
    return { ok: true, text: null };
  }

  // Mais de 200 caracteres -> too_long
  if (trimmed.length > MAX_GROUP_TEXT_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  // Contém URL (http://, https://, www.) -> has_url
  if (URL_PATTERN.test(trimmed)) {
    return { ok: false, reason: "has_url" };
  }

  return { ok: true, text: trimmed };
}

/**
 * Resolve a frase de aviso no formulário público.
 * Só devolve o texto se houver link de grupo válido E o aviso for válido e não-nulo.
 * Caso contrário devolve null (vazio não mostra nada).
 */
export function resolveGroupNotice(link: unknown, notice: unknown): string | null {
  if (!hasValidGroupLink(link)) {
    return null;
  }
  const result = sanitizeGroupText(notice);
  if (!result.ok || !result.text) {
    return null;
  }
  return result.text;
}

/**
 * Resolve o texto de convite para confirmação de inscrição e e-mail.
 * Devolve o texto sanitizado se válido e não-nulo; senão devolve o padrão DEFAULT_GROUP_INVITE_TEXT.
 * Nunca lança, nunca devolve vazio.
 */
export function resolveGroupInviteText(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_GROUP_INVITE_TEXT;
  }
  const result = sanitizeGroupText(raw);
  if (!result.ok || !result.text) {
    return DEFAULT_GROUP_INVITE_TEXT;
  }
  return result.text;
}
