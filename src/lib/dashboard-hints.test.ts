import { describe, it, expect } from "vitest";
import { barHint, DASHBOARD_CARD_HINTS, PUBLIC_FORM_HINTS } from "./dashboard-hints";

describe("dashboard-hints (T-27)", () => {
  describe("barHint", () => {
    it("formata corretamente para o dia de hoje com múltiplas respostas", () => {
      const hint = barHint(
        { weekdayName: "sexta-feira", isoDate: "2026-10-02", total: 35 },
        true,
      );
      expect(hint).toBe("sexta-feira, 02/10/2026 (hoje): 35 respostas");
    });

    it("formata corretamente para dia que não é hoje no singular (1 resposta)", () => {
      const hint = barHint(
        { weekdayName: "quinta-feira", isoDate: "2026-10-01", total: 1 },
        false,
      );
      expect(hint).toBe("quinta-feira, 01/10/2026: 1 resposta");
    });

    it("formata corretamente com 0 respostas", () => {
      const hint = barHint(
        { weekdayName: "quarta-feira", isoDate: "2026-09-30", total: 0 },
        false,
      );
      expect(hint).toBe("quarta-feira, 30/09/2026: 0 respostas");
    });

    it("formata no singular no dia de hoje (1 resposta)", () => {
      const hint = barHint(
        { weekdayName: "sexta-feira", isoDate: "2026-10-02", total: 1 },
        true,
      );
      expect(hint).toBe("sexta-feira, 02/10/2026 (hoje): 1 resposta");
    });
  });

  describe("constantes de texto de cards", () => {
    it("contém as explicações dos 4 cards de acordo com a lógica real", () => {
      expect(DASHBOARD_CARD_HINTS.PUBLISHED_FORMS).toBe(
        "Formulários com status publicado, entre todos os seus formulários.",
      );
      expect(DASHBOARD_CARD_HINTS.TOTAL_RESPONSES).toBe(
        "Soma das respostas de todos os formulários, abertos, rascunhos e encerrados.",
      );
      expect(DASHBOARD_CARD_HINTS.RESPONSES_7_DAYS).toBe(
        "Respostas enviadas nos últimos 7 dias, hoje incluído, em todos os formulários.",
      );
      expect(DASHBOARD_CARD_HINTS.CLOSING_SOON).toBe(
        "Formulários com prazo de encerramento nos próximos 3 dias.",
      );
    });

    it("contém as explicações dos blocos de vagas e prazo do formulário público", () => {
      expect(PUBLIC_FORM_HINTS.SLOTS).toBe(
        "Vagas ainda disponíveis neste formulário. Quando restam 10 ou menos, aparece o aviso Últimas vagas.",
      );
      expect(PUBLIC_FORM_HINTS.DEADLINE).toBe(
        "Data e hora limite para enviar a inscrição, no horário de Brasília.",
      );
    });
  });
});
