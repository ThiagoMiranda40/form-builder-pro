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
- Verificação padrão: `bunx tsc --noEmit`, `bun run test` (Vitest), `bun run build`.
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
- Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`) só como **Segredo** do Worker e em `.dev.vars` local (ignorado pelo git). O `.env` do repositório contém **apenas** URL e chave pública do Supabase.
- Não excluir perguntas de formulário que já tem inscritos: as respostas apontam para o ID da pergunta e os dados sumiriam da tabela e das exportações.
