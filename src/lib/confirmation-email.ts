import { isValidEmail } from "./validators";
import { hideDocument } from "./inscricao";
import { formatAnswer } from "./answer-format";

/**
 * Escapa caracteres especiais HTML para prevenir XSS em e-mails (SEC-09).
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Valida se o destinatário de e-mail é seguro para envio (SEC-09).
 * Impede injeção de múltiplos destinatários, quebras de linha e headers inválidos.
 */
export function isSafeRecipient(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  if (email.length > 254) return false;

  // Caracteres proibidos que poderiam causar split ou injeção de cabeçalhos
  if (/[\r\n\t\0,;<>" ]/.test(email)) return false;

  return isValidEmail(email.trim());
}

export interface QuestionSummaryEmail {
  id: string;
  label: string;
  field_type?: string;
  type?: string;
  position: number;
}

export interface BuildConfirmationEmailParams {
  form: {
    title: string;
    event_date?: string | null;
    event_time?: string | null;
    event_location?: string | null;
  };
  questions: QuestionSummaryEmail[];
  answers: Record<string, unknown>;
  editUrl: string;
  kind?: "confirmada" | "atualizada";
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Constrói o e-mail transacional de confirmação ou atualização de inscrição em pt-BR.
 * Garante:
 * - Sem quebras de linha no assunto (anti-header injection).
 * - CPF e RG mascarados com hideDocument (SEC-03).
 * - Textos escapados com escapeHtml (SEC-09).
 * - Sem imagens externas ou rastreadores de abertura.
 */
export function buildConfirmationEmail(params: BuildConfirmationEmailParams): BuiltEmail {
  const isUpdate = params.kind === "atualizada";
  const cleanTitle = (params.form.title || "Formulário").replace(/[\r\n]+/g, " ").trim();
  const subjectPrefix = isUpdate ? "Inscrição atualizada" : "Inscrição confirmada";
  const subject = `${subjectPrefix} — ${cleanTitle}`;

  let eventLine: string | null = null;
  if (params.form.event_date) {
    const parts = params.form.event_date.split("-");
    const formattedDate =
      parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : params.form.event_date;
    let line = `Evento: ${formattedDate}`;
    if (params.form.event_time && params.form.event_time.trim()) {
      line += ` às ${params.form.event_time.trim()}`;
    }
    if (params.form.event_location && params.form.event_location.trim()) {
      line += ` · ${params.form.event_location.trim()}`;
    }
    eventLine = line;
  }

  const introText = isUpdate
    ? "Suas respostas foram atualizadas."
    : "Recebemos sua inscrição.";

  const sortedQuestions = [...params.questions].sort((a, b) => a.position - b.position);

  // Monta lista de respostas formatadas
  const responseItems: Array<{ label: string; valueFormatted: string }> = [];

  for (const q of sortedQuestions) {
    const rawVal = params.answers[q.id];
    const fieldType = q.field_type ?? q.type ?? "";
    let formattedVal = "";

    if (rawVal === undefined || rawVal === null || rawVal === "") {
      formattedVal = "—";
    } else if (Array.isArray(rawVal)) {
      formattedVal = rawVal.length > 0 ? rawVal.join(", ") : "—";
    } else {
      const strVal = String(rawVal);
      if (fieldType === "cpf" || fieldType === "rg") {
        formattedVal = hideDocument(strVal);
      } else if (fieldType === "date" || fieldType === "birthdate") {
        formattedVal = formatAnswer(fieldType, strVal);
      } else {
        formattedVal = strVal;
      }
    }


    responseItems.push({
      label: q.label || "Pergunta",
      valueFormatted: formattedVal,
    });
  }

  // HTML
  const htmlItems = responseItems
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">${escapeHtml(item.label)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${escapeHtml(item.valueFormatted)}</td>
        </tr>`
    )
    .join("\n");

  const safeEditUrl = escapeHtml(params.editUrl);
  const eventLineHtml = eventLine
    ? `\n    <p style="font-size: 14px; font-weight: 600; margin-top: 0; margin-bottom: 12px; color: #374151;">${escapeHtml(eventLine)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 24px;">
    <h1 style="font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px; color: #111827;">${escapeHtml(cleanTitle)}</h1>${eventLineHtml}
    <p style="font-size: 15px; margin-top: 0; margin-bottom: 20px; color: #4b5563;">${escapeHtml(introText)}</p>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
      <tbody>
        ${htmlItems}
      </tbody>
    </table>

    <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; margin-top: 24px;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151; font-weight: 600;">Para corrigir seus dados, acesse:</p>
      <a href="${safeEditUrl}" style="color: #4f46e5; word-break: break-all; font-size: 14px; text-decoration: underline;">${safeEditUrl}</a>
    </div>

    <p style="font-size: 12px; color: #9ca3af; margin-top: 24px; margin-bottom: 0;">Este é um e-mail automático. Por favor, não responda a esta mensagem.</p>
  </div>
</body>
</html>`;

  // Versão em texto puro
  const textItems = responseItems
    .map((item) => `- ${item.label}: ${item.valueFormatted}`)
    .join("\n");

  const eventLineText = eventLine ? `\n${eventLine}` : "";

  const text = `${cleanTitle}${eventLineText}
${introText}

Resumo dos dados enviados:
${textItems}

Para corrigir seus dados, acesse:
${params.editUrl}

Este é um e-mail automático. Por favor, não responda a esta mensagem.`;

  return { subject, html, text };
}

export interface SendConfirmationEmailParams {
  fetchFn?: typeof fetch;
  apiKey?: string;
  from?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Envia o e-mail de confirmação via API REST do Resend.
 * Não lança exceção em caso de erro (falha de rede ou resposta não-2xx); retorna false.
 */
export async function sendConfirmationEmail(params: SendConfirmationEmailParams): Promise<boolean> {
  const { fetchFn, apiKey, from, to, subject, html, text } = params;

  if (!apiKey || !from || !to || !isSafeRecipient(to)) {
    return false;
  }

  const fn = fetchFn ?? fetch;

  try {
    const res = await fn("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    return res.ok;
  } catch {
    // Falha silenciosa: nunca quebra a inscrição (SEC-09)
    return false;
  }
}
