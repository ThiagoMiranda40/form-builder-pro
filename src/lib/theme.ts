/**
 * Converte um canal sRGB de 0..255 para o espaço linear segundo WCAG 2.1.
 */
function sRgbToLinear(c: number): number {
  const normalized = c / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Converte string hex (#rgb ou #rrggbb) em tupla [r, g, b] no intervalo 0..255.
 * Retorna null se a string não for uma cor hexadecimal válida.
 */
export function parseHex(hex: string): [number, number, number] | null {
  if (!hex || typeof hex !== "string") return null;

  let clean = hex.trim();
  if (clean.startsWith("#")) {
    clean = clean.slice(1);
  }

  if (clean.length === 3) {
    if (!/^[0-9a-fA-F]{3}$/.test(clean)) return null;
    const c0 = clean.charAt(0);
    const c1 = clean.charAt(1);
    const c2 = clean.charAt(2);
    const r = parseInt(c0 + c0, 16);
    const g = parseInt(c1 + c1, 16);
    const b = parseInt(c2 + c2, 16);
    return [r, g, b];
  }

  if (clean.length === 6) {
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }

  return null;
}

/**
 * Calcula a luminância relativa (0..1) de uma cor hexadecimal conforme a fórmula WCAG 2.1.
 * Retorna 0 se o formato for inválido.
 */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;

  const [r, g, b] = rgb;
  const rLin = sRgbToLinear(r);
  const gLin = sRgbToLinear(g);
  const bLin = sRgbToLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calcula a taxa de contraste (1..21) entre duas cores hexadecimais conforme WCAG 2.1.
 */
export function wcagContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Retorna '#ffffff' ou '#000000' para maximizar o contraste contra o fundo informado (WCAG 2.1).
 * Para qualquer cor válida, o contraste obtido atinge pelo menos 4.5:1 (nível AA).
 * Para hex inválido ou vazio, o fallback seguro é '#ffffff'.
 */
export function readableTextColor(bgColorHex: string): string {
  const rgb = parseHex(bgColorHex);
  if (!rgb) return "#ffffff";

  const lum = relativeLuminance(bgColorHex);

  // Luminância do branco = 1.0; do preto = 0.0
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastBlack = (lum + 0.05) / 0.05;

  return contrastWhite >= contrastBlack ? "#ffffff" : "#000000";
}
