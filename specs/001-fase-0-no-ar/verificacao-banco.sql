-- Verificação do banco — Spec 001 (T-04).
-- Uso:  psql "$DATABASE_URL" -f specs/001-fase-0-no-ar/verificacao-banco.sql
-- Pré-requisito: existir pelo menos 1 usuário em auth.users (o administrador) e a migração Fase 0 aplicada.
-- Cria formulários de teste (slugs "teste-fase0*") e apaga tudo no final. Toda linha deve começar com PASSOU.
-- A concorrência (vários envios ao mesmo tempo) é testada à parte, ver tasks.md T-04.

\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

SELECT id AS owner FROM auth.users LIMIT 1 \gset
SELECT set_config('app.owner', :'owner', false) AS _ \gset

CREATE FUNCTION pg_temp.chk(label text, got text, want text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN got IS NOT DISTINCT FROM want THEN 'PASSOU — ' || label
              ELSE 'FALHOU — ' || label || ' (obtido: ' || coalesce(got, 'nulo') || ', esperado: ' || want || ')' END $$;

-- Tenta inserir um slug; devolve 'aceito' ou 'recusado'
CREATE FUNCTION pg_temp.try_slug(s text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.forms(owner_id, slug) VALUES (current_setting('app.owner')::uuid, s);
  DELETE FROM public.forms WHERE slug = s;
  RETURN 'aceito';
EXCEPTION WHEN OTHERS THEN RETURN 'recusado';
END $$;

DELETE FROM public.forms WHERE slug LIKE 'teste-fase0%';

-- ===== Slug (RF-11) =====
SELECT pg_temp.chk('slug legível é aceito', pg_temp.try_slug('teste-fase0-skf-corrida-track-field'), 'aceito');
SELECT pg_temp.chk('slug reservado "painel" é recusado', pg_temp.try_slug('painel'), 'recusado');
SELECT pg_temp.chk('slug reservado "editar" é recusado', pg_temp.try_slug('editar'), 'recusado');
SELECT pg_temp.chk('slug reservado "saude" é recusado', pg_temp.try_slug('saude'), 'recusado');
SELECT pg_temp.chk('slug com maiúscula é recusado', pg_temp.try_slug('Maiuscula'), 'recusado');
SELECT pg_temp.chk('slug curto (2 letras) é recusado', pg_temp.try_slug('ab'), 'recusado');
SELECT pg_temp.chk('slug começando com hífen é recusado', pg_temp.try_slug('-abc'), 'recusado');
SELECT pg_temp.chk('slug com hífens repetidos é recusado', pg_temp.try_slug('a--b'), 'recusado');
SELECT pg_temp.chk('slug com sublinhado é recusado', pg_temp.try_slug('com_underline'), 'recusado');
SELECT pg_temp.chk('slug com espaço é recusado', pg_temp.try_slug('com espaco'), 'recusado');

INSERT INTO public.forms(owner_id, slug, status, max_responses) VALUES (:'owner', 'teste-fase0', 'published', 5);
SELECT pg_temp.chk('slug repetido é recusado', pg_temp.try_slug('teste-fase0'), 'recusado');

-- ===== CPF único (RF-03) =====
SELECT pg_temp.chk('1ª inscrição', (submit_response('teste-fase0', '{"q2":"5 km"}', '52998224725'))->>'status', 'ok');
SELECT pg_temp.chk('2ª inscrição com o mesmo CPF', (submit_response('teste-fase0', '{"q2":"10 km"}', '52998224725'))->>'status', 'duplicate');
SELECT pg_temp.chk('só 1 resposta gravada', count(*)::text, '1') FROM public.responses r JOIN public.forms f ON f.id = r.form_id WHERE f.slug = 'teste-fase0';

-- ===== Edição (RF-06) =====
SELECT r.edit_token AS tok FROM public.responses r JOIN public.forms f ON f.id = r.form_id WHERE f.slug = 'teste-fase0' LIMIT 1 \gset
SELECT pg_temp.chk('token tem 64 caracteres', length(:'tok')::text, '64');
SELECT pg_temp.chk('editar 5 km → 10 km', (update_response(:'tok', '{"q2":"10 km"}', '52998224725'))->>'status', 'ok');
SELECT pg_temp.chk('a resposta agora é 10 km', answers->>'q2', '10 km') FROM public.responses WHERE edit_token = :'tok';
SELECT pg_temp.chk('trocar o CPF na edição é recusado', (update_response(:'tok', '{}', '11144477735'))->>'status', 'identifier_locked');
SELECT pg_temp.chk('token falso', (update_response('falso', '{}', NULL))->>'status', 'not_found');
SELECT pg_temp.chk('editar não consumiu vaga (continua 1)', count(*)::text, '1') FROM public.responses r JOIN public.forms f ON f.id = r.form_id WHERE f.slug = 'teste-fase0';

-- ===== Vagas cheias (RF-04): inscrever bloqueia, editar continua =====
INSERT INTO public.responses(form_id, answers, identifier) SELECT id, '{}', 'x' || g FROM public.forms, generate_series(1, 4) g WHERE slug = 'teste-fase0';
SELECT pg_temp.chk('inscrever com vagas esgotadas', (submit_response('teste-fase0', '{}', 'novo'))->>'status', 'full');
SELECT pg_temp.chk('editar com vagas esgotadas', (update_response(:'tok', '{"q2":"5 km"}', '52998224725'))->>'status', 'ok');

-- ===== Prazo, rascunho e inexistente =====
UPDATE public.forms SET closes_at = now() - interval '1 minute' WHERE slug = 'teste-fase0';
SELECT pg_temp.chk('inscrever com prazo vencido', (submit_response('teste-fase0', '{}', 'n2'))->>'status', 'closed');
SELECT pg_temp.chk('editar com prazo vencido', (update_response(:'tok', '{}', '52998224725'))->>'status', 'closed');
UPDATE public.forms SET closes_at = NULL, status = 'draft' WHERE slug = 'teste-fase0';
SELECT pg_temp.chk('inscrever em rascunho', (submit_response('teste-fase0', '{}', 'n3'))->>'status', 'unavailable');
SELECT pg_temp.chk('slug inexistente', (submit_response('teste-fase0-nao-existe', '{}', 'n'))->>'status', 'unavailable');
UPDATE public.forms SET status = 'published' WHERE slug = 'teste-fase0';

-- ===== Consentimento (RF-08) =====
DELETE FROM public.responses WHERE form_id = (SELECT id FROM public.forms WHERE slug = 'teste-fase0');
UPDATE public.forms SET consent_text = 'Autorizo o uso dos meus dados.' WHERE slug = 'teste-fase0';
SELECT pg_temp.chk('sem aceite é bloqueado', (submit_response('teste-fase0', '{}', 'c1', false))->>'status', 'consent_required');
SELECT pg_temp.chk('com aceite é gravado', (submit_response('teste-fase0', '{}', 'c2', true))->>'status', 'ok');
SELECT pg_temp.chk('data do aceite registrada', (consented_at IS NOT NULL)::text, 'true') FROM public.responses WHERE identifier = 'c2';
UPDATE public.forms SET consent_text = NULL WHERE slug = 'teste-fase0';
SELECT pg_temp.chk('formulário sem termo dispensa aceite', (submit_response('teste-fase0', '{}', 'c3'))->>'status', 'ok');

-- ===== Formulário sem CPF: identificador nulo pode repetir =====
INSERT INTO public.forms(owner_id, slug, status) VALUES (:'owner', 'teste-fase0-sem-cpf', 'published');
SELECT pg_temp.chk('1ª sem identificador', (submit_response('teste-fase0-sem-cpf', '{"a":1}', NULL))->>'status', 'ok');
SELECT pg_temp.chk('2ª sem identificador', (submit_response('teste-fase0-sem-cpf', '{"a":2}', NULL))->>'status', 'ok');

DELETE FROM public.forms WHERE slug LIKE 'teste-fase0%';
