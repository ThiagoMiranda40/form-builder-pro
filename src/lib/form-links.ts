/**
 * Helper puro para montar o link público de um formulário (T-65 / RF-28).
 * Normaliza a origem (remove barras finais) e codifica o slug.
 */
export function publicFormUrl(origin: string, slug: string): string {
  const cleanOrigin = origin.replace(/\/+$/, "");
  if (!slug) {
    return `${cleanOrigin}/`;
  }
  return `${cleanOrigin}/${encodeURIComponent(slug)}`;
}
