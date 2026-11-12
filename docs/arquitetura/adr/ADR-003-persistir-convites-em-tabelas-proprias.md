# ADR-003 — Persistir link do grupo, lotes e entregas em estruturas próprias

Status: Proposto (12/11/2026). Origem: CA-04 do PRD M-46.

## Contexto
É preciso saber quem já foi convidado (RF-05), impedir envio duplicado (RF-03), limitar abuso (RNF-04) e registrar autoria (RNF-05). Os dados do formulário e do link do cliente moram em `forms` e `responses`, acessados só pelo servidor com chave de serviço (padrão da T-44).

## Opções consideradas
1. Guardar o estado dentro de `responses.answers` ou em colunas de `responses`: mistura dado do inscrito com dado operacional e arrisca aparecer em exportações.
2. Tabelas novas dedicadas.
3. Não persistir (só e-mail enviado e esquecido): impede RF-05 e limites.

## Decisão
Opção 2. Uma coluna `forms.whatsapp_group_link` (texto, opcional) e duas tabelas: `invite_batches` (formulário, tipo de autor, usuário quando for administrador, link usado, totais, estado, data) e `invite_deliveries` (lote, formulário, inscrição, canal `email` ou `whatsapp`, estado `pending`, `sent` ou `failed`, id do provedor, data). Acesso só por service role (REVOKE para anon e authenticated), como a função da T-44. Exclusão de inscrição ou de formulário apaga as entregas em cascata (compatível com a exclusão LGPD da T-42). Detalhes de colunas e índices ficam com a SDD (`data-model.md`).

## Consequências
Uma migração nova. As entregas guardam só ids, nunca o e-mail ou o telefone em texto (o endereço é lido da resposta no momento do envio).

## Em linguagem simples
Passamos a anotar, numa folha à parte, a quem já mandamos convite. Isso evita mandar duas vezes e permite ver o andamento, sem mexer nos dados das inscrições.

## Revisitar quando
O número de entregas passar de algumas dezenas de milhares de linhas (limpeza por prazo).
