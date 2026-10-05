/**
 * Cálculo puro da velocidade de rolagem automática durante arrasto de elementos (T-34d).
 *
 * @param clientY Posição vertical do ponteiro na janela.
 * @param viewportHeight Altura visível da janela (window.innerHeight).
 * @param options Configurações opcionais de margem de ativação (edge) e velocidade máxima (maxSpeed).
 * @returns Velocidade em pixels por quadro: negativo para rolar para cima, positivo para rolar para baixo, 0 no meio.
 */
export function autoScrollSpeed(
  clientY: number,
  viewportHeight: number,
  options?: { edge?: number; maxSpeed?: number }
): number {
  if (!Number.isFinite(clientY) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return 0;
  }

  const edge = options?.edge ?? 120;
  const maxSpeed = options?.maxSpeed ?? 28;

  const e = Math.min(edge, viewportHeight / 3);
  if (e <= 0) return 0;

  if (clientY < e) {
    const rawModule = (maxSpeed * (e - clientY)) / e;
    const module = Math.min(maxSpeed, rawModule);
    const speed = -module;
    return speed === 0 ? 0 : speed;
  }

  const bottomThreshold = viewportHeight - e;
  if (clientY > bottomThreshold) {
    const rawModule = (maxSpeed * (clientY - bottomThreshold)) / e;
    const module = Math.min(maxSpeed, rawModule);
    return module === 0 ? 0 : module;
  }

  return 0;
}
