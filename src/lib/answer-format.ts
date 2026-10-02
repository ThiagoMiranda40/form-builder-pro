/**
 * Formata valores de respostas de acordo com o tipo de campo do formulário.
 * Regras:
 * - Lista de strings -> itens unidos por ", "
 * - null ou undefined -> ""
 * - quando fieldType for "date" e o valor casar com /^\d{4}-\d{2}-\d{2}$/ -> "dd/mm/aaaa" por manipulação direta de texto (sem new Date, para não sofrer desvio de fuso)
 * - qualquer outro valor volta como veio (string)
 */
export function formatAnswer(
  fieldType: string | undefined,
  value: string | string[] | undefined | null,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  const strValue = String(value);

  if (fieldType === "date") {
    const match = strValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }

  return strValue;
}
