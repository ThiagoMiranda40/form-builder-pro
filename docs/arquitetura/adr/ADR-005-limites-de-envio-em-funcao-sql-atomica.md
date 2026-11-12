# ADR-005 — Limites de envio (intervalo e orçamento diário) em função SQL atômica

Status: Proposto (12/11/2026). Origem: RNF-04 do PRD M-46.

## Contexto
É preciso impedir cliques repetidos, abuso e estouro do limite do Resend (100 e-mails por dia no plano gratuito, página de preços sem data). Não há Redis, fila nem outra infraestrutura, e o projeto quer custo zero. Na T-44, o contador de tentativas de código foi feito em código (ler e depois atualizar), não atômico, e a função SQL atômica correspondente (`share_register_failure`) ficou sem uso. Dois cliques simultâneos podem passar por uma verificação em código.

## Opções consideradas
1. Verificar em código (ler, decidir, gravar): corrida possível.
2. Função SQL única que, com trava por formulário (`pg_advisory_xact_lock`), confere intervalo e orçamento e cria o lote, devolvendo "ok" ou o motivo da recusa.
3. Serviço externo de limite de taxa: infraestrutura nova.

## Decisão
Opção 2. A função `invite_create_batch` confere: (a) intervalo mínimo de 10 minutos desde o último lote do mesmo formulário, (b) orçamento diário de e-mails de convite no sistema todo (valor inicial 80 por 24 h, ajustável por variável de ambiente, deixando 20 para as confirmações de inscrição) e (c) que o formulário tem link do grupo. Em caso de sucesso cria o lote e as entregas pendentes numa só transação. Execução só para service role.

## Consequências
O orçamento conta só os convites enviados por este sistema; e-mails de confirmação usam a mesma cota do Resend e não entram na conta. A margem de 20 é uma premissa a revisar com dado real do painel do Resend.

## Em linguagem simples
Quem decide se pode enviar é o próprio banco de dados, numa única operação, então dois cliques ao mesmo tempo não conseguem furar o limite.

## Revisitar quando
O plano do Resend mudar (EV-01) ou houver medição real do uso diário.
