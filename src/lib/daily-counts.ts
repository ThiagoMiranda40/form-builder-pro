const TIME_ZONE = "America/Sao_Paulo";

export type DayCount = {
  label: string;
  total: number;
  dateText: string;
  isoDate: string;
  weekdayName: string;
};

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
const WEEKDAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

function getCivilDateInSP(d: Date): { year: number; month: number; day: number } | null {
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  if (!year || !month || !day) return null;
  return { year, month, day };
}

/**
 * Agrupa respostas por dia no fuso fixo de São Paulo ("America/Sao_Paulo").
 * Devolve `days` itens, do mais antigo ao de hoje (o último é hoje).
 */
export function countByDay(dates: string[], days: number, now: Date): DayCount[] {
  if (days <= 0) return [];

  const nowCivil = getCivilDateInSP(now);
  if (!nowCivil) return [];

  const anchorUTC = Date.UTC(nowCivil.year, nowCivil.month - 1, nowCivil.day, 12, 0, 0);

  // Gera os slots do mais antigo (offset = days - 1) até hoje (offset = 0)
  const slots: Array<{
    key: string;
    label: string;
    dateText: string;
    isoDate: string;
    weekdayName: string;
    total: number;
  }> = [];
  const slotMap = new Map<string, number>();

  for (let i = 0; i < days; i++) {
    const offsetDays = days - 1 - i;
    const slotD = new Date(anchorUTC - offsetDays * 86400000);
    const year = slotD.getUTCFullYear();
    const month = slotD.getUTCMonth() + 1;
    const day = slotD.getUTCDate();
    const dayOfWeek = slotD.getUTCDay();

    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateText = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
    const label = WEEKDAY_LABELS[dayOfWeek]!;
    const isoDate = key;
    const weekdayName = WEEKDAY_NAMES[dayOfWeek]!;

    slotMap.set(key, i);
    slots.push({ key, label, dateText, isoDate, weekdayName, total: 0 });
  }

  for (const rawDate of dates) {
    if (!rawDate) continue;
    const d = new Date(rawDate);
    const civil = getCivilDateInSP(d);
    if (!civil) continue;

    const key = `${civil.year}-${String(civil.month).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`;
    const index = slotMap.get(key);
    if (index !== undefined) {
      slots[index]!.total += 1;
    }
  }

  return slots.map(({ label, total, dateText, isoDate, weekdayName }) => ({
    label,
    total,
    dateText,
    isoDate,
    weekdayName,
  }));
}
