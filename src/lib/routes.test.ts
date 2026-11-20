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

  it("$slug.tsx satisfaz os requisitos de T-24e (HONEYPOT_ERROR_MESSAGE sem literal duplicado, setHp('') no erro, liberação de isSubmittingRef no finally e preservação de respostas)", () => {
    const slugPath = path.join(rootDir, "src/routes/$slug.tsx");
    const content = fs.readFileSync(slugPath, "utf-8");
    const submitPath = path.join(rootDir, "src/lib/submit-response.ts");
    const submitContent = fs.readFileSync(submitPath, "utf-8");

    // submit-response.ts exporta HONEYPOT_ERROR_MESSAGE, GENERIC_SUBMIT_ERROR e resolveSubmitOutcome
    expect(submitContent).toContain("export const HONEYPOT_ERROR_MESSAGE");
    expect(submitContent).toContain("export const GENERIC_SUBMIT_ERROR");
    expect(submitContent).toContain("export function resolveSubmitOutcome");

    // $slug.tsx importa resolveSubmitOutcome, não contém a mensagem antiga "Recarregue a página" nem duplica a literal de HONEYPOT_ERROR_MESSAGE
    expect(content).toContain("resolveSubmitOutcome");
    expect(content).not.toContain("Recarregue a página");
    expect(content).not.toContain("preenchido um campo automaticamente");

    // Existe setHp("") no ramo de erro (outcome.kind !== "success") e não apaga answers/consent/emailConfirmations
    const errorBranchMatch = content.match(/if\s*\(\s*outcome\.kind\s*!==\s*"success"\s*\)\s*\{[\s\S]*?return;\s*\}/);
    expect(errorBranchMatch).not.toBeNull();
    const errorBranch = errorBranchMatch ? errorBranchMatch[0] : "";
    expect(errorBranch).toContain('setHp("")');
    expect(errorBranch).not.toContain("setAnswers(");
    expect(errorBranch).not.toContain("setConsent(");
    expect(errorBranch).not.toContain("setEmailConfirmations(");
    expect(errorBranch).not.toContain("setDone(");

    // isSubmittingRef.current = false e setSending(false) no finally
    const finallyMatch = content.match(/finally\s*\{[\s\S]*?\}/);
    expect(finallyMatch).not.toBeNull();
    const finallyBlock = finallyMatch ? finallyMatch[0] : "";
    expect(finallyBlock).toContain("isSubmittingRef.current = false");
    expect(finallyBlock).toContain("setSending(false)");
  });

  it("c.$token.tsx, ShareLinkCard.tsx, editor e share satisfazem os requisitos de T-44 (M-44)", () => {
    const clientRoutePath = path.join(rootDir, "src/routes/c.$token.tsx");
    const clientContent = fs.readFileSync(clientRoutePath, "utf-8");

    const shareCardPath = path.join(rootDir, "src/components/ShareLinkCard.tsx");
    const shareCardContent = fs.readFileSync(shareCardPath, "utf-8");

    const editorPath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");
    const editorContent = fs.readFileSync(editorPath, "utf-8");

    const sharePath = path.join(rootDir, "src/lib/share.ts");
    const shareContent = fs.readFileSync(sharePath, "utf-8");

    const shareFnPath = path.join(rootDir, "src/lib/share.functions.ts");
    const shareFnContent = fs.readFileSync(shareFnPath, "utf-8");

    // 1. c.$token.tsx trata o estado locked, mantém noindex e no-referrer e contém os textos literais
    expect(clientContent).toContain('"locked"');
    expect(clientContent).toContain("noindex, nofollow");
    expect(clientContent).toContain("no-referrer");
    expect(clientContent).toContain('autoComplete="off"');
    expect(clientContent).toContain('role="alert"');
    expect(clientContent).toContain("Link protegido");
    expect(clientContent).toContain(
      "Digite o código de acesso que o administrador enviou para ver as inscrições.",
    );
    expect(clientContent).toContain("Código de acesso");
    expect(clientContent).toContain("Acessar");
    expect(clientContent).toContain("Código incorreto. Confira e tente novamente.");
    expect(clientContent).toContain(
      "Muitas tentativas. Aguarde 15 minutos e tente de novo.",
    );
    expect(clientContent).toContain(
      "Não foi possível verificar o código agora. Tente novamente.",
    );

    // 2. Editor e ShareLinkCard contêm os textos literais de rótulo e de código e NÃO usam confirm(
    expect(editorContent).toContain("Link público de inscrição");
    expect(editorContent).toContain("Compartilhe este link com quem vai se inscrever.");
    expect(editorContent).not.toContain('from("forms").select("*")');

    expect(shareCardContent).toContain("Link privado do cliente");
    expect(shareCardContent).toContain(
      "Mostra os dados dos inscritos. Compartilhe só com o responsável, junto com o código de acesso, de preferência por outro canal.",
    );
    expect(shareCardContent).toContain(
      "Atenção: este link mostra dados pessoais dos inscritos. Envie só ao responsável.",
    );
    expect(shareCardContent).toContain("Copiar código");
    expect(shareCardContent).toContain(
      "Anote ou envie agora. Este código não aparece de novo. Se perder, gere um novo código: o link continua o mesmo, mas quem já entrou precisará digitar o novo código.",
    );
    expect(shareCardContent).toContain("Link protegido por código de acesso");
    expect(shareCardContent).toContain("Gerar novo código");
    expect(shareCardContent).toContain("Gerar novo link e código");
    expect(shareCardContent).toContain("Desativar link");
    expect(shareCardContent).toContain(
      "Este link não tem código de acesso. Quem tiver o endereço vê os dados.",
    );
    expect(shareCardContent).toContain("Proteger com código");
    expect(shareCardContent).not.toContain("confirm(");
    expect(shareCardContent).not.toContain("window.confirm");

    // 3. Path=/ no cookie (nunca Path=/c/)
    const combinedShareServer = shareContent + "\n" + shareFnContent;
    expect(combinedShareServer).toContain("Path=/");
    expect(combinedShareServer).not.toContain("Path=/c/");
  });
});

describe("Link do grupo fora do carregamento público (T-50 / SEC-46 / QA-46-20)", () => {
  const rootDir = process.cwd();
  const publicFormsPath = path.join(rootDir, "src/lib/public-forms.functions.ts");
  const editResponsePath = path.join(rootDir, "src/lib/edit-response.functions.ts");
  const slugRoutePath = path.join(rootDir, "src/routes/$slug.tsx");
  const editarTokenPath = path.join(rootDir, "src/routes/editar.$token.tsx");
  const editorRoutePath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");

  // Nota: a T-51 adicionou leitura no servidor para devolver groupLink no resultado da inscrição e e-mail (QA-46-20).
  it("nenhuma chamada .select(...) em edit-response.functions.ts contém whatsapp_group_link", () => {
    const editResponseContent = fs.readFileSync(editResponsePath, "utf-8");

    const extractSelectStrings = (content: string): string[] => {
      const matches: string[] = [];
      const regex = /\.select\(\s*(["'`])([\s\S]*?)\1\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        if (m[2]) matches.push(m[2]);
      }
      return matches;
    };

    const editSelects = extractSelectStrings(editResponseContent);
    expect(editSelects.length).toBeGreaterThan(0);

    for (const s of editSelects) {
      expect(s).not.toContain("whatsapp_group_link");
    }
  });

  it("public-forms.functions.ts não possui chave whatsapp_group_link: nem groupLink: no retorno de getPublicForm e contém a coluna nos selects internos (T-50 / T-56 / SEC-46)", () => {
    const publicFormsContent = fs.readFileSync(publicFormsPath, "utf-8");

    // 1. Nenhuma chave de objeto whatsapp_group_link: nem groupLink: no retorno de getPublicForm
    const getPublicFormSection = publicFormsContent.slice(
      publicFormsContent.indexOf("export const getPublicForm"),
      publicFormsContent.indexOf("export const submitResponse"),
    );
    const returnIndex = getPublicFormSection.indexOf("return {");
    expect(returnIndex).toBeGreaterThan(-1);
    const returnBlock = getPublicFormSection.slice(returnIndex);
    const keyAssignmentRegex = /whatsapp_group_link\s*:|groupLink\s*:/;
    expect(keyAssignmentRegex.test(returnBlock)).toBe(false);

    // 2. A palavra whatsapp_group_link aparece no arquivo apenas nos selects internos e no mapeamento de loadPublicFormAndQuestions
    expect(publicFormsContent).toMatch(
      /loadPublicFormAndQuestions[\s\S]*?\.select\([\s\S]*?whatsapp_group_link[\s\S]*?\)/,
    );
    expect(publicFormsContent).toMatch(
      /getPublicForm[\s\S]*?\.select\([\s\S]*?whatsapp_group_link[\s\S]*?\)/,
    );
  });

  it("src/routes/$slug.tsx e src/routes/editar.$token.tsx não contêm a palavra whatsapp_group_link", () => {
    const slugContent = fs.readFileSync(slugRoutePath, "utf-8");
    const editarContent = fs.readFileSync(editarTokenPath, "utf-8");

    expect(slugContent).not.toContain("whatsapp_group_link");
    expect(editarContent).not.toContain("whatsapp_group_link");
  });

  it("src/routes/$slug.tsx contém os textos literais da confirmação, renderiza groupNotice e NÃO contém hasGroupInvite nem whatsapp_group_link (T-51 / T-56 / RF-18 / RF-26)", () => {
    const slugContent = fs.readFileSync(slugRoutePath, "utf-8");

    expect(slugContent).toContain("Grupo de avisos do evento");
    expect(slugContent).toContain("Entrar no grupo do WhatsApp");
    expect(slugContent).toContain("form.groupNotice");
    expect(slugContent).not.toContain("hasGroupInvite");
    expect(slugContent).not.toContain("whatsapp_group_link");
  });

  it("o select do carregamento do editor contém whatsapp_group_link", () => {
    const editorContent = fs.readFileSync(editorRoutePath, "utf-8");
    // Garante que o select do carregamento inicial do formulário no editor inclui whatsapp_group_link
    expect(editorContent).toMatch(/\.select\([\s\S]*?whatsapp_group_link[\s\S]*?\)/);
  });

  it("src/routes/$slug.tsx usa constantes WHATSAPP_BUTTON_* e o botão do grupo não usa accent nem readableTextColor (T-57)", () => {
    const slugContent = fs.readFileSync(slugRoutePath, "utf-8");

    expect(slugContent).toContain("WHATSAPP_BUTTON_BG");
    expect(slugContent).toContain("WHATSAPP_BUTTON_FG");

    // Encontra o elemento <a> do grupo do WhatsApp
    const groupAnchorMatch = slugContent.match(
      /<a[\s\S]*?done\.groupLink[\s\S]*?Entrar no grupo do WhatsApp[\s\S]*?<\/a>/,
    );
    expect(groupAnchorMatch).not.toBeNull();
    const anchorCode = groupAnchorMatch ? groupAnchorMatch[0] : "";

    expect(anchorCode).not.toContain("accent");
    expect(anchorCode).not.toContain("readableTextColor");
  });

  it("public/whatsapp-icon.png existe e possui assinatura de arquivo PNG (T-57)", () => {
    const pngPath = path.join(rootDir, "public/whatsapp-icon.png");
    expect(fs.existsSync(pngPath)).toBe(true);

    const buffer = fs.readFileSync(pngPath);
    // Assinatura PNG: 0x89, 0x50, 0x4E, 0x47
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4E);
    expect(buffer[3]).toBe(0x47);
  });
});

describe("Instrução de tamanho do logotipo no editor (T-58)", () => {
  const rootDir = process.cwd();
  const editorRoutePath = path.join(rootDir, "src/routes/_authenticated.formularios.$id.tsx");

  it("o arquivo do editor contém o texto de apoio exato e o aria-describedby ligado ao id do parágrafo", () => {
    const editorContent = fs.readFileSync(editorRoutePath, "utf-8");
    const exactHint =
      "Tamanho recomendado: altura de 96 px e largura de até 480 px (aparece com 48 px de altura, nítida em telas de alta resolução). Use PNG, SVG ou WebP com fundo transparente, de até 200 KB. Cole o endereço direto da imagem, começando com https://.";

    expect(editorContent).toContain(exactHint);

    // O input do logotipo possui aria-describedby apontando para o id do parágrafo de apoio
    const logoInputMatch = editorContent.match(
      /<input[^>]*value=\{form\.theme\.logo_url[\s\S]*?\/>/,
    );
    expect(logoInputMatch).not.toBeNull();
    const logoInputCode = logoInputMatch ? logoInputMatch[0] : "";

    const describedByMatch = logoInputCode.match(/aria-describedby=["']([^"']+)["']/);
    expect(describedByMatch).not.toBeNull();
    const hintId = describedByMatch ? describedByMatch[1] : "";

    // O parágrafo com o id correspondente existe e contém o texto de apoio
    const pTagRegex = new RegExp(`<p[^>]*id=["']${hintId}["'][^>]*>[\\s\\S]*?<\\/p>`);
    const pTagMatch = editorContent.match(pTagRegex);
    expect(pTagMatch).not.toBeNull();
    expect(pTagMatch ? pTagMatch[0] : "").toContain(exactHint);
  });
});

describe("Página de respostas e Painel — T-60 a T-64: Apoio de contatos e refino mobile (RF-22, QA-46-35, QA-46-37, QA-46-38)", () => {
  const rootDir = process.cwd();
  const respostasRoutePath = path.join(
    rootDir,
    "src/routes/_authenticated.formularios.$id_.respostas.tsx",
  );
  const painelRoutePath = path.join(
    rootDir,
    "src/routes/_authenticated.painel.tsx",
  );

  it("a página de respostas contém os textos exatos e a acessibilidade do botão de contatos (T-60 / T-63 / T-64)", () => {
    const content = fs.readFileSync(respostasRoutePath, "utf-8");

    // 1. Rótulo do botão atualizado
    expect(content).toContain("Baixar contatos para a agenda");
    // Não contém mais o rótulo antigo
    expect(content).not.toContain("Baixar contatos (.vcf)");

    // 2. Não usa mais title="..." no botão de contatos
    const buttonIndex = content.indexOf("Baixar contatos para a agenda");
    expect(buttonIndex).toBeGreaterThan(-1);
    const startTag = content.lastIndexOf("<button", buttonIndex);
    const endTag = content.indexOf(">", buttonIndex);
    const buttonBlock = content.slice(startTag, endTag + 1);
    expect(buttonBlock).not.toContain("title=");
    expect(buttonBlock).toContain("vcf-contacts-hint");

    // 3. Texto de apoio fixo visível
    const exactSupportText =
      "Baixa um arquivo com o nome e o celular de quem informou WhatsApp. Abra o arquivo no celular para adicionar todos à sua agenda de uma vez.";
    expect(content).toContain(exactSupportText);

    // 4. Texto quando desabilitado e contagem
    expect(content).toContain("vcfDisabledMessage");
    expect(content).toContain("vcfSummaryText");

    // 5. Botão/link Como usar e Diálogo com título e passos numerados
    expect(content).toContain("Como usar");
    expect(content).toContain("Como usar o arquivo de contatos");
    expect(content).toContain("Baixe o arquivo.");
    expect(content).toContain("No celular, abra o arquivo baixado e escolha Contatos.");
    expect(content).toContain(
      "No WhatsApp, crie o grupo e adicione os contatos. Se preferir, envie o link do grupo.",
    );
    expect(content).toContain("Entendi");
  });

  it("a página de respostas estrutura cabeçalho, barra compacta e cartão de contatos em coluna (T-62 / T-63 / T-64)", () => {
    const content = fs.readFileSync(respostasRoutePath, "utf-8");

    // (a) A barra de 4 botões NÃO contém grid-cols-2 nem min-h-11 (bloco entre o comentário do bloco 2 e o do bloco 3)
    const block2Comment = "Bloco 2";
    const block3Comment = "Bloco 3";
    const idx2 = content.indexOf(block2Comment);
    const idx3 = content.indexOf(block3Comment);
    expect(idx2).toBeGreaterThan(-1);
    expect(idx3).toBeGreaterThan(idx2);
    const block2Content = content.slice(idx2, idx3);
    expect(block2Content).not.toContain("grid-cols-2");
    expect(block2Content).not.toContain("min-h-11");
    expect(block2Content).toContain("flex flex-wrap items-center gap-2");

    // (b) O cartão contém flex flex-col items-start e o botão de contatos vem ANTES do id="vcf-contacts-hint"
    expect(content).toContain("flex flex-col items-start");
    const downloadContactsIndex = content.indexOf("Baixar contatos para a agenda");
    const hintIndex = content.indexOf('id="vcf-contacts-hint"');
    expect(downloadContactsIndex).toBeGreaterThan(-1);
    expect(hintIndex).toBeGreaterThan(-1);
    expect(downloadContactsIndex).toBeLessThan(hintIndex);

    // (c) Existem id="vcf-contacts-hint" e id="vcf-contacts-count", cada um exatamente uma vez, e aria-describedby no botão
    const hintOccurrences = content.match(/id=["']vcf-contacts-hint["']/g) || [];
    const countOccurrences = content.match(/id=["']vcf-contacts-count["']/g) || [];
    expect(hintOccurrences).toHaveLength(1);
    expect(countOccurrences).toHaveLength(1);
    expect(content).toContain("vcf-contacts-hint vcf-contacts-count");

    // (d) Como usar tem ring-1 e min-h-11 e não tem underline
    const howToUseIdx = content.indexOf("setHowToUseOpen(true)");
    expect(howToUseIdx).toBeGreaterThan(-1);
    const howToUseStart = content.lastIndexOf("<button", howToUseIdx);
    const howToUseEnd = content.indexOf("</button>", howToUseIdx);
    const howToUseBtn = content.slice(howToUseStart, howToUseEnd);
    expect(howToUseBtn).toContain("Como usar");
    expect(howToUseBtn).toContain("ring-1");
    expect(howToUseBtn).toContain("min-h-11");
    expect(howToUseBtn).not.toContain("underline");

    // (e) Importa Download de lucide-react com aria-hidden e não importa Info
    expect(content).toMatch(/import\s*\{[^}]*Download[^}]*\}\s*from\s*["']lucide-react["']/);
    expect(content).not.toMatch(/import\s*\{[^}]*Info[^}]*\}\s*from\s*["']lucide-react["']/);
    expect(content).toMatch(/<Download[^>]*aria-hidden/);

    // (f) Link ← Editor tem min-h-11
    const editorLinkIdx = content.indexOf("← Editor");
    expect(editorLinkIdx).toBeGreaterThan(-1);
    const editorLinkStart = content.lastIndexOf("<Link", editorLinkIdx);
    const editorLink = content.slice(editorLinkStart, editorLinkIdx);
    expect(editorLink).toContain("min-h-11");

    // Foco visível
    expect(content).toContain("focus-visible:ring-2");
  });

  it("o painel organiza os cartões de formulário com alvos de toque e responsividade mobile (T-64)", () => {
    const painelContent = fs.readFileSync(painelRoutePath, "utf-8");

    // (f) O link Respostas, e os botões Duplicar e Excluir têm min-h-11 e px-4
    const respostasIdx = painelContent.indexOf("/formularios/$id/respostas");
    const duplicarIdx = painelContent.indexOf("duplicateForm.mutate(form.id)");
    const excluirIdx = painelContent.indexOf("setFormToDelete({");
    expect(respostasIdx).toBeGreaterThan(-1);
    expect(duplicarIdx).toBeGreaterThan(-1);
    expect(excluirIdx).toBeGreaterThan(-1);

    const respostasTag = painelContent.slice(painelContent.lastIndexOf("<Link", respostasIdx), painelContent.indexOf("</Link>", respostasIdx));
    const duplicarTag = painelContent.slice(painelContent.lastIndexOf("<button", duplicarIdx), painelContent.indexOf("</button>", duplicarIdx));
    const excluirTag = painelContent.slice(painelContent.lastIndexOf("<button", excluirIdx), painelContent.indexOf("</button>", excluirIdx));

    expect(respostasTag).toContain("min-h-11");
    expect(respostasTag).toContain("px-4");
    expect(duplicarTag).toContain("min-h-11");
    expect(duplicarTag).toContain("px-4");
    expect(excluirTag).toContain("min-h-11");
    expect(excluirTag).toContain("px-4");

    // (g) Título tem line-clamp-2 e sm:truncate
    expect(painelContent).toContain("line-clamp-2");
    expect(painelContent).toContain("sm:truncate");

    // (h) col-span-2 no Respostas
    expect(respostasTag).toContain("col-span-2");

    // (i) aria-label Duplicar o formulário e Excluir o formulário continuam
    expect(duplicarTag).toContain("Duplicar o formulário");
    expect(excluirTag).toContain("Excluir o formulário");

    // (j) Nenhum dos três tem text-xs sem prefixo sm:
    expect(respostasTag).not.toMatch(/(^|[\s"'])text-xs([\s"']|$)/);
    expect(duplicarTag).not.toMatch(/(^|[\s"'])text-xs([\s"']|$)/);
    expect(excluirTag).not.toMatch(/(^|[\s"'])text-xs([\s"']|$)/);
  });
});

describe("Imagem de capa do formulário — T-61 (RF-27, QA-46-36)", () => {
  const rootDir = process.cwd();
  const editorPath = path.join(
    rootDir,
    "src/routes/_authenticated.formularios.$id.tsx",
  );
  const slugPath = path.join(rootDir, "src/routes/$slug.tsx");
  const editTokenPath = path.join(rootDir, "src/routes/editar.$token.tsx");

  it("o editor contém o campo de capa, rótulo, apoio, erro e aria-describedby", () => {
    const content = fs.readFileSync(editorPath, "utf-8");

    // Rótulo exato
    expect(content).toContain("URL da imagem de capa (opcional)");
    expect(content).toContain('id="form-theme-cover-url"');
    expect(content).toContain('aria-describedby="form-theme-cover-url-hint"');

    // Texto de apoio exato
    const exactSupportText =
      "Imagem de capa: 1200 × 400 px (proporção 3:1), PNG, JPG ou WebP de até 300 KB. Aparece no topo do formulário, em largura total. Use letras grandes (mínimo de 60 px de altura) e deixe uma margem de 40 px nas bordas. O texto dentro da imagem não é lido por leitores de tela: repita o essencial no título ou na descrição. Cole o endereço direto da imagem, começando com https://.";
    expect(content).toContain(exactSupportText);

    // Mensagem de erro de validação
    expect(content).toContain(
      "Cole o endereço da imagem começando com https://",
    );
  });

  it("$slug.tsx e editar.$token.tsx renderizam a imagem de capa com aspect-[3/1], object-cover e alt vazio", () => {
    const slugContent = fs.readFileSync(slugPath, "utf-8");
    const editTokenContent = fs.readFileSync(editTokenPath, "utf-8");

    for (const [name, content] of [
      ["$slug.tsx", slugContent],
      ["editar.$token.tsx", editTokenContent],
    ]) {
      expect(content, `${name} deve verificar theme?.cover_url`).toContain(
        "cover_url",
      );
      expect(content, `${name} deve usar aspect-[3/1]`).toContain(
        "aspect-[3/1]",
      );
      expect(content, `${name} deve usar object-cover`).toContain(
        "object-cover",
      );
      expect(content, `${name} deve usar alt=\"\" para imagem decorativa`).toContain(
        'alt=""',
      );
    }
  });
});

describe("Painel — Atalhos para o formulário publicado — T-65 (RF-28, QA-46-39, SEC-38)", () => {
  const rootDir = process.cwd();
  const painelPath = path.join(rootDir, "src/routes/_authenticated.painel.tsx");

  it("o painel importa publicFormUrl, ExternalLink e Copy", () => {
    const content = fs.readFileSync(painelPath, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*publicFormUrl[^}]*\}\s*from\s*["'][^"']*form-links["']/);
    expect(content).toMatch(/import\s*\{[^}]*ExternalLink[^}]*\}\s*from\s*["']lucide-react["']/);
    expect(content).toMatch(/import\s*\{[^}]*Copy[^}]*\}\s*from\s*["']lucide-react["']/);
  });

  it("o painel contém atalhos condicionais a status !== 'draft', textos e acessibilidade", () => {
    const content = fs.readFileSync(painelPath, "utf-8");

    // Condiciona atalhos a status !== 'draft'
    expect(content).toMatch(/status\s*!==\s*["']draft["']/);

    // Contém aria-label descritivos
    expect(content).toContain("Abrir o formulário");
    expect(content).toContain("Copiar o link do formulário");

    // Link público abre em nova aba com rel seguro
    expect(content).toContain('target="_blank"');
    expect(content).toContain('rel="noopener noreferrer"');

    // Toasts de cópia
    expect(content).toContain("Link copiado!");
    expect(content).toContain("Não foi possível copiar o link. Tente novamente.");

    // Alvos de toque no celular
    expect(content).toContain("min-h-11");

    // Nunca expõe links privados de cliente nem tokens de compartilhamento
    expect(content).not.toContain("share_token");
    expect(content).not.toMatch(/href=.*\/c\//);

    // Os aria-label antigos continuam intactos
    expect(content).toContain("Duplicar o formulário");
    expect(content).toContain("Excluir o formulário");
  });
});





