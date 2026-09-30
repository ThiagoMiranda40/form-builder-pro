-- Verificação do banco — Spec 001 (T-04), versão compatível com o editor de SQL do Supabase E com o psql.
-- Uso no Supabase: SQL Editor -> colar este arquivo inteiro -> Run. O resultado é UMA tabela; toda linha deve começar com PASSOU.
-- Uso no psql:     psql "$DATABASE_URL" -f specs/001-fase-0-no-ar/verificacao-banco.sql
-- Pré-requisito: existir pelo menos 1 usuário em auth.users (o administrador) e a migração Fase 0 aplicada.
-- Cria formulários de teste (slugs "teste-fase0*") e apaga tudo no final. A concorrência é testada à parte (verificacao-concorrencia.mjs).


SELECT set_config('app.owner', (SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1), false);

CREATE TEMP TABLE resultados (n serial, linha text);

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
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug legível é aceito', pg_temp.try_slug('teste-fase0-skf-corrida-track-field'), 'aceito');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug reservado "painel" é recusado', pg_temp.try_slug('painel'), 'recusado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug reservado "editar" é recusado', pg_temp.try_slug('editar'), 'recusado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug reservado "saude" é recusado', pg_temp.try_slug('saude'), 'recusado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug com maiúscula é recusado', pg_temp.try_slug('Maiuscula'), 'recusado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug curto (2 letras) é recusado', pg_temp.try_slug('ab'), 'recusado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug começando com hífen é recusado', pg_temp.try_slug('-abc'), 'recusado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug com hífens repetidos é recusado', pg_temp.try_slug('a--b'), 'recusado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug com sublinhado é recusado', pg_temp.try_slug('com_underline'), 'recusado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug com espaço é recusado', pg_temp.try_slug('com espaco'), 'recusado');

INSERT INTO public.forms(owner_id, slug, status, max_responses) VALUES (current_setting('app.owner')::uuid, 'teste-fase0', 'published', 5);
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug repetido é recusado', pg_temp.try_slug('teste-fase0'), 'recusado');

-- ===== CPF único (RF-03) =====
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('1ª inscrição', (submit_response('teste-fase0', '{"q2":"5 km"}', '52998224725'))->>'status', 'ok');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('2ª inscrição com o mesmo CPF', (submit_response('teste-fase0', '{"q2":"10 km"}', '52998224725'))->>'status', 'duplicate');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('só 1 resposta gravada', count(*)::text, '1') FROM public.responses r JOIN public.forms f ON f.id = r.form_id WHERE f.slug = 'teste-fase0';

-- ===== Edição (RF-06) =====
SELECT set_config('app.tok', (SELECT r.edit_token FROM public.responses r JOIN public.forms f ON f.id = r.form_id WHERE f.slug = 'teste-fase0' LIMIT 1), false);
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('token tem 64 caracteres', length(current_setting('app.tok'))::text, '64');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('editar 5 km → 10 km', (update_response(current_setting('app.tok'), '{"q2":"10 km"}', '52998224725'))->>'status', 'ok');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('a resposta agora é 10 km', answers->>'q2', '10 km') FROM public.responses WHERE edit_token = current_setting('app.tok');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('trocar o CPF na edição é recusado', (update_response(current_setting('app.tok'), '{}', '11144477735'))->>'status', 'identifier_locked');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('token falso', (update_response('falso', '{}', NULL))->>'status', 'not_found');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('editar não consumiu vaga (continua 1)', count(*)::text, '1') FROM public.responses r JOIN public.forms f ON f.id = r.form_id WHERE f.slug = 'teste-fase0';

-- ===== Vagas cheias (RF-04): inscrever bloqueia, editar continua =====
INSERT INTO public.responses(form_id, answers, identifier) SELECT id, '{}', 'x' || g FROM public.forms, generate_series(1, 4) g WHERE slug = 'teste-fase0';
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('inscrever com vagas esgotadas', (submit_response('teste-fase0', '{}', 'novo'))->>'status', 'full');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('editar com vagas esgotadas', (update_response(current_setting('app.tok'), '{"q2":"5 km"}', '52998224725'))->>'status', 'ok');

-- ===== Prazo, rascunho e inexistente =====
UPDATE public.forms SET closes_at = now() - interval '1 minute' WHERE slug = 'teste-fase0';
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('inscrever com prazo vencido', (submit_response('teste-fase0', '{}', 'n2'))->>'status', 'closed');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('editar com prazo vencido', (update_response(current_setting('app.tok'), '{}', '52998224725'))->>'status', 'closed');
UPDATE public.forms SET closes_at = NULL, status = 'draft' WHERE slug = 'teste-fase0';
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('inscrever em rascunho', (submit_response('teste-fase0', '{}', 'n3'))->>'status', 'unavailable');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('slug inexistente', (submit_response('teste-fase0-nao-existe', '{}', 'n'))->>'status', 'unavailable');
UPDATE public.forms SET status = 'published' WHERE slug = 'teste-fase0';

-- ===== Consentimento (RF-08) =====
DELETE FROM public.responses WHERE form_id = (SELECT id FROM public.forms WHERE slug = 'teste-fase0');
UPDATE public.forms SET consent_text = 'Autorizo o uso dos meus dados.' WHERE slug = 'teste-fase0';
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('sem aceite é bloqueado', (submit_response('teste-fase0', '{}', 'c1', false))->>'status', 'consent_required');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('com aceite é gravado', (submit_response('teste-fase0', '{}', 'c2', true))->>'status', 'ok');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('data do aceite registrada', (consented_at IS NOT NULL)::text, 'true') FROM public.responses WHERE identifier = 'c2';
UPDATE public.forms SET consent_text = NULL WHERE slug = 'teste-fase0';
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('formulário sem termo dispensa aceite', (submit_response('teste-fase0', '{}', 'c3'))->>'status', 'ok');

-- ===== Formulário sem CPF: identificador nulo pode repetir =====
INSERT INTO public.forms(owner_id, slug, status) VALUES (current_setting('app.owner')::uuid, 'teste-fase0-sem-cpf', 'published');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('1ª sem identificador', (submit_response('teste-fase0-sem-cpf', '{"a":1}', NULL))->>'status', 'ok');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('2ª sem identificador', (submit_response('teste-fase0-sem-cpf', '{"a":2}', NULL))->>'status', 'ok');

-- ===== Permissões: quem pode ler e escrever (SEC-02 e "visitante sem login não lê nada") =====
-- Assume um papel por vez. "negado" = o banco recusou; o controle positivo prova que trocar de papel funciona.
CREATE FUNCTION pg_temp.como(papel text, consulta text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE res text;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', papel);
  EXECUTE consulta INTO res;
  RESET ROLE;
  RETURN coalesce(res, 'nulo');
EXCEPTION WHEN OTHERS THEN
  RETURN 'negado';
END $$;

INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('controle: consigo agir como visitante (anon)', pg_temp.como('anon', 'select 1::text'), '1');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('visitante não lê formulários', CASE WHEN pg_temp.como('anon', 'select count(*)::text from public.forms') IN ('0','negado') THEN 'sem acesso' ELSE 'VAZOU' END, 'sem acesso');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('visitante não lê perguntas', CASE WHEN pg_temp.como('anon', 'select count(*)::text from public.questions') IN ('0','negado') THEN 'sem acesso' ELSE 'VAZOU' END, 'sem acesso');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('visitante não lê respostas', CASE WHEN pg_temp.como('anon', 'select count(*)::text from public.responses') IN ('0','negado') THEN 'sem acesso' ELSE 'VAZOU' END, 'sem acesso');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('visitante não lê perfis', CASE WHEN pg_temp.como('anon', 'select count(*)::text from public.profiles') IN ('0','negado') THEN 'sem acesso' ELSE 'VAZOU' END, 'sem acesso');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('visitante não grava resposta direto na tabela', pg_temp.como('anon', $q$ insert into public.responses(form_id, answers) select id, '{}' from public.forms limit 1 returning 'inseriu' $q$), 'negado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('usuário logado sem ser o dono não lê respostas alheias', CASE WHEN pg_temp.como('authenticated', 'select count(*)::text from public.responses') IN ('0','negado') THEN 'sem acesso' ELSE 'VAZOU' END, 'sem acesso');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('visitante não chama submit_response', pg_temp.como('anon', $q$ select public.submit_response('teste-fase0','{}','zz')->>'status' $q$), 'negado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('usuário logado não chama submit_response', pg_temp.como('authenticated', $q$ select public.submit_response('teste-fase0','{}','zz')->>'status' $q$), 'negado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('visitante não chama update_response', pg_temp.como('anon', $q$ select public.update_response('falso','{}',null)->>'status' $q$), 'negado');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('o servidor (service_role) chama submit_response', pg_temp.como('service_role', $q$ select public.submit_response('teste-fase0-nao-existe','{}','zz')->>'status' $q$), 'unavailable');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('submit_response é SECURITY DEFINER com search_path fixo', (SELECT (prosecdef AND coalesce(array_to_string(proconfig, ',') LIKE '%search_path=public%', false))::text FROM pg_proc WHERE oid = 'public.submit_response(text,jsonb,text,boolean)'::regprocedure), 'true');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('update_response é SECURITY DEFINER com search_path fixo', (SELECT (prosecdef AND coalesce(array_to_string(proconfig, ',') LIKE '%search_path=public%', false))::text FROM pg_proc WHERE oid = 'public.update_response(text,jsonb,text)'::regprocedure), 'true');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('toda tabela pública tem RLS ligada', (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity), '0');
INSERT INTO pg_temp.resultados(linha) SELECT pg_temp.chk('nenhuma política vale para visitante (anon/public)', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND roles && ARRAY['anon','public']::name[]), '0');

DELETE FROM public.forms WHERE slug LIKE 'teste-fase0%';

-- ===== Resultado (uma única tabela) =====
SELECT resultado FROM (
  SELECT n, linha AS resultado FROM pg_temp.resultados
  UNION ALL
  SELECT 1000000, '== RESUMO: ' || count(*) FILTER (WHERE linha LIKE 'PASSOU%') || ' PASSOU, ' || count(*) FILTER (WHERE linha LIKE 'FALHOU%') || ' FALHOU ==' FROM pg_temp.resultados
) r ORDER BY n;
