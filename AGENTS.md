<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Form Builder Pro — instruções do projeto

Documentos: produto em `docs/PRD-form-builder-pro.md`; feature atual em `specs/001-fase-0-no-ar/` (`spec.md` = comportamento, `plan.md` = técnica, `data-model.md` = banco, `tasks.md` = tarefas). Executar **uma task por vez** e rodar a verificação dela antes de seguir.

## Comandos
- Gerenciador de pacotes: **bun** (`bun.lock`). O `bunfig.toml` bloqueia versões com menos de 24 h: se uma dependência for barrada, usar a versão anterior e **nunca** adicionar exceção sem perguntar ao dono.
- Verificação padrão NESTA MÁQUINA (Windows com Controle de Aplicativo Inteligente ativado, que bloqueia os .exe gerados pelo Bun, como vite.exe): rode os arquivos JavaScript das ferramentas direto com o bun:
  - tipos: `bun node_modules/typescript/bin/tsc --noEmit`
  - testes: `bun node_modules/vitest/vitest.mjs run`
  - build: `bun node_modules/vite/bin/vite.js build`
  - servidor local: `bun node_modules/vite/bin/vite.js dev` (porta 8080)
- Em qualquer outra máquina, os equivalentes são `bunx tsc --noEmit`, `bun run test`, `bun run build` e `bun run dev`.
- Se um popup de bloqueio do Windows citar OUTRO arquivo, PARE e me avise. Não desative o Controle de Aplicativo. O `npx wrangler dev` (workerd) pode ser bloqueado pelo mesmo motivo; a verificação real do Worker é feita no Worker publicado.
- **Não usar `eslint` como critério** (há centenas de erros de formatação antigos) e **não reformatar o repositório**.
- `vite preview` **não funciona** neste projeto. Para conferir rotas: `bun run dev`; para rodar o Worker compilado: `npx wrangler dev --config .output/server/wrangler.json`.

## Regras do projeto
- Uso próprio: um único administrador. Nunca reintroduzir cadastro público nem login com Google (depende do Lovable Cloud).
- **Regras de negócio (vagas, CPF único, consentimento, prazo) valem no servidor/banco**, nunca só na tela. Validação de respostas: sempre `validateAnswer` (`src/lib/validators.ts`), a mesma no navegador e no servidor.
- Vagas e CPF único são aplicados pelas funções `submit_response`/`update_response` do banco. Não reimplementar contagem no código.
- O link de edição do inscrito é `/editar/{token}` e **não depende do slug** do formulário.
- CPF e RG **nunca** aparecem por inteiro em e-mail. Todo texto de inscrito em HTML passa por `escapeHtml`.
- Falha no envio de e-mail **nunca** derruba a inscrição.
- Rota pública do formulário: `/{slug}`. Slugs reservados: `auth, painel, formularios, api, saude, admin, assets, login, editar` (lista em `src/lib/slug.ts` **e** na migração; um teste compara as duas).
- Migrações: sempre um arquivo novo em `supabase/migrations/`; **nunca editar as existentes**.

## Pegadinhas
- Não editar arquivos gerados pelo Lovable: `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher}.ts` e `src/integrations/lovable/`. Exceção: `types.ts` é atualizado à mão junto com cada migração. `src/routeTree.gen.ts` é regenerado pelo build.
- A chave secreta do Supabase e a do Resend existem SOMENTE como Segredo do Worker. NÃO criar .dev.vars, .env.local nem qualquer arquivo com chaves nesta máquina (a pasta do projeto está no OneDrive e sincroniza com a nuvem). A verificação local roda sem chaves; a verificação real ocorre no Worker publicado. O .env do repositório contém apenas URL e chave pública do Supabase.
- Não excluir perguntas de formulário que já tem inscritos: as respostas apontam para o ID da pergunta e os dados sumiriam da tabela e das exportações.

## Fluxo de git e prova
- **Política de versões**: `main` e `spec-001-fase-0-no-ar` são mantidas iguais até existir versão em produção (decisão do dono). Depois do primeiro formulário real (T-14), passar a trabalhar só em branch e mesclar na `main` após validar.
- **Cada tarefa termina com um commit na branch**, mensagem `feat(spec-001): implementa T-NN - <título curto>` (documentação: `docs: <resumo>`), push da branch e fast-forward da `main`: `git checkout main && git merge --ff-only spec-001-fase-0-no-ar && git push origin main && git checkout spec-001-fase-0-no-ar`. Sem `--force` e sem rebase.
- **Prova**: `git ls-remote origin refs/heads/main refs/heads/spec-001-fase-0-no-ar` com os dois hashes iguais.
- **Antes de commitar**: `git status --short` só pode listar os arquivos permitidos da tarefa (mais gerados: `routeTree.gen.ts` e `bun.lock`). Qualquer outro: PARE.
- **Tarefas com regra de negócio**: mostrar os testes falhando antes de implementar.
- **Relatório**: hash, saídas literais dos comandos, arquivos alterados e a "tradução em linguagem simples". Depois PARE.

## Ambiente
- Windows com PowerShell (usar `curl.exe`, não `curl`).
- Controle de Aplicativo Inteligente do Windows ATIVADO: bloqueia executáveis sem assinatura (inclusive os .exe gerados pelo Bun); use os comandos da seção Comandos.
- A pasta do projeto está dentro do OneDrive por decisão do dono até o fim da Spec 001.
- O servidor de desenvolvimento roda na porta 8080.
- Os blocos de verificação do tasks.md podem estar em sintaxe bash. No PowerShell desta máquina, traduza: `curl` -> `curl.exe`; `grep` -> `Select-String`; `! comando` -> conferir que não há saída; `&` e `sleep N` -> iniciar o servidor de desenvolvimento em processo separado/segundo plano, esperar a porta 8080 responder e encerrá-lo ao final; porta 5173 -> 8080; `bun run X` e `bunx` -> os equivalentes da seção Comandos.

## Passos manuais
- As tarefas marcadas com 🧑 (T-02, partes da T-03 e T-14) são feitas pelo dono em painéis externos. O agente não as executa; relata códigos e mensagens, nunca chaves.

