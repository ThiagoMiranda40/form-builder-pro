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
});
