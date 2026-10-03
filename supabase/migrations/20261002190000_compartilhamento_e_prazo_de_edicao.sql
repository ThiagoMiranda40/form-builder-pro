-- T-25 (M-20) link do cliente e prazo de edição (uso futuro)
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS forms_share_token_key
  ON public.forms (share_token) WHERE share_token IS NOT NULL;

ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS edit_window_hours INTEGER;
ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_edit_window_hours_check;
ALTER TABLE public.forms ADD CONSTRAINT forms_edit_window_hours_check
  CHECK (edit_window_hours IS NULL OR edit_window_hours BETWEEN 1 AND 720);
