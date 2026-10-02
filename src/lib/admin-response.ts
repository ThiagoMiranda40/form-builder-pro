export interface QuestionSummary {
  id: string;
  field_type?: string;
  label?: string;
  position?: number;
}

export type AdminUpdateResult =
  | { ok: true; emailChanged: boolean; newEmail: string | null }
  | { ok: false; error: string; field?: string };

export type AdminResendResult =
  | { sent: true }
  | { sent: false; error: string; code?: string };

/**
 * Verifica se a resposta da pergunta de e-mail mudou entre duas versões.
 * Compara valores normalizados (aparando espaços e ignorando maiúsculas/minúsculas).
 */
export function hasEmailChanged(
  prevAnswers: Record<string, unknown> | null | undefined,
  newAnswers: Record<string, unknown> | null | undefined,
  emailQuestionId?: string | null,
): boolean {
  if (!emailQuestionId) return false;

  const prevRaw = prevAnswers?.[emailQuestionId];
  const nextRaw = newAnswers?.[emailQuestionId];

  const prevNorm = typeof prevRaw === "string" ? prevRaw.trim().toLowerCase() : "";
  const nextNorm = typeof nextRaw === "string" ? nextRaw.trim().toLowerCase() : "";

  return prevNorm !== nextNorm;
}

/**
 * Procura a primeira pergunta do tipo e-mail com resposta preenchida.
 */
export function findEmailQuestionWithAnswer(
  questions: QuestionSummary[],
  answers: Record<string, unknown> | null | undefined,
): { questionId: string; email: string } | null {
  if (!answers || !questions) return null;

  for (const q of questions) {
    if (q.field_type === "email") {
      const val = answers[q.id];
      if (typeof val === "string" && val.trim().length > 0) {
        return {
          questionId: q.id,
          email: val.trim(),
        };
      }
    }
  }

  return null;
}

/**
 * Compara se os dígitos numéricos de dois valores de CPF são estritamente iguais.
 */
export function isCpfDigitsEqual(
  val1: string | null | undefined,
  val2: string | null | undefined,
): boolean {
  if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) {
    return false;
  }

  const d1 = String(val1).replace(/\D/g, "");
  const d2 = String(val2).replace(/\D/g, "");

  return d1 === d2;
}
