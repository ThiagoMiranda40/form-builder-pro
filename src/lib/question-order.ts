/**
 * Funções puras e genéricas para ordenação de perguntas (T-34 / M-32).
 * Todas as funções operam de forma imutável (sem alterar os argumentos recebidos)
 * e devolvem posições sequenciais (0, 1, 2...).
 */

export interface Positionable {
  id: string;
  position: number;
}

/**
 * Normaliza as posições de uma lista para que fiquem estritamente sequenciais (0, 1, 2...),
 * retornando uma nova cópia sem mutar os itens recebidos.
 */
export function normalizePositions<T extends Positionable>(list: T[]): T[] {
  return list.map((item, index) => ({
    ...item,
    position: index,
  }));
}

/**
 * Move um item por um passo (-1 para cima, 1 para baixo).
 * Se o índice estiver fora dos limites ou o movimento ultrapassar as bordas,
 * retorna uma cópia com a mesma ordem e posições normalizadas.
 */
export function moveByStep<T extends Positionable>(
  list: T[],
  index: number,
  direction: -1 | 1,
): T[] {
  if (index < 0 || index >= list.length) {
    return normalizePositions(list);
  }

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= list.length) {
    return normalizePositions(list);
  }

  const next = [...list];
  const [current] = next.splice(index, 1);
  if (!current) return normalizePositions(list);
  next.splice(targetIndex, 0, current);

  return normalizePositions(next);
}

/**
 * Move um item de `fromIndex` para `toIndex`, limitando `toIndex` ao intervalo [0, length - 1].
 * Se `fromIndex` for igual a `toIndex` ou estiver fora do array, devolve cópia inalterada.
 */
export function moveToIndex<T extends Positionable>(
  list: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (list.length === 0 || fromIndex < 0 || fromIndex >= list.length) {
    return normalizePositions(list);
  }

  const clampedTarget = Math.max(0, Math.min(list.length - 1, toIndex));
  if (fromIndex === clampedTarget) {
    return normalizePositions(list);
  }

  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return normalizePositions(list);
  next.splice(clampedTarget, 0, item);

  return normalizePositions(next);
}

/**
 * Retorna o índice onde um item novo deve entrar:
 * logo depois do item com id `afterId`. Se `afterId` for nulo, indefinido
 * ou não existir na lista, retorna o fim da lista (`list.length`).
 */
export function insertionIndex<T extends Positionable>(
  list: T[],
  afterId: string | null | undefined,
): number {
  if (!afterId || list.length === 0) {
    return list.length;
  }

  const index = list.findIndex((item) => item.id === afterId);
  if (index === -1) {
    return list.length;
  }

  return index + 1;
}

/**
 * Insere um item logo após o item com id `afterId` e normaliza as posições da lista.
 */
export function insertAfter<T extends Positionable>(
  list: T[],
  item: T,
  afterId: string | null | undefined,
): T[] {
  const index = insertionIndex(list, afterId);
  const next = [...list];
  next.splice(index, 0, item);
  return normalizePositions(next);
}

/**
 * Retorna mensagem textual para leitores de tela em aria-live informando a nova posição.
 */
export function moveAnnouncement(newIndex: number, total: number): string {
  return `Pergunta movida para a posição ${newIndex + 1} de ${total}.`;
}

/**
 * Retorna { id, position } de todas as perguntas da lista exceto a de id `newId`,
 * na ordem da lista e com as posições da própria lista (T-34b).
 * Opera de forma puramente imutável.
 */
export function positionsToPersist<T extends Positionable>(
  list: T[],
  newId: string,
): Array<{ id: string; position: number }> {
  return list
    .filter((item) => item.id !== newId)
    .map((item) => ({
      id: item.id,
      position: item.position,
    }));
}

