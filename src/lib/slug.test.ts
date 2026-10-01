import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  RESERVED_SLUGS,
  sanitizeSlugInput,
  slug,
  suggestSlug,
  trimSlugEdges,
  validateSlug,
} from "./slug";

describe("Regras do endereço (slug)", () => {
  describe("validateSlug", () => {
    it("aceita slug válido retornando null", () => {
      expect(validateSlug("skf-corrida-track-field")).toBeNull();
    });

    it("recusa tamanho menor que 3 com mensagem de tamanho", () => {
      const err = validateSlug("ab");
      expect(err).toBeTruthy();
      expect(err).toMatch(/3 e 60/i);
    });

    it("recusa tamanho maior que 60 com mensagem de tamanho", () => {
      const err = validateSlug("a".repeat(61));
      expect(err).toBeTruthy();
      expect(err).toMatch(/3 e 60/i);
    });

    it("recusa formatos inválidos com mensagem de formato", () => {
      const invalidFormats = [
        "Maiuscula",
        "-abc",
        "a--b",
        "com_underline",
        "com espaco",
      ];
      for (const value of invalidFormats) {
        const err = validateSlug(value);
        expect(err, `esperava erro de formato para "${value}"`).toBeTruthy();
        expect(err).toMatch(/letras minúsculas, números e hífens/i);
      }
    });

    it("recusa todos os nomes reservados com a mensagem exata", () => {
      const reserved = [
        "painel",
        "editar",
        "saude",
        "auth",
        "formularios",
        "api",
        "admin",
        "assets",
        "login",
      ];
      for (const name of reserved) {
        expect(validateSlug(name)).toBe("Esse nome é reservado pelo sistema");
      }
    });
  });

  describe("suggestSlug", () => {
    it("sugere slug a partir do título sem acentos e com hífens", () => {
      expect(suggestSlug("SKF Corrida Track & Field")).toBe("skf-corrida-track-field");
    });

    it("concatena sufixo quando informado", () => {
      expect(suggestSlug("Novo formulário", "abc123")).toBe("novo-formulario-abc123");
    });

    it("devolve valor válido padrão para entradas vazias ou só de símbolos", () => {
      const s = suggestSlug("!!!");
      expect(s).toBe("formulario");
      expect(validateSlug(s)).toBeNull();
    });

    it("mantém o sufixo intacto em título longo e passa em validateSlug", () => {
      const longTitle =
        "Este é um título extremamente longo para um formulário que ultrapassa com certeza o limite de sessenta caracteres";
      const s = suggestSlug(longTitle, "abc123");
      expect(s.endsWith("-abc123")).toBe(true);
      expect(s.length).toBeLessThanOrEqual(60);
      expect(validateSlug(s)).toBeNull();
    });

    it("passa em validateSlug com base de 59 letras e sufixo", () => {
      const base59 = "a".repeat(59);
      const s = suggestSlug(base59, "abc123");
      expect(s.endsWith("-abc123")).toBe(true);
      expect(s.length).toBeLessThanOrEqual(60);
      expect(validateSlug(s)).toBeNull();
    });

    it("gera valores válidos que passam em validateSlug para 5K e A", () => {
      const s5k = suggestSlug("5K");
      expect(s5k).toBe("5k-formulario");
      expect(validateSlug(s5k)).toBeNull();

      const sa = suggestSlug("A");
      expect(sa).toBe("a-formulario");
      expect(validateSlug(sa)).toBeNull();
    });
  });

  describe("sanitizeSlugInput", () => {
    it("converte maiúsculas, acentos e caracteres especiais para hífen", () => {
      expect(sanitizeSlugInput("SKF Corrida Track&Field")).toBe("skf-corrida-track-field");
    });

    it("mantém hífen final enquanto o usuário digita", () => {
      expect(sanitizeSlugInput("skf-")).toBe("skf-");
    });

    it("converte espaços nas pontas e internos em hífen único e mantém hífen final", () => {
      expect(sanitizeSlugInput("  Corrida  Ação  ")).toBe("corrida-acao-");
    });

    it("remove hífen inicial", () => {
      expect(sanitizeSlugInput("-abc")).toBe("abc");
    });

    it("colapsa hífens consecutivos em hífen único", () => {
      expect(sanitizeSlugInput("a--b")).toBe("a-b");
    });

    it("corta entradas longas em no máximo 60 caracteres", () => {
      const input70 = "a".repeat(70);
      const sanitized = sanitizeSlugInput(input70);
      expect(sanitized.length).toBe(60);
      expect(sanitized).toBe("a".repeat(60));
    });
  });

  describe("trimSlugEdges", () => {
    it("remove hífen final e inicial", () => {
      expect(trimSlugEdges("corrida-acao-")).toBe("corrida-acao");
      expect(trimSlugEdges("-corrida-acao-")).toBe("corrida-acao");
    });
  });

  describe("slug (função base para títulos e arquivos)", () => {
    it("normaliza acentos, corta em 60 e garante fallback seguro", () => {
      expect(slug("Corrida & Caminhada 2026")).toBe("corrida-caminhada-2026");
      expect(slug("???")).toBe("formulario");
    });
  });

  describe("Consistência com a migração Fase 0 do banco", () => {
    it("compara lista de slugs reservados do código com a constraint forms_slug_reserved do SQL", () => {
      const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
      const files = fs.readdirSync(migrationsDir);
      const migrationFile = files.find((f) => f.includes("_fase0_inscricao.sql"));
      expect(migrationFile, "arquivo de migração Fase 0 não encontrado").toBeTruthy();

      const sql = fs.readFileSync(path.join(migrationsDir, migrationFile!), "utf-8");
      const match = sql.match(/forms_slug_reserved[\s\S]*?CHECK\s*\(\s*slug\s+NOT\s+IN\s*\(([^)]+)\)\)/i);
      expect(match, "constraint forms_slug_reserved não encontrada na migração").toBeTruthy();

      const innerList = match?.[1] ?? "";
      const sqlReservedSlugs = Array.from(innerList.matchAll(/'([^']+)'/g), (m) => m[1]);
      expect(sqlReservedSlugs.length).toBe(9);
      expect(new Set(sqlReservedSlugs)).toEqual(new Set(RESERVED_SLUGS));
    });
  });
});
