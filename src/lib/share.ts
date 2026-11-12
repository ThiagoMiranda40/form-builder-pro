/**
 * Funções puras para gerenciamento de links do cliente e código de acesso (T-25 / M-20 / T-44 / M-44).
 */

/**
 * Alfabeto de 32 símbolos sem caracteres ambíguos (sem I, O, 0, 1).
 * Como possui exatamente 32 símbolos (2^5), a máscara de 5 bits (& 0x1f) não introduz viés de módulo.
 */
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface ShareSessionPayload {
  f: string; // ID do formulário
  v: number; // share_code_version
  exp: number; // expiração em segundos (epoch)
}

export interface VerifyShareSessionExpected {
  formId?: string;
  version?: number;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Comparação em tempo constante entre duas strings ASCII/hexadecimais de mesmo tamanho.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length || aBytes.length === 0) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(b64url: string): string | null {
  try {
    if (!b64url || !/^[A-Za-z0-9_-]+$/.test(b64url)) return null;
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Gera um token de 32 bytes aleatórios criptograficamente seguros (256 bits),
 * formatado como 64 caracteres hexadecimais minúsculos.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
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

/**
 * Gera código de acesso de 10 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem I, O, 0, 1),
 * usando `crypto.getRandomValues` sem viés de módulo (32 símbolos = 5 bits exatos).
 */
export function generateAccessCode(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += ACCESS_CODE_ALPHABET[bytes[i]! & 0x1f];
  }
  return out;
}

/**
 * Normaliza a entrada do código de acesso: maiúsculas, sem espaços e sem hífens.
 */
export function normalizeAccessCode(input: string): string {
  if (typeof input !== "string") return "";
  return input.toUpperCase().replace(/[\s\-–—]+/g, "");
}

/**
 * Gera sal aleatório de 16 bytes em hexadecimal minúsculo (32 caracteres).
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Calcula o hash SHA-256 (Web Crypto) sobre `salt + ":" + code` (normalizado) em hexadecimal.
 */
export async function hashAccessCode(code: string, salt: string): Promise<string> {
  const normalized = normalizeAccessCode(code);
  return sha256Hex(`${salt}:${normalized}`);
}

/**
 * Verifica um código de acesso contra o sal e o hash esperado em tempo constante.
 */
export async function verifyAccessCode(
  code: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  if (typeof code !== "string" || typeof salt !== "string" || typeof expectedHash !== "string") {
    return false;
  }
  const normalized = normalizeAccessCode(code);
  if (!normalized || !salt || !/^[0-9a-f]{64}$/i.test(expectedHash)) {
    return false;
  }
  const actualHash = await hashAccessCode(normalized, salt);
  return constantTimeEqual(actualHash, expectedHash.toLowerCase());
}

/**
 * Calcula a data de expiração da sessão ao desbloquear:
 * `expiraEm = max(closes_at, agora) + 30 dias`.
 * Se `closes_at` for nulo ou inválido, usa `agora + 30 dias`.
 */
export function computeSessionExpiry(
  closesAt: string | null | undefined,
  now: Date = new Date(),
): Date {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  if (!closesAt) {
    return new Date(nowMs + THIRTY_DAYS_MS);
  }
  const closesMs = new Date(closesAt).getTime();
  if (Number.isNaN(closesMs)) {
    return new Date(nowMs + THIRTY_DAYS_MS);
  }
  const baseMs = Math.max(closesMs, nowMs);
  return new Date(baseMs + THIRTY_DAYS_MS);
}

/**
 * Assina uma sessão de compartilhamento com HMAC-SHA256.
 */
export async function signShareSession(
  payload: ShareSessionPayload,
  secret: string,
): Promise<string> {
  if (!secret || typeof secret !== "string") {
    throw new Error("Segredo de sessão ausente.");
  }
  const canonical: ShareSessionPayload = {
    f: String(payload.f),
    v: Number(payload.v),
    exp: Math.floor(Number(payload.exp)),
  };
  const body = encodeBase64Url(JSON.stringify(canonical));
  const sig = await hmacSha256Hex(body, secret);
  return `${body}.${sig}`;
}

/**
 * Verifica uma sessão assinada com HMAC-SHA256 em tempo constante,
 * conferindo assinatura, expiração, formulário (quando informado) e versão (quando informada).
 */
export async function verifyShareSession(
  token: string | null | undefined,
  secret: string | null | undefined,
  now: Date | number = new Date(),
  expected?: VerifyShareSessionExpected,
): Promise<ShareSessionPayload | null> {
  if (typeof token !== "string" || typeof secret !== "string" || !token || !secret) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig || !/^[0-9a-f]{64}$/i.test(sig)) {
    return null;
  }

  const expectedSig = await hmacSha256Hex(body, secret);
  if (!constantTimeEqual(expectedSig, sig.toLowerCase())) {
    return null;
  }

  const decodedJson = decodeBase64Url(body);
  if (!decodedJson) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedJson);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj["f"] !== "string" ||
    !obj["f"] ||
    typeof obj["v"] !== "number" ||
    !Number.isInteger(obj["v"]) ||
    typeof obj["exp"] !== "number" ||
    !Number.isFinite(obj["exp"])
  ) {
    return null;
  }

  const nowSeconds =
    now instanceof Date ? Math.floor(now.getTime() / 1000) : Math.floor(Number(now) / 1000);
  if (obj["exp"] <= nowSeconds) {
    return null;
  }

  if (expected?.formId !== undefined && obj["f"] !== expected.formId) {
    return null;
  }

  if (expected?.version !== undefined && obj["v"] !== expected.version) {
    return null;
  }

  return {
    f: obj["f"],
    v: obj["v"],
    exp: obj["exp"],
  };
}

/**
 * Verifica se o link está temporariamente bloqueado por excesso de tentativas.
 */
export function isLockedOut(
  lockedUntil: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lockedUntil) return false;
  const untilMs =
    lockedUntil instanceof Date ? lockedUntil.getTime() : new Date(lockedUntil).getTime();
  if (Number.isNaN(untilMs)) return false;
  return untilMs > now.getTime();
}

/**
 * Gera o nome do cookie de sessão do link compartilhado:
 * `fbp_share_<primeiros 16 hex do SHA-256 do token>`
 */
export async function shareCookieName(token: string): Promise<string> {
  const hash = await sha256Hex(token);
  return `fbp_share_${hash.slice(0, 16)}`;
}

/**
 * Serializa o cabeçalho Set-Cookie com HttpOnly, Secure, SameSite=Lax, Path=/ e Max-Age.
 */
export function formatShareCookie(name: string, value: string, maxAgeSeconds: number): string {
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds));
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Extrai o valor de um cookie específico do cabeçalho Cookie da requisição.
 */
export function parseCookieHeader(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader || typeof cookieHeader !== "string") return null;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const k = pair.slice(0, eqIdx).trim();
    if (k === name) {
      return pair.slice(eqIdx + 1).trim();
    }
  }
  return null;
}
