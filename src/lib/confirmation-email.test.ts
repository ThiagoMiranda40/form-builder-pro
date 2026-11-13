import { describe, it, expect, vi } from "vitest";
import {
  escapeHtml,
  isSafeRecipient,
  buildConfirmationEmail,
  sendConfirmationEmail,
} from "./confirmation-email";

describe("confirmation-email (T-08)", () => {
  describe("escapeHtml", () => {
    it("deve escapar tags script e caracteres HTML perigosos", () => {
      const escaped = escapeHtml('<script>alert("xss & fun")</script>');
      expect(escaped).not.toContain("<script>");
      expect(escaped).toContain("&lt;script&gt;");
      expect(escaped).toContain("&amp;");
      expect(escaped).toContain("&quot;");
    });
  });

  describe("isSafeRecipient", () => {
    it("deve aceitar destinatários de e-mail válidos e limpos", () => {
      expect(isSafeRecipient("a@b.com")).toBe(true);
      expect(isSafeRecipient("participante.evento@triade.app.br")).toBe(true);
    });

    it("deve rejeitar e-mails com múltiplos destinatários ou caracteres proibidos (, ; < > \" espaços)", () => {
      expect(isSafeRecipient("a@b.com,c.com")).toBe(false);
      expect(isSafeRecipient("a@b.com;x@y.com")).toBe(false);
      expect(isSafeRecipient("x<y@z.com>")).toBe(false);
      expect(isSafeRecipient('"a"@b.com')).toBe(false);
      expect(isSafeRecipient("usuario @exemplo.com")).toBe(false);
      expect(isSafeRecipient("usuario@exemplo.com\n")).toBe(false);
    });

    it("deve rejeitar e-mails maiores que 254 caracteres", () => {
      const longEmail = `${"a".repeat(250)}@b.com`;
      expect(isSafeRecipient(longEmail)).toBe(false);
    });
  });

  describe("buildConfirmationEmail", () => {
    const form = { title: "Corrida Track&Field 2026\r\n" };
    const questions = [
      { id: "q1", label: "Nome", field_type: "short_text", position: 1 },
      { id: "q2", label: "CPF", field_type: "cpf", position: 2 },
      { id: "q3", label: "RG", field_type: "rg", position: 3 },
      { id: "q4", label: "Distâncias", field_type: "multi_choice", position: 4 },
      { id: "q5", label: "Observações", field_type: "long_text", position: 5 },
    ];
    const answers = {
      q1: "João <Silva> & Cia",
      q2: "529.982.247-25",
      q3: "12.345.678-9",
      q4: ["5 km", "10 km"],
      // q5 deixado sem resposta
    };
    const editUrl = "https://triade.app.br/editar/token123";

    it("deve construir e-mail para kind confirmada sem quebra de linha no assunto", () => {
      const email = buildConfirmationEmail({
        form,
        questions,
        answers,
        editUrl,
        kind: "confirmada",
      });

      expect(email.subject).toBe("Inscrição confirmada — Corrida Track&Field 2026");
      expect(email.subject).not.toContain("\r");
      expect(email.subject).not.toContain("\n");

      // Verificações no HTML
      expect(email.html).toContain("Recebemos sua inscrição.");
      expect(email.html).toContain("João &lt;Silva&gt; &amp; Cia");
      expect(email.html).toContain("***.***.***-25");
      expect(email.html).not.toContain("529.982.247-25");
      expect(email.html).toContain("**.***.**8-9");
      expect(email.html).not.toContain("12.345.678-9");
      expect(email.html).toContain("5 km, 10 km");
      expect(email.html).toContain("—");
      expect(email.html).toContain("Para corrigir seus dados, acesse:");
      expect(email.html).toContain(`href="${editUrl}"`);
      expect(email.html).not.toContain("<img");

      // Verificações no Text
      expect(email.text).toContain("Recebemos sua inscrição.");
      expect(email.text).toContain("***.***.***-25");
      expect(email.text).toContain(editUrl);
    });

    it("deve construir e-mail para kind atualizada", () => {
      const email = buildConfirmationEmail({
        form: { title: "Workshop Tech" },
        questions: [{ id: "q1", label: "Nome", field_type: "short_text", position: 1 }],
        answers: { q1: "Carlos" },
        editUrl,
        kind: "atualizada",
      });

      expect(email.subject).toBe("Inscrição atualizada — Workshop Tech");
      expect(email.html).toContain("Suas respostas foram atualizadas.");
      expect(email.text).toContain("Suas respostas foram atualizadas.");
    });

    it("deve formatar perguntas do tipo date e birthdate em dd/mm/aaaa no texto e HTML com CPF mascarado (T-24)", () => {
      const email = buildConfirmationEmail({
        form: { title: "Corrida SKF" },
        questions: [
          { id: "q_cpf", label: "CPF", field_type: "cpf", position: 1 },
          { id: "q_nasc", label: "Data de Nascimento", field_type: "birthdate", position: 2 },
          { id: "q_data", label: "Data da Prova", type: "date", position: 3 },
        ],
        answers: {
          q_cpf: "529.982.247-25",
          q_nasc: "1981-12-20",
          q_data: "2026-10-02",
        },
        editUrl: "https://triade.app.br/editar/token123",
      });

      // CPF segue mascarado
      expect(email.html).toContain("***.***.***-25");
      expect(email.text).toContain("***.***.***-25");
      expect(email.html).not.toContain("529.982.247-25");

      // Datas formatadas em dd/mm/aaaa
      expect(email.html).toContain("20/12/1981");
      expect(email.text).toContain("20/12/1981");
      expect(email.html).not.toContain("1981-12-20");
      expect(email.text).not.toContain("1981-12-20");

      expect(email.html).toContain("02/10/2026");
      expect(email.text).toContain("02/10/2026");
      expect(email.html).not.toContain("2026-10-02");
      expect(email.text).not.toContain("2026-10-02");
    });

    it("T-24c: inclui linha Evento: ... quando event_date está preenchido e escapa dados no HTML", () => {
      const email = buildConfirmationEmail({
        form: {
          title: "Corrida Noturna",
          event_date: "2026-11-10",
          event_time: "06:30",
          event_location: "Shopping <Teste> & Cia",
        },
        questions: [{ id: "q1", label: "Nome", field_type: "short_text", position: 1 }],
        answers: { q1: "Atleta" },
        editUrl: "https://triade.app.br/editar/token123",
      });

      // Texto puro
      expect(email.text).toContain("Evento: 10/11/2026 às 06:30 · Shopping <Teste> & Cia");

      // HTML escapado
      expect(email.html).toContain("Evento: 10/11/2026 às 06:30 · Shopping &lt;Teste&gt; &amp; Cia");
    });

    it("T-24c: sem event_date o e-mail fica IDÊNTICO ao anterior sem linha de evento", () => {
      const email = buildConfirmationEmail({
        form: {
          title: "Corrida Noturna",
          event_time: "06:30",
          event_location: "Shopping Teste",
        },
        questions: [{ id: "q1", label: "Nome", field_type: "short_text", position: 1 }],
        answers: { q1: "Atleta" },
        editUrl: "https://triade.app.br/editar/token123",
      });

      expect(email.text).not.toContain("Evento:");
      expect(email.html).not.toContain("Evento:");
    });

    describe("T-51 (M-46): bloco do Grupo de avisos do WhatsApp", () => {
      const baseEmailInput = {
        form: { title: "Corrida Noturna" },
        questions: [{ id: "q1", label: "Nome", field_type: "short_text", position: 1 }],
        answers: { q1: "Atleta" },
        editUrl: "https://triade.app.br/editar/token123",
      };

      it("com kind:'confirmada' e link válido, html e text contêm bloco do grupo antes de 'Para corrigir seus dados'", () => {
        const link = "https://chat.whatsapp.com/LPUC195Oj4n7Gi4v60rS3A";
        const email = buildConfirmationEmail({
          ...baseEmailInput,
          kind: "confirmada",
          groupLink: link,
        });

        // Título, textos e link presentes no HTML
        expect(email.html).toContain("Grupo de avisos do evento");
        expect(email.html).toContain("Entre no grupo para receber as informações da corrida. Entrar é opcional.");
        expect(email.html).toContain("Entrar no grupo do WhatsApp");
        expect(email.html).toContain(`href="${link}"`);
        expect(email.html).toContain(`Se o botão não abrir, copie este endereço: ${link}`);
        expect(email.html).toContain("Quem entra no grupo vê o número de WhatsApp dos outros participantes.");

        // Ordem: o bloco do grupo deve vir ANTES de "Para corrigir seus dados"
        const groupBlockIdxHtml = email.html.indexOf("Grupo de avisos do evento");
        const editBlockIdxHtml = email.html.indexOf("Para corrigir seus dados");
        expect(groupBlockIdxHtml).toBeGreaterThan(-1);
        expect(editBlockIdxHtml).toBeGreaterThan(-1);
        expect(groupBlockIdxHtml).toBeLessThan(editBlockIdxHtml);

        // Versão em texto puro
        expect(email.text).toContain("Grupo de avisos do evento");
        expect(email.text).toContain("Entre no grupo para receber as informações da corrida. Entrar é opcional.");
        expect(email.text).toContain(`Entrar no grupo do WhatsApp: ${link}`);
        expect(email.text).toContain(`Se o botão não abrir, copie este endereço: ${link}`);
        expect(email.text).toContain("Quem entra no grupo vê o número de WhatsApp dos outros participantes.");

        const groupBlockIdxText = email.text.indexOf("Grupo de avisos do evento");
        const editBlockIdxText = email.text.indexOf("Para corrigir seus dados");
        expect(groupBlockIdxText).toBeGreaterThan(-1);
        expect(editBlockIdxText).toBeGreaterThan(-1);
        expect(groupBlockIdxText).toBeLessThan(editBlockIdxText);
      });

      it("com kind:'atualizada' e link válido, NÃO inclui bloco do grupo", () => {
        const link = "https://chat.whatsapp.com/LPUC195Oj4n7Gi4v60rS3A";
        const email = buildConfirmationEmail({
          ...baseEmailInput,
          kind: "atualizada",
          groupLink: link,
        });

        expect(email.html).not.toContain("Grupo de avisos do evento");
        expect(email.html).not.toContain("Entrar no grupo do WhatsApp");
        expect(email.text).not.toContain("Grupo de avisos do evento");
        expect(email.text).not.toContain(link);
      });

      it("sem groupLink, saída é byte a byte IDÊNTICA à chamada sem o parâmetro", () => {
        const withoutParam = buildConfirmationEmail({
          ...baseEmailInput,
          kind: "confirmada",
        });
        const withUndefined = buildConfirmationEmail({
          ...baseEmailInput,
          kind: "confirmada",
          groupLink: undefined,
        });
        const withNull = buildConfirmationEmail({
          ...baseEmailInput,
          kind: "confirmada",
          groupLink: null,
        });
        const withEmpty = buildConfirmationEmail({
          ...baseEmailInput,
          kind: "confirmada",
          groupLink: "",
        });

        expect(withUndefined).toEqual(withoutParam);
        expect(withNull).toEqual(withoutParam);
        expect(withEmpty).toEqual(withoutParam);
      });

      it("link inválido ou tentativa de injeção é ignorado (sem bloco e sem script)", () => {
        const badLinks = [
          "http://chat.whatsapp.com/x",
          "https://evil.com/",
          "javascript:alert(1)",
          'https://chat.whatsapp.com/x"><script>',
        ];

        for (const bad of badLinks) {
          const email = buildConfirmationEmail({
            ...baseEmailInput,
            kind: "confirmada",
            groupLink: bad,
          });

          expect(email.html).not.toContain("Grupo de avisos do evento");
          expect(email.html).not.toContain("<script>");
          expect(email.text).not.toContain("Grupo de avisos do evento");
        }
      });

      it("com groupInviteText personalizado, renderiza o texto customizado escapado e não usa o padrão (T-56)", () => {
        const link = "https://chat.whatsapp.com/LPUC195Oj4n7Gi4v60rS3A";
        const email = buildConfirmationEmail({
          ...baseEmailInput,
          kind: "confirmada",
          groupLink: link,
          groupInviteText: "Avisos rápidos sobre a largada <5km & 10km>.",
        });

        expect(email.html).toContain("Avisos rápidos sobre a largada &lt;5km &amp; 10km&gt;.");
        expect(email.html).not.toContain("Entre no grupo para receber as informações da corrida. Entrar é opcional.");
        expect(email.html).toContain("Quem entra no grupo vê o número de WhatsApp dos outros participantes.");

        expect(email.text).toContain("Avisos rápidos sobre a largada <5km & 10km>.");
        expect(email.text).not.toContain("Entre no grupo para receber as informações da corrida. Entrar é opcional.");
        expect(email.text).toContain("Quem entra no grupo vê o número de WhatsApp dos outros participantes.");
      });

      it("com groupInviteText vazio ou inválido, usa o texto padrão (T-56)", () => {
        const link = "https://chat.whatsapp.com/LPUC195Oj4n7Gi4v60rS3A";
        const email = buildConfirmationEmail({
          ...baseEmailInput,
          kind: "confirmada",
          groupLink: link,
          groupInviteText: "   ",
        });

        expect(email.html).toContain("Entre no grupo para receber as informações da corrida. Entrar é opcional.");
        expect(email.text).toContain("Entre no grupo para receber as informações da corrida. Entrar é opcional.");
      });
    });
  });


  describe("sendConfirmationEmail", () => {
    it("deve retornar false sem chamar a rede se faltar apiKey, from ou se to for inseguro", async () => {
      const fetchFn = vi.fn();

      const res1 = await sendConfirmationEmail({
        fetchFn: fetchFn as any,
        apiKey: "",
        from: "noreply@triade.app.br",
        to: "a@b.com",
        subject: "Teste",
        html: "<p>ok</p>",
        text: "ok",
      });
      expect(res1).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();

      const res2 = await sendConfirmationEmail({
        fetchFn: fetchFn as any,
        apiKey: "re_key_123",
        from: "",
        to: "a@b.com",
        subject: "Teste",
        html: "<p>ok</p>",
        text: "ok",
      });
      expect(res2).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();

      const res3 = await sendConfirmationEmail({
        fetchFn: fetchFn as any,
        apiKey: "re_key_123",
        from: "noreply@triade.app.br",
        to: "invalido,destinatario@b.com",
        subject: "Teste",
        html: "<p>ok</p>",
        text: "ok",
      });
      expect(res3).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("deve chamar a API do Resend via POST e retornar true em status ok", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "email_123" }),
      });

      const res = await sendConfirmationEmail({
        fetchFn: fetchFn as any,
        apiKey: "re_test_key",
        from: "inscricoes@triade.app.br",
        to: "participante@exemplo.com",
        subject: "Inscrição confirmada",
        html: "<p>Olá</p>",
        text: "Olá",
      });

      expect(res).toBe(true);
      expect(fetchFn).toHaveBeenCalledWith("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "inscricoes@triade.app.br",
          to: ["participante@exemplo.com"],
          subject: "Inscrição confirmada",
          html: "<p>Olá</p>",
          text: "Olá",
        }),
      });
    });

    it("deve retornar false e NÃO lançar erro se fetch responder não-ok ou lançar exceção", async () => {
      const fetchErrorResp = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const res1 = await sendConfirmationEmail({
        fetchFn: fetchErrorResp as any,
        apiKey: "re_test_key",
        from: "inscricoes@triade.app.br",
        to: "participante@exemplo.com",
        subject: "Erro",
        html: "<p>Erro</p>",
        text: "Erro",
      });
      expect(res1).toBe(false);

      const fetchThrow = vi.fn().mockRejectedValue(new Error("Network failure"));
      const res2 = await sendConfirmationEmail({
        fetchFn: fetchThrow as any,
        apiKey: "re_test_key",
        from: "inscricoes@triade.app.br",
        to: "participante@exemplo.com",
        subject: "Falha",
        html: "<p>Falha</p>",
        text: "Falha",
      });
      expect(res2).toBe(false);
    });
  });
});
