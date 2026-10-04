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
});


