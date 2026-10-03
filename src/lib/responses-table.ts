import { formatAnswer } from "./answer-format";

export interface TableQuestion {
  id: string;
  label: string;
  field_type?: string;
}

export interface TableRow {
  id: string;
  submitted_at: string;
  updated_at?: string | null;
  answers: Record<string, string | string[]>;
}

export type SortMode = "newest" | "oldest" | "name_asc" | "name_desc";

/**
 * Normaliza uma string para busca: minúsculas, sem acentos (NFD),
 * espaços repetidos reduzidos para um espaço simples, e aparado (trim).
 */
export function normalizeForSearch(value: string): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Encontra a pergunta de nome:
 * 1. A primeira pergunta com field_type === "name" ou cujo rótulo normalizado contém "nome"
 * 2. Se nenhuma, a primeira com field_type === "short_text"
 * 3. Se nenhuma, null
 */
export function findNameQuestion(questions: TableQuestion[]): TableQuestion | null {
  const byNameOrLabel = questions.find((q) => {
    if (q.field_type === "name") return true;
    const norm = normalizeForSearch(q.label);
    return norm.includes("nome");
  });
  if (byNameOrLabel) return byNameOrLabel;

  const byShortText = questions.find((q) => q.field_type === "short_text");
  return byShortText ?? null;
}

/**
 * Formata a data de submissão no padrão "dd/mm/aaaa hh:mm" com fuso "America/Sao_Paulo".
 */
export function formatSubmittedAt(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${getPart("day")}/${getPart("month")}/${getPart("year")} ${getPart("hour")}:${getPart("minute")}`;
  } catch {
    return "";
  }
}

/**
 * Verifica se uma linha casa com a consulta.
 * Regras:
 * - Consulta vazia devolve true;
 * - A consulta é dividida em termos por espaço e TODOS os termos precisam casar;
 * - Um termo casa se:
 *   1. Aparece no texto normalizado de qualquer resposta já formatada com formatAnswer (datas em dd/mm/aaaa);
 *   2. OU aparece no texto da data de envio ("dd/mm/aaaa hh:mm", fuso "America/Sao_Paulo");
 *   3. OU se o termo tiver 3 ou mais dígitos e esses dígitos aparecerem nos dígitos de UMA mesma resposta
 *      (nunca concatena dígitos de respostas diferentes). Se o termo tiver menos de 3 dígitos, a busca
 *      por dígitos NÃO é ativada.
 */
export function rowMatchesQuery(
  row: TableRow,
  questions: TableQuestion[],
  query: string,
): boolean {
  if (!query) return true;
  const trimmed = query.trim();
  if (!trimmed) return true;

  const terms = trimmed.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const normSubmitted = normalizeForSearch(formatSubmittedAt(row.submitted_at));

  const formattedAnswers: string[] = [];
  const digitsPerAnswer: string[] = [];

  for (const q of questions) {
    const raw = row.answers?.[q.id];
    const formatted = formatAnswer(q.field_type, raw);
    formattedAnswers.push(normalizeForSearch(formatted));

    const rawStr = Array.isArray(raw) ? raw.join("") : String(raw ?? "");
    const digits = rawStr.replace(/\D/g, "");
    if (digits) {
      digitsPerAnswer.push(digits);
    }
  }

  return terms.every((term) => {
    const normTerm = normalizeForSearch(term);
    const termDigits = term.replace(/\D/g, "");
    const has3Digits = termDigits.length >= 3;

    // 1. Data de envio formatada
    if (normSubmitted.includes(normTerm)) {
      return true;
    }

    // 2. Qualquer resposta formatada (ex.: datas dd/mm/aaaa, texto etc.)
    if (formattedAnswers.some((ans) => ans.includes(normTerm))) {
      return true;
    }

    // 3. Se tiver 3 ou mais dígitos e coincidir com os dígitos de UMA mesma resposta
    if (has3Digits && digitsPerAnswer.some((d) => d.includes(termDigits))) {
      return true;
    }

    return false;
  });
}

/**
 * Filtra as linhas com base na consulta.
 * Consulta vazia devolve todas as linhas.
 */
export function filterRows(
  rows: TableRow[],
  questions: TableQuestion[],
  query: string,
): TableRow[] {
  if (!query || !query.trim()) {
    return rows;
  }
  return rows.filter((r) => rowMatchesQuery(r, questions, query));
}

/**
 * Ordena as linhas retornando uma NOVA cópia.
 * - "newest": submitted_at decrescente, empate por id
 * - "oldest": submitted_at crescente, empate por id
 * - "name_asc" / "name_desc": pelo nome da pergunta encontrada por findNameQuestion
 *   com Intl.Collator("pt-BR", { sensitivity: "base", numeric: true }).
 *   Linhas sem nome sempre por último nas duas direções.
 *   Desempate por submitted_at crescente, depois por id.
 */
export function sortRows(
  rows: TableRow[],
  questions: TableQuestion[],
  mode: SortMode,
): TableRow[] {
  const result = [...rows];

  if (mode === "newest") {
    return result.sort((a, b) => {
      const diff = new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
  }

  if (mode === "oldest") {
    return result.sort((a, b) => {
      const diff = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
  }

  const nameQ = findNameQuestion(questions);
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

  return result.sort((a, b) => {
    const valA =
      nameQ && typeof a.answers?.[nameQ.id] === "string"
        ? (a.answers[nameQ.id] as string).trim()
        : "";
    const valB =
      nameQ && typeof b.answers?.[nameQ.id] === "string"
        ? (b.answers[nameQ.id] as string).trim()
        : "";

    const hasA = Boolean(valA);
    const hasB = Boolean(valB);

    if (!hasA && !hasB) {
      const diff = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    }
    if (!hasA) return 1;
    if (!hasB) return -1;

    const comp = collator.compare(valA, valB);
    if (comp !== 0) {
      return mode === "name_asc" ? comp : -comp;
    }

    const diff = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}
