-- T-24c (M-33, M-30): data do evento e limites de idade. Retrocompatível. Reverter: ALTER TABLE ... DROP COLUMN das 4 colunas.
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS event_time TEXT,
  ADD COLUMN IF NOT EXISTS event_location TEXT;

ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_event_time_check;
ALTER TABLE public.forms ADD CONSTRAINT forms_event_time_check
  CHECK (event_time IS NULL OR event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_event_location_check;
ALTER TABLE public.forms ADD CONSTRAINT forms_event_location_check
  CHECK (event_location IS NULL OR char_length(event_location) <= 120);

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_settings_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_settings_check
  CHECK (jsonb_typeof(settings) = 'object');
