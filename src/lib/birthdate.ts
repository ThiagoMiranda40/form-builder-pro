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
