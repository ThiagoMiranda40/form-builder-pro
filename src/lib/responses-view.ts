/**
 * Determina se uma inscrição foi editada com base na diferença temporal
 * entre a data de envio original e a data da última atualização.
 *
 * Retorna verdadeiro apenas se updatedAt for estritamente mais de 1 segundo (1000 ms)
 * posterior a submittedAt.
 */
export function isEdited(
  submittedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): boolean {
  if (!submittedAt || !updatedAt) return false;

  const subTime = new Date(submittedAt).getTime();
  const updTime = new Date(updatedAt).getTime();

  if (isNaN(subTime) || isNaN(updTime)) return false;

  return updTime - subTime > 1000;
}

/**
 * Devolve o primeiro valor de texto não vazio das respostas, na ordem das perguntas
 * (aparado e limitado a 60 caracteres, com reticências se cortar);
 * sem nenhum, devolve "esta pessoa".
 */
export function describeResponse(
  questions?: Array<{ id: string; [key: string]: unknown }> | null,
  answers?: Record<string, unknown> | null,
): string {
  if (!questions || !answers) return "esta pessoa";

  for (const q of questions) {
    const val = answers[q.id];
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.length > 0) {
        return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
      }
    }
  }

  return "esta pessoa";
}
