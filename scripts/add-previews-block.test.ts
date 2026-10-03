import { describe, it, expect } from "vitest";
import { addPreviewsBlock } from "./add-previews-block.mjs";

describe("addPreviewsBlock", () => {
  const sampleWranglerConfig = {
    name: "thiagomiranda40-form-builder-pro",
    main: "index.mjs",
    assets: {
      binding: "ASSETS",
      directory: "../public",
    },
    compatibility_flags: ["nodejs_compat"],
    no_bundle: true,
    rules: [
      {
        type: "ESModule",
        globs: ["**/*.mjs", "**/*.js"],
      },
    ],
  };

  it("acrescenta o bloco previews vazio quando ele não existe", () => {
    const result = addPreviewsBlock(sampleWranglerConfig);
    expect(result).toHaveProperty("previews");
    expect(result.previews).toEqual({});
  });

  it("não duplica nem altera um bloco previews já existente", () => {
    const configWithPreviews = {
      ...sampleWranglerConfig,
      previews: { existing_key: "preserved" },
    };
    const result = addPreviewsBlock(configWithPreviews);
    expect(result.previews).toEqual({ existing_key: "preserved" });
  });

  it("preserva name, main, assets, compatibility_flags, no_bundle e rules intactos", () => {
    const result = addPreviewsBlock(sampleWranglerConfig);
    expect(result.name).toBe(sampleWranglerConfig.name);
    expect(result.main).toBe(sampleWranglerConfig.main);
    expect(result.assets).toEqual(sampleWranglerConfig.assets);
    expect(result.compatibility_flags).toEqual(sampleWranglerConfig.compatibility_flags);
    expect(result.no_bundle).toBe(sampleWranglerConfig.no_bundle);
    expect(result.rules).toEqual(sampleWranglerConfig.rules);
  });

  it("não altera o objeto original", () => {
    const original = JSON.parse(JSON.stringify(sampleWranglerConfig));
    const input = { ...sampleWranglerConfig };
    const result = addPreviewsBlock(input);
    expect(input).toEqual(original);
    expect(result).not.toBe(input);
  });
});
