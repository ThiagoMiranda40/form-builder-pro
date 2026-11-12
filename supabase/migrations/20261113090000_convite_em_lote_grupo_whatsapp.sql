-- Migração T-45 (M-46): Banco — link do grupo, lotes e entregas de convite (RF-17, RF-19, RF-21, ARQ-02, ARQ-05, SEC-39, SEC-41)
-- Compatível com a produção atual: apenas acrescenta colunas anuláveis em forms,
-- duas tabelas novas fechadas (RLS ligada sem políticas, acesso exclusivo a service_role)
-- e a função atômica public.invite_create_batch.

-- 1) Colunas de link do grupo do WhatsApp em public.forms
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS whatsapp_group_link text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_group_link_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_group_link_updated_by text NULL;

ALTER TABLE public.forms
  DROP CONSTRAINT IF EXISTS forms_whatsapp_group_link_check;

ALTER TABLE public.forms
  ADD CONSTRAINT forms_whatsapp_group_link_check
  CHECK (
    whatsapp_group_link IS NULL
    OR (
      whatsapp_group_link ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'
      AND char_length(whatsapp_group_link) <= 200
    )
  );

ALTER TABLE public.forms
  DROP CONSTRAINT IF EXISTS forms_whatsapp_group_link_updated_by_check;

ALTER TABLE public.forms
  ADD CONSTRAINT forms_whatsapp_group_link_updated_by_check
  CHECK (
    whatsapp_group_link_updated_by IS NULL
    OR whatsapp_group_link_updated_by IN ('admin', 'client_link')
  );

-- 2) Tabela de lotes de convite (invite_batches)
CREATE TABLE IF NOT EXISTS public.invite_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  group_link text NOT NULL,
  total integer NOT NULL CHECK (total >= 0),
  sent integer NOT NULL DEFAULT 0 CHECK (sent >= 0),
  failed integer NOT NULL DEFAULT 0 CHECK (failed >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done'))
);

CREATE INDEX IF NOT EXISTS invite_batches_form_created_idx
  ON public.invite_batches (form_id, created_at DESC);

ALTER TABLE public.invite_batches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.invite_batches FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.invite_batches TO service_role;

-- 3) Tabela de entregas de convite por inscrito (invite_deliveries) — sem e-mail nem telefone
CREATE TABLE IF NOT EXISTS public.invite_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.invite_batches(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  response_id uuid NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  state text NOT NULL CHECK (state IN ('pending', 'sent', 'failed', 'opened')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  error_code text NULL,
  CONSTRAINT invite_deliveries_batch_response_channel_key UNIQUE (batch_id, response_id, channel)
);

CREATE INDEX IF NOT EXISTS invite_deliveries_batch_state_idx
  ON public.invite_deliveries (batch_id, state);

CREATE INDEX IF NOT EXISTS invite_deliveries_form_response_channel_idx
  ON public.invite_deliveries (form_id, response_id, channel);

ALTER TABLE public.invite_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.invite_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.invite_deliveries TO service_role;

-- 4) Função atômica de criação de lote com trava por formulário, intervalo mínimo e orçamento diário
CREATE OR REPLACE FUNCTION public.invite_create_batch(
  p_form_id uuid,
  p_created_by text,
  p_response_ids uuid[],
  p_min_interval_minutes integer DEFAULT 10,
  p_daily_budget integer DEFAULT 80,
  p_resend boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_link text;
  v_last_batch_at timestamptz;
  v_eligible_ids uuid[];
  v_eligible_count integer;
  v_used_24h integer;
  v_remaining integer;
  v_to_take integer;
  v_deferred integer;
  v_batch_id uuid;
BEGIN
  -- Serializa o orçamento global de 24 h (sempre adquirido antes da trava por formulário)
  PERFORM pg_advisory_xact_lock(hashtext('invite_create_batch:budget'));
  -- Serializa chamadas concorrentes para o mesmo formulário na mesma transação
  PERFORM pg_advisory_xact_lock(hashtext(p_form_id::text));

  -- (1) Formulário existe e possui whatsapp_group_link válido configurado
  SELECT f.whatsapp_group_link
    INTO v_group_link
    FROM public.forms AS f
   WHERE f.id = p_form_id;

  IF NOT FOUND OR v_group_link IS NULL OR btrim(v_group_link) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_link');
  END IF;

  -- (2) Intervalo mínimo desde o último lote deste formulário
  SELECT max(b.created_at)
    INTO v_last_batch_at
    FROM public.invite_batches AS b
   WHERE b.form_id = p_form_id;

  IF v_last_batch_at IS NOT NULL
     AND v_last_batch_at > now() - make_interval(mins => greatest(0, coalesce(p_min_interval_minutes, 10))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_soon');
  END IF;

  -- (3) Filtra candidatos que pertencem ao formulário e que ainda não têm entrega 'sent' por e-mail (salvo p_resend = true)
  IF p_response_ids IS NULL OR coalesce(array_length(p_response_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nobody_eligible');
  END IF;

  SELECT ARRAY(
    SELECT r.id
      FROM public.responses AS r
     WHERE r.form_id = p_form_id
       AND r.id = ANY(p_response_ids)
       AND NOT EXISTS (
         SELECT 1
           FROM public.invite_deliveries AS dp
           JOIN public.invite_batches AS bp ON bp.id = dp.batch_id
          WHERE dp.response_id = r.id
            AND dp.channel = 'email'
            AND dp.state = 'pending'
            AND bp.status = 'open'
       )
       AND (
         coalesce(p_resend, false)
         OR NOT EXISTS (
           SELECT 1
             FROM public.invite_deliveries AS d
            WHERE d.form_id = p_form_id
              AND d.response_id = r.id
              AND d.channel = 'email'
              AND d.state = 'sent'
         )
       )
     ORDER BY r.submitted_at ASC, r.id ASC
  ) INTO v_eligible_ids;

  v_eligible_count := coalesce(array_length(v_eligible_ids, 1), 0);

  IF v_eligible_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nobody_eligible');
  END IF;

  -- (4) Orçamento diário (últimas 24 h em todo o sistema para entregas de e-mail sent ou pending)
  SELECT count(*)::integer
    INTO v_used_24h
    FROM public.invite_deliveries AS d
   WHERE d.channel = 'email'
     AND d.state IN ('sent', 'pending')
     AND d.updated_at > now() - interval '24 hours';

  v_remaining := greatest(0, coalesce(p_daily_budget, 80) - coalesce(v_used_24h, 0));

  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'budget_exhausted');
  END IF;

  v_to_take := least(v_eligible_count, v_remaining);
  v_deferred := v_eligible_count - v_to_take;

  -- (5) Cria o lote e as entregas pendentes
  INSERT INTO public.invite_batches (
    form_id,
    created_at,
    created_by,
    group_link,
    total,
    sent,
    failed,
    status
  )
  VALUES (
    p_form_id,
    now(),
    p_created_by,
    v_group_link,
    v_to_take,
    0,
    0,
    'open'
  )
  RETURNING id INTO v_batch_id;

  INSERT INTO public.invite_deliveries (
    batch_id,
    form_id,
    response_id,
    channel,
    state,
    updated_at
  )
  SELECT
    v_batch_id,
    p_form_id,
    rid,
    'email',
    'pending',
    now()
  FROM unnest(v_eligible_ids[1:v_to_take]) AS rid;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'total', v_to_take,
    'deferred', v_deferred
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invite_create_batch(uuid, text, uuid[], integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_create_batch(uuid, text, uuid[], integer, integer, boolean) TO service_role;

