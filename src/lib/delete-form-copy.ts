// src/lib/delete-form-copy.ts

export interface DeleteFormCopyParams {
  title: string;
  responses: number;
  status: string;
}

export interface DeleteFormCopyResult {
  heading: string;
  description: string;
  openWarning: string | null;
  requireAck: boolean;
  ackLabel: string | null;
  confirmLabel: string;
  pendingLabel: string;
}

/**
 * Função pura que calcula os textos e estados para o diálogo de exclusão de formulário.
 * - Formata o título com aspas curvas “ e ”, cortando em 80 caracteres com "…" se maior.
 * - Trata responses inválido (negativo, não inteiro ou NaN) como 0.
 * - Gera a descrição contextual com base na quantidade de respostas.
 * - Gera aviso se o formulário estiver com status "published".
 * - Controla a obrigatoriedade e o rótulo da caixa de confirmação de perda de dados.
 */
export function deleteFormCopy({
  title,
  responses,
  status,
}: DeleteFormCopyParams): DeleteFormCopyResult {
  const heading = "Excluir este formulário?";
  const confirmLabel = "Excluir";
  const pendingLabel = "Excluindo...";

  // Higienização de responses
  const safeResponses =
    typeof responses === "number" &&
    !isNaN(responses) &&
    Number.isInteger(responses) &&
    responses > 0
      ? responses
      : 0;

  // Formatação de título: aspas curvas e corte em 80 caracteres com reticências
  const rawTitle = title ?? "";
  const truncatedTitle =
    rawTitle.length > 80 ? `${rawTitle.slice(0, 80)}…` : rawTitle;
  const formattedTitle = `“${truncatedTitle}”`;

  // Descrição
  let description: string;
  if (safeResponses === 0) {
    description = `O formulário ${formattedTitle} e as suas perguntas serão apagados. Esta ação não pode ser desfeita.`;
  } else if (safeResponses === 1) {
    description = `O formulário ${formattedTitle}, as suas perguntas e a 1 resposta recebida serão apagados. Esta ação não pode ser desfeita. Se precisar dos dados, exporte as respostas antes.`;
  } else {
    description = `O formulário ${formattedTitle}, as suas perguntas e as ${safeResponses} respostas recebidas serão apagados. Esta ação não pode ser desfeita. Se precisar dos dados, exporte as respostas antes.`;
  }

  // Aviso quando o formulário está publicado
  const openWarning =
    status === "published"
      ? "O formulário está aberto: o link de inscrição deixará de funcionar na hora."
      : null;

  // Caixa de confirmação de ciência
  const requireAck = safeResponses > 0;
  let ackLabel: string | null = null;
  if (safeResponses === 1) {
    ackLabel = "Entendo que a resposta recebida também será apagada";
  } else if (safeResponses > 1) {
    ackLabel = `Entendo que as ${safeResponses} respostas recebidas também serão apagadas`;
  }

  return {
    heading,
    description,
    openWarning,
    requireAck,
    ackLabel,
    confirmLabel,
    pendingLabel,
  };
}
