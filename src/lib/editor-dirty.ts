/**
 * Funções puras para detecção de alterações (dirty state) no editor de formulários (T-34b / M-32 / M-35).
 * Gera um snapshot JSON determinístico contendo apenas os campos persistidos pela operação de salvar.
 */

export interface FormSnapshotInput {
  title?: string | null;
  description?: string | null;
  slug?: string | null;
  theme?: unknown;
  max_responses?: number | null;
  closes_at?: string | null;
  consent_text?: string | null;
  success_message?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface QuestionSnapshotInput {
  id: string;
  label?: string | null;
  help_text?: string | null;
  field_type?: string | null;
  required?: boolean | null;
  options?: unknown;
  position?: number | null;
  [key: string]: unknown;
}

/**
 * Ordena recursivamente as chaves de objetos para garantir serialização JSON canônica e estável.
 */
function stableSort(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = stableSort(obj[key]);
  }
  return result;
}

/**
 * Devolve uma string JSON estável contendo SÓ o que o save() grava:
 * - do formulário: title, description, slug, theme, max_responses, closes_at, consent_text, success_message, status
 * - de cada pergunta, na ordem da lista: id, label, help_text, field_type, required, options, position
 */
export function editorSnapshot(
  form: FormSnapshotInput | null | undefined,
  questions: QuestionSnapshotInput[] | null | undefined,
): string {
  if (!form) return "";

  const canonical = {
    form: {
      title: form.title ?? "",
      description: form.description ?? "",
      slug: form.slug ?? "",
      theme: form.theme ?? null,
      max_responses: form.max_responses ?? null,
      closes_at: form.closes_at ?? null,
      consent_text: form.consent_text ?? null,
      success_message: form.success_message ?? null,
      status: form.status ?? "",
    },
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      label: q.label ?? "",
      help_text: q.help_text ?? "",
      field_type: q.field_type ?? "",
      required: Boolean(q.required),
      options: Array.isArray(q.options) ? q.options : [],
      position: q.position ?? 0,
    })),
  };

  return JSON.stringify(stableSort(canonical));
}

/**
 * Devolve se o editor possui alterações não salvas.
 * saved !== null && current !== saved
 */
export function isEditorDirty(current: string, saved: string | null): boolean {
  return saved !== null && current !== saved;
}
