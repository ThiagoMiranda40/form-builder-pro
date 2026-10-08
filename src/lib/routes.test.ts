import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Rotas e hierarquia do TanStack Router (T-12 / BUG-03)", () => {
  const rootDir = process.cwd();
  const oldRoutePath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.respostas.tsx");
  const newRoutePath = path.join(rootDir, "src/routes/_authenticated.formularios.$id_.respostas.tsx");
  const routeTreePath = path.join(rootDir, "src/routeTree.gen.ts");

  it("o arquivo antigo de rota filha não deve mais existir", () => {
    expect(fs.existsSync(oldRoutePath)).toBe(false);
  });

  it("o arquivo novo de rota irmã (_authenticated.formularios.$id_.respostas.tsx) deve existir", () => {
    expect(fs.existsSync(newRoutePath)).toBe(true);
  });

  it("em routeTree.gen.ts a rota de respostas tem AuthenticatedRoute como pai (e não a rota do editor)", () => {
    const content = fs.readFileSync(routeTreePath, "utf-8");

    // Procura a declaração da rota de respostas no routeTree.gen.ts
    // Deve apontar para AuthenticatedRoute e NÃO para AuthenticatedFormulariosIdRoute
    const respostasRouteMatch = content.match(
      /const AuthenticatedFormulariosId_?RespostasRoute =[\s\S]*?getParentRoute:\s*\(\)\s*=>\s*([A-Za-z0-9_]+)/,
    );

    expect(respostasRouteMatch).not.toBeNull();
    const parentRoute = respostasRouteMatch ? respostasRouteMatch[1] : "";

    // O pai DEVE ser AuthenticatedRoute, nunca AuthenticatedFormulariosIdRoute
    expect(parentRoute).toBe("AuthenticatedRoute");
    expect(parentRoute).not.toBe("AuthenticatedFormulariosIdRoute");
  });

  it("os arquivos das páginas legais existem e não têm /$slug como rota pai (T-17)", () => {
    const termosPath = path.join(rootDir, "src/routes/legal.termos-de-uso.tsx");
    const politicaPath = path.join(rootDir, "src/routes/legal.politica-de-privacidade.tsx");

    expect(fs.existsSync(termosPath)).toBe(true);
    expect(fs.existsSync(politicaPath)).toBe(true);

    const content = fs.readFileSync(routeTreePath, "utf-8");

    // No routeTree.gen.ts, as rotas /legal/... não devem ter a rota Slug como getParentRoute
    const termosMatch = content.match(
      /const LegalTermosDeUsoRoute =[\s\S]*?getParentRoute:\s*\(\)\s*=>\s*([A-Za-z0-9_]+)/,
    );
    const politicaMatch = content.match(
      /const LegalPoliticaDePrivacidadeRoute =[\s\S]*?getParentRoute:\s*\(\)\s*=>\s*([A-Za-z0-9_]+)/,
    );

    if (termosMatch) {
      expect(termosMatch[1]).not.toMatch(/Slug/i);
    }
    if (politicaMatch) {
      expect(politicaMatch[1]).not.toMatch(/Slug/i);
    }
  });

  it("o arquivo da rota do cliente c.$token.tsx existe e não é filha de /$slug (T-25)", () => {
    const clientRoutePath = path.join(rootDir, "src/routes/c.$token.tsx");
    expect(fs.existsSync(clientRoutePath)).toBe(true);

    if (fs.existsSync(routeTreePath)) {
      const content = fs.readFileSync(routeTreePath, "utf-8");
      const clientRouteMatch = content.match(
        /const CTokenRoute =[\s\S]*?getParentRoute:\s*\(\)\s*=>\s*([A-Za-z0-9_]+)/
      );
      if (clientRouteMatch) {
        expect(clientRouteMatch[1]).not.toMatch(/Slug/i);
        expect(clientRouteMatch[1]).toMatch(/^rootRoute/);
      }
    }
  });

  it("c.$token.tsx importa buildClientLinkMeta, define og:title e og:description e mantém noindex e no-referrer (T-39)", () => {
    const clientRoutePath = path.join(rootDir, "src/routes/c.$token.tsx");
    const content = fs.readFileSync(clientRoutePath, "utf-8");

    expect(content).toContain("buildClientLinkMeta");
    expect(content).toContain("og:title");
    expect(content).toContain("og:description");
    expect(content).toContain("noindex, nofollow");
    expect(content).toContain("no-referrer");

    const slugRoutePath = path.join(rootDir, "src/routes/$slug.tsx");
    const slugContent = fs.readFileSync(slugRoutePath, "utf-8");
    expect(slugContent).toContain("buildFormMeta");
  });

  it("editor de formulários satisfaz os requisitos de T-34 (M-32)", () => {
    const editorPath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // (a) os 4 aria-label literais do item 3
    expect(editorContent).toContain("Arrastar pergunta");
    expect(editorContent).toContain("Mover pergunta");
    expect(editorContent).toContain("para cima");
    expect(editorContent).toContain("para baixo");
    expect(editorContent).toContain("Excluir pergunta");

    // (b) lg:sticky
    expect(editorContent).toContain("lg:sticky");

    // (c) o uso de AlertDialog e dos textos literais
    expect(editorContent).toContain("AlertDialog");
    expect(editorContent).toContain("Excluir esta pergunta?");
    expect(editorContent).toContain("A nova pergunta entra logo abaixo da pergunta selecionada.");

    // (d) que NÃO há <span com onClick no arquivo
    expect(editorContent).not.toMatch(/<span[^>]*onClick/);

    // (e) que package.json não contém dnd-kit, react-beautiful-dnd, sortablejs nem react-sortable
    const pkgPath = path.join(rootDir, "package.json");
    const pkgContent = fs.readFileSync(pkgPath, "utf-8");
    expect(pkgContent).not.toContain("dnd-kit");
    expect(pkgContent).not.toContain("react-beautiful-dnd");
    expect(pkgContent).not.toContain("sortablejs");
    expect(pkgContent).not.toContain("react-sortable");
  });

  it("editor de formulários satisfaz os requisitos de T-34b (largura, barra fixa, dirty e atalhos)", () => {
    const editorPath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // (a) contém minmax(0,1fr) e NÃO contém grid-cols-[1fr_360px]
    expect(editorContent).toContain("minmax(0,1fr)");
    expect(editorContent).not.toContain("grid-cols-[1fr_360px]");

    // (b) sticky bottom-4 e os textos literais
    expect(editorContent).toContain("sticky bottom-4");
    expect(editorContent).toContain("Alterações não salvas");
    expect(editorContent).toContain("Tudo salvo");

    // (c) beforeunload
    expect(editorContent).toContain("beforeunload");

    // (d) metaKey e ctrlKey
    expect(editorContent).toContain("metaKey");
    expect(editorContent).toContain("ctrlKey");
  });

  it("editor de formulários satisfaz os requisitos de T-34c (Enter nas opções, adicionar abaixo, painel sem aba Pergunta)", () => {
    const qefPath = path.join(rootDir, "src/components/QuestionEditFields.tsx");
    const qefContent = fs.readFileSync(qefPath, "utf-8");
    const editorPath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // (a) que QuestionEditFields.tsx NÃO contém setText(options.join
    expect(qefContent).not.toContain("setText(options.join");

    // (b) que o editor contém "Adicionar pergunta abaixo da pergunta" e "Adicionar uma pergunta logo abaixo desta"
    expect(editorContent).toContain("Adicionar pergunta abaixo da pergunta");
    expect(editorContent).toContain("Adicionar uma pergunta logo abaixo desta");

    // (c) que o editor NÃO contém setTab("pergunta") nem "pergunta" | "aparencia" nem tab === "pergunta"
    expect(editorContent).not.toContain('setTab("pergunta")');
    expect(editorContent).not.toContain('"pergunta" | "aparencia"');
    expect(editorContent).not.toContain('tab === "pergunta"');

    // (d) que o editor contém adding
    expect(editorContent).toContain("adding");
  });

  it("editor de formulários satisfaz os requisitos de T-34d (rolagem automática ao arrastar pergunta)", () => {
    const editorPath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    // (a) que o editor importa autoScrollSpeed de drag-autoscroll
    expect(editorContent).toMatch(/import\s*\{[^}]*autoScrollSpeed[^}]*\}\s*from\s*["'][^"']*drag-autoscroll["']/);

    // (b) que contém requestAnimationFrame, cancelAnimationFrame e window.scrollBy
    expect(editorContent).toContain("requestAnimationFrame");
    expect(editorContent).toContain("cancelAnimationFrame");
    expect(editorContent).toContain("window.scrollBy");

    // (c) que o editor contém um addEventListener("dragover" em document
    expect(editorContent).toMatch(/document\.addEventListener\(\s*["']dragover["']/);
  });

  it("painel e editor satisfazem os requisitos de T-41 (duplicar formulário)", () => {
    const painelPath = path.join(rootDir, "src/routes/_authenticated.painel.tsx");
    const painelContent = fs.readFileSync(painelPath, "utf-8");
    const editorPath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    const successToast = "Formulário duplicado como rascunho. Revise a descrição, a data, o prazo e as vagas antes de publicar.";
    const dirtyHint = "Salve as alterações antes de duplicar";

    // Painel e editor importam cloneForm de clone-form
    expect(painelContent).toMatch(/import\s*\{[^}]*cloneForm[^}]*\}\s*from\s*["'][^"']*clone-form["']/);
    expect(editorContent).toMatch(/import\s*\{[^}]*cloneForm[^}]*\}\s*from\s*["'][^"']*clone-form["']/);

    // Contêm o texto de toast de sucesso
    expect(painelContent).toContain(successToast);
    expect(editorContent).toContain(successToast);

    // Editor contém a dica de alterações pendentes
    expect(editorContent).toContain(dirtyHint);
  });

  it("painel e DeleteFormDialog satisfazem os requisitos de T-42 (excluir formulário com diálogo próprio)", () => {
    const painelPath = path.join(rootDir, "src/routes/_authenticated.painel.tsx");
    const painelContent = fs.readFileSync(painelPath, "utf-8");
    const dialogPath = path.join(rootDir, "src/components/DeleteFormDialog.tsx");
    const dialogContent = fs.readFileSync(dialogPath, "utf-8");

    // (a) que _authenticated.painel.tsx NÃO contém confirm(
    expect(painelContent).not.toContain("confirm(");

    // (b) que importa DeleteFormDialog e deleteFormCopy
    expect(painelContent).toMatch(/import\s*\{[^}]*DeleteFormDialog[^}]*\}\s*from\s*["'][^"']*DeleteFormDialog["']/);
    expect(painelContent).toMatch(/import\s*\{[^}]*deleteFormCopy[^}]*\}\s*from\s*["'][^"']*delete-form-copy["']/);

    // (c) que DeleteFormDialog.tsx contém AlertDialog, preventDefault e type="checkbox"
    expect(dialogContent).toContain("AlertDialog");
    expect(dialogContent).toContain("preventDefault");
    expect(dialogContent).toContain('type="checkbox"');
  });

  it("respostas e ResponseDetailDialog satisfazem os requisitos de T-43 (botão WhatsApp)", () => {
    const respostasPath = path.join(rootDir, "src/routes/_authenticated.formularios.$id_.respostas.tsx");
    const respostasContent = fs.readFileSync(respostasPath, "utf-8");
    const clientPath = path.join(rootDir, "src/routes/c.$token.tsx");
    const clientContent = fs.readFileSync(clientPath, "utf-8");
    const dialogPath = path.join(rootDir, "src/components/ResponseDetailDialog.tsx");
    const dialogContent = fs.readFileSync(dialogPath, "utf-8");
    const whatsappPath = path.join(rootDir, "src/lib/whatsapp.ts");
    const whatsappContent = fs.existsSync(whatsappPath) ? fs.readFileSync(whatsappPath, "utf-8") : "";

    // (a) que a tela do administrador contém whatsappContext
    expect(respostasContent).toContain("whatsappContext");

    // (b) que c.$token.tsx NÃO contém whatsappContext nem wa.me
    expect(clientContent).not.toContain("whatsappContext");
    expect(clientContent).not.toContain("wa.me");

    // (c) que ResponseDetailDialog.tsx contém rel="noopener noreferrer" e target="_blank"
    expect(dialogContent).toContain('rel="noopener noreferrer"');
    expect(dialogContent).toContain('target="_blank"');

    // (d) que whatsapp.ts contém "https://wa.me/"
    expect(whatsappContent).toContain("https://wa.me/");
  });

  it("editor, formulário público e migração satisfazem os requisitos de T-24c (data do evento e limites de idade)", () => {
    const editorPath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");
    const questionFieldsPath = path.join(rootDir, "src/components/QuestionEditFields.tsx");
    const editorContent = fs.readFileSync(editorPath, "utf-8");
    const questionFieldsContent = fs.readFileSync(questionFieldsPath, "utf-8");
    const fullEditorText = editorContent + "\n" + questionFieldsContent;

    // Confirme que o editor contém "Data do evento", "Horário (opcional)", "Local (opcional)", "Limpar data", "Só maiores de 18", "Só menores de 18", "Sem limite" e "A idade mínima não pode ser maior que a máxima."
    expect(fullEditorText).toContain("Data do evento");
    expect(fullEditorText).toContain("Horário (opcional)");
    expect(fullEditorText).toContain("Local (opcional)");
    expect(fullEditorText).toContain("Limpar data");
    expect(fullEditorText).toContain("Só maiores de 18");
    expect(fullEditorText).toContain("Só menores de 18");
    expect(fullEditorText).toContain("Sem limite");
    expect(fullEditorText).toContain("A idade mínima não pode ser maior que a máxima.");

    // Que $slug.tsx contém "Evento: "
    const slugPath = path.join(rootDir, "src/routes/$slug.tsx");
    const slugContent = fs.readFileSync(slugPath, "utf-8");
    expect(slugContent).toContain("Evento: ");

    // Que a migração contém event_date, event_time, event_location e settings
    const migrationPath = path.join(
      rootDir,
      "supabase/migrations/20261007120000_data_do_evento_e_limites_de_idade.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const migrationContent = fs.readFileSync(migrationPath, "utf-8");
    expect(migrationContent).toContain("event_date");
    expect(migrationContent).toContain("event_time");
    expect(migrationContent).toContain("event_location");
    expect(migrationContent).toContain("settings");
  });

  it("honeypot em $slug.tsx possui atributos anti-autofill, sem label e nome opaco (T-24d, SEC-29)", () => {
    const slugPath = path.join(rootDir, "src/routes/$slug.tsx");
    const content = fs.readFileSync(slugPath, "utf-8");

    // O input NÃO tem name="hp"
    expect(content).not.toMatch(/<input[^>]*name=["']hp["']/);
    // Tem name="zq_trap_7f3" e id="zq_trap_7f3"
    expect(content).toContain('name="zq_trap_7f3"');
    expect(content).toContain('id="zq_trap_7f3"');
    // Tem atributos anti-autofill
    expect(content).toContain('autoComplete="off"');
    expect(content).toContain('data-1p-ignore="true"');
    expect(content).toContain('data-lpignore="true"');
    expect(content).toContain('data-form-type="other"');
    expect(content).toContain('autoCapitalize="off"');
    expect(content).toContain('autoCorrect="off"');
    expect(content).toContain("spellCheck={false}");
    // Sem <label associado
    expect(content).not.toContain('htmlFor="zq_trap_7f3"');
    // Form possui noValidate
    expect(content).toMatch(/<form[^>]*noValidate/);
    // Payload continua enviando a chave hp
    expect(content).toContain("data: { slug, answers, consent, hp }");
  });
});


