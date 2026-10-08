const TIME_ZONE = "America/Sao_Paulo";

/**
 * Retorna a data civil de hoje (AAAA-MM-DD) no fuso fixo de São Paulo ("America/Sao_Paulo").
 */
export function todayInSaoPaulo(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Retorna os limites para campos de data de nascimento:
 * min = "1900-01-01"
 * max = o dia anterior a hoje no fuso de São Paulo.
 */
export function birthdateBounds(now: Date): { min: string; max: string } {
  const today = todayInSaoPaulo(now);
  const parts = today.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  utcDate.setUTCDate(utcDate.getUTCDate() - 1);

  const maxY = utcDate.getUTCFullYear();
  const maxM = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const maxD = String(utcDate.getUTCDate()).padStart(2, "0");

  return {
    min: "1900-01-01",
    max: `${maxY}-${maxM}-${maxD}`,
  };
}

/**
 * Valida se a string está no formato AAAA-MM-DD e corresponde a uma data real de calendário
 * (por ida e volta com Date.UTC).
 */
export function isValidIsoDate(value: string): boolean {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parts = value.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) return false;

  const date = new Date(Date.UTC(y, m - 1, d));

  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Valida data de nascimento:
 * - null quando válida;
 * - "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura." quando formato válido mas data é hoje ou futura (comparação por texto AAAA-MM-DD);
 * - "Data de nascimento inválida." quando formato/calendário for inválido ou a data for anterior a 1900-01-01.
 */
export function validateBirthdate(value: string, now: Date): string | null {
  if (!isValidIsoDate(value)) {
    return "Data de nascimento inválida.";
  }

  const parts = value.split("-").map(Number);
  const year = parts[0];
  if (year === undefined || year < 1900) {
    return "Data de nascimento inválida.";
  }

  const today = todayInSaoPaulo(now);
  if (value >= today) {
    return "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura.";
  }

  return null;
}

export type DateInputAttrs = {
  type: "date";
  min?: string;
  max?: string;
  autoComplete?: string;
};

/**
 * Retorna os atributos HTML para campos de data ("date" ou "birthdate").
 * - Para "date": { type: "date" }
 * - Para "birthdate": { type: "date", min: "1900-01-01", max: <ontem em SP>, autoComplete: "bday" }
 * - Para outros tipos: null
 */
export function dateInputAttrs(
  fieldType: string,
  now: Date,
): DateInputAttrs | null {
  if (fieldType === "date") {
    return { type: "date" };
  }
  if (fieldType === "birthdate") {
    const bounds = birthdateBounds(now);
    return {
      type: "date",
      min: bounds.min,
      max: bounds.max,
      autoComplete: "bday",
    };
  }
  return null;
}

/**
 * Retorna os anos completos na data de referência (compara mês e dia).
 * Devolve null se alguma data for inválida ou se a data de referência for anterior à data de nascimento.
 */
export function ageOnDate(birthIso: string, refIso: string): number | null {
  if (!isValidIsoDate(birthIso) || !isValidIsoDate(refIso)) return null;
  const [by, bm, bd] = birthIso.split("-").map(Number);
  const [ry, rm, rd] = refIso.split("-").map(Number);
  if (
    by === undefined ||
    bm === undefined ||
    bd === undefined ||
    ry === undefined ||
    rm === undefined ||
    rd === undefined
  ) {
    return null;
  }
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) {
    age--;
  }
  if (age < 0) return null;
  return age;
}

export type AgeLimits = {
  minAge: number | null;
  maxAge: number | null;
};

/**
 * Normaliza os limites de idade (aceita inteiros de 0 a 120; vazio ou outro valor vira nulo).
 * Se minAge > maxAge, devolve os dois nulos.
 */
export function normalizeAgeLimits(raw: unknown): AgeLimits {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { minAge: null, maxAge: null };
  }
  const obj = raw as Record<string, unknown>;
  const parseAge = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 120) {
      return v;
    }
    return null;
  };

  const minAge = parseAge(obj["minAge"]);
  const maxAge = parseAge(obj["maxAge"]);

  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    return { minAge: null, maxAge: null };
  }

  return { minAge, maxAge };
}

/**
 * Mensagem explicativa em português para limites de idade.
 */
export function ageLimitMessage(limits: AgeLimits): string {
  const { minAge, maxAge } = limits;
  if (minAge !== null && maxAge !== null) {
    return `Este evento aceita participantes de ${minAge} a ${maxAge} anos.`;
  }
  if (minAge !== null) {
    return `Este evento aceita participantes a partir de ${minAge} anos.`;
  }
  if (maxAge !== null) {
    return `Este evento aceita participantes de até ${maxAge} anos.`;
  }
  return "";
}

/**
 * Valida a idade do nascimento contra os limites na data de referência.
 * Retorna null se estiver sem limites ou dentro da faixa; caso contrário, retorna ageLimitMessage.
 */
export function validateBirthdateAge(
  birthIso: string,
  limits: AgeLimits | null | undefined,
  refIso: string,
): string | null {
  const normalized = normalizeAgeLimits(limits);
  if (normalized.minAge === null && normalized.maxAge === null) {
    return null;
  }
  const age = ageOnDate(birthIso, refIso);
  if (age === null) {
    return ageLimitMessage(normalized);
  }
  if (normalized.minAge !== null && age < normalized.minAge) {
    return ageLimitMessage(normalized);
  }
  if (normalized.maxAge !== null && age > normalized.maxAge) {
    return ageLimitMessage(normalized);
  }
  return null;
}

/**
 * Resolve a data de referência para contagem de idade:
 * usa eventDate se for ISO válida, senão todayInSaoPaulo(now).
 */
export function resolveAgeReferenceDate(
  eventDate: string | null | undefined,
  now: Date,
): string {
  if (typeof eventDate === "string" && isValidIsoDate(eventDate)) {
    return eventDate;
  }
  return todayInSaoPaulo(now);
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * Calcula a janela de datas de nascimento estreitada pelos limites de idade.
 * min = o maior entre "1900-01-01" e o primeiro nascimento cuja idade em refIso seja <= maxAge
 * max = o menor entre "ontem em SP" e o último nascimento cuja idade em refIso seja >= minAge
 */
export function birthdateWindow(
  limits: AgeLimits | null | undefined,
  refIso: string,
  now: Date,
): { min: string; max: string } {
  const baseBounds = birthdateBounds(now);
  const normalized = normalizeAgeLimits(limits);

  let calculatedMin = "1900-01-01";
  if (normalized.maxAge !== null && isValidIsoDate(refIso)) {
    const [ry, rm, rd] = refIso.split("-").map(Number);
    const yOld = ry! - (normalized.maxAge + 1);
    let bOld = `${yOld}-${String(rm).padStart(2, "0")}-${String(rd).padStart(2, "0")}`;
    if (rm === 2 && rd === 29 && !isLeapYear(yOld)) {
      bOld = `${yOld}-02-28`;
    }
    calculatedMin = addDaysIso(bOld, 1);
  }

  let calculatedMax = baseBounds.max;
  if (normalized.minAge !== null && isValidIsoDate(refIso)) {
    const [ry, rm, rd] = refIso.split("-").map(Number);
    const y = ry! - normalized.minAge;
    let bMax = `${y}-${String(rm).padStart(2, "0")}-${String(rd).padStart(2, "0")}`;
    if (rm === 2 && rd === 29 && !isLeapYear(y)) {
      bMax = `${y}-02-28`;
    }
    calculatedMax = bMax;
  }

  const finalMin = calculatedMin > "1900-01-01" ? calculatedMin : "1900-01-01";
  const finalMax = calculatedMax < baseBounds.max ? calculatedMax : baseBounds.max;

  return {
    min: finalMin,
    max: finalMax,
  };
}


