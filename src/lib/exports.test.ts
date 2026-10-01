import { describe, it, expect } from "vitest";
import { buildRows, type ExportQuestion, type ExportResponse } from "./exports";

describe("buildRows (T-12 / Item 6)", () => {
  const questions: ExportQuestion[] = [
    { id: "q-cpf", label: "CPF" },
    { id: "q-nome", label: "Nome Completo" },
    { id: "q-dist", label: "Opções de Percurso" },
    { id: "q-obs", label: "Observações" },
  ];

  it("o cabeçalho é 'Enviado em' mais os rótulos das perguntas, com acentos preservados", () => {
    const { header } = buildRows(questions, []);
    expect(header).toEqual([
      "Enviado em",
      "CPF",
      "Nome Completo",
      "Opções de Percurso",
      "Observações",
    ]);
  });

  it("o CPF sai COMPLETO e sem máscara (ex.: '529.982.247-25')", () => {
    const responses: ExportResponse[] = [
      {
        submitted_at: "2026-10-01T10:00:00.000Z",
        answers: {
          "q-cpf": "529.982.247-25",
          "q-nome": "João da Silva",
          "q-dist": "10 km",
        },
      },
    ];

    const { rows } = buildRows(questions, responses);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    // Índice 0: Enviado em; Índice 1: CPF
    expect(row[1]).toBe("529.982.247-25");
    expect(row[1]).not.toContain("***");
  });

  it("listas viram texto separado por ', '", () => {
    const responses: ExportResponse[] = [
      {
        submitted_at: "2026-10-01T10:00:00.000Z",
        answers: {
          "q-cpf": "111.444.777-35",
          "q-nome": "Maria Souza",
          "q-dist": ["5 km", "10 km"],
        },
      },
    ];

    const { rows } = buildRows(questions, responses);
    const row = rows[0]!;
    // Índice 3: Opções de Percurso (q-dist)
    expect(row[3]).toBe("5 km, 10 km");
  });

  it("resposta ausente vira string vazia", () => {
    const responses: ExportResponse[] = [
      {
        submitted_at: "2026-10-01T10:00:00.000Z",
        answers: {
          "q-cpf": "390.533.447-05",
          "q-nome": "Carlos Pereira",
          // q-dist e q-obs ausentes
        },
      },
    ];

    const { rows } = buildRows(questions, responses);
    const row = rows[0]!;
    expect(row[3]).toBe("");
    expect(row[4]).toBe("");
  });

  it("acentos e caracteres especiais em português são preservados", () => {
    const responses: ExportResponse[] = [
      {
        submitted_at: "2026-10-01T10:00:00.000Z",
        answers: {
          "q-cpf": "529.982.247-25",
          "q-nome": "José Conceição de Alcântara",
          "q-dist": "Caminhada de 3 km & Corrida",
          "q-obs": "Atenção: alérgico a crustáceos / inscrição de São Paulo - SP",
        },
      },
    ];

    const { rows } = buildRows(questions, responses);
    const row = rows[0]!;
    expect(row[2]).toBe("José Conceição de Alcântara");
    expect(row[3]).toBe("Caminhada de 3 km & Corrida");
    expect(row[4]).toBe("Atenção: alérgico a crustáceos / inscrição de São Paulo - SP");
  });
});
