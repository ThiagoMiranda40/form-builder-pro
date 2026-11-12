-- T-44 (M-44): código de acesso do link do cliente e controle de tentativas.
-- Retrocompatível: links antigos sem share_code_hash continuam funcionando como legado.
-- Reverter:
--   DROP FUNCTION IF EXISTS public.share_register_failure(uuid, integer, integer);
--   ALTER TABLE public.forms
--     DROP COLUMN IF EXISTS share_code_hash,
--     DROP COLUMN IF EXISTS share_code_salt,
--     DROP COLUMN IF EXISTS share_code_version,
--     DROP COLUMN IF EXISTS share_failed_attempts,
--     DROP COLUMN IF EXISTS share_locked_until;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS share_code_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS share_code_salt TEXT NULL,
  ADD COLUMN IF NOT EXISTS share_code_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_locked_until TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION public.share_register_failure(
  p_form_id UUID,
  p_max INTEGER DEFAULT 5,
  p_lock_minutes INTEGER DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
BEGIN
  UPDATE public.forms
  SET
    share_failed_attempts = CASE
      WHEN share_locked_until IS NOT NULL AND share_locked_until <= now() AND share_failed_attempts >= p_max
        THEN 1
      ELSE share_failed_attempts + 1
    END,
    share_locked_until = CASE
      WHEN (
        CASE
          WHEN share_locked_until IS NOT NULL AND share_locked_until <= now() AND share_failed_attempts >= p_max
            THEN 1
          ELSE share_failed_attempts + 1
        END
      ) >= p_max
        THEN now() + make_interval(mins => p_lock_minutes)
      ELSE NULL
    END
  WHERE id = p_form_id
  RETURNING share_failed_attempts, share_locked_until
  INTO v_attempts, v_locked_until;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_locked_until IS NOT NULL THEN 'locked_out' ELSE 'wrong_code' END,
    'failed_attempts', v_attempts,
    'locked_until', v_locked_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.share_register_failure(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_register_failure(UUID, INTEGER, INTEGER) TO service_role;
