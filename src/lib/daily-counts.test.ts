import { describe, it, expect } from "vitest";
import { countByDay } from "./daily-counts";

describe("countByDay (T-22 / Item 3)", () => {
  // Fixa now em 2026-10-02 às 15:00 UTC (12:00 em São Paulo)
  // Últimos 7 dias em SP:
  // 26/09 (Sáb - "S"), 27/09 (Dom - "D"), 28/09 (Seg - "S"), 29/09 (Ter - "T"), 30/09 (Qua - "Q"), 01/10 (Qui - "Q"), 02/10 (Sex - "S")
  const fixedNow = new Date("2026-10-02T15:00:00.000Z");

  it("retorna exatamente 'days' itens, do mais antigo ao de hoje (o último é hoje)", () => {
    const result = countByDay([], 7, fixedNow);
    expect(result).toHaveLength(7);
    expect(result[6]?.dateText).toBe("02/10");
    expect(result[6]?.label).toBe("S"); // Sexta-feira
    expect(result[0]?.dateText).toBe("26/09");
    expect(result[0]?.label).toBe("S"); // Sábado
    expect(result[1]?.dateText).toBe("27/09");
    expect(result[1]?.label).toBe("D"); // Domingo
  });

  it("resposta às 23:30 de São Paulo (já é o dia seguinte em UTC) cai no dia certo", () => {
    // 2026-10-01 às 23:30 em SP (UTC-3) corresponde a 2026-10-02T02:30:00.000Z em UTC
    const dates = ["2026-10-02T02:30:00.000Z"];
    const result = countByDay(dates, 7, fixedNow);

    const oct01 = result.find((d) => d.dateText === "01/10");
    const oct02 = result.find((d) => d.dateText === "02/10");

    expect(oct01?.total).toBe(1);
    expect(oct02?.total).toBe(0);
  });

  it("lista vazia retorna todos os dias com total 0", () => {
    const result = countByDay([], 7, fixedNow);
    expect(result.every((d) => d.total === 0)).toBe(true);
    expect(result.reduce((acc, d) => acc + d.total, 0)).toBe(0);
  });

  it("datas fora da janela de 7 dias são ignoradas", () => {
    const dates = [
      "2026-09-25T12:00:00.000Z", // 7 dias antes (fora, janela começa em 26/09)
      "2026-09-20T10:00:00.000Z", // bem anterior
      "2026-10-03T10:00:00.000Z", // futuro
      "invalid-date",
    ];
    const result = countByDay(dates, 7, fixedNow);
    expect(result.reduce((acc, d) => acc + d.total, 0)).toBe(0);
  });

  it("soma dos totais reflete corretamente as inscrições computadas dentro da janela", () => {
    const dates = [
      "2026-09-26T14:00:00.000Z", // 26/09 em SP -> 1
      "2026-09-26T18:00:00.000Z", // 26/09 em SP -> 2
      "2026-09-27T10:00:00.000Z", // 27/09 em SP -> 1
      "2026-10-02T12:00:00.000Z", // 02/10 em SP -> 1
      "2026-10-02T14:00:00.000Z", // 02/10 em SP -> 2
      "2026-09-20T00:00:00.000Z", // fora
    ];
    const result = countByDay(dates, 7, fixedNow);
    expect(result.find((d) => d.dateText === "26/09")?.total).toBe(2);
    expect(result.find((d) => d.dateText === "27/09")?.total).toBe(1);
    expect(result.find((d) => d.dateText === "02/10")?.total).toBe(2);
    expect(result.reduce((acc, d) => acc + d.total, 0)).toBe(5);
  });

  describe("T-27: isoDate e weekdayName", () => {
    it("com now fixo, o último item é hoje com weekdayName e isoDate corretos (2026-10-02 é sexta-feira)", () => {
      const result = countByDay([], 7, fixedNow);
      expect(result).toHaveLength(7);

      const today = result[6];
      expect(today?.isoDate).toBe("2026-10-02");
      expect(today?.weekdayName).toBe("sexta-feira");

      const first = result[0];
      expect(first?.isoDate).toBe("2026-09-26");
      expect(first?.weekdayName).toBe("sábado");

      const sunday = result[1];
      expect(sunday?.isoDate).toBe("2026-09-27");
      expect(sunday?.weekdayName).toBe("domingo");
    });

    it("resposta às 23:30 de São Paulo cai no dia certo com weekdayName e isoDate esperados", () => {
      // 2026-10-01 às 23:30 em SP (UTC-3) corresponde a 2026-10-02T02:30:00.000Z em UTC
      const dates = ["2026-10-02T02:30:00.000Z"];
      const result = countByDay(dates, 7, fixedNow);

      const oct01 = result.find((d) => d.dateText === "01/10");
      expect(oct01?.total).toBe(1);
      expect(oct01?.isoDate).toBe("2026-10-01");
      expect(oct01?.weekdayName).toBe("quinta-feira");
    });
  });
});

