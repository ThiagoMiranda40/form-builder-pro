# Prompt T-55 — Baixar contatos (.vcf) na página de respostas (M-46, Marco 0)

Repositório: ThiagoMiranda40/form-builder-pro. Branch de trabalho: `spec-001-fase-0-no-ar`. A `main` está em `524ac2b`: NÃO mexa na `main`. NUNCA use --force. NÃO altere dependências (`package.json` e `bun.lock` intactos). TDD: escreva os testes ANTES do código, rode e veja falhar, depois implemente. Commits pequenos em português. A promoção para a `main` só será feita depois, a pedido do dono. Não rode nada contra dados reais.

## Contexto
Prioridade máxima do dono (12/11/2026): convidar os inscritos para o grupo do WhatsApp do evento. Esta é a **T-55, a primeira tarefa da M-46 (Marco 0)**: um botão que baixa um arquivo `.vcf` com os contatos dos inscritos, para o administrador importar na agenda do celular de uma vez. **Sem banco, sem função de servidor, sem e-mail, sem painel novo.** As demais tarefas (T-45 a T-54) NÃO fazem parte deste pedido.

## Antes de começar (obrigatório)
Leia `AGENTS.md`, `specs/001-fase-0-no-ar/tasks.md` (seção M-46: tabela de ordem e a T-55), `spec.md` (RF-22), `seguranca.md` (seção 9, SEC-43), `qa-plan.md` (seção 15: QA-46-18 e QA-46-28) e `design/ui-ux.md` (seção 12, Tela I, botão `Baixar contatos`). Leia também `src/lib/whatsapp.ts` (`parseBrazilMobile`), `src/lib/responses-table.ts` (`findNameQuestion`), `src/lib/exports.ts` e a barra de botões de exportação em `src/routes/_authenticated.formularios.$id_.respostas.tsx` (botões `Exportar Excel` e `Exportar PDF`), e veja como o botão de WhatsApp do card de detalhes (T-43, `ResponseDetailDialog.tsx`) escolhe a pergunta de telefone: use o mesmo critério. Se algum arquivo ou ID citado não existir, PARE e avise.

## Primeiro passo — linha de base
Rode e cole a saída real de `bunx tsc --noEmit`, `bun run test` e `bun run build` (use os equivalentes da seção Comandos do `AGENTS.md`). Falha preexistente: reporte, não corrija.

## TAREFA 1 — Documentação
Somente: em `tasks.md`, estado da T-55 para `em andamento` e, ao final, `concluída (aguardando prova na prévia)`. Em `qa-plan.md`, marque QA-46-18 como implementado quando os testes passarem. Nada mais em `specs/` nem em `docs/`.

## TAREFA 2 — Código
1. **Testes primeiro** em `src/lib/invite.test.ts` (arquivo novo): nome com `\n`, `;`, `,`, `\` e o texto `END:VCARD` não cria campo nem contato extra; separador de linha `CRLF`; N contatos para N válidos; telefone inválido ou fixo fica de fora; nome vazio vira `Inscrito`; telefone sai como `+55<DDD><número>`.
2. **`src/lib/invite.ts`** (arquivo novo, funções puras, sem rede, sem cookie, sem `getRequest`): `buildVcf(contacts: {name: string; phone: string}[]): string`, vCard 3.0. Escapar `\`, `;`, `,` e quebras de linha no nome; remover caracteres de controle; só entram telefones que `parseBrazilMobile` valida.
3. **Botão** `Baixar contatos (.vcf)` na página de respostas do administrador, ao lado de `Exportar PDF`, mesmo estilo dos outros dois. Gerado no navegador com os dados já carregados na página (todos os inscritos, não só os filtrados), arquivo `contatos-<título em minúsculas sem acento e com hífens>.vcf`. Nome do contato = resposta da pergunta de nome (`findNameQuestion`); telefone = resposta da pergunta de telefone do formulário. Se não houver pergunta de telefone ou nenhum telefone válido, o botão fica desabilitado com a dica `Este formulário não tem celular válido para baixar.`
4. Não criar rota, função de servidor, tabela, migração, dependência nem componente novo além do botão.

## Entregue no relatório
- Linha de base e saída real dos comandos padrão ao final.
- `git diff --stat` e `git diff --stat -- package.json bun.lock` (este vazio).
- A saída do teste novo (vermelho antes, verde depois).
- Onde o botão aparece e como a pergunta de telefone foi escolhida (cite o arquivo e a linha do critério reaproveitado).
- Um `.vcf` de exemplo gerado pelo teste com 3 contatos falsos (um com nome malicioso), colado em bloco de código.
- Como o dono prova na prévia: abrir o formulário de teste na prévia, baixar o arquivo, importar no Android e no iPhone e conferir nome e telefone.
- Hash do commit e branch; `git ls-remote origin refs/heads/main` mostrando que a `main` não mudou.
- O que NÃO foi feito e por quê.

## Regras do relatório
Reporte somente saídas reais de comandos. Não declare “aprovado” o que não foi executado; marque como “não executado” o que depende do dono (importar no celular). Depois do relatório, **PARE**. Não avance para outra tarefa.
