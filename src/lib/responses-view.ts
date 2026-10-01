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
