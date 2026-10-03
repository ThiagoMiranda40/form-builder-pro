import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Função pura que acrescenta o bloco previews: {} se ele ainda não existir,
 * preservando todo o restante da configuração e sem alterar o objeto original.
 */
export function addPreviewsBlock(config) {
  if (!config || typeof config !== "object") {
    return config;
  }
  if ("previews" in config) {
    return { ...config };
  }
  return {
    ...config,
    previews: {},
  };
}

// Execução como script CLI (ex.: node scripts/add-previews-block.mjs)
const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const currentFilePath = path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (scriptPath && (scriptPath === currentFilePath || scriptPath.endsWith("add-previews-block.mjs"))) {
  const wranglerPath = path.resolve(process.cwd(), ".output/server/wrangler.json");
  if (!fs.existsSync(wranglerPath)) {
    console.warn(`[add-previews-block] Arquivo não encontrado: ${wranglerPath}`);
    process.exit(0);
  }

  try {
    const raw = fs.readFileSync(wranglerPath, "utf-8");
    const json = JSON.parse(raw);
    const updated = addPreviewsBlock(json);
    fs.writeFileSync(wranglerPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
    console.log("[add-previews-block] Bloco \"previews\": {} garantido em .output/server/wrangler.json");
  } catch (err) {
    console.error("[add-previews-block] Erro ao atualizar wrangler.json:", err);
    process.exit(1);
  }
}
