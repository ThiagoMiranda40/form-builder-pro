const GROUP_LINK_REGEX = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/;
export const MAX_GROUP_LINK_LENGTH = 200;

/**
 * Valida o link de convite do grupo do WhatsApp (RF-17, ARQ-07, SEC-38).
 * Aceita apenas https://chat.whatsapp.com/<código alfanumérico> com até 200 caracteres após trim.
 * String vazia após trim devolve { ok: true, link: "" } (tratado pelo chamador como remover link).
 */
export function validateGroupLink(
  input: unknown,
): { ok: true; link: string } | { ok: false } {
  if (typeof input !== "string") {
    return { ok: false };
  }

  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: true, link: "" };
  }

  if (trimmed.length > MAX_GROUP_LINK_LENGTH) {
    return { ok: false };
  }

  if (!GROUP_LINK_REGEX.test(trimmed)) {
    return { ok: false };
  }

  return { ok: true, link: trimmed };
}

/**
 * Retorna verdadeiro se o valor informado for um link de grupo do WhatsApp válido e não-vazio.
 * Devolve false se for vazio, nulo, indefinido ou fora do formato seguro.
 */
export function hasValidGroupLink(raw: unknown): boolean {
  const result = validateGroupLink(raw);
  return result.ok && result.link.length > 0;
}
