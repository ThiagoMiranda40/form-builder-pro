export const SITE_URL = "https://inscricoes.corretime.com.br";
export const SITE_TITLE = "Inscrições | Corre Time";
export const SITE_DESCRIPTION =
  "Faça sua inscrição online e corrija seus dados depois pelo link que enviamos ao seu e-mail.";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const DEFAULT_FORM_TITLE = "Formulário de inscrição";
export const DEFAULT_FORM_DESCRIPTION =
  "Preencha seus dados para concluir a inscrição neste formulário.";
export const DEFAULT_FORM_OG_TITLE = "Formulário de inscrição";
export const DEFAULT_FORM_OG_DESCRIPTION =
  "Preencha seus dados para concluir a inscrição.";

export const CLIENT_LINK_TAB_TITLE = "Inscrições recebidas | Corre Time";
export const CLIENT_LINK_OG_TITLE =
  "NÃO COMPARTILHE: lista de inscritos | Corre Time";
export const CLIENT_LINK_DESCRIPTION =
  "Acesso restrito, só leitura, com dados pessoais. Não é o link de inscrição.";

export interface ClientLinkMetaResult {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
}

/**
 * Constrói metadados estáticos e genéricos para o link do cliente (/c/$token) (T-39).
 */
export function buildClientLinkMeta(): ClientLinkMetaResult {
  return {
    title: CLIENT_LINK_TAB_TITLE,
    description: CLIENT_LINK_DESCRIPTION,
    ogTitle: CLIENT_LINK_OG_TITLE,
    ogDescription: CLIENT_LINK_DESCRIPTION,
  };
}

export interface FormMetaPayload {
  state?: string | null;
  form?: {
    title?: string | null;
    description?: string | null;
  } | null;
}

export interface FormMetaResult {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
}

function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function truncateTitle(title: string): string {
  if (title.length <= 70) return title;
  return title.slice(0, 70) + "…";
}

function truncateDescription(text: string): string {
  if (text.length <= 160) return text;
  if (text[160] === " ") {
    return text.slice(0, 160) + "…";
  }
  const sub = text.slice(0, 160);
  const lastSpace = sub.lastIndexOf(" ");
  if (lastSpace > 0) {
    return sub.slice(0, lastSpace) + "…";
  }
  return sub + "…";
}

/**
 * Constrói metadados (title, description, og:title, og:description) para a rota pública do formulário (T-19).
 */
export function buildFormMeta(payload?: FormMetaPayload | null): FormMetaResult {
  const isValidState =
    payload?.state === "open" ||
    payload?.state === "closed" ||
    payload?.state === "full";

  const rawTitle = payload?.form?.title?.trim();

  if (!isValidState || !rawTitle) {
    return {
      title: DEFAULT_FORM_TITLE,
      description: DEFAULT_FORM_DESCRIPTION,
      ogTitle: DEFAULT_FORM_OG_TITLE,
      ogDescription: DEFAULT_FORM_OG_DESCRIPTION,
    };
  }

  const normalizedTitle = normalizeWhitespace(rawTitle);
  const ogTitle = truncateTitle(normalizedTitle);
  const title = `${ogTitle} | Corre Time`;

  const rawDesc = payload?.form?.description?.trim();
  let description = DEFAULT_FORM_DESCRIPTION;
  let ogDescription = DEFAULT_FORM_OG_DESCRIPTION;

  if (rawDesc) {
    const normalizedDesc = normalizeWhitespace(rawDesc);
    const truncatedDesc = truncateDescription(normalizedDesc);
    description = truncatedDesc;
    ogDescription = truncatedDesc;
  }

  return {
    title,
    description,
    ogTitle,
    ogDescription,
  };
}
