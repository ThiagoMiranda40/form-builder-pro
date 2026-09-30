// Verificação de concorrência — Spec 001 (T-04).
// Prova que, com 5 vagas e 20 envios ao mesmo tempo, entram EXATAMENTE 5 ("ok") e 15 são recusados ("full").
//
// Uso (PowerShell, na pasta do projeto; a string de conexão contém a senha do banco: nunca grave em arquivo nem cole em conversa):
//   bun specs/001-fase-0-no-ar/verificacao-concorrencia.mjs
// A conexão vem da variável de ambiente DATABASE_URL (veja o passo a passo da T-04 no tasks.md).
// Cria 1 formulário de teste ("teste-concorrencia"), faz os 20 envios e APAGA tudo no final.
// Requer Bun 1.2 ou mais novo (cliente PostgreSQL embutido). Nenhum pacote a instalar.

const VAGAS = 5;
const ENVIOS = 20;
const SLUG = "teste-concorrencia";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FALHOU — a variável DATABASE_URL não está definida. Siga o passo a passo da T-04 no tasks.md.");
  process.exit(2);
}

let SQL;
try {
  ({ SQL } = await import("bun"));
  if (typeof SQL !== "function") throw new Error("sem cliente SQL");
} catch {
  console.error(`FALHOU — este Bun (${typeof Bun !== "undefined" ? Bun.version : "?"}) não tem o cliente PostgreSQL embutido. Atualize com: bun upgrade`);
  process.exit(2);
}

const db = new SQL(url, { max: 10 });
let falhou = false;
const linha = (ok, texto) => {
  console.log(`${ok ? "PASSOU" : "FALHOU"} — ${texto}`);
  if (!ok) falhou = true;
};

try {
  await db`DELETE FROM public.forms WHERE slug = ${SLUG}`;
  const criado = await db`
    INSERT INTO public.forms(owner_id, slug, status, max_responses)
    SELECT id, ${SLUG}, 'published', ${VAGAS} FROM auth.users ORDER BY created_at LIMIT 1
    RETURNING id`;
  if (criado.length !== 1) throw new Error("não há usuário administrador em auth.users (T-02)");
  const formId = criado[0].id;

  const status = await Promise.all(
    Array.from({ length: ENVIOS }, (_, i) =>
      db`SELECT (public.submit_response(${SLUG}, ${"{}"}::jsonb, ${"cpf" + i}))->>'status' AS status`.then((r) => r[0].status),
    ),
  );
  const contagem = {};
  for (const s of status) contagem[s] = (contagem[s] ?? 0) + 1;
  console.log(`Resultado dos ${ENVIOS} envios simultâneos:`, JSON.stringify(contagem));

  const gravadas = await db`SELECT count(*)::int AS n FROM public.responses WHERE form_id = ${formId}`;
  linha((contagem.ok ?? 0) === VAGAS, `entraram exatamente ${VAGAS} inscrições (obtido: ${contagem.ok ?? 0})`);
  linha((contagem.full ?? 0) === ENVIOS - VAGAS, `${ENVIOS - VAGAS} foram recusadas por vagas esgotadas (obtido: ${contagem.full ?? 0})`);
  linha(Object.keys(contagem).every((k) => k === "ok" || k === "full"), "nenhum outro resultado inesperado");
  linha(gravadas[0].n === VAGAS, `o banco guardou exatamente ${VAGAS} respostas (obtido: ${gravadas[0].n})`);
} catch (erro) {
  console.error("FALHOU — erro durante o teste:", erro?.message ?? erro);
  falhou = true;
} finally {
  try {
    await db`DELETE FROM public.forms WHERE slug = ${SLUG}`;
    const resto = await db`SELECT count(*)::int AS n FROM public.forms WHERE slug = ${SLUG}`;
    console.log(resto[0].n === 0 ? "Limpeza: formulário de teste apagado." : "ATENÇÃO: o formulário de teste NÃO foi apagado; apague pelo painel do Supabase.");
  } catch (e) {
    console.error("ATENÇÃO: não consegui apagar o formulário de teste:", e?.message ?? e);
  }
  await db.close();
}
process.exit(falhou ? 1 : 0);
