export type FieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "email"
  | "phone"
  | "cpf"
  | "rg"
  | "date"
  | "single_choice"
  | "multi_choice";

export const FIELD_TYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: "short_text", label: "Texto curto", hint: "Resposta em uma linha" },
  { value: "long_text", label: "Texto longo", hint: "Parágrafo" },
  { value: "number", label: "Número", hint: "Apenas números" },
  { value: "email", label: "E-mail", hint: "Endereço de e-mail válido" },
  { value: "phone", label: "Telefone", hint: "DDD + número" },
  { value: "cpf", label: "CPF", hint: "Com validação de dígitos" },
  { value: "rg", label: "RG", hint: "Documento de identidade" },
  { value: "date", label: "Data", hint: "Seleção de data" },
  { value: "single_choice", label: "Escolha única", hint: "Uma opção da lista" },
  { value: "multi_choice", label: "Múltipla escolha", hint: "Várias opções" },
];

export function fieldTypeLabel(type: string) {
  return FIELD_TYPES.find((f) => f.value === type)?.label ?? "Texto curto";
}

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += digits[i]! * (len + 1 - i);
    let check = (sum * 10) % 11;
    if (check === 10) check = 0;
    if (check !== digits[len]) return false;
  }
  return true;
}

export function isValidRG(value: string): boolean {
  const rg = value.replace(/[^0-9A-Za-z]/g, "");
  if (rg.length < 7 || rg.length > 10) return false;
  if (/^(.)\1+$/.test(rg)) return false;
  return /^[0-9]+[0-9Xx]?$/.test(rg);
}

export function isValidPhoneBR(value: string): boolean {
  const p = onlyDigits(value);
  if (p.length !== 10 && p.length !== 11) return false;
  const ddd = Number(p.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (p.length === 11 && p[2] !== "9") return false;
  return true;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(value.trim());
}

export function maskCPF(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function maskPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, "($1");
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export function maskRG(value: string) {
  return value.replace(/[^0-9A-Za-z.\-]/g, "").slice(0, 14);
}

export function applyMask(type: string, value: string) {
  if (type === "cpf") return maskCPF(value);
  if (type === "phone") return maskPhone(value);
  if (type === "rg") return maskRG(value);
  return value;
}

/** Returns an error message in pt-BR, or null when the answer is acceptable. */
export function validateAnswer(
  type: string,
  required: boolean,
  raw: unknown,
): string | null {
  const isEmpty =
    raw === undefined ||
    raw === null ||
    (typeof raw === "string" && raw.trim() === "") ||
    (Array.isArray(raw) && raw.length === 0);

  if (isEmpty) return required ? "Este campo é obrigatório." : null;

  const value = Array.isArray(raw) ? raw.join(", ") : String(raw);

  switch (type) {
    case "cpf":
      return isValidCPF(value) ? null : "CPF inválido — confira os números.";
    case "rg":
      return isValidRG(value) ? null : "RG inválido — use de 7 a 10 caracteres.";
    case "phone":
      return isValidPhoneBR(value) ? null : "Telefone inválido — informe DDD + número.";
    case "email":
      return isValidEmail(value) ? null : "E-mail inválido.";
    case "number":
      return Number.isFinite(Number(value)) ? null : "Informe apenas números.";
    default:
      return value.length > 5000 ? "Resposta muito longa." : null;
  }
}
