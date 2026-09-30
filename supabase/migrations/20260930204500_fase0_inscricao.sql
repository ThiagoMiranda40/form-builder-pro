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
