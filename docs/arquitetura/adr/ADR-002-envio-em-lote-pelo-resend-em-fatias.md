# ADR-002 — Envio em lote pelo endpoint batch do Resend, em fatias de até 50, com idempotência

Status: Proposto (12/11/2026). Origem: CA-03 do PRD M-46 (refinada).

## Contexto
O envio atual (`sendConfirmationEmail`, `src/lib/confirmation-email.ts:213`) faz uma chamada HTTP por e-mail. Em Cloudflare Workers, cada chamada HTTP e cada consulta ao Supabase contam como subrequest. Documentação da Cloudflare consultada em 12/11/2026: plano Free permite 50 subrequests por invocação e 10 ms de CPU; plano pago, 10.000 e 30 s de CPU (configurável). O plano usado pelo projeto não foi confirmado. O Resend (página de preços, sem data) limita o plano gratuito a 100 e-mails por dia e 3.000 por mês, e a API a 10 requisições por segundo. O endpoint de lote do Resend aceita até 100 e-mails por chamada, sem anexos, e aceita o cabeçalho `Idempotency-Key` (único por requisição, vale 24 h, até 256 caracteres).

## Opções consideradas
1. Um `fetch` por e-mail dentro de um laço: 57 inscritos exigem 57 subrequests mais as consultas ao banco, acima do limite Free (50).
2. Fila externa ou Queues: infraestrutura nova, custo e complexidade antes de haver escala.
3. Endpoint de lote do Resend, em fatias pequenas, controladas pela tela (cada chamada ao servidor processa uma fatia).

## Decisão
Opção 3. Cada chamada ao servidor processa no máximo 50 destinatários pendentes, em uma única chamada ao endpoint de lote, com `Idempotency-Key` derivada de `batch_id` e do número da fatia. O estado de cada destinatário fica no banco (ADR-003), então o envio pode ser interrompido e retomado. Meta de projeto: no máximo 20 subrequests por chamada ao servidor.

## Consequências
Cabe no plano Free. Um fechamento de aba no meio deixa destinatários pendentes que o painel oferece continuar. O endpoint de lote não documenta falha parcial; por isso o código lê a resposta item a item e trata qualquer resposta inesperada como "pendente", nunca como "enviado".

## Em linguagem simples
Em vez de mandar 57 cartas uma a uma, entregamos um maço de até 50 de uma vez. Isso cabe no plano gratuito da Cloudflare e, se algo falhar no meio, o sistema sabe quem já recebeu e continua de onde parou, sem mandar duas vezes.

## Revisitar quando
A Resend ou a Cloudflare mudarem os limites citados, ou quando EV-01 ou EV-02 dispararem.
