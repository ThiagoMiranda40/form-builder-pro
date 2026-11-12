// Verificação de concorrência — M-46 (T-45, QA-46-07, ARQ-05, SEC-41).
// Prova que duas (ou mais) chamadas simultâneas a public.invite_create_batch para o mesmo formulário
// são serializadas por pg_advisory_xact_lock e criam EXATAMENTE 1 lote, recusando as demais com "too_soon".
//
// Uso (PowerShell, na pasta do projeto; nunca grave DATABASE_URL em arquivo nem cole em conversa):
//   bun specs/001-fase-0-no-ar/verificacao-concorrencia-m46.mjs
//
// Cria 1 formulário de teste ("teste-concorrencia-m46") com 10 inscrições de teste,
// dispara 5 chamadas simultâneas a invite_create_batch e APAGA tudo no final.

const CHAMADAS_SIMULTANEAS = 5;
const INSCRITOS_TESTE = 10;
const SLUG = "teste-concorrencia-m46";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "FALHOU — a variável DATABASE_URL não está definida. Defina $env:DATABASE_URL na sessão antes de rodar.",
  );
  process.exit(2);
}

let SQL;
try {
  ({ SQL } = await import("bun"));
  if (typeof SQL !== "function") throw new Error("sem cliente SQL");
} catch {
  console.error(
    `FALHOU — este Bun (${typeof Bun !== "undefined" ? Bun.version : "?"}) não tem o cliente PostgreSQL embutido.`,
  );
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
    INSERT INTO public.forms (owner_id, slug, title, status, whatsapp_group_link, whatsapp_group_link_updated_at, whatsapp_group_link_updated_by)
    SELECT id, ${SLUG}, 'Teste Concorrência M-46', 'published', 'https://chat.whatsapp.com/TesteConcorrenciaM46', now(), 'admin'
    FROM auth.users
    ORDER BY created_at
    LIMIT 1
    RETURNING id, owner_id`;

  if (criado.length !== 1) {
    throw new Error("não há usuário administrador em auth.users");
  }

  const formId = criado[0].id;
  const ownerId = criado[0].owner_id;

  const inseridos = await db`
    INSERT INTO public.responses (form_id, answers, identifier)
    SELECT ${formId}::uuid, jsonb_build_object('nome', 'Atleta ' || g), lpad(g::text, 11, '0')
    FROM generate_series(1, ${INSCRITOS_TESTE}) g
    RETURNING id`;

  const responseIds = `{${inseridos.map((r) => r.id).join(",")}}`;
  const createdBy = `admin:${ownerId}`;

  // Dispara CHAMADAS_SIMULTANEAS chamadas concorrentes para o mesmo formulário
  const resultados = await Promise.all(
    Array.from({ length: CHAMADAS_SIMULTANEAS }, () =>
      db`SELECT public.invite_create_batch(
        ${formId}::uuid,
        ${createdBy}::text,
        ${responseIds}::uuid[],
        10,
        500,
        false
      ) AS res`.then((rows) => {
        const raw = rows[0]?.res;
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      }),
    ),
  );

  const criados = resultados.filter((r) => r?.ok === true);
  const recusadosTooSoon = resultados.filter(
    (r) => r?.ok === false && r?.reason === "too_soon",
  );

  console.log(
    `Resultado das ${CHAMADAS_SIMULTANEAS} chamadas simultâneas:`,
    JSON.stringify(resultados),
  );

  const lotesNoBanco = await db`
    SELECT count(*)::int AS n FROM public.invite_batches WHERE form_id = ${formId}::uuid`;
  const entregasNoBanco = await db`
    SELECT count(*)::int AS n FROM public.invite_deliveries WHERE form_id = ${formId}::uuid`;

  linha(
    criados.length === 1,
    `exatamente 1 lote criado nas chamadas simultâneas (obtido: ${criados.length})`,
  );
  linha(
    recusadosTooSoon.length === CHAMADAS_SIMULTANEAS - 1,
    `${CHAMADAS_SIMULTANEAS - 1} chamadas recusadas com reason="too_soon" (obtido: ${recusadosTooSoon.length})`,
  );
  linha(
    lotesNoBanco[0].n === 1,
    `o banco gravou exatamente 1 linha em invite_batches (obtido: ${lotesNoBanco[0].n})`,
  );
  linha(
    entregasNoBanco[0].n === INSCRITOS_TESTE,
    `o banco gravou exatamente ${INSCRITOS_TESTE} entregas em invite_deliveries (obtido: ${entregasNoBanco[0].n})`,
  );
} catch (erro) {
  console.error("FALHOU — erro durante o teste:", erro?.message ?? erro);
  falhou = true;
} finally {
  try {
    await db`DELETE FROM public.forms WHERE slug = ${SLUG}`;
    const resto = await db`SELECT count(*)::int AS n FROM public.forms WHERE slug = ${SLUG}`;
    console.log(
      resto[0].n === 0
        ? "Limpeza: formulário de teste apagado (lotes e entregas removidos em cascata)."
        : "ATENÇÃO: o formulário de teste NÃO foi apagado; apague pelo painel do Supabase.",
    );
  } catch (e) {
    console.error("ATENÇÃO: não consegui apagar o formulário de teste:", e?.message ?? e);
  }
  await db.close();
}

process.exit(falhou ? 1 : 0);
