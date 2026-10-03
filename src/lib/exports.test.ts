import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildRows,
  buildPdfDocument,
  type ExportQuestion,
  type ExportResponse,
} from "./exports";

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

  it("pergunta do tipo data (date) tem a resposta convertida para dd/mm/aaaa", () => {
    const questionsWithDate: ExportQuestion[] = [
      { id: "q-nome", label: "Nome", field_type: "short_text" },
      { id: "q-nasc", label: "Data de Nascimento", field_type: "date" },
    ];
    const responses: ExportResponse[] = [
      {
        submitted_at: "2026-10-01T10:00:00.000Z",
        answers: {
          "q-nome": "Ana Paula",
          "q-nasc": "1981-12-20",
        },
      },
    ];

    const { rows } = buildRows(questionsWithDate, responses);
    const row = rows[0]!;
    expect(row[1]).toBe("Ana Paula");
    expect(row[2]).toBe("20/12/1981");
  });

  it("(a) buildRows com field_type: 'birthdate' devolve dd/mm/aaaa (QA-GAP-13)", () => {
    const questionsWithBirthdate: ExportQuestion[] = [
      { id: "q-nome", label: "Nome", field_type: "name" },
      { id: "q-nasc", label: "Data de Nascimento", field_type: "birthdate" },
    ];
    const responses: ExportResponse[] = [
      {
        submitted_at: "2026-10-01T10:00:00.000Z",
        answers: {
          "q-nome": "Mariana Lima",
          "q-nasc": "1994-07-15",
        },
      },
    ];

    const { rows } = buildRows(questionsWithBirthdate, responses);
    const row = rows[0]!;
    expect(row[1]).toBe("Mariana Lima");
    expect(row[2]).toBe("15/07/1994");
  });

  it("(b) regressão do SEC-26: respostas começadas por =, +, - e @ saem como texto (t === 's') e sem propriedade f", () => {
    const formulaQuestions: ExportQuestion[] = [
      { id: "q1", label: "Fórmula 1" },
      { id: "q2", label: "Fórmula 2" },
      { id: "q3", label: "Fórmula 3" },
      { id: "q4", label: "Fórmula 4" },
    ];
    const formulaResponses: ExportResponse[] = [
      {
        submitted_at: "2026-10-01T10:00:00.000Z",
        answers: {
          q1: "=1+1",
          q2: "+5511999999999",
          q3: "-100",
          q4: "@SUM(A1:A10)",
        },
      },
    ];
    const { header, rows } = buildRows(formulaQuestions, formulaResponses);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    for (const cellRef of ["B2", "C2", "D2", "E2"]) {
      const cell = sheet[cellRef];
      expect(cell).toBeDefined();
      expect(cell.t).toBe("s");
      expect(cell.f).toBeUndefined();
    }
  });
});

describe("buildPdfDocument (T-37)", () => {
  it("(c) buildPdfDocument devolve um PDF válido começando com %PDF e tabela configurada", async () => {
    const sampleQuestions: ExportQuestion[] = [
      { id: "q-cpf", label: "CPF", field_type: "cpf" },
      { id: "q-nome", label: "Nome", field_type: "name" },
    ];
    const sampleResponses: ExportResponse[] = [
      {
        submitted_at: "2026-10-01T10:00:00.000Z",
        answers: {
          "q-cpf": "123.456.789-00",
          "q-nome": "Fulano",
        },
      },
    ];
    const doc = await buildPdfDocument("Evento Teste", sampleQuestions, sampleResponses);
    expect(doc).toBeDefined();
    const arrayBuffer = doc.output("arraybuffer");
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const headerStr = String.fromCharCode(...headerBytes);
    expect(headerStr).toBe("%PDF");
  });
});
