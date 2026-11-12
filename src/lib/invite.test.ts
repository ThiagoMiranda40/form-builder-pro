import { describe, expect, it } from "vitest";
import {
  buildVcf,
  extractVcfContacts,
  findPhoneQuestion,
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
