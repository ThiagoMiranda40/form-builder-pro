import { describe, expect, it } from 'vitest';
import { readableTextColor, sanitizeImageUrl } from './theme';

function sRGBToLinear(val255: number): number {
  const v = val255 / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBToLinear(r) + 0.7152 * sRGBToLinear(g) + 0.0722 * sRGBToLinear(b);
}

function calculateContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('theme.ts - readableTextColor', () => {
  it('retorna #ffffff para hex inválido ou vazio', () => {
    expect(readableTextColor('')).toBe('#ffffff');
    expect(readableTextColor('invalid')).toBe('#ffffff');
    expect(readableTextColor('#12')).toBe('#ffffff');
    expect(readableTextColor('#12345')).toBe('#ffffff');
    expect(readableTextColor('#gggggg')).toBe('#ffffff');
    expect(readableTextColor('#1234567')).toBe('#ffffff');
  });

  it('casos conhecidos retornam a cor esperada com melhor contraste', () => {
    expect(readableTextColor('#4f46e5')).toBe('#ffffff');
    expect(readableTextColor('#000000')).toBe('#ffffff');
    expect(readableTextColor('#ffff00')).toBe('#000000');
    expect(readableTextColor('#22c55e')).toBe('#000000');
    expect(readableTextColor('#ffffff')).toBe('#000000');
  });

  it('aceita hex de 3 caracteres (#rgb) e case insensitive', () => {
    expect(readableTextColor('#000')).toBe('#ffffff');
    expect(readableTextColor('#FFF')).toBe('#000000');
    expect(readableTextColor('#4F46E5')).toBe('#ffffff');
  });

  it('varredura das 216 cores "web safe" garante que a cor retornada sempre tem o maior contraste e atinge pelo menos 4.5:1 sempre que matematicamente possível', () => {
    // 216 web-safe colors: R, G, B in [0, 51, 102, 153, 204, 255] (i.e. 0x00, 0x33, 0x66, 0x99, 0xCC, 0xFF)
    const steps = [0x00, 0x33, 0x66, 0x99, 0xcc, 0xff];
    const lumWhite = relativeLuminance(255, 255, 255);
    const lumBlack = relativeLuminance(0, 0, 0);
    let totalTested = 0;

    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) {
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          const choice = readableTextColor(hex);
          const bgLum = relativeLuminance(r, g, b);
          const ratioWhite = calculateContrastRatio(bgLum, lumWhite);
          const ratioBlack = calculateContrastRatio(bgLum, lumBlack);

          if (choice === '#ffffff') {
            expect(ratioWhite).toBeGreaterThanOrEqual(ratioBlack);
          } else {
            expect(ratioBlack).toBeGreaterThan(ratioWhite);
          }

          const chosenRatio = choice === '#ffffff' ? ratioWhite : ratioBlack;
          // WCAG 2.1 AA requires contrast >= 4.5:1. For any background color, max(contrast_white, contrast_black) >= 4.5
          expect(chosenRatio).toBeGreaterThanOrEqual(4.5);
          totalTested++;
        }
      }
    }

    expect(totalTested).toBe(216);
  });
});

describe('theme.ts - sanitizeImageUrl (T-61)', () => {
  it('retorna a URL aparada para URLs https válidas', () => {
    expect(sanitizeImageUrl('https://exemplo.com/banner.jpg')).toBe(
      'https://exemplo.com/banner.jpg',
    );
    expect(sanitizeImageUrl('  https://exemplo.com/capa.png  ')).toBe(
      'https://exemplo.com/capa.png',
    );
    expect(
      sanitizeImageUrl('https://cdn.exemplo.com/imagens/banner.webp?w=1200&h=400#topo'),
    ).toBe('https://cdn.exemplo.com/imagens/banner.webp?w=1200&h=400#topo');
    expect(
      sanitizeImageUrl('https://exemplo.com/foto-promoção-verão.jpg'),
    ).toBe('https://exemplo.com/foto-promoção-verão.jpg');
  });

  it('retorna null para protocolos não-https, esquemas inseguros ou formato relativo', () => {
    expect(sanitizeImageUrl('http://exemplo.com/banner.jpg')).toBeNull();
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
    expect(sanitizeImageUrl('//cdn.exemplo.com/banner.jpg')).toBeNull();
    expect(sanitizeImageUrl('/assets/banner.jpg')).toBeNull();
    expect(sanitizeImageUrl('ftp://exemplo.com/banner.jpg')).toBeNull();
  });

  it('retorna null para vazios, espaços ou tipos inválidos', () => {
    expect(sanitizeImageUrl('')).toBeNull();
    expect(sanitizeImageUrl('   ')).toBeNull();
    expect(sanitizeImageUrl(null)).toBeNull();
    expect(sanitizeImageUrl(undefined)).toBeNull();
    expect(sanitizeImageUrl(12345)).toBeNull();
    expect(sanitizeImageUrl({})).toBeNull();
    expect(sanitizeImageUrl([])).toBeNull();
  });

  it('retorna null se contiver espaços internos ou caracteres de controle', () => {
    expect(sanitizeImageUrl('https://exemplo.com/banner com espaco.jpg')).toBeNull();
    expect(sanitizeImageUrl('https://exemplo.com/banner\n.jpg')).toBeNull();
    expect(sanitizeImageUrl('https://exemplo.com/banner\t.jpg')).toBeNull();
    expect(sanitizeImageUrl('https://exemplo.com/banner\x00.jpg')).toBeNull();
  });

  it('retorna null se exceder 500 caracteres', () => {
    const base = 'https://exemplo.com/';
    const valid500 = base + 'a'.repeat(500 - base.length);
    expect(valid500.length).toBe(500);
    expect(sanitizeImageUrl(valid500)).toBe(valid500);

    const invalid501 = base + 'a'.repeat(501 - base.length);
    expect(invalid501.length).toBe(501);
    expect(sanitizeImageUrl(invalid501)).toBeNull();
  });
});
