export const RESERVED_SLUGS = [
  "auth",
  "painel",
  "formularios",
  "api",
  "saude",
  "admin",
  "assets",
  "login",
  "editar",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

/**
 * Normaliza uma string gerando um slug seguro para uso geral (títulos, arquivos exportados).
 */
export function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "formulario"
  );
}

/**
 * Valida se um slug cumpre todas as regras do sistema (formato, tamanho e nomes reservados).
 * Retorna mensagem de erro em pt-BR ou null se for válido.
 */
export function validateSlug(value: string): string | null {
  if (RESERVED_SLUGS.includes(value as ReservedSlug)) {
    return "Esse nome é reservado pelo sistema";
  }
  if (value.length < 3 || value.length > 60) {
    return "O endereço deve ter entre 3 e 60 caracteres.";
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) {
    return "Use apenas letras minúsculas, números e hífens.";
  }
  return null;
}

/**
 * Sugere um slug legível a partir de um título e sufixo opcional (ex.: ID aleatório).
 */
export function suggestSlug(title: string, suffix?: string): string {
  const trimmedSuffix = suffix?.trim();
  let result: string;

  if (trimmedSuffix) {
    const cleanSuffix = slug(trimmedSuffix).replace(/^-+|-+$/g, "");
    const maxBaseLength = Math.max(0, 60 - (cleanSuffix.length + 1));
    const base = slug(title);
    const trimmedBase = base.slice(0, maxBaseLength).replace(/^-+|-+$/g, "");
    result = trimmedBase ? `${trimmedBase}-${cleanSuffix}` : cleanSuffix;
  } else {
    result = slug(title);
  }

  result = result.replace(/^-+|-+$/g, "").slice(0, 60).replace(/^-+|-+$/g, "");

  if (!result) {
    result = "formulario";
  } else if (result.length < 3) {
    result = `${result}-formulario`;
  }

  return result;
}

/**
 * Sanitiza o valor enquanto o usuário digita no campo:
 * remove acentos, converte para minúsculas, troca caracteres especiais e espaços por hífen,
 * remove hífen inicial mas mantém hífen no fim temporariamente. Corta em 60 caracteres.
 */
export function sanitizeSlugInput(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60);
}

/**
 * Remove hífens residuais nas pontas (início e fim) ao sair do campo (blur).
 */
export function trimSlugEdges(input: string): string {
  return input.replace(/^-+|-+$/g, "");
}
