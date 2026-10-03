# Data model — Spec 001

> **A migração abaixo foi executada e testada** em um Postgres 16 local, aplicada por cima das 2 migrações reais do repositório (com um stub do schema `auth` do Supabase). Resultado dos testes na seção "Verificação". Ela vira o arquivo `supabase/migrations/<timestamp>_fase0_inscricao.sql` (task T-04). **Nunca edite as migrações existentes.**

## Entidades (só o que muda)

| Entidade | Adicionar | Regra |
|---|---|---|
| **forms** | `consent_text` (texto, opcional) | Se preenchido, o aceite é obrigatório |
| **forms** | regras no `slug` | Formato `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60 caracteres, não reservado (o `UNIQUE` já existe) |
| **forms** | `share_token` (texto, opcional) | Token de 64 hex minúsculos para visualização do cliente (T-25 / M-20); índice único parcial onde não nulo |
| **forms** | `edit_window_hours` (inteiro, opcional) | Janela limite em horas (1 a 720) para edição da resposta (T-25, uso futuro) |
| **responses** | `identifier` (CPF só dígitos, opcional) | **Único por formulário** quando preenchido |
| **responses** | `edit_token` (64 caracteres, único, gerado no banco) | Identifica a inscrição para edição; independe do slug |
| **responses** | `consented_at`, `updated_at` | Prova do aceite; data da última edição |

Relações inalteradas: `forms 1—N questions`, `forms 1—N responses`, `auth.users 1—N forms`.

Decisões:
- **Regra de negócio no banco, não só no código.** Limite de vagas, CPF único e consentimento são aplicados dentro de **uma transação** (`submit_response`), que trava a linha do formulário (`FOR UPDATE`). Só assim o limite é seguro sob envios simultâneos.
- **`identifier` é derivado, não digitado duas vezes.** O CPF continua também dentro de `answers` (para a tabela e as exportações); `identifier` existe só para a regra de unicidade. É a única duplicação, mantida pelo servidor no mesmo comando que grava a resposta.
- **Token gerado no banco** (dois UUIDs aleatórios concatenados = 244 bits), guardado em texto puro. Aceito porque o administrador precisa poder copiá-lo (RF-07).
- **Funções só para o servidor.** `anon` e `authenticated` não executam `submit_response`/`update_response`; só `service_role`.
- **Leitura pública removida.** O formulário público já lê pelo servidor com a chave de serviço; as políticas de leitura anônima em `forms` e `questions` eram exposição desnecessária.
- **Não excluir perguntas de formulário com inscritos:** as respostas apontam para o ID da pergunta e os dados sumiriam da tabela/exportação.

## Migração (testada)

```sql
-- ===== Fase 0: inscrição única por CPF, limite atômico, edição por link, slug personalizado =====

-- 1) Formulário: consentimento (LGPD) e regras de slug (URL personalizada)
ALTER TABLE public.forms ADD COLUMN consent_text TEXT;

ALTER TABLE public.forms ADD CONSTRAINT forms_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 60);

ALTER TABLE public.forms ADD CONSTRAINT forms_slug_reserved
  CHECK (slug NOT IN ('auth','painel','formularios','api','saude','admin','assets','login','editar'));

-- 2) Resposta: identificador (CPF só dígitos), consentimento, token de edição, última edição
ALTER TABLE public.responses
  ADD COLUMN identifier TEXT,
  ADD COLUMN consented_at TIMESTAMPTZ,
  ADD COLUMN edit_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX responses_form_identifier_uniq
  ON public.responses (form_id, identifier) WHERE identifier IS NOT NULL;
CREATE UNIQUE INDEX responses_edit_token_uniq ON public.responses (edit_token);

-- 3) Inscrever: tudo numa única transação; o bloqueio da linha do formulário serializa envios simultâneos
CREATE OR REPLACE FUNCTION public.submit_response(p_slug TEXT, p_answers JSONB, p_identifier TEXT, p_consented BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f public.forms%ROWTYPE;
  n INTEGER;
  r public.responses%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.forms WHERE slug = p_slug FOR UPDATE;
  IF NOT FOUND OR f.status <> 'published' THEN
    RETURN jsonb_build_object('status', 'unavailable');
  END IF;
  IF f.closes_at IS NOT NULL AND f.closes_at < now() THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;
  IF f.consent_text IS NOT NULL AND NOT p_consented THEN
    RETURN jsonb_build_object('status', 'consent_required');
  END IF;
  SELECT count(*) INTO n FROM public.responses WHERE form_id = f.id;
  IF f.max_responses IS NOT NULL AND n >= f.max_responses THEN
    RETURN jsonb_build_object('status', 'full');
  END IF;

  INSERT INTO public.responses (form_id, answers, identifier, consented_at)
  VALUES (f.id, p_answers, p_identifier, CASE WHEN f.consent_text IS NOT NULL THEN now() END)
  ON CONFLICT (form_id, identifier) WHERE identifier IS NOT NULL DO NOTHING
  RETURNING * INTO r;

  IF r.id IS NULL THEN
    RETURN jsonb_build_object('status', 'duplicate');
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'response_id', r.id,
                            'edit_token', r.edit_token, 'success_message', f.success_message);
END $$;

-- 4) Editar pelo link: não consome vaga; o identificador (CPF) não pode mudar
CREATE OR REPLACE FUNCTION public.update_response(p_token TEXT, p_answers JSONB, p_identifier TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.responses%ROWTYPE;
  f public.forms%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.responses WHERE edit_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  SELECT * INTO f FROM public.forms WHERE id = r.form_id;
  IF f.status <> 'published' OR (f.closes_at IS NOT NULL AND f.closes_at < now()) THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;
  IF r.identifier IS DISTINCT FROM p_identifier THEN
    RETURN jsonb_build_object('status', 'identifier_locked');
  END IF;
  UPDATE public.responses SET answers = p_answers, updated_at = now() WHERE id = r.id;
  RETURN jsonb_build_object('status', 'ok', 'response_id', r.id, 'success_message', f.success_message);
END $$;

REVOKE ALL ON FUNCTION public.submit_response(TEXT, JSONB, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_response(TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_response(TEXT, JSONB, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_response(TEXT, JSONB, TEXT) TO service_role;

-- 5) Endurecimento: leitura pública passa só pelo servidor (o formulário público já usa a chave de serviço)
DROP POLICY forms_public_read ON public.forms;
DROP POLICY questions_public_read ON public.questions;
REVOKE SELECT ON public.forms, public.questions FROM anon;
```

### Contrato das funções

| Função | Retorno (`status`) |
|---|---|
| `submit_response(slug, answers, identifier, consented)` | `ok` (+ `edit_token`, `success_message`) · `duplicate` · `full` · `closed` · `unavailable` · `consent_required` |
| `update_response(token, answers, identifier)` | `ok` (+ `success_message`) · `not_found` · `closed` · `identifier_locked` |

Erros de `INSERT/UPDATE` em `forms.slug` chegam ao código como: código `23505` (endereço já usado), `23514` com nome da constraint `forms_slug_format` ou `forms_slug_reserved`.

## Verificação do banco (resultado real dos testes)

Rodados nesta ordem, num banco novo com as 2 migrações do repositório + a migração acima:

| Grupo | Caso | Resultado observado |
|---|---|---|
| Slug | `skf-corrida-track-field`; `painel`, `editar`, `saude` (reservados); `Maiuscula`; `ab`; `-abc`; `a--b`; `com_underline`; `com espaco` | Só o primeiro aceito; todos os outros recusados |
| Slug | mesmo slug em 2 formulários | Recusado (unicidade) |
| CPF | 1ª inscrição / 2ª com o mesmo CPF | `ok` / `duplicate`; 1 resposta gravada |
| Edição | trocar "5 km" → "10 km" com o mesmo CPF | `ok`; resposta vira "10 km"; continua 1 resposta |
| Edição | trocar o CPF / token falso | `identifier_locked` / `not_found` |
| Vagas cheias | inscrever / editar | `full` / `ok` (editar não é bloqueado) |
| Prazo | inscrever e editar com prazo vencido | `closed` / `closed` |
| Estado | rascunho / slug inexistente | `unavailable` / `unavailable` |
| Consentimento | sem aceite / com aceite | `consent_required` / `ok` com `consented_at` preenchido; formulário sem texto: `consented_at` nulo |
| Sem CPF | 2 inscrições com identificador nulo | Ambas `ok` |
| **Concorrência** | **5 vagas, 20 envios simultâneos (CPFs diferentes)** | **5 `ok` + 15 `full`; 5 gravadas** |
| **Concorrência** | **mesmo CPF, 10 envios simultâneos** | **1 `ok` + 9 `duplicate`; 1 gravada** |
| Permissões | `anon` lê `forms`/`questions`/`responses` e executa as funções; `authenticated` executa `submit_response` | Todos **bloqueados**; `service_role` executa normalmente (agora cobertas por 15 checagens do script) |

### Como repetir no Supabase real (T-04)

Cole o arquivo `verificacao-banco.sql` no SQL Editor do Supabase e execute (esperado: 47 PASSOU). Em seguida, execute `verificacao-concorrencia.mjs` via Bun no terminal (esperado: 5 ok + 15 full). Veja o passo a passo detalhado na task T-04 do `tasks.md`.

## Alterações à mão em `src/integrations/supabase/types.ts`

O arquivo é gerado pelo Lovable (vem de um projeto que não usaremos mais). Ele **não** será regenerado, então acrescente à mão:
- `forms`: `consent_text: string | null` (Row) e opcional em Insert/Update.
- `forms` (T-25): `share_token: string | null`, `edit_window_hours: number | null` (Row) e opcionais em Insert/Update.
- `responses`: `identifier: string | null`, `consented_at: string | null`, `edit_token: string`, `updated_at: string` (opcionais em Insert/Update, exceto onde já são gerados pelo banco).
- `Functions`: `submit_response` (Args: `p_slug`, `p_answers: Json`, `p_identifier: string | null`, `p_consented?: boolean`; Returns: `Json`) e `update_response` (Args: `p_token`, `p_answers: Json`, `p_identifier: string | null`; Returns: `Json`).

## Migração T-25: Compartilhamento e prazo de edição (`20261002190000_compartilhamento_e_prazo_de_edicao.sql`)

Aplicada no banco em 02/10/2026 pelo dono:
```sql
-- T-25 (M-20) link do cliente e prazo de edição (uso futuro)
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS forms_share_token_key
  ON public.forms (share_token) WHERE share_token IS NOT NULL;

ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS edit_window_hours INTEGER;
ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_edit_window_hours_check;
ALTER TABLE public.forms ADD CONSTRAINT forms_edit_window_hours_check
  CHECK (edit_window_hours IS NULL OR edit_window_hours BETWEEN 1 AND 720);
```

