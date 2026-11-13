import { describe, expect, it } from "vitest";
import {
  buildInviteWhatsappUrl,
  buildVcf,
  chunk,
  extractVcfContacts,
  findPhoneQuestion,
  INVITE_MESSAGE_VARIANTS,
  pickEligible,
  pickInviteMessage,
  sanitizeSubject,
  validateGroupLink,
  vcfFilename,
} from "./invite";

describe("invite — T-55: Baixar contatos (.vcf) (RF-22, SEC-43, QA-46-18)", () => {
  it("gera N contatos em formato vCard 3.0 com CRLF para N celulares válidos", () => {
    const vcf = buildVcf([
      { name: "Maria Souza", phone: "(11) 98765-4321" },
      { name: "João Lima", phone: "21998765432" },
      { name: "Ana Paula", phone: "+55 31 99123-4567" },
    ]);

    // Todas as quebras de linha devem ser CRLF (\r\n), nunca \n isolado
    expect(vcf).toContain("\r\n");
    const withoutCrlf = vcf.replace(/\r\n/g, "");
    expect(withoutCrlf).not.toContain("\n");
    expect(withoutCrlf).not.toContain("\r");

    // 3 blocos completos BEGIN:VCARD ... END:VCARD
    const begins = vcf.match(/^BEGIN:VCARD$/gm) ?? [];
    const ends = vcf.match(/^END:VCARD$/gm) ?? [];
    expect(begins).toHaveLength(3);
    expect(ends).toHaveLength(3);

    expect(vcf).toContain("VERSION:3.0\r\n");
    expect(vcf).toContain("FN:Maria Souza\r\n");
    expect(vcf).toContain("TEL;TYPE=CELL:+5511987654321\r\n");
    expect(vcf).toContain("FN:João Lima\r\n");
    expect(vcf).toContain("TEL;TYPE=CELL:+5521998765432\r\n");
    expect(vcf).toContain("FN:Ana Paula\r\n");
    expect(vcf).toContain("TEL;TYPE=CELL:+5531991234567\r\n");
  });

  it("ignora telefones inválidos, vazios ou fixos (10 dígitos)", () => {
    const vcf = buildVcf([
      { name: "Fixo SP", phone: "(11) 3234-5678" },
      { name: "Sem nono dígito", phone: "(11) 8765-4321" },
      { name: "DDD inválido", phone: "(00) 98765-4321" },
      { name: "Vazio", phone: "" },
      { name: "Texto", phone: "nao-e-telefone" },
      { name: "Válido Único", phone: "(41) 99988-7766" },
    ]);

    const begins = vcf.match(/^BEGIN:VCARD$/gm) ?? [];
    expect(begins).toHaveLength(1);
    expect(vcf).toContain("FN:Válido Único\r\n");
    expect(vcf).toContain("TEL;TYPE=CELL:+5541999887766\r\n");
    expect(vcf).not.toContain("Fixo SP");
    expect(vcf).not.toContain("Sem nono dígito");
  });

  it("retorna string vazia quando nenhum contato possui celular válido", () => {
    expect(buildVcf([])).toBe("");
    expect(
      buildVcf([
        { name: "Apenas Fixo", phone: "(11) 3333-4444" },
        { name: "Incompleto", phone: "119876" },
      ]),
    ).toBe("");
  });

  it("usa 'Inscrito' quando o nome é vazio, só espaços ou só caracteres de controle", () => {
    const vcf = buildVcf([
      { name: "", phone: "(11) 98765-4321" },
      { name: "   \t  ", phone: "(21) 98765-4321" },
      { name: "\u0000\u0007\u001F", phone: "(31) 98765-4321" },
    ]);

    const fnLines = vcf.split("\r\n").filter((l) => l.startsWith("FN:"));
    expect(fnLines).toEqual([
      "FN:Inscrito",
      "FN:Inscrito",
      "FN:Inscrito",
    ]);
  });

  it("escapa \\, ;, , e quebras de linha e neutraliza injeção de END:VCARD / novos campos (SEC-43)", () => {
    const maliciousName =
      "Carlos;Silva, Jr.\\Admin\r\nTEL;TYPE=CELL:+5511900000000\nEND:VCARD\r\nBEGIN:VCARD\nFN:Invasor";
    const vcf = buildVcf([
      { name: "Maria Souza", phone: "(11) 98765-4321" },
      { name: maliciousName, phone: "(21) 99876-5432" },
      { name: "Pedro Santos", phone: "(31) 99111-2233" },
    ]);

    const lines = vcf.trimEnd().split("\r\n");

    // Deve haver exatamente 3 cartões (nenhum contato extra criado)
    expect(lines.filter((l) => l === "BEGIN:VCARD")).toHaveLength(3);
    expect(lines.filter((l) => l === "END:VCARD")).toHaveLength(3);

    // Deve haver exatamente 3 linhas TEL (o TEL injetado no nome não virou propriedade)
    const telLines = lines.filter((l) => l.startsWith("TEL"));
    expect(telLines).toEqual([
      "TEL;TYPE=CELL:+5511987654321",
      "TEL;TYPE=CELL:+5521998765432",
      "TEL;TYPE=CELL:+5531991112233",
    ]);

    // A linha FN do contato malicioso contém os caracteres escapados na mesma linha
    const maliciousFn = lines.find((l) => l.startsWith("FN:Carlos"));
    expect(maliciousFn).toBeDefined();
    expect(maliciousFn).toContain("Carlos\\;Silva\\, Jr.\\\\Admin\\n");
  });

  it("remove caracteres de controle ASCII e limita o nome a 100 caracteres antes de escapar (SEC-43)", () => {
    const longName = "A\u0000\u0007\u001B".repeat(60); // 60 'A's após limpar controle
    const veryLongName = "B".repeat(150);

    const vcf = buildVcf([
      { name: longName, phone: "(11) 98765-4321" },
      { name: veryLongName, phone: "(21) 98765-4321" },
    ]);

    expect(vcf).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);
    expect(vcf).toContain(`FN:${"A".repeat(60)}\r\n`);
    expect(vcf).toContain(`FN:${"B".repeat(100)}\r\n`);
    expect(vcf).not.toContain("B".repeat(101));
  });

  it("extrai contatos das respostas usando findNameQuestion e a pergunta field_type === 'phone'", () => {
    const questions = [
      { id: "q-nome", label: "Nome completo", field_type: "short_text" },
      { id: "q-tel", label: "WhatsApp", field_type: "phone" },
    ];
    const responses = [
      { answers: { "q-nome": "Maria Souza", "q-tel": "(11) 98765-4321" } },
      { answers: { "q-nome": "Fixo Ignorado", "q-tel": "(11) 3222-3333" } },
      { answers: { "q-nome": "", "q-tel": "(21) 99876-5432" } },
    ];

    expect(findPhoneQuestion(questions)?.id).toBe("q-tel");
    expect(findPhoneQuestion([{ id: "q1", label: "Nome", field_type: "short_text" }])).toBeNull();

    const contacts = extractVcfContacts(questions, responses);
    expect(contacts).toEqual([
      { name: "Maria Souza", phone: "(11) 98765-4321" },
      { name: "", phone: "(21) 99876-5432" },
    ]);
  });

  it("gera o nome de arquivo contatos-<slug>.vcf a partir do título do formulário", () => {
    expect(vcfFilename("Corrida de Rua São Paulo 2026!")).toBe(
      "contatos-corrida-de-rua-sao-paulo-2026.vcf",
    );
  });
});

describe("invite — T-46: Núcleo puro do convite (RF-17, RF-20, ARQ-04, ARQ-07, SEC-38, SEC-48, QA-46-01, QA-46-17, QA-46-29)", () => {
  describe("validateGroupLink (QA-46-01, ARQ-07, SEC-38)", () => {
    it("aceita links válidos https://chat.whatsapp.com/<código> até 200 caracteres e aplica trim", () => {
      expect(validateGroupLink("https://chat.whatsapp.com/AbC123")).toEqual({
        ok: true,
        link: "https://chat.whatsapp.com/AbC123",
      });
      expect(
        validateGroupLink("   https://chat.whatsapp.com/GrupoCorrida2026XYZ987   "),
      ).toEqual({
        ok: true,
        link: "https://chat.whatsapp.com/GrupoCorrida2026XYZ987",
      });

      const exact200 = `https://chat.whatsapp.com/${"a".repeat(174)}`;
      expect(exact200).toHaveLength(200);
      expect(validateGroupLink(exact200)).toEqual({
        ok: true,
        link: exact200,
      });
    });

    it("devolve { ok: true, link: '' } para string vazia ou só espaços (remover link)", () => {
      expect(validateGroupLink("")).toEqual({ ok: true, link: "" });
      expect(validateGroupLink("   \t  ")).toEqual({ ok: true, link: "" });
    });

    it("devolve { ok: false } para entradas que não são string", () => {
      expect(validateGroupLink(null)).toEqual({ ok: false });
      expect(validateGroupLink(undefined)).toEqual({ ok: false });
      expect(validateGroupLink(12345)).toEqual({ ok: false });
      expect(validateGroupLink({ link: "https://chat.whatsapp.com/AbC123" })).toEqual({
        ok: false,
      });
    });

    it("recusa links inválidos (http, subdomínio falso, outro domínio, query, espaço, @, javascript:, quebra de linha, 201 chars, barra final, etc.)", () => {
      const invalidLinks = [
        "http://chat.whatsapp.com/x",
        "https://chat.whatsapp.com.evil.com/x",
        "https://evil.com/chat.whatsapp.com/x",
        "https://chat.whatsapp.com/x?a=1",
        "https://chat.whatsapp.com/x y",
        "https://chat.whatsapp.com/@x",
        "javascript:alert(1)",
        "https://chat.whatsapp.com/AbC\n123",
        "https://chat.whatsapp.com/AbC\r\n123",
        `https://chat.whatsapp.com/${"a".repeat(175)}`, // 201 caracteres
        "https://chat.whatsapp.com/AbC123/", // barra final extra
        "https://chat.whatsapp.com/", // sem código
        "https://CHAT.WHATSAPP.COM/AbC123", // maiúsculas no host
        "https://user@chat.whatsapp.com/AbC123", // usuário@
        "https://chat.whatsapp.com:443/AbC123", // porta explícita
        "https://chat.whatsapp.com/AbC%20123", // %
      ];

      for (const bad of invalidLinks) {
        expect(validateGroupLink(bad), `deveria recusar: ${bad}`).toEqual({
          ok: false,
        });
      }
    });
  });

  describe("INVITE_MESSAGE_VARIANTS e pickInviteMessage (QA-46-29)", () => {
    it("possui exatamente 5 variações contendo os marcadores {primeiro nome}, {título} e {link} e a 4ª redação exata", () => {
      expect(INVITE_MESSAGE_VARIANTS).toHaveLength(5);
      for (const tpl of INVITE_MESSAGE_VARIANTS) {
        expect(tpl).toContain("{primeiro nome}");
        expect(tpl).toContain("{título}");
        expect(tpl).toContain("{link}");
      }
      expect(INVITE_MESSAGE_VARIANTS[3]).toBe(
        'Passando para avisar, {primeiro nome}: o grupo de comunicados de "{título}" já está aberto. Entre por aqui para receber as informações: {link}',
      );
    });

    it("usa 'participante' quando firstName é vazio, só espaços ou undefined em todas as 5 variações (sem vírgula solta nem saudação quebrada)", () => {
      const link = "https://chat.whatsapp.com/GrupoSemNome123";
      // Seleciona 5 responseIds que caem nos 5 índices (0 a 4)
      const idsByVariant: string[] = [];
      const seen = new Set<string>();
      for (let i = 1; i <= 57 && idsByVariant.length < 5; i++) {
        const respId = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        const probe = pickInviteMessage(respId, "Maria", "Evento", link);
        if (!seen.has(probe)) {
          seen.add(probe);
          idsByVariant.push(respId);
        }
      }
      expect(idsByVariant).toHaveLength(5);

      for (const emptyInput of ["", "   \t  ", undefined as unknown as string]) {
        for (const respId of idsByVariant) {
          const msg = pickInviteMessage(respId, emptyInput, "Corrida 10K", link);
          expect(msg).toContain("participante");
          expect(msg).not.toMatch(/^\s*,/);
          expect(msg).not.toContain("Olá, !");
          expect(msg).not.toContain("Oi, !");
          expect(msg).not.toContain("avisar, :");
        }
      }
    });

    it("monta a mensagem com primeiro nome capitalizado, título cortado em 80 caracteres e link do grupo", () => {
      const longTitle = "C".repeat(95);
      const link = "https://chat.whatsapp.com/AbCdEf123456";
      const msg = pickInviteMessage("resp-001", "MARIA APARECIDA SOUZA", longTitle, link);

      expect(msg).toContain("Maria");
      expect(msg).not.toContain("APARECIDA");
      expect(msg).toContain(`${"C".repeat(80)}…`);
      expect(msg).not.toContain("C".repeat(81));
      expect(msg).toContain(link);
      expect(msg).not.toContain("{primeiro nome}");
      expect(msg).not.toContain("{título}");
      expect(msg).not.toContain("{link}");
    });

    it("sorteia de forma determinística (mesmo responseId = mesma variação) e distribui entre as 5 variações em 57 inscritos", () => {
      const link = "https://chat.whatsapp.com/GrupoTeste57";
      const id = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
      const firstCall = pickInviteMessage(id, "Carlos", "Corrida 10K", link);
      for (let i = 0; i < 10; i++) {
        expect(pickInviteMessage(id, "Carlos", "Corrida 10K", link)).toBe(firstCall);
      }

      const seenMessages = new Set<string>();
      const counts = [0, 0, 0, 0, 0];
      const expectedByVariant = INVITE_MESSAGE_VARIANTS.map((tpl) =>
        tpl
          .replace("{primeiro nome}", "Maria")
          .replace("{título}", "Corrida de Rua Dezembro")
          .replace("{link}", link),
      );

      for (let i = 1; i <= 57; i++) {
        const respId = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        const m = pickInviteMessage(respId, "Maria", "Corrida de Rua Dezembro", link);
        expect(m).toContain("Maria");
        expect(m).toContain("Corrida de Rua Dezembro");
        expect(m).toContain(link);
        seenMessages.add(m);
        const variantIdx = expectedByVariant.indexOf(m);
        expect(variantIdx).toBeGreaterThanOrEqual(0);
        counts[variantIdx] = (counts[variantIdx] ?? 0) + 1;
      }

      expect(seenMessages.size).toBe(5);
      expect(counts).toEqual([11, 9, 11, 13, 13]);
    });
  });

  describe("buildInviteWhatsappUrl (QA-46-17, SEC-48)", () => {
    it("gera URL https://wa.me/55<11 dígitos>?text=<codificado> para celular válido", () => {
      const msg =
        'Oi, Maria! Aqui é a organização de "Corrida de Rua". Entre no nosso grupo: https://chat.whatsapp.com/AbC123';
      const url = buildInviteWhatsappUrl("(11) 98765-4321", msg);
      expect(url).toBe(
        `https://wa.me/5511987654321?text=${encodeURIComponent(msg)}`,
      );
    });

    it("devolve null para telefone fixo, vazio ou inválido", () => {
      expect(buildInviteWhatsappUrl("(11) 3333-4444", "Oi")).toBeNull();
      expect(buildInviteWhatsappUrl("", "Oi")).toBeNull();
      expect(buildInviteWhatsappUrl("12345", "Oi")).toBeNull();
      expect(buildInviteWhatsappUrl("(00) 98765-4321", "Oi")).toBeNull();
    });
  });

  describe("pickEligible", () => {
    const questions = [
      { id: "q-nome", label: "Nome completo", field_type: "short_text" },
      { id: "q-email", label: "E-mail", field_type: "email" },
      { id: "q-tel", label: "Celular / WhatsApp", field_type: "phone" },
      { id: "q-cpf", label: "CPF", field_type: "cpf" },
    ];

    it("extrai { id, firstName, email, phone } validando e-mail com isSafeRecipient e telefone com parseBrazilMobile, sem copiar outros campos", () => {
      const responses = [
        {
          id: "r-1",
          answers: {
            "q-nome": "Maria Clara Silva",
            "q-email": "  maria@exemplo.com.br ",
            "q-tel": "(11) 98765-4321",
            "q-cpf": "123.456.789-00",
          },
        },
        {
          id: "r-2",
          answers: {
            "q-nome": "JOÃO PEDRO",
            "q-email": "invalido@@exemplo..com",
            "q-tel": "(11) 3333-4444", // fixo -> null
            "q-cpf": "111.222.333-44",
          },
        },
        {
          id: "r-3",
          answers: {
            "q-nome": "   ",
            "q-email": "ana@exemplo.com,outro@exemplo.com", // inseguro -> null
            "q-tel": "+55 21 99876-5432",
          },
        },
      ];

      const result = pickEligible(responses, questions);
      expect(result).toEqual([
        {
          id: "r-1",
          firstName: "Maria",
          email: "maria@exemplo.com.br",
          phone: "11987654321",
        },
        {
          id: "r-2",
          firstName: "João",
          email: null,
          phone: null,
        },
        {
          id: "r-3",
          firstName: "",
          email: null,
          phone: "21998765432",
        },
      ]);

      for (const item of result) {
        expect(Object.keys(item).sort()).toEqual(["email", "firstName", "id", "phone"]);
      }
    });
  });

  describe("chunk", () => {
    it("divide 57 itens em partes de 50 e 7 (tamanho padrão 50) e devolve [] para lista vazia", () => {
      const items = Array.from({ length: 57 }, (_, i) => i + 1);
      const parts = chunk(items);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(50);
      expect(parts[1]).toHaveLength(7);
      expect(parts[0]?.[0]).toBe(1);
      expect(parts[0]?.[49]).toBe(50);
      expect(parts[1]?.[0]).toBe(51);
      expect(parts[1]?.[6]).toBe(57);

      expect(chunk([])).toEqual([]);
      expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    });

    it("usa tamanho padrão 50 quando size não é finito ou é menor que 1 (0.5, 0, -4, NaN) sem travar", () => {
      const guardedArray = (arr: number[]) => {
        const copy = [...arr];
        let calls = 0;
        const origSlice = copy.slice.bind(copy);
        copy.slice = (start?: number, end?: number) => {
          if (++calls > 10) {
            throw new Error("loop infinito em chunk: step inválido");
          }
          return origSlice(start, end);
        };
        return copy;
      };

      for (const invalidSize of [0.5, 0, -4, Number.NaN]) {
        const res = chunk(guardedArray([1, 2, 3]), invalidSize);
        expect(res).toEqual([[1, 2, 3]]);
        expect(res.every((part) => part.length > 0)).toBe(true);
      }
    });
  });

  describe("sanitizeSubject", () => {
    it("remove caracteres de controle (inclusive \\r, \\n, U+2028, U+2029 e bidi U+200E..U+2069) e limita a 120 caracteres", () => {
      const dirty = "Convite para o grupo:\r\nCorrida\u0000\u0007\t2026";
      const clean = sanitizeSubject(dirty);
      expect(clean).not.toMatch(/[\u0000-\u001F\u007F]/);
      expect(clean).toBe("Convite para o grupo: Corrida 2026");

      const bidiAndSep =
        "Corrida \u202Eevil\u2028linha\u2029fim\u200E\u200F\u202A\u202B\u202C\u202D\u2066\u2067\u2068\u2069";
      const cleanBidi = sanitizeSubject(bidiAndSep);
      expect(cleanBidi).not.toMatch(
        /[\u200E\u200F\u2028-\u202E\u2066-\u2069]/,
      );
      expect(cleanBidi.length).toBeLessThanOrEqual(120);
      expect(cleanBidi).toContain("Corrida");
      expect(cleanBidi).toContain("evil");
      expect(cleanBidi).toContain("linha");

      const longSubject = "A".repeat(150);
      expect(sanitizeSubject(longSubject)).toHaveLength(120);
      expect(sanitizeSubject(longSubject)).toBe("A".repeat(120));
    });
  });
});
