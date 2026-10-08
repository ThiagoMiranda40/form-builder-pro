import { describe, it, expect, vi } from "vitest";
import {
  buildCloneTitle,
  buildCloneFormPayload,
  buildCloneQuestions,
  cloneForm,
} from "./clone-form";

describe("buildCloneTitle (T-41)", () => {
  it("título simples ganha sufixo (cópia)", () => {
    expect(buildCloneTitle("Treino Oficial")).toBe("Treino Oficial (cópia)");
  });

  it("título já terminando em (cópia) ganha (cópia 2)", () => {
    expect(buildCloneTitle("Treino Oficial (cópia)")).toBe("Treino Oficial (cópia 2)");
  });

  it("título terminando em (cópia 2) ganha (cópia 3)", () => {
    expect(buildCloneTitle("Treino Oficial (cópia 2)")).toBe("Treino Oficial (cópia 3)");
  });

  it("título terminando em (cópia 9) ganha (cópia 10)", () => {
    expect(buildCloneTitle("Treino Oficial (cópia 9)")).toBe("Treino Oficial (cópia 10)");
  });

  it("título longo nunca passa de 120 caracteres e preserva o sufixo inteiro", () => {
    const longTitle = "A".repeat(120);
    const result = buildCloneTitle(longTitle);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith(" (cópia)")).toBe(true);
    expect(result).toBe("A".repeat(120 - " (cópia)".length) + " (cópia)");

    // Teste com título longo já numerado
    const longTitle2 = "A".repeat(120 - " (cópia)".length) + " (cópia)";
    const result2 = buildCloneTitle(longTitle2);
    expect(result2.length).toBeLessThanOrEqual(120);
    expect(result2.endsWith(" (cópia 2)")).toBe(true);
  });

  it("título vazio gera apenas o sufixo (cópia)", () => {
    expect(buildCloneTitle("")).toBe(" (cópia)");
  });
});

describe("buildCloneFormPayload (T-41)", () => {
  it("gera payload com somente as chaves permitidas, status draft e campos nulos corretos", () => {
    const originalTheme = { color: "#22c55e", font: "display", logo_url: "https://logo.png" };
    const source = {
      id: "orig-123",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      title: "Inscrição Corrida",
      description: "Descrição do evento",
      theme: originalTheme,
      consent_text: "Concordo com os termos LGPD",
      success_message: "Obrigado por se inscrever!",
      max_responses: 50,
      closes_at: "2026-12-31T23:59:59Z",
      share_token: "token-secreto-compartilhado",
      edit_window_hours: 24,
      event_date: "2026-11-10",
      event_time: "08:00",
      event_location: "Parque Ibirapuera",
    };

    const payload = buildCloneFormPayload(source, "owner-abc", "xyz123");

    // Somente as chaves permitidas (T-41 e T-24c)
    const allowedKeys = [
      "owner_id",
      "title",
      "slug",
      "status",
      "description",
      "theme",
      "consent_text",
      "success_message",
      "max_responses",
      "closes_at",
      "share_token",
      "edit_window_hours",
      "event_date",
      "event_time",
      "event_location",
    ].sort();

    expect(Object.keys(payload).sort()).toEqual(allowedKeys);

    // Valores
    expect(payload.owner_id).toBe("owner-abc");
    expect(payload.title).toBe("Inscrição Corrida (cópia)");
    expect(payload.status).toBe("draft");
    expect(payload.description).toBe("Descrição do evento");
    expect(payload.consent_text).toBe("Concordo com os termos LGPD");
    expect(payload.success_message).toBe("Obrigado por se inscrever!");
    expect(payload.max_responses).toBe(50);
    expect(payload.closes_at).toBeNull();
    expect(payload.share_token).toBeNull();
    expect(payload.edit_window_hours).toBeNull();
    // T-24c: não copia data do evento, horário nem local
    expect(payload.event_date).toBeNull();
    expect(payload.event_time).toBeNull();
    expect(payload.event_location).toBeNull();

    // Theme é cópia profunda (não a mesma referência)
    expect(payload.theme).toEqual(originalTheme);
    expect(payload.theme).not.toBe(originalTheme);

    // Nenhum ID ou timestamps
    expect((payload as Record<string, unknown>)["id"]).toBeUndefined();
    expect((payload as Record<string, unknown>)["created_at"]).toBeUndefined();
    expect((payload as Record<string, unknown>)["updated_at"]).toBeUndefined();
  });
});

describe("buildCloneQuestions (T-41, T-24c)", () => {
  it("ordena por position mesmo com entrada embaralhada, gera posições sequenciais 0..n-1 e copia opções e settings por valor", () => {
    const originalOptions = ["Opção 1", "Opção 2", "Opção 3"];
    const originalSettings = { minAge: 18, maxAge: 60 };
    const input = [
      {
        id: "q3",
        form_id: "orig-form",
        created_at: "2026-01-01",
        label: "Pergunta 3",
        help_text: "Ajuda 3",
        field_type: "short_text" as const,
        required: false,
        options: [],
        position: 10,
        settings: {},
      },
      {
        id: "q1",
        form_id: "orig-form",
        created_at: "2026-01-01",
        label: "Pergunta 1",
        help_text: "Ajuda 1",
        field_type: "birthdate" as const,
        required: true,
        options: originalOptions,
        position: 2,
        settings: originalSettings,
      },
      {
        id: "q2",
        form_id: "orig-form",
        created_at: "2026-01-01",
        label: "Pergunta 2",
        help_text: "",
        field_type: "cpf" as const,
        required: true,
        options: [],
        position: 5,
      },
    ];

    const inputBackup = JSON.stringify(input);
    const cloned = buildCloneQuestions(input, "new-form-id");

    // Não muta a entrada
    expect(JSON.stringify(input)).toBe(inputBackup);

    expect(cloned).toHaveLength(3);

    // Ordem por position
    expect(cloned[0]!.label).toBe("Pergunta 1");
    expect(cloned[0]!.position).toBe(0);
    expect(cloned[0]!.form_id).toBe("new-form-id");
    expect(cloned[0]!.options).toEqual(originalOptions);
    expect(cloned[0]!.options).not.toBe(originalOptions); // cópia profunda
    expect(cloned[0]!.settings).toEqual(originalSettings);
    expect(cloned[0]!.settings).not.toBe(originalSettings); // cópia profunda de settings (T-24c)

    expect(cloned[1]!.label).toBe("Pergunta 2");
    expect(cloned[1]!.position).toBe(1);
    expect(cloned[1]!.form_id).toBe("new-form-id");
    expect(cloned[1]!.settings).toEqual({});

    expect(cloned[2]!.label).toBe("Pergunta 3");
    expect(cloned[2]!.position).toBe(2);
    expect(cloned[2]!.form_id).toBe("new-form-id");

    // Nenhuma questão possui id nem created_at
    cloned.forEach((q) => {
      expect((q as Record<string, unknown>)["id"]).toBeUndefined();
      expect((q as Record<string, unknown>)["created_at"]).toBeUndefined();
    });
  });

  it("lista vazia devolve array vazio sem erros", () => {
    expect(buildCloneQuestions([], "new-form-id")).toEqual([]);
  });
});

describe("cloneForm (T-41)", () => {
  it("caminho feliz: insere o formulário e depois as perguntas, devolvendo { id, slug }", async () => {
    const calls: { table: string; action: string; payload?: unknown }[] = [];

    const fakeClient = {
      from: (table: string) => {
        calls.push({ table, action: "from" });
        if (table === "forms") {
          return {
            select: (_cols: string) => ({
              eq: (col: string, val: string) => ({
                single: async () => {
                  calls.push({ table, action: `select.eq.${col}.${val}` });
                  return {
                    data: {
                      id: "orig-1",
                      owner_id: "user-1",
                      title: "Corrida",
                      description: "Desc",
                      theme: { color: "#22c55e" },
                      consent_text: null,
                      success_message: "Sucesso",
                      max_responses: 10,
                    },
                    error: null,
                  };
                },
              }),
            }),
            insert: (payload: unknown) => {
              calls.push({ table, action: "insert", payload });
              return {
                select: (_cols: string) => ({
                  single: async () => ({
                    data: { id: "new-form-99", slug: (payload as { slug: string }).slug },
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        if (table === "questions") {
          return {
            select: (_cols: string) => ({
              eq: (col: string, val: string) => ({
                order: (_col: string) => async () => {
                  calls.push({ table, action: `select.eq.${col}.${val}.order` });
                  return {
                    data: [
                      {
                        id: "q1",
                        form_id: "orig-1",
                        label: "Nome",
                        help_text: "",
                        field_type: "short_text",
                        required: true,
                        options: [],
                        position: 0,
                      },
                    ],
                    error: null,
                  };
                },
              }),
            }),
            insert: async (payload: unknown) => {
              calls.push({ table, action: "insert", payload });
              return { error: null };
            },
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      },
    };

    const result = await cloneForm(fakeClient as any, "user-1", "orig-1");
    expect(result.id).toBe("new-form-99");
    expect(result.slug).toMatch(/^corrida-copia/);

    // Confirma que 'responses' NUNCA foi chamado
    expect(calls.some((c) => c.table === "responses")).toBe(false);
  });

  it("origem inexistente lança 'Formulário não encontrado.'", async () => {
    const fakeClient = {
      from: (table: string) => {
        if (table === "forms") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: "Not found" } }),
              }),
            }),
          };
        }
        return {};
      },
    };

    await expect(cloneForm(fakeClient as any, "user-1", "nao-existe")).rejects.toThrow(
      "Formulário não encontrado."
    );
  });

  it("conflito de endereço na 1ª tentativa e sucesso na 2ª", async () => {
    let attempts = 0;
    const fakeClient = {
      from: (table: string) => {
        if (table === "forms") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "orig-1",
                    owner_id: "user-1",
                    title: "Evento",
                    description: "",
                    theme: {},
                    consent_text: null,
                    success_message: "",
                    max_responses: null,
                  },
                  error: null,
                }),
              }),
            }),
            insert: (payload: unknown) => ({
              select: () => ({
                single: async () => {
                  attempts++;
                  if (attempts === 1) {
                    return { data: null, error: { code: "23505", message: "duplicate key" } };
                  }
                  return { data: { id: "new-form-ok", slug: (payload as { slug: string }).slug }, error: null };
                },
              }),
            }),
          };
        }
        if (table === "questions") {
          return {
            select: () => ({
              eq: () => ({
                order: () => async () => ({ data: [], error: null }),
              }),
            }),
            insert: async () => ({ error: null }),
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      },
    };

    const result = await cloneForm(fakeClient as any, "user-1", "orig-1");
    expect(attempts).toBe(2);
    expect(result.id).toBe("new-form-ok");
  });

  it("3 conflitos seguidos lançam 'Não foi possível duplicar o formulário.'", async () => {
    let attempts = 0;
    const fakeClient = {
      from: (table: string) => {
        if (table === "forms") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "orig-1",
                    owner_id: "user-1",
                    title: "Evento",
                    description: "",
                    theme: {},
                    consent_text: null,
                    success_message: "",
                    max_responses: null,
                  },
                  error: null,
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => {
                  attempts++;
                  return { data: null, error: { code: "23505", message: "duplicate key" } };
                },
              }),
            }),
          };
        }
        if (table === "questions") {
          return {
            select: () => ({
              eq: () => ({
                order: () => async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      },
    };

    await expect(cloneForm(fakeClient as any, "user-1", "orig-1")).rejects.toThrow(
      "Não foi possível duplicar o formulário."
    );
    expect(attempts).toBe(3);
  });

  it("falha ao inserir perguntas apaga o formulário novo e lança o erro", async () => {
    let deletedId: string | null = null;
    const fakeClient = {
      from: (table: string) => {
        if (table === "forms") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "orig-1",
                    owner_id: "user-1",
                    title: "Evento",
                    description: "",
                    theme: {},
                    consent_text: null,
                    success_message: "",
                    max_responses: null,
                  },
                  error: null,
                }),
              }),
            }),
            insert: (payload: unknown) => ({
              select: () => ({
                single: async () => ({
                  data: { id: "new-created-form", slug: (payload as { slug: string }).slug },
                  error: null,
                }),
              }),
            }),
            delete: () => ({
              eq: (_col: string, val: string) => {
                deletedId = val;
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "questions") {
          return {
            select: () => ({
              eq: () => ({
                order: () => async () => ({
                  data: [
                    {
                      id: "q1",
                      form_id: "orig-1",
                      label: "P1",
                      help_text: "",
                      field_type: "short_text",
                      required: true,
                      options: [],
                      position: 0,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            insert: async () => ({ error: { message: "DB write failed" } }),
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      },
    };

    await expect(cloneForm(fakeClient as any, "user-1", "orig-1")).rejects.toThrow(
      "Não foi possível duplicar o formulário."
    );
    expect(deletedId).toBe("new-created-form");
  });

  it("cliente falso NUNCA recebe from('responses')", async () => {
    const tableQueries: string[] = [];
    const fakeClient = {
      from: (table: string) => {
        tableQueries.push(table);
        if (table === "forms") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "orig-1",
                    owner_id: "user-1",
                    title: "E",
                    description: "",
                    theme: {},
                    consent_text: null,
                    success_message: "",
                    max_responses: null,
                  },
                  error: null,
                }),
              }),
            }),
            insert: (payload: unknown) => ({
              select: () => ({
                single: async () => ({
                  data: { id: "new-f", slug: (payload as { slug: string }).slug },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "questions") {
          return {
            select: () => ({
              eq: () => ({
                order: () => async () => ({ data: [], error: null }),
              }),
            }),
            insert: async () => ({ error: null }),
          };
        }
        return {};
      },
    };

    await cloneForm(fakeClient as any, "user-1", "orig-1");
    expect(tableQueries).not.toContain("responses");
  });
});
