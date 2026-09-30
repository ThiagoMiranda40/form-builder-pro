import { describe, expect, it } from 'vitest';
import { readableTextColor, wcagContrastRatio } from './theme';

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
    let totalTested = 0;

    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) {
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          const choice = readableTextColor(hex);
          const ratioWhite = wcagContrastRatio(hex, '#ffffff');
          const ratioBlack = wcagContrastRatio(hex, '#000000');

          if (choice === '#ffffff') {
            expect(ratioWhite).toBeGreaterThanOrEqual(ratioBlack);
          } else {
            expect(ratioBlack).toBeGreaterThan(ratioWhite);
          }

          const chosenRatio = choice === '#ffffff' ? ratioWhite : ratioBlack;
          // WCAG 2.1 AA requires contrast >= 4.5:1. For any background color, max(contrast_white, contrast_black) >= 4.5
          // (Since relative luminance of the crossover point is around 0.179, max contrast is at least ~4.58:1)
          expect(chosenRatio).toBeGreaterThanOrEqual(4.5);
          totalTested++;
        }
      }
    }

    expect(totalTested).toBe(216);
  });
});
