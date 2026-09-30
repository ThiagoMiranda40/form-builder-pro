import { onlyDigits } from "./validators";

export interface QuestionSummary {
  id: string;
  field_type?: string;
  type?: string;
  position: number;
  [key: string]: unknown;
}

/**
 * Normaliza um valor de CPF deixando apenas dígitos.
 * Retorna null se for vazio, nulo ou não contiver dígitos.
 */
export function normalizeCPF(value?: string | null): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  return digits.length > 0 ? digits : null;
}

/**
 * Encontra a primeira pergunta do tipo "cpf" em uma lista de perguntas,
 * ordenando por `position` crescente.
 */
export function findIdentifierQuestion<T extends { position: number; field_type?: string; type?: string }>(
  questions: T[]
): T | undefined {
  return [...questions]
    .sort((a, b) => a.position - b.position)
    .find((q) => (q.field_type ?? q.type) === "cpf");
}

/**
 * Encontra a primeira pergunta do tipo "email" em uma lista de perguntas,
 * ordenando por `position` crescente.
 */
export function findEmailQuestion<T extends { position: number; field_type?: string; type?: string }>(
  questions: T[]
): T | undefined {
  return [...questions]
    .sort((a, b) => a.position - b.position)
    .find((q) => (q.field_type ?? q.type) === "email");
}

/**
 * Mascara CPF e RG para exibição segura em telas e e-mails (SEC-03).
 * Preserva caracteres de pontuação e mantém apenas os últimos 2 alfanuméricos visíveis.
 * Se tiver 2 ou menos caracteres alfanuméricos, mascara todos.
 */
export function hideDocument(value: string): string {
  if (!value) return "";
  const alphanumerics = value.match(/[a-zA-Z0-9]/g) || [];
  if (alphanumerics.length <= 2) {
    return value.replace(/[a-zA-Z0-9]/g, "*");
  }

  let seen = 0;
  const keepFromIndex = alphanumerics.length - 2;
  return value.replace(/[a-zA-Z0-9]/g, (char) => {
    if (seen < keepFromIndex) {
      seen++;
      return "*";
    }
    seen++;
    return char;
  });
}

/**
 * Detecta preenchimento do campo invisível honeypot (anti-bot).
 * Retorna true se houver algum valor não vazio.
 */
export function isHoneypotFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value);
}

export interface SubmitStatusResult {
  ok: boolean;
  error?: string;
  field?: string;
}

/**
 * Mapeia o status de retorno da submissão/atualização no banco em mensagens amigáveis em pt-BR.
 */
export function mapSubmitStatus(status: string): SubmitStatusResult {
  switch (status) {
    case "ok":
      return { ok: true };
    case "duplicate":
      return {
        ok: false,
        error: "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador.",
        field: "cpf",
      };
    case "consent_required":
      return {
        ok: false,
        error: "É necessário aceitar o termo para continuar.",
        field: "__consent",
      };
    case "full":
      return {
        ok: false,
        error: "O limite de inscrições foi atingido.",
      };
    case "closed":
      return {
        ok: false,
        error: "O prazo de preenchimento encerrou.",
      };
    case "unavailable":
      return {
        ok: false,
        error: "Este formulário não está disponível.",
      };
    default:
      return {
        ok: false,
        error: "Não foi possível concluir a inscrição. Tente novamente.",
      };
  }
}
