-- Verificação do banco — M-56 (T-56), versão para o SQL Editor do Supabase (e psql).
-- QA-46-33, SEC-49, RF-26.
-- Uso: colar este arquivo inteiro no SQL Editor -> Run (botão "Run without RLS": a tabela de resultados é temporária).
-- O resultado é UMA tabela; toda linha deve começar com PASSOU e a última é o RESUMO.
-- NÃO usa BEGIN/ROLLBACK: cria formulário de teste "teste-m56*", usa só dados dele e apaga tudo no final.
-- Pré-requisito: migração 20261113150000 aplicada e pelo menos 1 usuário em auth.users.

SELECT set_config('app.owner', (SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1), false);

CREATE TEMP TABLE resultados_m56 (n serial, linha text);

CREATE FUNCTION pg_temp.chk_m56(label text, got text, want text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN got IS NOT DISTINCT FROM want THEN 'PASSOU — ' || label
              ELSE 'FALHOU — ' || label || ' (obtido: ' || coalesce(got, 'nulo') || ', esperado: ' || want || ')' END
$$;

CREATE FUNCTION pg_temp.try_update_texts(f_id uuid, notice_val text, invite_val text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.forms
     SET whatsapp_group_notice_text = notice_val,
         whatsapp_group_invite_text = invite_val
   WHERE id = f_id;
  RETURN 'aceito';
EXCEPTION WHEN OTHERS THEN
  RETURN 'recusado';
END $$;

DELETE FROM public.forms WHERE slug LIKE 'teste-m56%';

-- 1) Existência das colunas na tabela forms
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'colunas whatsapp_group_notice_text e whatsapp_group_invite_text existem em public.forms',
  (
    SELECT count(*)::text
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'forms'
       AND column_name IN ('whatsapp_group_notice_text', 'whatsapp_group_invite_text')
  ),
  '2'
);

-- Formulário de teste
INSERT INTO public.forms (owner_id, slug, title, status)
VALUES (current_setting('app.owner')::uuid, 'teste-m56-form', 'Corrida M56', 'published');

-- 2) Aceita ambos NULL
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'aceita ambas as colunas NULL',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    NULL,
    NULL
  ),
  'aceito'
);

-- 3) Aceita texto de até 200 caracteres com acentos
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'aceita texto válido de 200 caracteres com acentuação',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    rpad('Aviso com acentuação: Atenção atletas! ', 200, 'x'),
    rpad('Convite especial: Entre no grupo oficial! ', 200, 'y')
  ),
  'aceito'
);

-- 4) Recusa texto com 201 caracteres no notice_text
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'recusa notice_text com 201 caracteres',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    repeat('a', 201),
    NULL
  ),
  'recusado'
);

-- 5) Recusa texto com 201 caracteres no invite_text
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'recusa invite_text com 201 caracteres',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    NULL,
    repeat('b', 201)
  ),
  'recusado'
);

-- 6) Recusa string vazia '' no notice_text
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'recusa string vazia no notice_text',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    '',
    NULL
  ),
  'recusado'
);

-- 7) Recusa string vazia '' no invite_text
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'recusa string vazia no invite_text',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    NULL,
    ''
  ),
  'recusado'
);

-- 8) Recusa texto com quebra de linha (\n)
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'recusa caractere de controle (newline) no notice_text',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    'Linha 1' || E'\n' || 'Linha 2',
    NULL
  ),
  'recusado'
);

-- 9) Recusa texto com tabulação (\t)
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'recusa caractere de controle (tab) no invite_text',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    NULL,
    'Texto com' || E'\t' || 'tab'
  ),
  'recusado'
);

-- 10) Aceita ambas as colunas preenchidas com textos curtos válidos
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'aceita ambas preenchidas com textos válidos',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    'Aviso prévio curto',
    'Convite personalizado curto'
  ),
  'aceito'
);

-- 11) UPDATE de volta para NULL funciona
INSERT INTO pg_temp.resultados_m56(linha)
SELECT pg_temp.chk_m56(
  'UPDATE para NULL limpa ambos os campos com sucesso',
  pg_temp.try_update_texts(
    (SELECT id FROM public.forms WHERE slug = 'teste-m56-form'),
    NULL,
    NULL
  ),
  'aceito'
);

DELETE FROM public.forms WHERE slug LIKE 'teste-m56%';

-- ===== Resultado final (uma única tabela) =====
SELECT resultado FROM (
  SELECT n, linha AS resultado FROM pg_temp.resultados_m56
  UNION ALL
  SELECT 1000000,
    '== RESUMO M-56: ' ||
    count(*) FILTER (WHERE linha LIKE 'PASSOU%') || ' PASSOU, ' ||
    count(*) FILTER (WHERE linha LIKE 'FALHOU%') || ' FALHOU =='
  FROM pg_temp.resultados_m56
) r ORDER BY n;

