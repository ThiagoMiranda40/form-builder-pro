import { describe, it, expect } from "vitest";
import {
  normalizeForSearch,
  findNameQuestion,
  rowMatchesQuery,
  filterRows,
  sortRows,
  type TableQuestion,
  type TableRow,
} from "./responses-table";

describe("responses-table", () => {
  const sampleQuestions: TableQuestion[] = [
    { id: "q1", label: "Nome completo", field_type: "name" },
    { id: "q2", label: "CPF", field_type: "cpf" },
    { id: "q3", label: "Telefone", field_type: "phone" },
    { id: "q4", label: "Data de Nascimento", field_type: "birthdate" },
    { id: "q5", label: "Cidade", field_type: "short_text" },
  ];

  const sampleRows: TableRow[] = [
    {
      id: "r1",
      submitted_at: "2026-10-02T10:00:00Z",
      answers: {
        q1: "Lívia Mendes",
        q2: "298.327.318-01",
        q3: "(11) 99716-7890",
        q4: "1995-04-12",
        q5: "São Paulo",
      },
    },
    {
      id: "r2",
      submitted_at: "2026-10-02T12:00:00Z",
      answers: {
        q1: "Ricardo Alves",
        q2: "123.456.789-00",
        q3: "(21) 98888-0000",
        q4: "1990-08-20",
        q5: "Rio de Janeiro",
      },
    },
    {
      id: "r3",
      submitted_at: "2026-10-02T14:00:00Z",
      answers: {
        q1: "Alice Silva",
        q2: "111.222.333-44",
        q3: "(31) 97777-1111",
        q4: "2000-01-01",
        q5: "Belo Horizonte",
      },
    },
    {
      id: "r4",
      submitted_at: "2026-10-02T16:00:00Z",
      answers: {
        q1: "Álvaro Pereira",
        q2: "555.666.777-88",
        q3: "(41) 96666-2222",
        q4: "1988-12-05",
        q5: "Curitiba",
      },
    },
    {
      id: "r5",
      submitted_at: "2026-10-02T18:00:00Z",
      answers: {
        q1: "Bruno Castro",
        q2: "999.888.777-66",
        q3: "(51) 95555-3333",
        q4: "1992-03-30",
        q5: "Porto Alegre",
      },
    },
    {
      id: "r6",
      submitted_at: "2026-10-02T20:00:00Z",
      answers: {
        q1: "",
        q2: "444.333.222-11",
        q3: "(61) 94444-4444",
        q4: "1985-05-15",
        q5: "Brasília",
      },
    },
  ];

  describe("normalizeForSearch", () => {
    it("deve converter para minúsculas, remover acentos e aparar espaços repetidos", () => {
      expect(normalizeForSearch("  Lívia   MENDES  ")).toBe("livia mendes");
      expect(normalizeForSearch("ÁÉÍÓÚ çãõ")).toBe("aeiou cao");
      expect(normalizeForSearch("")).toBe("");
    });
  });

  describe("findNameQuestion", () => {
    it("acha a primeira pergunta com field_type 'name'", () => {
      const q = findNameQuestion(sampleQuestions);
      expect(q?.id).toBe("q1");
    });

    it("acha pergunta cujo rótulo contenha 'nome' quando field_type não for 'name'", () => {
      const questions: TableQuestion[] = [
        { id: "q_email", label: "E-mail", field_type: "email" },
        { id: "q_nome", label: "Nome do participante", field_type: "text" },
      ];
      expect(findNameQuestion(questions)?.id).toBe("q_nome");
    });

    it("cai em fallback para 'short_text' se não houver 'name' nem 'nome' no rótulo", () => {
      const questions: TableQuestion[] = [
        { id: "q_cpf", label: "CPF", field_type: "cpf" },
        { id: "q_obs", label: "Observação", field_type: "short_text" },
      ];
      expect(findNameQuestion(questions)?.id).toBe("q_obs");
    });

    it("retorna null se não houver nenhuma pergunta candidata", () => {
      const questions: TableQuestion[] = [
        { id: "q_cpf", label: "CPF", field_type: "cpf" },
        { id: "q_email", label: "E-mail", field_type: "email" },
      ];
      expect(findNameQuestion(questions)).toBeNull();
    });
  });

  describe("rowMatchesQuery e filterRows", () => {
    it("acentos: 'livia' acha 'Lívia'", () => {
      const matched = filterRows(sampleRows, sampleQuestions, "livia");
      expect(matched.map((r) => r.id)).toEqual(["r1"]);
    });

    it("maiúsculas: 'RICARDO' acha 'Ricardo'", () => {
      const matched = filterRows(sampleRows, sampleQuestions, "RICARDO");
      expect(matched.map((r) => r.id)).toEqual(["r2"]);
    });

    it("dois termos: 'ricardo alves' exige que ambos os termos casem", () => {
      const matched = filterRows(sampleRows, sampleQuestions, "ricardo alves");
      expect(matched.map((r) => r.id)).toEqual(["r2"]);

      const noMatch = filterRows(sampleRows, sampleQuestions, "ricardo curitiba");
      expect(noMatch).toEqual([]);
    });

    it("CPF só com dígitos: '29832731801' acha '298.327.318-01'", () => {
      const matched = filterRows(sampleRows, sampleQuestions, "29832731801");
      expect(matched.map((r) => r.id)).toEqual(["r1"]);
    });

    it("telefone só com dígitos: '997167' acha '(11) 99716-7890'", () => {
      const matched = filterRows(sampleRows, sampleQuestions, "997167");
      expect(matched.map((r) => r.id)).toEqual(["r1"]);
    });

    it("'02/10/2026' acha a data formatada de envio", () => {
      const matched = filterRows(sampleRows, sampleQuestions, "02/10/2026");
      expect(matched.length).toBeGreaterThan(0);
      expect(matched.map((r) => r.id)).toContain("r1");
    });

    it("termo de 2 dígitos NÃO usa a busca por dígitos", () => {
      // "29" tem 2 dígitos: NÃO pode ativar busca por dígitos em 298.327...
      // só deve casar se o texto literal contiver "29"
      const matched = filterRows(sampleRows, sampleQuestions, "29");
      // "298.327..." contém "29" como texto literal, mas se testarmos um número que existe nos dígitos sem pontuação e não no texto:
      // Exemplo: no telefone "(11) 99716-7890", os dígitos consecutivos "19" existem ("1199716"), mas no texto está "1) 9"
      const rowWithPhone: TableRow = {
        id: "rp1",
        submitted_at: "2026-10-02T10:00:00Z",
        answers: { q3: "(11) 99716-7890" },
      };
      // "19" tem 2 dígitos; como texto literal "(11) 99716-7890" não tem "19"
      expect(rowMatchesQuery(rowWithPhone, sampleQuestions, "19")).toBe(false);
      // "119" tem 3 dígitos; a busca por dígitos ativa e acha nos dígitos de q3 ("11997167890")
      expect(rowMatchesQuery(rowWithPhone, sampleQuestions, "119")).toBe(true);
    });

    it("dígitos de respostas diferentes NÃO se combinam", () => {
      const rowCombinedDigits: TableRow = {
        id: "rc1",
        submitted_at: "2026-10-02T10:00:00Z",
        answers: {
          q2: "123",
          q3: "456",
        },
      };
      // "123456" não existe em nenhuma resposta individual
      expect(rowMatchesQuery(rowCombinedDigits, sampleQuestions, "123456")).toBe(false);
      // mas "123" existe em q2 e "456" existe em q3
      expect(rowMatchesQuery(rowCombinedDigits, sampleQuestions, "123")).toBe(true);
      expect(rowMatchesQuery(rowCombinedDigits, sampleQuestions, "456")).toBe(true);
    });

    it("consulta vazia devolve todas as linhas", () => {
      expect(filterRows(sampleRows, sampleQuestions, "")).toEqual(sampleRows);
      expect(filterRows(sampleRows, sampleQuestions, "   ")).toEqual(sampleRows);
    });

    it("nenhum resultado devolve array vazio", () => {
      expect(filterRows(sampleRows, sampleQuestions, "termo-inexistente-xyz")).toEqual([]);
    });
  });

  describe("sortRows", () => {
    it("não altera o array original", () => {
      const copy = [...sampleRows];
      sortRows(sampleRows, sampleQuestions, "name_asc");
      expect(sampleRows).toEqual(copy);
    });

    it("ordena por 'newest' (submitted_at decrescente)", () => {
      const sorted = sortRows(sampleRows, sampleQuestions, "newest");
      expect(sorted.map((r) => r.id)).toEqual(["r6", "r5", "r4", "r3", "r2", "r1"]);
    });

    it("ordena por 'oldest' (submitted_at crescente)", () => {
      const sorted = sortRows(sampleRows, sampleQuestions, "oldest");
      expect(sorted.map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4", "r5", "r6"]);
    });

    it("ordena por 'name_asc' com 'Álvaro' entre 'Alice' e 'Bruno', e sem nome por último", () => {
      const sorted = sortRows(sampleRows, sampleQuestions, "name_asc");
      // Alice -> Álvaro -> Bruno -> Lívia -> Ricardo -> (sem nome: r6)
      expect(sorted.map((r) => r.id)).toEqual(["r3", "r4", "r5", "r1", "r2", "r6"]);
    });

    it("ordena por 'name_desc' mantendo sem nome por último", () => {
      const sorted = sortRows(sampleRows, sampleQuestions, "name_desc");
      // Ricardo -> Lívia -> Bruno -> Álvaro -> Alice -> (sem nome: r6)
      expect(sorted.map((r) => r.id)).toEqual(["r2", "r1", "r5", "r4", "r3", "r6"]);
    });
  });
});
