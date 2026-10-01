export type FormStateInput = {
  status: string;
  closes_at: string | null;
  max_responses: number | null;
};

export type PublicFormState = "open" | "closed" | "full" | "not_found" | "draft";

/**
 * Resolve o estado público de um formulário:
 * - status "draft" -> "draft"
 * - status "closed" -> "closed"
 * - status desconhecido -> "draft"
 * - status "published":
 *   - com prazo vencido -> "closed" (mesmo se lotado)
 *   - com vagas esgotadas -> "full"
 *   - normal -> "open"
 */
export function resolvePublicState(
  form: FormStateInput,
  responsesCount: number,
  now: Date
): PublicFormState {
  if (form.status === "draft") return "draft";
  if (form.status === "closed") return "closed";
  if (form.status !== "published") return "draft";

  const isExpired = form.closes_at ? new Date(form.closes_at).getTime() < now.getTime() : false;
  if (isExpired) return "closed";

  const isFull = form.max_responses !== null && responsesCount >= form.max_responses;
  if (isFull) return "full";

  return "open";
}
