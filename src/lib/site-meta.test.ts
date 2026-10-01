import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SITE_URL,
  SITE_TITLE,
  SITE_DESCRIPTION,
  OG_IMAGE,
} from "./site-meta";

describe("site-meta (T-18)", () => {
  it("exporta constantes com título e descrição da Corre Time", () => {
    expect(SITE_URL).toBe("https://inscricoes.corretime.com.br");
    expect(SITE_TITLE).toBe("Inscrições | Corre Time");
    expect(SITE_DESCRIPTION).toBe(
      "Faça sua inscrição online e corrija seus dados depois pelo link que enviamos ao seu e-mail."
    );
  });

  it("OG_IMAGE é URL absoluta https para og-image.png", () => {
    expect(OG_IMAGE.startsWith("https://")).toBe(true);
    expect(OG_IMAGE).toBe("https://inscricoes.corretime.com.br/og-image.png");
  });

  it("os três arquivos de marca existem em public/", () => {
    const publicDir = path.resolve(process.cwd(), "public");
    const faviconPath = path.join(publicDir, "favicon.ico");
    const appleIconPath = path.join(publicDir, "apple-touch-icon.png");
    const ogImagePath = path.join(publicDir, "og-image.png");

    expect(fs.existsSync(faviconPath)).toBe(true);
    expect(fs.existsSync(appleIconPath)).toBe(true);
    expect(fs.existsSync(ogImagePath)).toBe(true);
  });

  it("og-image.png tem exatamente 1200x630 nos bytes 16 a 24 do cabeçalho PNG", () => {
    const ogImagePath = path.resolve(process.cwd(), "public/og-image.png");
    const buffer = fs.readFileSync(ogImagePath);

    // PNG Header: 8 bytes assinatura, 4 bytes chunk length ('IHDR'), 4 bytes chunk type ('IHDR'),
    // bytes 16-19: largura (uint32be), bytes 20-23: altura (uint32be)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  it("favicon.ico começa com os bytes 00 00 01 00", () => {
    const faviconPath = path.resolve(process.cwd(), "public/favicon.ico");
    const buffer = fs.readFileSync(faviconPath);
    const header = Array.from(buffer.subarray(0, 4));

    expect(header).toEqual([0x00, 0x00, 0x01, 0x00]);
  });
});
