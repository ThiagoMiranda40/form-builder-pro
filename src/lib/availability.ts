const TIME_ZONE = "America/Sao_Paulo";

export type SlotAvailability = {
  remaining: number;
  number: string;
  label: string;
  urgent: boolean;
  badge: string | null;
};

export type DeadlineAvailability = {
  dateText: string;
  timeText: string;
  urgent: boolean;
  badge: string | null;
};

export type AvailabilityResult = {
  slots: SlotAvailability | null;
  deadline: DeadlineAvailability | null;
};

export type AvailabilityInput = {
  maxResponses: number | null;
  responsesCount: number;
  closesAt: string | null;
  now: Date;
};

function getCivilDateParts(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { year, month, day };
}

export function buildAvailability(input: {
  maxResponses: number | null;
  responsesCount: number;
  closesAt: string | null;
  now: Date;
}): AvailabilityResult {
  // 1. Slots / Vagas
  let slots: SlotAvailability | null = null;
  if (input.maxResponses !== null) {
    const remaining = Math.max(0, input.maxResponses - input.responsesCount);
    const urgent = remaining <= 10;
    const badge = urgent && remaining > 0 ? "Últimas vagas" : null;
    const label = remaining === 1 ? "vaga restante" : "vagas restantes";
    slots = {
      remaining,
      number: String(remaining),
      label,
      urgent,
      badge,
    };
  }

  // 2. Deadline / Prazo
  let deadline: DeadlineAvailability | null = null;
  if (input.closesAt) {
    const closeDate = new Date(input.closesAt);
    if (!isNaN(closeDate.getTime())) {
      const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const dateText = dateFormatter.format(closeDate);
      const timeText = timeFormatter.format(closeDate);

      const isPassed = closeDate.getTime() < input.now.getTime();

      let badge: string | null = null;
      let urgent = false;

      if (!isPassed) {
        const nowParts = getCivilDateParts(input.now, TIME_ZONE);
        const closeParts = getCivilDateParts(closeDate, TIME_ZONE);

        const isSameDay =
          closeParts.year === nowParts.year &&
          closeParts.month === nowParts.month &&
          closeParts.day === nowParts.day;

        if (isSameDay) {
          badge = "Encerra hoje";
          urgent = true;
        } else {
          const nextDay = new Date(
            Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + 1)
          );
          const nextY = nextDay.getUTCFullYear();
          const nextM = nextDay.getUTCMonth() + 1;
          const nextD = nextDay.getUTCDate();

          const isNextDay =
            closeParts.year === nextY &&
            closeParts.month === nextM &&
            closeParts.day === nextD;

          if (isNextDay) {
            badge = "Encerra amanhã";
            urgent = true;
          }
        }
      }

      deadline = {
        dateText,
        timeText,
        urgent,
        badge,
      };
    }
  }

  return { slots, deadline };
}
