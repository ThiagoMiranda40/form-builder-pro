import { describe, expect, it } from "vitest";
import { editorSnapshot, isEditorDirty } from "./editor-dirty";

describe("editor-dirty (T-34b / M-32 / M-35)", () => {
  const baseForm = {
    title: "Formulário de Treino",
    description: "Descrição de teste",
    slug: "treino-2026",
    theme: { color: "#4f46e5", font: "sans" },
    max_responses: 50,
    closes_at: "2026-10-15T23:59:00",
    consent_text: "Concordo com os termos",
    success_message: "Inscrição confirmada!",
    status: "published",
    // Campos que o save() NÃO grava:
    share_token: "tok_12345",
    created_at: "2026-10-01",
    user_id: "user_abc",
  };

  const baseQuestions = [
    {
      id: "q1",
      label: "Nome completo",
      help_text: "Preencha seu nome",
      field_type: "short_text",
      required: true,
      options: [],
      position: 0,
      // Campo que o save() NÃO grava:
      form_id: "form_123",
    },
    {
      id: "q2",
      label: "Distância",
      help_text: "Escolha a distância",
      field_type: "single_choice",
      required: true,
      options: ["5 km", "10 km"],
      position: 1,
      form_id: "form_123",
    },
  ];

  it("iguais não sujam", () => {
    const snap1 = editorSnapshot(baseForm, baseQuestions);
    const snap2 = editorSnapshot({ ...baseForm }, [...baseQuestions]);
    expect(isEditorDirty(snap1, snap2)).toBe(false);
  });

  it("saved nulo (carregando) não suja", () => {
    const current = editorSnapshot(baseForm, baseQuestions);
    expect(isEditorDirty(current, null)).toBe(false);
  });

  it("mudar rótulo suja", () => {
    const saved = editorSnapshot(baseForm, baseQuestions);
    const modifiedQuestions = [
      { ...baseQuestions[0]!, label: "Nome alterado" },
      baseQuestions[1]!,
    ];
    const current = editorSnapshot(baseForm, modifiedQuestions);
    expect(isEditorDirty(current, saved)).toBe(true);
  });

  it("mudar ordem das perguntas suja", () => {
    const saved = editorSnapshot(baseForm, baseQuestions);
    const reorderedQuestions = [
      { ...baseQuestions[1]!, position: 0 },
      { ...baseQuestions[0]!, position: 1 },
    ];
    const current = editorSnapshot(baseForm, reorderedQuestions);
    expect(isEditorDirty(current, saved)).toBe(true);
  });

  it("mudar opção suja", () => {
    const saved = editorSnapshot(baseForm, baseQuestions);
    const modifiedQuestions = [
      baseQuestions[0]!,
      { ...baseQuestions[1]!, options: ["5 km", "10 km", "21 km"] },
    ];
    const current = editorSnapshot(baseForm, modifiedQuestions);
    expect(isEditorDirty(current, saved)).toBe(true);
  });

  it("mudar slug suja", () => {
    const saved = editorSnapshot(baseForm, baseQuestions);
    const modifiedForm = { ...baseForm, slug: "outro-slug" };
    const current = editorSnapshot(modifiedForm, baseQuestions);
    expect(isEditorDirty(current, saved)).toBe(true);
  });

  it("mudar cor do tema suja", () => {
    const saved = editorSnapshot(baseForm, baseQuestions);
    const modifiedForm = {
      ...baseForm,
      theme: { color: "#22c55e", font: "sans" },
    };
    const current = editorSnapshot(modifiedForm, baseQuestions);
    expect(isEditorDirty(current, saved)).toBe(true);
  });

  it("share_token e qualquer campo que o save() não grava NÃO sujam", () => {
    const saved = editorSnapshot(baseForm, baseQuestions);
    const modifiedForm = {
      ...baseForm,
      share_token: "novo_token_diferente",
      client_link: "https://exemplo.com/c/123",
      updated_at: "2026-10-04T22:00:00",
    };
    const modifiedQuestions = baseQuestions.map((q) => ({
      ...q,
      form_id: "outro_form_id",
      created_at: "2026-10-04",
    }));
    const current = editorSnapshot(modifiedForm, modifiedQuestions);
    expect(isEditorDirty(current, saved)).toBe(false);
  });

  it("mover e devolver ao lugar original não suja", () => {
    const saved = editorSnapshot(baseForm, baseQuestions);
    // Simula mover
    const moved = [
      { ...baseQuestions[1]!, position: 0 },
      { ...baseQuestions[0]!, position: 1 },
    ];
    expect(isEditorDirty(editorSnapshot(baseForm, moved), saved)).toBe(true);

    // Devolve ao lugar original
    const restored = [
      { ...baseQuestions[0]!, position: 0 },
      { ...baseQuestions[1]!, position: 1 },
    ];
    expect(isEditorDirty(editorSnapshot(baseForm, restored), saved)).toBe(false);
  });

  it("a ordem das chaves no objeto não muda o resultado", () => {
    const formKeyOrder1 = {
      title: "Título",
      status: "draft",
      theme: { color: "#ff0000", font: "sans" },
      slug: "meu-slug",
    };
    const formKeyOrder2 = {
      slug: "meu-slug",
      theme: { font: "sans", color: "#ff0000" },
      title: "Título",
      status: "draft",
    };
    const snap1 = editorSnapshot(formKeyOrder1, baseQuestions);
    const snap2 = editorSnapshot(formKeyOrder2, baseQuestions);
    expect(snap1).toBe(snap2);
    expect(isEditorDirty(snap1, snap2)).toBe(false);
  });

  describe("T-24c: novos campos de evento e limites de idade sujam o editor", () => {
    it("mudar event_date suja", () => {
      const saved = editorSnapshot(baseForm, baseQuestions);
      const modified = { ...baseForm, event_date: "2026-11-10" };
      expect(isEditorDirty(editorSnapshot(modified, baseQuestions), saved)).toBe(true);
    });

    it("mudar event_time suja", () => {
      const saved = editorSnapshot(baseForm, baseQuestions);
      const modified = { ...baseForm, event_time: "07:30" };
      expect(isEditorDirty(editorSnapshot(modified, baseQuestions), saved)).toBe(true);
    });

    it("mudar event_location suja", () => {
      const saved = editorSnapshot(baseForm, baseQuestions);
      const modified = { ...baseForm, event_location: "Parque Ibirapuera" };
      expect(isEditorDirty(editorSnapshot(modified, baseQuestions), saved)).toBe(true);
    });

    it("mudar settings de limites de idade na pergunta suja", () => {
      const saved = editorSnapshot(baseForm, baseQuestions);
      const modifiedQuestions = [
        { ...baseQuestions[0]!, settings: { minAge: 18, maxAge: 60 } },
        baseQuestions[1]!,
      ];
      expect(isEditorDirty(editorSnapshot(baseForm, modifiedQuestions), saved)).toBe(true);
    });
  });
});
