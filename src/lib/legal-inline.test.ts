import { describe, it, expect } from "vitest";
import { parseInline } from "./legal-inline";

describe("parseInline", () => {
  it("trata texto sem marcador como texto puro", () => {
    expect(parseInline("Texto puro sem marcador")).toEqual([
      { text: "Texto puro sem marcador", bold: false },
    ]);
  });

  it("processa negrito simples no início ou meio", () => {
    expect(parseInline("**1. O que é.** Este site permite...")).toEqual([
      { text: "1. O que é.", bold: true },
      { text: " Este site permite...", bold: false },
    ]);
  });

  it("processa múltiplos blocos em negrito na mesma string", () => {
    expect(parseInline("**A** e **B**")).toEqual([
      { text: "A", bold: true },
      { text: " e ", bold: false },
      { text: "B", bold: true },
    ]);
  });

  it("mantém marcador sem par como texto literal", () => {
    expect(parseInline("Texto com ** marcador sem par")).toEqual([
      { text: "Texto com ** marcador sem par", bold: false },
    ]);
  });

  it("mantém tags como <script> como texto literal (sem gerar HTML)", () => {
    const input = "<script>alert(1)</script>";
    expect(parseInline(input)).toEqual([
      { text: "<script>alert(1)</script>", bold: false },
    ]);
  });
});
