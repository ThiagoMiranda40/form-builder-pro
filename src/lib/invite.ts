import { parseBrazilMobile } from "./whatsapp";
import { findNameQuestion, type TableQuestion } from "./responses-table";
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
