# ADR-001 — Convite por link, sem adicionar participantes ao grupo

Status: Proposto (12/11/2026), aguarda aprovação do dono. Origem: CA-01 e CA-02 do PRD M-46. Decisão de produto ligada: DP-01.

## Contexto
O pedido é colocar os inscritos (57 hoje) num grupo de WhatsApp automaticamente. Fatos medidos em 12/11/2026 (fontes no PRD, seção 13):
- A Groups API oficial da Meta não adiciona participantes: só gera link de convite que a pessoa aceita. Segundo fontes de terceiros, o grupo da API tem no máximo 8 participantes e exige Official Business Account.
- Bibliotecas não oficiais adicionam direto, mas violam os termos do WhatsApp (fonte secundária), arriscam banir o número do cliente e exigem processo sempre ligado, que não existe em Cloudflare Workers.
- A configuração de privacidade "Grupos" do WhatsApp impede a adição de quem restringiu, mesmo manualmente.

## Opções consideradas
1. Groups API oficial: inviável (8 participantes, OBA, só convite).
2. Biblioteca não oficial em servidor próprio: viola termos, risco de banimento, custo de manter servidor, não resolve a privacidade do convidado.
3. Convite por link distribuído pelo sistema (e-mail em lote, botão wa.me, link na confirmação): sem risco ao número do cliente, sem servidor novo, o convidado decide.

## Decisão
Opção 3. O sistema nunca se conecta ao WhatsApp. Só gera links (`wa.me` e o link de convite do grupo informado pelo usuário) e e-mails.

## Consequências
Cliente cria o grupo uma vez e cola o link. Não é possível saber quem entrou. Nenhuma dependência nova.

## Em linguagem simples
Em vez de o sistema "puxar" 57 pessoas para o grupo, ele entrega a cada uma o convite. É mais seguro para o número do cliente, não custa nada e respeita quem não quer entrar. O custo é que cada pessoa precisa tocar no convite.

## Revisitar quando
O cliente comprovar que precisa de envio direto pelo WhatsApp e aceitar o custo e as regras da plataforma paga (ver EV-03 do architecture.md).
