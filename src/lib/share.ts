/**
 * Funções puras para gerenciamento de links do cliente (T-25 / M-20).
 */

/**
 * Gera um token de 32 bytes aleatórios criptograficamente seguros (256 bits),
 * formatado como 64 caracteres hexadecimais minúsculos.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Valida se um valor é um token de compartilhamento válido:
 * string com exatamente 64 caracteres hexadecimais minúsculos [0-9a-f].
 */
export function isValidShareToken(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{64}$/.test(value);
}

/**
 * Constrói a URL pública do link do cliente no formato `${origin}/c/${token}`.
 */
export function buildShareUrl(origin: string, token: string): string {
  const cleanOrigin = origin.replace(/\/+$/, "");
  return `${cleanOrigin}/c/${token}`;
}
