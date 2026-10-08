import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { suggestSlug, mapSlugDbError } from "@/lib/slug";

export type FormRow = Database["public"]["Tables"]["forms"]["Row"];
export type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];

/**
 * Constrói o título do formulário clonado adicionando sufixo sequencial.
 * - título simples -> "${título} (cópia)"
 * - se terminar em " (cópia)" -> "${título base} (cópia 2)"
 * - se terminar em " (cópia N)" -> "${título base} (cópia N+1)"
 * - limite máximo de 120 caracteres: trunca a base original preservando o sufixo inteiro.
 */
export function buildCloneTitle(title: string): string {
  const match = title.match(/ \(cópia(?: (\d+))?\)$/);
  let base = title;
  let suffix = " (cópia)";

  if (match) {
    base = title.slice(0, title.length - match[0].length);
    if (match[1]) {
      const currentNumber = parseInt(match[1], 10);
      suffix = ` (cópia ${currentNumber + 1})`;
    } else {
      suffix = " (cópia 2)";
    }
  }

  const maxBaseLength = Math.max(0, 120 - suffix.length);
  const truncatedBase = base.slice(0, maxBaseLength);
  return `${truncatedBase}${suffix}`;
}

/**
 * Gera o payload de inserção do novo formulário clonado.
 * Retorna SOMENTE as chaves permitidas, com status "draft" e prazos/tokens zerados.
 */
export function buildCloneFormPayload(
  source: Partial<FormRow> & { title: string },
  ownerId: string,
  suffix: string
) {
  const newTitle = buildCloneTitle(source.title ?? "");
  const newSlug = suggestSlug(newTitle, suffix);
  const clonedTheme =
    source.theme !== undefined && source.theme !== null
      ? JSON.parse(JSON.stringify(source.theme))
      : null;

  return {
    owner_id: ownerId,
    title: newTitle,
    slug: newSlug,
    status: "draft" as const,
    description: source.description ?? null,
    theme: clonedTheme,
    consent_text: source.consent_text ?? null,
    success_message: source.success_message ?? null,
    max_responses: source.max_responses ?? null,
    closes_at: null,
    share_token: null,
    edit_window_hours: null,
    event_date: null,
    event_time: null,
    event_location: null,
  };
}

/**
 * Constrói a lista de perguntas para o novo formulário clonado.
 * Ordena por position, reindexa de 0..n-1 e remove id/created_at.
 * Não muta a entrada original.
 */
export function buildCloneQuestions(
  questions: Array<Partial<QuestionRow> & { label: string; field_type: QuestionRow["field_type"] }>,
  newFormId: string
) {
  if (!questions || questions.length === 0) {
    return [];
  }

  const sorted = [...questions].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return sorted.map((q, index) => ({
    form_id: newFormId,
    label: q.label,
    help_text: q.help_text !== undefined ? q.help_text : null,
    field_type: q.field_type,
    required: Boolean(q.required),
    options:
      q.options !== undefined && q.options !== null
        ? JSON.parse(JSON.stringify(q.options))
        : null,
    position: index,
    settings:
      q.settings !== undefined && q.settings !== null
        ? JSON.parse(JSON.stringify(q.settings))
        : {},
  }));
}

/**
 * Duplica um formulário existente e todas as suas perguntas para o proprietário autenticado.
 * - Lê formulário de origem (se inexistente/outro dono, lança erro)
 * - Lê perguntas na ordem
 * - Insere novo formulário com sufixo aleatório (tenta até 3 vezes em caso de colisão de slug)
 * - Insere perguntas de uma vez; se falhar, apaga o formulário criado
 * - NUNCA acessa a tabela `responses`.
 */
export async function cloneForm(
  client: SupabaseClient<Database> | any,
  ownerId: string,
  sourceId: string
): Promise<{ id: string; slug: string }> {
  // 1. Lê o formulário de origem
  const { data: sourceForm, error: formError } = await client
    .from("forms")
    .select("id, owner_id, title, description, theme, consent_text, success_message, max_responses")
    .eq("id", sourceId)
    .single();

  if (formError || !sourceForm || sourceForm.owner_id !== ownerId) {
    throw new Error("Formulário não encontrado.");
  }

  // 2. Lê as perguntas de origem ordenadas por posição
  const questionsQuery = client
    .from("questions")
    .select("id, form_id, label, help_text, field_type, required, options, position")
    .eq("form_id", sourceId)
    .order("position");

  // Suporte a mocks nos testes onde order() retorna função assíncrona ou Promise direta
  const questionsRes =
    typeof questionsQuery.order === "function"
      ? questionsQuery.order("position")
      : questionsQuery;

  const { data: rawQuestions, error: questionsSelectError } =
    typeof questionsRes === "function"
      ? await questionsRes()
      : await questionsRes;

  if (questionsSelectError) {
    throw new Error("Não foi possível duplicar o formulário.");
  }

  // 3. Insere o novo formulário com até 3 tentativas de resolução de slug
  let newForm: { id: string; slug: string } | null = null;
  let attempts = 0;

  while (attempts < 3) {
    attempts++;
    const suffix = Math.random().toString(36).slice(2, 8);
    const formPayload = buildCloneFormPayload(sourceForm, ownerId, suffix);

    const { data: insertedForm, error: insertError } = await client
      .from("forms")
      .insert(formPayload)
      .select("id, slug")
      .single();

    if (insertError) {
      const isSlugConflict =
        insertError.code === "23505" ||
        mapSlugDbError(insertError) === "Esse endereço já está em uso";

      if (isSlugConflict && attempts < 3) {
        continue;
      }

      throw new Error("Não foi possível duplicar o formulário.");
    }

    if (insertedForm) {
      newForm = insertedForm;
      break;
    }
  }

  if (!newForm) {
    throw new Error("Não foi possível duplicar o formulário.");
  }

  // 4. Insere as perguntas do formulário duplicado
  const questionsPayload = buildCloneQuestions(rawQuestions ?? [], newForm.id);

  if (questionsPayload.length > 0) {
    const { error: questionsInsertError } = await client
      .from("questions")
      .insert(questionsPayload);

    if (questionsInsertError) {
      // Apaga o formulário criado em caso de falha nas perguntas
      await client.from("forms").delete().eq("id", newForm.id);
      throw new Error("Não foi possível duplicar o formulário.");
    }
  }

  return {
    id: newForm.id,
    slug: newForm.slug,
  };
}
