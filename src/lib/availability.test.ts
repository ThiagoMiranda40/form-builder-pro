import { describe, expect, it } from "vitest";
import { buildAvailability } from "./availability";

describe("buildAvailability", () => {
  it("sem limite e sem prazo -> ambos null", () => {
    const res = buildAvailability({
      maxResponses: null,
      responsesCount: 0,
      closesAt: null,
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.slots).toBeNull();
    expect(res.deadline).toBeNull();
  });

  it("40 vagas e 0 respostas -> 40, vagas restantes, nao urgente, badge nulo", () => {
    const res = buildAvailability({
      maxResponses: 40,
      responsesCount: 0,
      closesAt: null,
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.slots).toEqual({
      remaining: 40,
      number: "40",
      label: "vagas restantes",
      urgent: false,
      badge: null,
    });
  });

  it("10 restantes -> urgente com badge 'Últimas vagas'", () => {
    const res = buildAvailability({
      maxResponses: 40,
      responsesCount: 30,
      closesAt: null,
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.slots).toEqual({
      remaining: 10,
      number: "10",
      label: "vagas restantes",
      urgent: true,
      badge: "Últimas vagas",
    });
  });

  it("1 restante -> singular 'vaga restante', urgente e badge 'Últimas vagas'", () => {
    const res = buildAvailability({
      maxResponses: 40,
      responsesCount: 39,
      closesAt: null,
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.slots).toEqual({
      remaining: 1,
      number: "1",
      label: "vaga restante",
      urgent: true,
      badge: "Últimas vagas",
    });
  });

  it("0 restantes -> 'vagas restantes', urgente e badge nulo", () => {
    const res = buildAvailability({
      maxResponses: 40,
      responsesCount: 40,
      closesAt: null,
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.slots).toEqual({
      remaining: 0,
      number: "0",
      label: "vagas restantes",
      urgent: true,
      badge: null,
    });
  });

  it("contagem maior que o limite -> remaining 0", () => {
    const res = buildAvailability({
      maxResponses: 40,
      responsesCount: 45,
      closesAt: null,
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.slots).toEqual({
      remaining: 0,
      number: "0",
      label: "vagas restantes",
      urgent: true,
      badge: null,
    });
  });

  it("prazo 2026-10-08T02:59:00Z com now em 2026-10-01 -> dateText 07/10/2026, timeText 23:59, sem badge", () => {
    const res = buildAvailability({
      maxResponses: null,
      responsesCount: 0,
      closesAt: "2026-10-08T02:59:00Z",
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.deadline).toEqual({
      dateText: "07/10/2026",
      timeText: "23:59",
      urgent: false,
      badge: null,
    });
  });

  it("o mesmo prazo com now = 2026-10-07T15:00:00Z -> badge 'Encerra hoje' e urgente", () => {
    const res = buildAvailability({
      maxResponses: null,
      responsesCount: 0,
      closesAt: "2026-10-08T02:59:00Z",
      now: new Date("2026-10-07T15:00:00Z"),
    });
    expect(res.deadline).toEqual({
      dateText: "07/10/2026",
      timeText: "23:59",
      urgent: true,
      badge: "Encerra hoje",
    });
  });

  it("com now = 2026-10-06T15:00:00Z -> badge 'Encerra amanhã' e urgente", () => {
    const res = buildAvailability({
      maxResponses: null,
      responsesCount: 0,
      closesAt: "2026-10-08T02:59:00Z",
      now: new Date("2026-10-06T15:00:00Z"),
    });
    expect(res.deadline).toEqual({
      dateText: "07/10/2026",
      timeText: "23:59",
      urgent: true,
      badge: "Encerra amanhã",
    });
  });

  it("prazo invalido ('abc') -> null", () => {
    const res = buildAvailability({
      maxResponses: null,
      responsesCount: 0,
      closesAt: "abc",
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.deadline).toBeNull();
  });

  it("prazo passado -> devolve deadline com urgent falso e badge nulo", () => {
    const res = buildAvailability({
      maxResponses: null,
      responsesCount: 0,
      closesAt: "2026-10-01T10:00:00Z",
      now: new Date("2026-10-01T15:00:00Z"),
    });
    expect(res.deadline).toEqual({
      dateText: "01/10/2026",
      timeText: "07:00",
      urgent: false,
      badge: null,
    });
  });

  it("caso em que o horario UTC ja e o dia seguinte mas em Sao Paulo ainda e o dia anterior", () => {
    // 2026-10-08T01:30:00Z em UTC é dia 08/10, mas em SP (UTC-3) é 07/10 às 22:30
    const res = buildAvailability({
      maxResponses: null,
      responsesCount: 0,
      closesAt: "2026-10-08T01:30:00Z",
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(res.deadline?.dateText).toBe("07/10/2026");
    expect(res.deadline?.timeText).toBe("22:30");
  });
});
