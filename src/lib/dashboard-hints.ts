/**
 * Dicas e textos explicativos (tooltips) para os cards estatísticos,
 * gráfico de barras e blocos informativos (T-27 / M-26 e M-29).
 */

export const DASHBOARD_CARD_HINTS = {
  PUBLISHED_FORMS:
    "Formulários com status publicado, entre todos os seus formulários.",
  TOTAL_RESPONSES:
    "Soma das respostas de todos os formulários, abertos, rascunhos e encerrados.",
  RESPONSES_7_DAYS:
    "Respostas enviadas nos últimos 7 dias, hoje incluído, em todos os formulários.",
  CLOSING_SOON:
    "Formulários com prazo de encerramento nos próximos 3 dias.",
} as const;

export const PUBLIC_FORM_HINTS = {
  SLOTS:
    "Vagas ainda disponíveis neste formulário. Quando restam 10 ou menos, aparece o aviso Últimas vagas.",
  DEADLINE:
    "Data e hora limite para enviar a inscrição, no horário de Brasília.",
} as const;

/**
 * Monta o texto descritivo e acessível para a dica de uma barra do gráfico.
 * Exemplo com isToday: "sexta-feira, 02/10/2026 (hoje): 35 respostas"
 * Exemplo sem isToday: "quinta-feira, 01/10/2026: 1 resposta"
 */
export function barHint(
  item: { weekdayName: string; isoDate: string; total: number },
  isToday: boolean,
): string {
  const [year, month, day] = item.isoDate.split("-");
  const dateFormatted = `${day}/${month}/${year}`;
  const responseSuffix = item.total === 1 ? "1 resposta" : `${item.total} respostas`;
  const todaySuffix = isToday ? " (hoje)" : "";

  return `${item.weekdayName}, ${dateFormatted}${todaySuffix}: ${responseSuffix}`;
}
