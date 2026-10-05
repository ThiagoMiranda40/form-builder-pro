import { describe, it, expect } from "vitest";
import { autoScrollSpeed } from "./drag-autoscroll";

describe("autoScrollSpeed (T-34d)", () => {
  const H = 900; // viewportHeight padrão para testes
  // e = Math.min(120, 900 / 3) = 120; maxSpeed = 28

  it("meio da tela devolve 0", () => {
    expect(autoScrollSpeed(450, H)).toBe(0);
    expect(autoScrollSpeed(300, H)).toBe(0);
    expect(autoScrollSpeed(600, H)).toBe(0);
  });

  it("exatamente em e e em viewportHeight - e devolve 0 (nunca -0)", () => {
    const topEdgeSpeed = autoScrollSpeed(120, H);
    const bottomEdgeSpeed = autoScrollSpeed(H - 120, H);

    expect(topEdgeSpeed).toBe(0);
    expect(Object.is(topEdgeSpeed, -0)).toBe(false);

    expect(bottomEdgeSpeed).toBe(0);
    expect(Object.is(bottomEdgeSpeed, -0)).toBe(false);
  });

  it("clientY = 0 devolve exatamente -maxSpeed (-28)", () => {
    expect(autoScrollSpeed(0, H)).toBe(-28);
  });

  it("mais perto da borda devolve módulo maior (monotônico) em cima e embaixo", () => {
    // Topo: clientY diminuindo de 120 até 0 (mais perto da borda superior)
    const topFar = autoScrollSpeed(90, H); // perto de 120
    const topMid = autoScrollSpeed(60, H);
    const topNear = autoScrollSpeed(20, H); // perto de 0

    expect(topFar).toBeLessThan(0);
    expect(topMid).toBeLessThan(0);
    expect(topNear).toBeLessThan(0);

    // Módulos: |topFar| < |topMid| < |topNear|
    expect(Math.abs(topFar)).toBeLessThan(Math.abs(topMid));
    expect(Math.abs(topMid)).toBeLessThan(Math.abs(topNear));

    // Base: clientY aumentando de 780 até 900 (mais perto da borda inferior)
    const bottomFar = autoScrollSpeed(790, H);
    const bottomMid = autoScrollSpeed(840, H);
    const bottomNear = autoScrollSpeed(880, H);

    expect(bottomFar).toBeGreaterThan(0);
    expect(bottomMid).toBeGreaterThan(0);
    expect(bottomNear).toBeGreaterThan(0);

    expect(bottomFar).toBeLessThan(bottomMid);
    expect(bottomMid).toBeLessThan(bottomNear);
  });

  it("simetria: velocidade a uma distância d do topo tem módulo igual a distância d da base", () => {
    const dist = 30; // 30px da borda
    const topSpeed = autoScrollSpeed(dist, H);
    const bottomSpeed = autoScrollSpeed(H - dist, H);

    expect(topSpeed).toBe(-bottomSpeed);
    expect(Math.abs(topSpeed)).toBe(bottomSpeed);
  });

  it("clientY < 0 e > viewportHeight são limitados a -maxSpeed e maxSpeed", () => {
    expect(autoScrollSpeed(-10, H)).toBe(-28);
    expect(autoScrollSpeed(-200, H)).toBe(-28);

    expect(autoScrollSpeed(H + 10, H)).toBe(28);
    expect(autoScrollSpeed(H + 300, H)).toBe(28);
  });

  it("janela baixa (viewportHeight = 200, e = 66.67)", () => {
    const lowH = 200;
    // e = Math.min(120, 200 / 3) = 66.666...
    const e = 200 / 3;

    // Meio da tela (100) deve ser 0
    expect(autoScrollSpeed(100, lowH)).toBe(0);

    // Na borda e
    expect(autoScrollSpeed(e, lowH)).toBe(0);
    expect(autoScrollSpeed(lowH - e, lowH)).toBe(0);

    // No topo 0 deve ser -28
    expect(autoScrollSpeed(0, lowH)).toBe(-28);
    // Na base 200 deve ser 28
    expect(autoScrollSpeed(200, lowH)).toBe(28);
  });

  it("entradas não finitas devolvem 0", () => {
    expect(autoScrollSpeed(NaN, H)).toBe(0);
    expect(autoScrollSpeed(10, NaN)).toBe(0);
    expect(autoScrollSpeed(Infinity, H)).toBe(0);
    expect(autoScrollSpeed(-Infinity, H)).toBe(0);
    expect(autoScrollSpeed(10, Infinity)).toBe(0);
    expect(autoScrollSpeed(10, -Infinity)).toBe(0);
  });

  it("viewportHeight <= 0 devolve 0", () => {
    expect(autoScrollSpeed(10, 0)).toBe(0);
    expect(autoScrollSpeed(10, -100)).toBe(0);
    expect(autoScrollSpeed(0, 0)).toBe(0);
  });

  it("options personalizadas (edge e maxSpeed customizados)", () => {
    const opts = { edge: 80, maxSpeed: 40 };
    // e = Math.min(80, 900 / 3) = 80
    expect(autoScrollSpeed(80, H, opts)).toBe(0);
    expect(autoScrollSpeed(0, H, opts)).toBe(-40);
    expect(autoScrollSpeed(-15, H, opts)).toBe(-40);
    expect(autoScrollSpeed(H - 80, H, opts)).toBe(0);
    expect(autoScrollSpeed(H, H, opts)).toBe(40);
    expect(autoScrollSpeed(H + 20, H, opts)).toBe(40);

    // Metade da zona de rolagem: clientY = 40 (40 / 80 = 0.5) => maxSpeed * 0.5 = 20
    expect(autoScrollSpeed(40, H, opts)).toBe(-20);
    expect(autoScrollSpeed(H - 40, H, opts)).toBe(20);
  });
});
