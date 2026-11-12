-- Verificação do banco — M-46 (T-45): link do grupo, lotes e entregas de convite (QA-46-02 a QA-46-06, SEC-39, SEC-41, ARQ-02, ARQ-05).
-- Compatível com o SQL Editor do Supabase e com o psql.
-- Toda a verificação roda dentro de BEGIN ... ROLLBACK para nunca deixar lixo no banco,
-- retornando uma única tabela onde todas as linhas devem começar com PASSOU.
--
-- Se executado ANTES da migração 20261113090000_convite_em_lote_grupo_whatsapp.sql:
-- falha imediatamente (vermelho) porque as colunas whatsapp_group_link*, as tabelas
-- invite_batches / invite_deliveries e a função invite_create_batch ainda não existem.

BEGIN;

SELECT set_config('app.owner', (SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1), true);

CREATE TEMP TABLE resultados_m46 (n serial, linha text) ON COMMIT DROP;

CREATE FUNCTION pg_temp.chk(label text, got text, want text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN got IS NOT DISTINCT FROM want THEN 'PASSOU — ' || label
              ELSE 'FALHOU — ' || label || ' (obtido: ' || coalesce(got, 'nulo') || ', esperado: ' || want || ')' END
$$;

CREATE FUNCTION pg_temp.try_group_link(f_id uuid, link_val text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.forms SET whatsapp_group_link = link_val WHERE id = f_id;
  RETURN 'aceito';
EXCEPTION WHEN OTHERS THEN
  RETURN 'recusado';
END $$;

CREATE FUNCTION pg_temp.como(papel text, consulta text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE res text;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', papel);
  EXECUTE consulta INTO res;
  RESET ROLE;
  RETURN coalesce(res, 'nulo');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN 'negado';
END $$;

DELETE FROM public.forms WHERE slug LIKE 'teste-m46%';

INSERT INTO public.forms (owner_id, slug, title, status)
VALUES (current_setting('app.owner')::uuid, 'teste-m46-form', 'Corrida M46', 'published');

INSERT INTO public.forms (owner_id, slug, title, status, whatsapp_group_link)
VALUES (
  current_setting('app.owner')::uuid,
  'teste-m46-outro',
  'Outro Evento M46',
  'published',
  'https://chat.whatsapp.com/OutroGrupoValido123'
);

SELECT set_config('app.form_m46', (SELECT id::text FROM public.forms WHERE slug = 'teste-m46-form'), true);
SELECT set_config('app.form_outro', (SELECT id::text FROM public.forms WHERE slug = 'teste-m46-outro'), true);

-- ===== 1. QA-46-02 — CHECK do banco em forms.whatsapp_group_link =====
INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link válido https://chat.whatsapp.com/AbCdEf123456 é aceito',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'https://chat.whatsapp.com/AbCdEf123456'),
  'aceito'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link nulo (remover link) é aceito',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, NULL),
  'aceito'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link de 200 caracteres exatos é aceito',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'https://chat.whatsapp.com/' || repeat('a', 174)),
  'aceito'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link de 201 caracteres é recusado',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'https://chat.whatsapp.com/' || repeat('a', 175)),
  'recusado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link http:// (sem TLS) é recusado',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'http://chat.whatsapp.com/AbCdEf123456'),
  'recusado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link de outro domínio https://evil.com/x é recusado',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'https://evil.com/x'),
  'recusado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link com subdomínio falso https://chat.whatsapp.com.evil.com/x é recusado',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'https://chat.whatsapp.com.evil.com/x'),
  'recusado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link com query string ?a=1 é recusado',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'https://chat.whatsapp.com/AbCdEf?a=1'),
  'recusado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link com espaço interno é recusado',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'https://chat.whatsapp.com/AbC dEf'),
  'recusado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link com @ é recusado',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, 'https://chat.whatsapp.com/@AbCdEf'),
  'recusado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-02: link vazio "" (sem código) é recusado',
  pg_temp.try_group_link(current_setting('app.form_m46')::uuid, ''),
  'recusado'
);

-- ===== 2. QA-46-04 / QA-46-05 / QA-46-06 — Função invite_create_batch =====

-- 2a. Formulário sem link -> no_link
UPDATE public.forms SET whatsapp_group_link = NULL WHERE id = current_setting('app.form_m46')::uuid;

INSERT INTO public.responses (form_id, answers, identifier)
SELECT current_setting('app.form_m46')::uuid, jsonb_build_object('nome', 'Inscrito ' || g), lpad(g::text, 11, '0')
FROM generate_series(1, 57) g;

INSERT INTO public.responses (form_id, answers, identifier)
VALUES (current_setting('app.form_outro')::uuid, '{"nome":"De Outro Form"}', '99999999999');

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: formulário sem whatsapp_group_link devolve no_link',
  (SELECT (public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(SELECT id FROM public.responses WHERE form_id = current_setting('app.form_m46')::uuid),
    10,
    80,
    false
  ))->>'reason'),
  'no_link'
);

-- Configura link válido no formulário de teste
UPDATE public.forms
SET whatsapp_group_link = 'https://chat.whatsapp.com/GrupoCorridaM46Valido',
    whatsapp_group_link_updated_at = now(),
    whatsapp_group_link_updated_by = 'admin'
WHERE id = current_setting('app.form_m46')::uuid;

-- 2b. Lista vazia ou apenas respostas de outro formulário -> nobody_eligible
INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: lista vazia de candidatos devolve nobody_eligible',
  (SELECT (public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY[]::uuid[],
    10,
    80,
    false
  ))->>'reason'),
  'nobody_eligible'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: response_ids de outro formulário são ignorados e devolvem nobody_eligible',
  (SELECT (public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(SELECT id FROM public.responses WHERE form_id = current_setting('app.form_outro')::uuid),
    10,
    80,
    false
  ))->>'reason'),
  'nobody_eligible'
);

-- 2c. Cenário de 57 candidatos onde 10 já possuem entrega sent em lote anterior (> 10 min atrás)
-- Isola eventuais lotes reais das últimas 24h movendo-os temporariamente na transação (desfeito pelo ROLLBACK)
UPDATE public.invite_batches SET created_at = now() - interval '3 days' WHERE created_at > now() - interval '2 days';
UPDATE public.invite_deliveries SET updated_at = now() - interval '3 days' WHERE updated_at > now() - interval '2 days';

INSERT INTO public.invite_batches (id, form_id, created_at, created_by, group_link, total, sent, failed, status)
VALUES (
  '00000000-0000-0000-0000-000000000010'::uuid,
  current_setting('app.form_m46')::uuid,
  now() - interval '2 days',
  'admin:' || current_setting('app.owner'),
  'https://chat.whatsapp.com/GrupoCorridaM46Valido',
  10,
  10,
  0,
  'done'
);

INSERT INTO public.invite_deliveries (batch_id, form_id, response_id, channel, state, updated_at)
SELECT
  '00000000-0000-0000-0000-000000000010'::uuid,
  current_setting('app.form_m46')::uuid,
  id,
  'email',
  'sent',
  now() - interval '2 days'
FROM (
  SELECT id FROM public.responses WHERE form_id = current_setting('app.form_m46')::uuid ORDER BY id LIMIT 10
) sub;

SELECT set_config(
  'app.res_47',
  (SELECT public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(SELECT id FROM public.responses WHERE form_id = current_setting('app.form_m46')::uuid ORDER BY id),
    10,
    80,
    false
  )::text),
  true
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: 57 candidatos (10 já sent) com p_resend=false cria lote ok=true',
  (current_setting('app.res_47')::jsonb)->>'ok',
  'true'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: lote criado tem total = 47 e deferred = 0',
  ((current_setting('app.res_47')::jsonb)->>'total') || ':' || ((current_setting('app.res_47')::jsonb)->>'deferred'),
  '47:0'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: 47 entregas pending foram criadas em invite_deliveries',
  (SELECT count(*)::text FROM public.invite_deliveries WHERE batch_id = ((current_setting('app.res_47')::jsonb)->>'batch_id')::uuid AND state = 'pending'),
  '47'
);

-- 2d. QA-46-05 — Intervalo mínimo de 10 minutos
INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-05: segunda chamada antes de 10 min devolve too_soon',
  (SELECT (public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(SELECT id FROM public.responses WHERE form_id = current_setting('app.form_m46')::uuid),
    10,
    80,
    true
  ))->>'reason'),
  'too_soon'
);

-- Recua apenas o created_at do lote 'open' (que tem 47 entregas pending) para 11 minutos atrás
UPDATE public.invite_batches
SET created_at = now() - interval '11 minutes'
WHERE id = ((current_setting('app.res_47')::jsonb)->>'batch_id')::uuid;

-- Com lote 'open' e entregas pending para as 47 pessoas (> 10 min depois), p_resend=false e p_resend=true devolvem nobody_eligible
INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: com lote open e entregas pending (> 10 min), p_resend=false para as mesmas pessoas devolve nobody_eligible',
  (SELECT (public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(
      SELECT response_id
      FROM public.invite_deliveries
      WHERE batch_id = ((current_setting('app.res_47')::jsonb)->>'batch_id')::uuid
      ORDER BY response_id
    ),
    10,
    80,
    false
  ))->>'reason'),
  'nobody_eligible'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: com lote open e entregas pending (> 10 min), p_resend=true para as mesmas pessoas devolve nobody_eligible',
  (SELECT (public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(
      SELECT response_id
      FROM public.invite_deliveries
      WHERE batch_id = ((current_setting('app.res_47')::jsonb)->>'batch_id')::uuid
      ORDER BY response_id
    ),
    10,
    80,
    true
  ))->>'reason'),
  'nobody_eligible'
);

-- Conclui o lote de 47 (status = 'done') e marca suas entregas como sent (há 2 dias para testar reenvio isolado)
UPDATE public.invite_batches
SET status = 'done', sent = 47
WHERE id = ((current_setting('app.res_47')::jsonb)->>'batch_id')::uuid;

UPDATE public.invite_deliveries
SET state = 'sent', updated_at = now() - interval '2 days'
WHERE batch_id = ((current_setting('app.res_47')::jsonb)->>'batch_id')::uuid;

-- Todos os 57 já estão sent -> chamada com p_resend=false devolve nobody_eligible
INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04: quando todos os 57 já têm entrega sent, p_resend=false devolve nobody_eligible',
  (SELECT (public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(SELECT id FROM public.responses WHERE form_id = current_setting('app.form_m46')::uuid),
    10,
    80,
    false
  ))->>'reason'),
  'nobody_eligible'
);

-- Com p_resend=true após 10 min, inclui todos os 57
SELECT set_config(
  'app.res_57',
  (SELECT public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(SELECT id FROM public.responses WHERE form_id = current_setting('app.form_m46')::uuid ORDER BY id),
    10,
    80,
    true
  )::text),
  true
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-04/05: após 10 min com p_resend=true, cria lote com total = 57',
  ((current_setting('app.res_57')::jsonb)->>'ok') || ':' || ((current_setting('app.res_57')::jsonb)->>'total'),
  'true:57'
);

-- 2e. QA-46-06 — Orçamento diário (70 enviados nas últimas 24 h + 57 candidatos com orçamento 80 -> total=10, deferred=47; depois -> budget_exhausted)
DELETE FROM public.invite_batches WHERE form_id = current_setting('app.form_m46')::uuid;

INSERT INTO public.invite_batches (id, form_id, created_at, created_by, group_link, total, sent, failed, status)
VALUES (
  '00000000-0000-0000-0000-000000000070'::uuid,
  current_setting('app.form_outro')::uuid,
  now() - interval '2 hours',
  'admin:' || current_setting('app.owner'),
  'https://chat.whatsapp.com/OutroGrupoValido123',
  70,
  70,
  0,
  'done'
);

-- Cria 70 respostas no outro formulário e 70 entregas sent nas últimas 2 horas
INSERT INTO public.responses (form_id, answers, identifier)
SELECT current_setting('app.form_outro')::uuid, '{}'::jsonb, 'outro-' || g
FROM generate_series(1, 70) g;

INSERT INTO public.invite_deliveries (batch_id, form_id, response_id, channel, state, updated_at)
SELECT
  '00000000-0000-0000-0000-000000000070'::uuid,
  current_setting('app.form_outro')::uuid,
  id,
  'email',
  'sent',
  now() - interval '2 hours'
FROM (
  SELECT id FROM public.responses WHERE form_id = current_setting('app.form_outro')::uuid ORDER BY id LIMIT 70
) sub;

SELECT set_config(
  'app.res_orcamento',
  (SELECT public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(SELECT id FROM public.responses WHERE form_id = current_setting('app.form_m46')::uuid ORDER BY id),
    10,
    80,
    false
  )::text),
  true
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-06: com 70 usados em 24h e orçamento 80, lote de 57 cria 10 e adia 47 (deferred=47)',
  ((current_setting('app.res_orcamento')::jsonb)->>'ok') || ':' ||
  ((current_setting('app.res_orcamento')::jsonb)->>'total') || ':' ||
  ((current_setting('app.res_orcamento')::jsonb)->>'deferred'),
  'true:10:47'
);

-- Recua created_at do lote parcial para > 10 min mantendo as 10 entregas nas últimas 24h (70 + 10 = 80 usadas)
UPDATE public.invite_batches
SET created_at = now() - interval '15 minutes'
WHERE id = ((current_setting('app.res_orcamento')::jsonb)->>'batch_id')::uuid;

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-06: com 80 usados em 24h e orçamento 80, nova chamada devolve budget_exhausted',
  (SELECT (public.invite_create_batch(
    current_setting('app.form_m46')::uuid,
    'admin:' || current_setting('app.owner'),
    ARRAY(SELECT id FROM public.responses WHERE form_id = current_setting('app.form_m46')::uuid ORDER BY id),
    10,
    80,
    false
  ))->>'reason'),
  'budget_exhausted'
);

-- ===== 3. QA-46-03 / SEC-39 / ARQ-02 — Permissões, RLS e SECURITY DEFINER =====
INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: anon não lê invite_batches',
  pg_temp.como('anon', 'SELECT count(*)::text FROM public.invite_batches'),
  'negado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: anon não insere em invite_batches',
  pg_temp.como('anon', format($q$ INSERT INTO public.invite_batches(form_id, created_by, group_link, total) VALUES (%L::uuid, 'anon', 'https://chat.whatsapp.com/AbC', 1) RETURNING 'inseriu' $q$, current_setting('app.form_m46'))),
  'negado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: anon não lê invite_deliveries',
  pg_temp.como('anon', 'SELECT count(*)::text FROM public.invite_deliveries'),
  'negado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: authenticated não lê invite_batches',
  pg_temp.como('authenticated', 'SELECT count(*)::text FROM public.invite_batches'),
  'negado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: authenticated não lê invite_deliveries',
  pg_temp.como('authenticated', 'SELECT count(*)::text FROM public.invite_deliveries'),
  'negado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: anon não executa invite_create_batch',
  pg_temp.como('anon', format($q$ SELECT (public.invite_create_batch(%L::uuid, 'anon', ARRAY[]::uuid[], 10, 80, false))->>'ok' $q$, current_setting('app.form_m46'))),
  'negado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: authenticated não executa invite_create_batch',
  pg_temp.como('authenticated', format($q$ SELECT (public.invite_create_batch(%L::uuid, 'auth', ARRAY[]::uuid[], 10, 80, false))->>'ok' $q$, current_setting('app.form_m46'))),
  'negado'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: service_role lê invite_batches e executa invite_create_batch',
  pg_temp.como('service_role', format($q$ SELECT (public.invite_create_batch(%L::uuid, 'service', ARRAY[]::uuid[], 10, 80, false))->>'reason' $q$, current_setting('app.form_m46'))),
  'nobody_eligible'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: invite_batches e invite_deliveries têm RLS ligada e nenhuma política aberta',
  (
    SELECT (
      bool_and(c.relrowsecurity)
      AND (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename IN ('invite_batches', 'invite_deliveries')) = 0
    )::text
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN ('invite_batches', 'invite_deliveries')
  ),
  'true'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-03: invite_create_batch é SECURITY DEFINER com search_path=public',
  (
    SELECT (prosecdef AND coalesce(array_to_string(proconfig, ',') LIKE '%search_path=public%', false))::text
    FROM pg_proc
    WHERE oid = 'public.invite_create_batch(uuid,text,uuid[],integer,integer,boolean)'::regprocedure
  ),
  'true'
);

INSERT INTO pg_temp.resultados_m46(linha)
SELECT pg_temp.chk(
  'QA-46-06/07: invite_create_batch contém trava global invite_create_batch:budget',
  (
    SELECT (prosrc LIKE '%invite_create_batch:budget%')::text
    FROM pg_proc
    WHERE oid = 'public.invite_create_batch(uuid,text,uuid[],integer,integer,boolean)'::regprocedure
  ),
  'true'
);

-- ===== Resultado final (uma única tabela) =====
SELECT resultado FROM (
  SELECT n, linha AS resultado FROM pg_temp.resultados_m46
  UNION ALL
  SELECT 1000000,
    '== RESUMO M-46: ' ||
    count(*) FILTER (WHERE linha LIKE 'PASSOU%') || ' PASSOU, ' ||
    count(*) FILTER (WHERE linha LIKE 'FALHOU%') || ' FALHOU =='
  FROM pg_temp.resultados_m46
) r ORDER BY n;

ROLLBACK;

