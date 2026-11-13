-- Migração T-56 (M-46): Textos personalizáveis do grupo do WhatsApp em public.forms (RF-26, SEC-49)
-- Acrescenta duas colunas anuláveis com limite de 200 caracteres e sem caracteres de controle:
-- 1) whatsapp_group_notice_text: frase opcional de aviso no formulário público.
-- 2) whatsapp_group_invite_text: texto de convite personalizado na tela e e-mail de confirmação.

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS whatsapp_group_notice_text text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_group_invite_text text NULL;

ALTER TABLE public.forms
  DROP CONSTRAINT IF EXISTS forms_whatsapp_group_notice_text_check;

ALTER TABLE public.forms
  ADD CONSTRAINT forms_whatsapp_group_notice_text_check
  CHECK (
    whatsapp_group_notice_text IS NULL
    OR (
      char_length(whatsapp_group_notice_text) BETWEEN 1 AND 200
      AND whatsapp_group_notice_text !~ '[[:cntrl:]]'
    )
  );

ALTER TABLE public.forms
  DROP CONSTRAINT IF EXISTS forms_whatsapp_group_invite_text_check;

ALTER TABLE public.forms
  ADD CONSTRAINT forms_whatsapp_group_invite_text_check
  CHECK (
    whatsapp_group_invite_text IS NULL
    OR (
      char_length(whatsapp_group_invite_text) BETWEEN 1 AND 200
      AND whatsapp_group_invite_text !~ '[[:cntrl:]]'
    )
  );

