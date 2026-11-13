# Prompt T-45 — Banco: link do grupo, lotes e entregas de convite (M-46)

Repositório: ThiagoMiranda40/form-builder-pro. Branch de trabalho: `spec-001-fase-0-no-ar`. A `main` está em `524ac2b`: NÃO mexa na `main`. NUNCA use --force. NÃO altere dependências (`package.json` e `bun.lock` intactos). TDD: escreva as verificações ANTES da migração. Commits pequenos em português. A promoção para a `main` só será feita depois, a pedido do dono. Não rode nada contra dados reais.

## Contexto
Prioridade máxima do dono (12/11/2026): o cliente precisa convidar os inscritos para o grupo do WhatsApp do evento sem salvar contatos. O sistema não adiciona pessoas ao grupo; ele distribui o convite (e-mail em lote, confirmação, botão de WhatsApp por inscrito). A M-46 tem as tarefas T-45 a T-55 e uma ordem própria de execução (administrador primeiro). Esta é a **T-45: só o banco**. Nenhuma tela, nenhuma função de servidor.

## Antes de começar (obrigatório)
Todos os documentos da M-46 já estão no repositório. Leia: `AGENTS.md`, `specs/001-fase-0-no-ar/tasks.md` (seção M-46, em especial a T-45 e a tabela de ordem), `data-model.md` (seção "Migração T-45"), `docs/arquitetura/architecture.md` (3.3, 3.4, 4.1 ARQ-02 e ARQ-05), `docs/arquitetura/adr/ADR-003` e `ADR-005`, `seguranca.md` (seção 9: SEC-39 e SEC-41), `qa-plan.md` (seção 15: QA-46-02 a QA-46-07). Se algum arquivo ou ID citado não existir, PARE e avise; não invente conteúdo.

## Primeiro passo — linha de base
Rode e cole a saída real de `bunx tsc --noEmit`, `bun run test` e `bun run build` (use os equivalentes da seção Comandos do `AGENTS.md`). Falha preexistente: reporte, não corrija.

## TAREFA 1 — Documentação
Somente: em `tasks.md`, mudar o estado da T-45 para `em andamento`. Nada mais em `specs/` nem em `docs/`.

## TAREFA 2 — Código (somente banco)
1. Escreva `specs/001-fase-0-no-ar/verificacao-banco-m46.sql` (sem `BEGIN/ROLLBACK`, pois o SQL Editor não mantém transação entre comandos: cria formulário de teste `teste-m46*` com dados só dele e apaga tudo no final; resultado esperado: 36 PASSOU, 0 FALHOU; rodar com "Run without RLS" porque a tabela de resultados é temporária) e `specs/001-fase-0-no-ar/verificacao-concorrencia-m46.mjs` com os casos QA-46-02 a QA-46-07. Devem falhar antes da migração (descreva o “vermelho”).
2. Escreva `supabase/migrations/20261113090000_convite_em_lote_grupo_whatsapp.sql` conforme `data-model.md`: colunas em `forms` com `CHECK` do link (regex `^https://chat\.whatsapp\.com/[A-Za-z0-9]+$`, até 200 caracteres); tabelas `invite_batches` e `invite_deliveries` com índices e unicidade; RLS ligado **sem política**; `REVOKE ALL ... FROM PUBLIC, anon, authenticated` e `GRANT` só para `service_role`; função `public.invite_create_batch(p_form_id uuid, p_created_by text, p_response_ids uuid[], p_min_interval_minutes int, p_daily_budget int, p_resend boolean)` `SECURITY DEFINER`, `search_path` fixo, `pg_advisory_xact_lock(hashtext(p_form_id::text))`, devolvendo `jsonb` com `ok`, `batch_id`, `total`, `deferred` ou `reason` (`no_link`, `too_soon`, `budget_exhausted`, `nobody_eligible`); idempotente (`IF NOT EXISTS`) onde couber.
3. Atualize à mão `src/integrations/supabase/types.ts` com as colunas e tabelas novas (sem regenerar por CLI).
4. Não crie função de servidor, tela nem componente.

## Entregue no relatório
- Saída real da linha de base e dos comandos padrão ao final.
- `git diff --stat` e `git diff --stat -- package.json bun.lock` (este vazio).
- Bloco copiável “Passo 0 — aplicar no Supabase SQL Editor antes de testar na prévia” com o SQL completo da migração (prévia e produção usam o mesmo banco; o dono aplica manualmente).
- Como o dono roda os dois arquivos de verificação e o que deve aparecer.
- Hash do commit e branch; `git ls-remote origin refs/heads/main` mostrando que a `main` não mudou.
- O que NÃO foi feito e por quê.

## Regras do relatório
Reporte somente saídas reais de comandos. Não declare “aprovado” o que não foi executado; marque como “não executado” o que depende do dono. Depois do relatório, **PARE**. Não avance para a T-46.
