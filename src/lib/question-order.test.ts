import { describe, expect, it } from "vitest";
import {
  normalizePositions,
  moveByStep,
  moveToIndex,
  insertionIndex,
  insertAfter,
  moveAnnouncement,
} from "./question-order";

describe("question-order (T-34 / M-32)", () => {
  describe("normalizePositions", () => {
    it("devolve array vazio para lista vazia sem mutar", () => {
      const input: Array<{ id: string; position: number }> = [];
      const result = normalizePositions(input);
      expect(result).toEqual([]);
      expect(result).not.toBe(input);
    });

    it("normaliza posições sequenciais (0, 1, 2...) sem mutar os itens originais", () => {
      const input = [
        { id: "q1", position: 5, label: "A" },
        { id: "q2", position: 20, label: "B" },
        { id: "q3", position: 100, label: "C" },
      ];
      const result = normalizePositions(input);
      expect(result).toEqual([
        { id: "q1", position: 0, label: "A" },
        { id: "q2", position: 1, label: "B" },
        { id: "q3", position: 2, label: "C" },
      ]);
      // Imutabilidade
      expect(input[0]!.position).toBe(5);
      expect(input[1]!.position).toBe(20);
      expect(input[2]!.position).toBe(100);
      expect(result).not.toBe(input);
      expect(result[0]).not.toBe(input[0]);
    });


    it("mantém posições já sequenciais em nova cópia", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ];
      const result = normalizePositions(input);
      expect(result).toEqual([
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ]);
      expect(result).not.toBe(input);
    });
  });

  describe("moveByStep", () => {
    it("devolve cópia igual se tentar mover para cima o primeiro item", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ];
      const result = moveByStep(input, 0, -1);
      expect(result).toEqual([
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ]);
      expect(result).not.toBe(input);
      expect(input[0]!.position).toBe(0);
    });

    it("devolve cópia igual se tentar mover para baixo o último item", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ];
      const result = moveByStep(input, 1, 1);
      expect(result).toEqual([
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ]);
      expect(result).not.toBe(input);
    });

    it("devolve cópia igual em lista vazia ou índice fora dos limites", () => {
      expect(moveByStep([], 0, 1)).toEqual([]);
      const input = [{ id: "q1", position: 0 }];
      expect(moveByStep(input, -1, 1)).toEqual([{ id: "q1", position: 0 }]);
      expect(moveByStep(input, 5, -1)).toEqual([{ id: "q1", position: 0 }]);
    });

    it("move elemento intermediário para cima (-1) e normaliza posições", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
        { id: "q3", position: 2 },
      ];
      const result = moveByStep(input, 1, -1);
      expect(result).toEqual([
        { id: "q2", position: 0 },
        { id: "q1", position: 1 },
        { id: "q3", position: 2 },
      ]);
      // Não muta original
      expect(input[0]!.id).toBe("q1");
      expect(input[1]!.id).toBe("q2");
    });

    it("move elemento intermediário para baixo (1) e normaliza posições", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
        { id: "q3", position: 2 },
      ];
      const result = moveByStep(input, 1, 1);
      expect(result).toEqual([
        { id: "q1", position: 0 },
        { id: "q3", position: 1 },
        { id: "q2", position: 2 },
      ]);
    });
  });

  describe("moveToIndex", () => {
    it("devolve cópia igual quando fromIndex === toIndex", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ];
      const result = moveToIndex(input, 1, 1);
      expect(result).toEqual([
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ]);
      expect(result).not.toBe(input);
    });

    it("devolve cópia igual quando lista está vazia ou fromIndex fora do intervalo", () => {
      expect(moveToIndex([], 0, 1)).toEqual([]);
      const input = [{ id: "q1", position: 0 }];
      expect(moveToIndex(input, -1, 0)).toEqual([{ id: "q1", position: 0 }]);
      expect(moveToIndex(input, 2, 0)).toEqual([{ id: "q1", position: 0 }]);
    });

    it("limita toIndex aos limites do array [0, length - 1]", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
        { id: "q3", position: 2 },
      ];
      // Mover o primeiro para além do fim
      const resEnd = moveToIndex(input, 0, 999);
      expect(resEnd).toEqual([
        { id: "q2", position: 0 },
        { id: "q3", position: 1 },
        { id: "q1", position: 2 },
      ]);

      // Mover o último para antes do início
      const resStart = moveToIndex(input, 2, -10);
      expect(resStart).toEqual([
        { id: "q3", position: 0 },
        { id: "q1", position: 1 },
        { id: "q2", position: 2 },
      ]);
    });

    it("move de baixo para cima corretamente (arrastar 3 para posição 0)", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
        { id: "q3", position: 2 },
        { id: "q4", position: 3 },
      ];
      const result = moveToIndex(input, 3, 1);
      expect(result).toEqual([
        { id: "q1", position: 0 },
        { id: "q4", position: 1 },
        { id: "q2", position: 2 },
        { id: "q3", position: 3 },
      ]);
      expect(input[3]!.id).toBe("q4"); // imutabilidade
    });


    it("move de cima para baixo corretamente (arrastar 0 para posição 2)", () => {
      const input = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
        { id: "q3", position: 2 },
      ];
      const result = moveToIndex(input, 0, 2);
      expect(result).toEqual([
        { id: "q2", position: 0 },
        { id: "q3", position: 1 },
        { id: "q1", position: 2 },
      ]);
    });
  });

  describe("insertionIndex", () => {
    const list = [
      { id: "q1", position: 0 },
      { id: "q2", position: 1 },
      { id: "q3", position: 2 },
    ];

    it("retorna índice logo após o item afterId", () => {
      expect(insertionIndex(list, "q1")).toBe(1);
      expect(insertionIndex(list, "q2")).toBe(2);
      expect(insertionIndex(list, "q3")).toBe(3);
    });

    it("retorna o fim da lista quando afterId é nulo ou indefinido", () => {
      expect(insertionIndex(list, null)).toBe(3);
      expect(insertionIndex(list, undefined)).toBe(3);
    });

    it("retorna o fim da lista quando afterId não existe na lista", () => {
      expect(insertionIndex(list, "inexistente")).toBe(3);
    });

    it("retorna 0 para lista vazia mesmo com afterId", () => {
      expect(insertionIndex([], "q1")).toBe(0);
      expect(insertionIndex([], null)).toBe(0);
    });
  });

  describe("insertAfter", () => {
    it("insere no fim se lista estiver vazia", () => {
      const item = { id: "new", position: 0 };
      const result = insertAfter([], item, null);
      expect(result).toEqual([{ id: "new", position: 0 }]);
    });

    it("insere logo após a pergunta indicada e normaliza posições", () => {
      const list = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ];
      const item = { id: "new", position: 99 };
      const result = insertAfter(list, item, "q1");
      expect(result).toEqual([
        { id: "q1", position: 0 },
        { id: "new", position: 1 },
        { id: "q2", position: 2 },
      ]);
      expect(list.length).toBe(2); // não muta entrada
    });

    it("insere no fim se afterId for nulo ou não existir", () => {
      const list = [
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
      ];
      const item = { id: "new", position: 0 };
      const result = insertAfter(list, item, null);
      expect(result).toEqual([
        { id: "q1", position: 0 },
        { id: "q2", position: 1 },
        { id: "new", position: 2 },
      ]);
    });
  });

  describe("moveAnnouncement", () => {
    it("devolve o texto literal exato com nova posição 1-based", () => {
      expect(moveAnnouncement(0, 5)).toBe("Pergunta movida para a posição 1 de 5.");
      expect(moveAnnouncement(1, 5)).toBe("Pergunta movida para a posição 2 de 5.");
      expect(moveAnnouncement(4, 5)).toBe("Pergunta movida para a posição 5 de 5.");
    });
  });
});
