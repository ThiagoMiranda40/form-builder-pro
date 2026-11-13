import { firstNameOf, parseBrazilMobile, whatsappUrl } from "./whatsapp";
import { findNameQuestion, type TableQuestion } from "./responses-table";
import { findEmailQuestionWithAnswer } from "./admin-response";
import { isSafeRecipient } from "./confirmation-email";
import { slug } from "./slug";

export interface VcfContactInput {
  name: string;
  phone: string;
}

const MAX_VCF_NAME_LENGTH = 100;

/**
 * Sanitiza e escapa o nome de um contato para o formato vCard 3.0 (RFC 2426 / SEC-43):
 * - Normaliza quebras de linha (\r\n e \r para \n);
 * - Converte tabulações em espaço e remove caracteres de controle ASCII (exceto \n);
 * - Apara espaços nas pontas e limita a 100 caracteres;
 * - Nome vazio após limpeza vira "Inscrito";
 * - Escapa \, ;, , e \n (nessa ordem) para impedir injeção de campos ou cartões extras.
 */
function escapeVcfName(rawName: unknown): string {
  const str = typeof rawName === "string" ? rawName : "";
  const cleaned = str
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_VCF_NAME_LENGTH)
    .trim();

  const effective = cleaned.length > 0 ? cleaned : "Inscrito";

  return effective
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Gera o conteúdo de um arquivo .vcf (vCard 3.0) separado por CRLF (\r\n).
 * Inclui apenas contatos cujo telefone seja validado como celular brasileiro por parseBrazilMobile.
 */
export function buildVcf(contacts: VcfContactInput[]): string {
  if (!Array.isArray(contacts) || contacts.length === 0) return "";

  const cards: string[] = [];

  for (const item of contacts) {
    if (!item) continue;
    const parsedPhone = parseBrazilMobile(item.phone);
    if (!parsedPhone) continue;

    const escapedName = escapeVcfName(item.name);
    const e164Phone = `+55${parsedPhone.ddd}${parsedPhone.number}`;

    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${escapedName}`,
      `N:${escapedName};;;;`,
      `TEL;TYPE=CELL:${e164Phone}`,
      "END:VCARD",
    ];
    cards.push(lines.join("\r\n"));
  }

  if (cards.length === 0) return "";
  return `${cards.join("\r\n")}\r\n`;
}

/**
 * Localiza a pergunta de telefone do formulário usando o mesmo critério do botão de WhatsApp
 * em ResponseDetailDialog.tsx (linha 94: q.field_type === "phone").
 */
export function findPhoneQuestion(questions: TableQuestion[]): TableQuestion | null {
  if (!Array.isArray(questions)) return null;
  return questions.find((q) => q.field_type === "phone") ?? null;
}

/**
 * Extrai a lista de contatos (nome + celular brasileiro válido) a partir das perguntas
 * e respostas carregadas do formulário.
 */
export function extractVcfContacts(
  questions: TableQuestion[],
  responses: { answers: Record<string, string | string[]> }[],
): VcfContactInput[] {
  const phoneQ = findPhoneQuestion(questions);
  if (!phoneQ || !Array.isArray(responses)) return [];

  const nameQ = findNameQuestion(questions);
  const result: VcfContactInput[] = [];

  for (const r of responses) {
    const rawPhone = r.answers?.[phoneQ.id];
    const phoneStr = Array.isArray(rawPhone)
      ? rawPhone.join("")
      : typeof rawPhone === "string"
        ? rawPhone
        : "";

    if (!parseBrazilMobile(phoneStr)) continue;

    const rawName = nameQ ? r.answers?.[nameQ.id] : "";
    const nameStr = Array.isArray(rawName)
      ? rawName.join(" ")
      : typeof rawName === "string"
        ? rawName
        : "";

    result.push({ name: nameStr, phone: phoneStr });
  }

  return result;
}

/**
 * Gera o nome do arquivo .vcf a partir do título do formulário:
 * contatos-<título em minúsculas sem acento e com hífens>.vcf
 */
export function vcfFilename(formTitle: string): string {
  return `contatos-${slug(formTitle)}.vcf`;
}

const GROUP_LINK_REGEX = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/;
const MAX_GROUP_LINK_LENGTH = 200;
const MAX_FORM_TITLE_IN_MESSAGE = 80;
const MAX_SUBJECT_LENGTH = 120;

/**
 * Valida o link de convite do grupo do WhatsApp (RF-17, ARQ-07, SEC-38).
 * Aceita apenas https://chat.whatsapp.com/<código alfanumérico> com até 200 caracteres após trim.
 * String vazia após trim devolve { ok: true, link: "" } (tratado pelo chamador como remover link).
 */
export function validateGroupLink(
  input: unknown,
): { ok: true; link: string } | { ok: false } {
  if (typeof input !== "string") {
    return { ok: false };
  }

  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: true, link: "" };
  }

  if (trimmed.length > MAX_GROUP_LINK_LENGTH) {
    return { ok: false };
  }

  if (!GROUP_LINK_REGEX.test(trimmed)) {
    return { ok: false };
  }

  return { ok: true, link: trimmed };
}

/**
 * Cinco variações de redação em português do Brasil para o convite individual via WhatsApp (RF-20, QA-46-29).
 * Todas incluem {primeiro nome}, {título} e {link}, variando abertura, ordem e fecho.
 */
export const INVITE_MESSAGE_VARIANTS: readonly [string, string, string, string, string] = [
  'Oi, {primeiro nome}! Aqui é a organização de "{título}". Entre no nosso grupo de avisos do evento: {link}',
  'Olá, {primeiro nome}! Segue o convite para o grupo de avisos de "{título}": {link} Nos vemos no evento.',
  '{primeiro nome}, tudo bem? Para acompanhar os avisos de "{título}", acesse o grupo da organização pelo link: {link}',
  'Bom dia, {primeiro nome}! O grupo de comunicados de "{título}" já está aberto. Entre por aqui para receber as informações: {link}',
  'Olá, {primeiro nome}! Confirmamos sua inscrição em "{título}". Caso queira receber os avisos no celular, entre no grupo do evento: {link}',
];

/**
 * Hash determinístico FNV-1a de 32 bits sobre o responseId para escolher a variação sem Math.random.
 */
function stableVariantIndex(responseId: string, count: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < responseId.length; i++) {
    hash ^= responseId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % count;
}

/**
 * Escolhe de forma estável uma das 5 variações de mensagem pelo responseId e substitui
 * {primeiro nome}, {título} (cortado em 80 caracteres) e {link}.
 */
export function pickInviteMessage(
  responseId: string,
  firstName: string,
  formTitle: string,
  link: string,
): string {
  const idStr = typeof responseId === "string" ? responseId : String(responseId ?? "");
  const index = stableVariantIndex(idStr, INVITE_MESSAGE_VARIANTS.length);
  const template = INVITE_MESSAGE_VARIANTS[index] ?? INVITE_MESSAGE_VARIANTS[0];

  const cleanName = firstNameOf(firstName);
  const rawTitle = typeof formTitle === "string" ? formTitle.trim() : "";
  const truncatedTitle =
    rawTitle.length > MAX_FORM_TITLE_IN_MESSAGE
      ? `${rawTitle.slice(0, MAX_FORM_TITLE_IN_MESSAGE)}…`
      : rawTitle;
  const cleanLink = typeof link === "string" ? link.trim() : "";

  return template
    .replace(/\{primeiro nome\}/g, () => cleanName)
    .replace(/\{título\}/g, () => truncatedTitle)
    .replace(/\{link\}/g, () => cleanLink);
}

/**
 * Monta a URL https://wa.me/55<DDD><número>?text=<codificado> reusando whatsappUrl.
 * Devolve null se o telefone não for um celular brasileiro válido (11 dígitos com 9 inicial).
 */
export function buildInviteWhatsappUrl(
  rawPhone: unknown,
  message: string,
): string | null {
  return whatsappUrl(rawPhone, message);
}

export interface EligibleInviteRecipient {
  id: string;
  firstName: string;
  email: string | null;
  phone: string | null;
}

/**
 * Extrai a lista de destinatários elegíveis a partir das respostas e perguntas do formulário:
 * - firstName extraído da pergunta de nome via findNameQuestion + firstNameOf;
 * - email validado por findEmailQuestionWithAnswer + isSafeRecipient;
 * - phone validado por findPhoneQuestion + parseBrazilMobile;
 * Não copia nenhum outro campo da resposta.
 */
export function pickEligible(
  responses: { id: string; answers: Record<string, unknown> | null | undefined }[],
  questions: TableQuestion[],
): EligibleInviteRecipient[] {
  if (!Array.isArray(responses) || !Array.isArray(questions)) return [];

  const nameQ = findNameQuestion(questions);
  const phoneQ = findPhoneQuestion(questions);

  return responses.map((r) => {
    const answers = r.answers ?? {};

    const rawName = nameQ ? answers[nameQ.id] : "";
    const nameStr = Array.isArray(rawName)
      ? rawName.join(" ")
      : typeof rawName === "string"
        ? rawName
        : "";
    const firstName = firstNameOf(nameStr);

    const emailMatch = findEmailQuestionWithAnswer(questions, answers);
    const email =
      emailMatch && isSafeRecipient(emailMatch.email) ? emailMatch.email : null;

    const rawPhone = phoneQ ? answers[phoneQ.id] : "";
    const phoneStr = Array.isArray(rawPhone)
      ? rawPhone.join("")
      : typeof rawPhone === "string"
        ? rawPhone
        : "";
    const parsedPhone = parseBrazilMobile(phoneStr);
    const phone = parsedPhone ? `${parsedPhone.ddd}${parsedPhone.number}` : null;

    return {
      id: r.id,
      firstName,
      email,
      phone,
    };
  });
}

/**
 * Divide uma lista em fatias de até `size` elementos (padrão 50).
 */
export function chunk<T>(items: readonly T[], size = 50): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const step = size > 0 ? Math.floor(size) : 50;
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += step) {
    result.push(items.slice(i, i + step));
  }
  return result;
}

/**
 * Remove caracteres de controle ASCII (convertendo quebras de linha e tabs em espaço)
 * e limita o assunto de e-mail a 120 caracteres (SEC-42).
 */
export function sanitizeSubject(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_SUBJECT_LENGTH);
}
