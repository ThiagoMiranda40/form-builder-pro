import { describe, it, expect } from "vitest";
import {
  todayInSaoPaulo,
  birthdateBounds,
  isValidIsoDate,
  validateBirthdate,
  dateInputAttrs,
  ageOnDate,
  normalizeAgeLimits,
  ageLimitMessage,
  validateBirthdateAge,
  resolveAgeReferenceDate,
  birthdateWindow,
  validateBirthdateInline,
} from "./birthdate";

describe("birthdate (T-24)", () => {
  describe("isValidIsoDate", () => {
    it("valida datas ISO válidas", () => {
      expect(isValidIsoDate("1981-12-20")).toBe(true);
      expect(isValidIsoDate("2026-10-02")).toBe(true);
      expect(isValidIsoDate("1900-01-01")).toBe(true);
      expect(isValidIsoDate("2024-02-29")).toBe(true); // bissexto
    });

    it("recusa formatos inválidos e datas inexistentes no calendário", () => {
      expect(isValidIsoDate("2026-02-30")).toBe(false);
      expect(isValidIsoDate("2026-13-01")).toBe(false);
      expect(isValidIsoDate("2023-02-29")).toBe(false); // não bissexto
      expect(isValidIsoDate("abc")).toBe(false);
      expect(isValidIsoDate("")).toBe(false);
      expect(isValidIsoDate("2026/10/02")).toBe(false);
      expect(isValidIsoDate("02-10-2026")).toBe(false);
    });
  });

  describe("todayInSaoPaulo & birthdateBounds", () => {
    it("calcula hoje e os limites no fuso fixo de São Paulo", () => {
      // 2026-10-03T02:00:00Z -> UTC-3 é 2026-10-02 23:00 (ainda 02/10 em SP)
      const now1 = new Date("2026-10-03T02:00:00Z");
      expect(todayInSaoPaulo(now1)).toBe("2026-10-02");
      expect(birthdateBounds(now1)).toEqual({
        min: "1900-01-01",
        max: "2026-10-01",
      });

      // 2026-10-03T03:30:00Z -> UTC-3 é 2026-10-03 00:30 (já 03/10 em SP)
      const now2 = new Date("2026-10-03T03:30:00Z");
      expect(todayInSaoPaulo(now2)).toBe("2026-10-03");
      expect(birthdateBounds(now2)).toEqual({
        min: "1900-01-01",
        max: "2026-10-02",
      });
    });
  });

  describe("validateBirthdate", () => {
    const fixedNow = new Date("2026-10-02T15:00:00-03:00"); // hoje em SP = 2026-10-02

    it("ontem -> ok (null)", () => {
      expect(validateBirthdate("2026-10-01", fixedNow)).toBeNull();
    });

    it("hoje -> mensagem válida", () => {
      expect(validateBirthdate("2026-10-02", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
    });

    it("amanhã -> mensagem válida", () => {
      expect(validateBirthdate("2026-10-03", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
    });

    it("1900-01-01 -> ok (null)", () => {
      expect(validateBirthdate("1900-01-01", fixedNow)).toBeNull();
    });

    it("1899-12-31 -> inválida", () => {
      expect(validateBirthdate("1899-12-31", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
    });

    it("2026-02-30 -> inválida", () => {
      expect(validateBirthdate("2026-02-30", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
    });

    it("abc e vazio -> inválida", () => {
      expect(validateBirthdate("abc", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
      expect(validateBirthdate("", fixedNow)).toBe(
        "Informe uma data de nascimento válida.",
      );
    });

    it("com now = 2026-10-03T02:00:00Z (ainda 02/10 em SP), 2026-10-02 é HOJE -> erro", () => {
      const now1 = new Date("2026-10-03T02:00:00Z");
      expect(validateBirthdate("2026-10-02", now1)).toBe(
        "Informe uma data de nascimento válida.",
      );
    });

    it("com now = 2026-10-03T03:30:00Z (já 03/10 em SP), 2026-10-02 é ontem -> ok", () => {
      const now2 = new Date("2026-10-03T03:30:00Z");
      expect(validateBirthdate("2026-10-02", now2)).toBeNull();
    });
  });

  describe("dateInputAttrs (T-24b)", () => {
    const fixedNow = new Date("2026-10-02T15:00:00-03:00");

    it("retorna null para tipos que não são data", () => {
      expect(dateInputAttrs("text", fixedNow)).toBeNull();
      expect(dateInputAttrs("short_text", fixedNow)).toBeNull();
      expect(dateInputAttrs("email", fixedNow)).toBeNull();
      expect(dateInputAttrs("cpf", fixedNow)).toBeNull();
    });

    it("retorna { type: 'date' } para o tipo date", () => {
      expect(dateInputAttrs("date", fixedNow)).toEqual({ type: "date" });
    });

    it("retorna atributos completos para birthdate nos dois horários de teste", () => {
      const now1 = new Date("2026-10-03T02:00:00Z");
      expect(dateInputAttrs("birthdate", now1)).toEqual({
        type: "date",
        min: "1900-01-01",
        max: "2026-10-01",
        autoComplete: "bday",
      });

      const now2 = new Date("2026-10-03T03:30:00Z");
      expect(dateInputAttrs("birthdate", now2)).toEqual({
        type: "date",
        min: "1900-01-01",
        max: "2026-10-02",
        autoComplete: "bday",
      });
    });
  });

  describe("limites de idade na data de nascimento (T-24c)", () => {
    describe("ageOnDate", () => {
      it("calcula no dia do aniversário, na véspera e no dia seguinte", () => {
        expect(ageOnDate("2000-05-10", "2018-05-10")).toBe(18); // dia do aniversário
        expect(ageOnDate("2000-05-10", "2018-05-09")).toBe(17); // véspera
        expect(ageOnDate("2000-05-10", "2018-05-11")).toBe(18); // dia seguinte
      });

      it("trata 29/02 em anos bissextos e não bissextos", () => {
        expect(ageOnDate("2004-02-29", "2005-02-28")).toBe(0);
        expect(ageOnDate("2004-02-29", "2005-03-01")).toBe(1);
        expect(ageOnDate("2004-02-29", "2008-02-28")).toBe(3);
        expect(ageOnDate("2004-02-29", "2008-02-29")).toBe(4);
      });

      it("trata virada de ano", () => {
        expect(ageOnDate("2000-12-31", "2001-01-01")).toBe(0);
        expect(ageOnDate("2000-12-31", "2001-12-30")).toBe(0);
        expect(ageOnDate("2000-12-31", "2001-12-31")).toBe(1);
      });

      it("devolve null para datas inválidas", () => {
        expect(ageOnDate("abc", "2026-10-10")).toBeNull();
        expect(ageOnDate("2026-10-10", "2026-02-30")).toBeNull();
        expect(ageOnDate("2026-10-10", "abc")).toBeNull();
      });
    });

    describe("normalizeAgeLimits", () => {
      it("aceita inteiros de 0 a 120 e devolve valores limpos", () => {
        expect(normalizeAgeLimits({ minAge: 18, maxAge: 60 })).toEqual({ minAge: 18, maxAge: 60 });
        expect(normalizeAgeLimits({ minAge: 0, maxAge: 120 })).toEqual({ minAge: 0, maxAge: 120 });
        expect(normalizeAgeLimits({ minAge: 18 })).toEqual({ minAge: 18, maxAge: null });
        expect(normalizeAgeLimits({ maxAge: 60 })).toEqual({ minAge: null, maxAge: 60 });
        expect(normalizeAgeLimits({})).toEqual({ minAge: null, maxAge: null });
      });

      it("rejeita lixo, negativos, 121, decimais, texto e objeto nulo", () => {
        expect(normalizeAgeLimits(null)).toEqual({ minAge: null, maxAge: null });
        expect(normalizeAgeLimits(undefined)).toEqual({ minAge: null, maxAge: null });
        expect(normalizeAgeLimits("lixo")).toEqual({ minAge: null, maxAge: null });
        expect(normalizeAgeLimits([18, 60])).toEqual({ minAge: null, maxAge: null });
        expect(normalizeAgeLimits({ minAge: -1, maxAge: 50 })).toEqual({ minAge: null, maxAge: 50 });
        expect(normalizeAgeLimits({ minAge: 18, maxAge: 121 })).toEqual({ minAge: 18, maxAge: null });
        expect(normalizeAgeLimits({ minAge: 18.5, maxAge: 60 })).toEqual({ minAge: null, maxAge: 60 });
        expect(normalizeAgeLimits({ minAge: "18", maxAge: "60" })).toEqual({ minAge: null, maxAge: null });
      });

      it("devolve os dois nulos quando minAge > maxAge", () => {
        expect(normalizeAgeLimits({ minAge: 30, maxAge: 20 })).toEqual({ minAge: null, maxAge: null });
      });
    });

    describe("ageLimitMessage", () => {
      it("retorna as três mensagens literais exatas", () => {
        expect(ageLimitMessage({ minAge: 18, maxAge: 60 })).toBe(
          "Este evento aceita participantes de 18 a 60 anos.",
        );
        expect(ageLimitMessage({ minAge: 18, maxAge: null })).toBe(
          "Este evento só aceita participantes com 18 anos ou mais.",
        );
        expect(ageLimitMessage({ minAge: null, maxAge: 60 })).toBe(
          "Este evento só aceita participantes de até 60 anos.",
        );
      });
    });

    describe("validateBirthdateAge", () => {
      const ref = "2026-10-10";
      const limits = { minAge: 18, maxAge: 60 };

      it("passa exatamente em minAge e maxAge", () => {
        expect(validateBirthdateAge("2008-10-10", limits, ref)).toBeNull(); // exatamente 18
        expect(validateBirthdateAge("1966-10-10", limits, ref)).toBeNull(); // exatamente 60
        expect(validateBirthdateAge("1965-10-11", limits, ref)).toBeNull(); // véspera de 61 (tem 60 anos)
      });

      it("falha um dia antes de completar minAge e um dia depois de passar de maxAge", () => {
        expect(validateBirthdateAge("2008-10-11", limits, ref)).toBe(
          "Este evento aceita participantes de 18 a 60 anos.",
        );
        expect(validateBirthdateAge("1965-10-10", limits, ref)).toBe(
          "Este evento aceita participantes de 18 a 60 anos.",
        );
      });

      it("data do evento no futuro contra hoje (exemplo da especificação)", () => {
        const eventDate = "2026-11-10";
        const min18 = { minAge: 18, maxAge: null };
        // Nascido em 05/11/2008 com evento em 10/11/2026 tem 18 anos e passa em minAge 18
        expect(validateBirthdateAge("2008-11-05", min18, eventDate)).toBeNull();
        // Nascido em 11/11/2008 tem 17 anos e falha
        expect(validateBirthdateAge("2008-11-11", min18, eventDate)).toBe(
          "Este evento só aceita participantes com 18 anos ou mais.",
        );
      });

      it("retorna null se sem limites ou se data dentro da faixa", () => {
        expect(validateBirthdateAge("2000-01-01", { minAge: null, maxAge: null }, ref)).toBeNull();
        expect(validateBirthdateAge("2000-01-01", limits, ref)).toBeNull();
      });
    });

    describe("validateBirthdateInline (T-24d)", () => {
      const fixedNow = new Date("2026-10-02T15:00:00-03:00"); // hoje em SP = 2026-10-02
      const eventDate = "2026-11-10";
      const min18 = { minAge: 18, maxAge: null };
      const range = { minAge: 18, maxAge: 60 };

      it("data completa fora da janela -> mensagem de idade", () => {
        // Nascido em 11/11/2008 tem 17 anos no evento (10/11/2026) -> erro
        expect(validateBirthdateInline("2008-11-11", min18, eventDate, fixedNow)).toBe(
          "Este evento só aceita participantes com 18 anos ou mais.",
        );
        expect(validateBirthdateInline("1965-10-10", range, "2026-10-10", fixedNow)).toBe(
          "Este evento aceita participantes de 18 a 60 anos.",
        );
        expect(validateBirthdateInline("1950-01-01", { minAge: null, maxAge: 50 }, "2026-10-10", fixedNow)).toBe(
          "Este evento só aceita participantes de até 50 anos.",
        );
      });

      it("data completa dentro da janela -> null", () => {
        expect(validateBirthdateInline("2008-11-05", min18, eventDate, fixedNow)).toBeNull();
        expect(validateBirthdateInline("1990-05-15", range, eventDate, fixedNow)).toBeNull();
      });

      it("incompleta ou vazia -> null (sem erro até blur)", () => {
        expect(validateBirthdateInline("", min18, eventDate, fixedNow)).toBeNull();
        expect(validateBirthdateInline("2008", min18, eventDate, fixedNow)).toBeNull();
        expect(validateBirthdateInline("2008-11", min18, eventDate, fixedNow)).toBeNull();
        expect(validateBirthdateInline("2008-11-", min18, eventDate, fixedNow)).toBeNull();
      });

      it("futura ou hoje -> 'Informe uma data de nascimento válida.'", () => {
        expect(validateBirthdateInline("2026-10-02", min18, eventDate, fixedNow)).toBe(
          "Informe uma data de nascimento válida.",
        );
        expect(validateBirthdateInline("2026-10-03", min18, eventDate, fixedNow)).toBe(
          "Informe uma data de nascimento válida.",
        );
      });

      it("mais de 120 anos ou anterior a 1900 -> 'Informe uma data de nascimento válida.'", () => {
        expect(validateBirthdateInline("1899-12-31", min18, eventDate, fixedNow)).toBe(
          "Informe uma data de nascimento válida.",
        );
        expect(validateBirthdateInline("1900-01-01", null, eventDate, fixedNow)).toBe(
          "Informe uma data de nascimento válida.",
        ); // Em 2026, nascido em 1900 tem 126 anos (> 120)
      });

      it("data impossível no calendário -> 'Informe uma data de nascimento válida.'", () => {
        expect(validateBirthdateInline("2026-02-30", min18, eventDate, fixedNow)).toBe(
          "Informe uma data de nascimento válida.",
        );
      });
    });

    describe("resolveAgeReferenceDate", () => {
      const fixedNow = new Date("2026-10-02T15:00:00-03:00");

      it("devolve eventDate quando for data ISO válida", () => {
        expect(resolveAgeReferenceDate("2026-11-10", fixedNow)).toBe("2026-11-10");
      });

      it("devolve todayInSaoPaulo quando eventDate for nulo, indefinido ou inválido", () => {
        expect(resolveAgeReferenceDate(null, fixedNow)).toBe("2026-10-02");
        expect(resolveAgeReferenceDate(undefined, fixedNow)).toBe("2026-10-02");
        expect(resolveAgeReferenceDate("data-invalida", fixedNow)).toBe("2026-10-02");
      });
    });

    describe("birthdateWindow e TESTE DE CONSISTÊNCIA", () => {
      const fixedNow = new Date("2026-10-02T15:00:00-03:00"); // hoje em SP = 2026-10-02, ontem = 2026-10-01

      it("sem limites devolve a janela padrão", () => {
        expect(birthdateWindow({ minAge: null, maxAge: null }, "2026-10-10", fixedNow)).toEqual({
          min: "1900-01-01",
          max: "2026-10-01",
        });
      });

      it("TESTE DE CONSISTÊNCIA: em múltiplas datas de referência e limites, bordas cumprem a idade e adjacentes ficam fora", () => {
        const testRefDates = ["2026-10-10", "2028-02-29", "2024-02-29", "2026-01-01", "2026-12-31"];
        const addOneDay = (iso: string) => {
          const [y, m, d] = iso.split("-").map(Number);
          const dt = new Date(Date.UTC(y!, m! - 1, d! + 1));
          return dt.toISOString().slice(0, 10);
        };
        const subOneDay = (iso: string) => {
          const [y, m, d] = iso.split("-").map(Number);
          const dt = new Date(Date.UTC(y!, m! - 1, d! - 1));
          return dt.toISOString().slice(0, 10);
        };

        for (const ref of testRefDates) {
          const limitsList = [
            { minAge: 18, maxAge: 60 },
            { minAge: 18, maxAge: null },
            { minAge: null, maxAge: 60 },
            { minAge: 16, maxAge: 25 },
            { minAge: 0, maxAge: 100 },
          ];

          for (const lim of limitsList) {
            const w = birthdateWindow(lim, ref, fixedNow);

            const baseBounds = birthdateBounds(fixedNow);
            if (lim.minAge !== null) {
              const ageMax = ageOnDate(w.max, ref);
              expect(ageMax).toBeGreaterThanOrEqual(lim.minAge);
              const dayAfterMax = addOneDay(w.max);
              if (w.max < baseBounds.max) {
                const ageAfterMax = ageOnDate(dayAfterMax, ref);
                if (ageAfterMax !== null) {
                  expect(ageAfterMax).toBeLessThan(lim.minAge);
                }
              } else {
                expect(dayAfterMax > baseBounds.max).toBe(true);
              }
            }

            if (lim.maxAge !== null) {
              const ageMin = ageOnDate(w.min, ref);
              expect(ageMin).toBeLessThanOrEqual(lim.maxAge);
              const dayBeforeMin = subOneDay(w.min);
              if (w.min > "1900-01-01") {
                const ageBeforeMin = ageOnDate(dayBeforeMin, ref);
                if (ageBeforeMin !== null) {
                  expect(ageBeforeMin).toBeGreaterThan(lim.maxAge);
                }
              } else {
                expect(dayBeforeMin < "1900-01-01").toBe(true);
              }
            }
          }
        }
      });
    });
  });
});


