# Tasks — Spec 001: Fase 0 no ar

**Comandos de verificação padrão** (toda task termina com eles verdes): `bunx tsc --noEmit` · `bun run test` · `bun run build`.
Nesta máquina, use os comandos equivalentes da seção Comandos do AGENTS.md (o Controle de Aplicativo Inteligente do Windows bloqueia os executáveis gerados pelo Bun).
**Não usar lint como critério** (344 erros de formatação já existentes).
**Tasks com comportamento seguem TDD:** escrever o teste que falha → implementar → rodar a suíte inteira.
**Marcadas 🧑 são passos manuais seus** (painéis externos); as demais o Claude Code / Antigravity executa.
**Ordem = risco primeiro:** infraestrutura (T-02, T-03) antes do código de negócio.

### Referências por tipo de tarefa
- **Tarefas com tela:** [`design/ui-ux.md`](./design/ui-ux.md)
- **Tarefas com servidor, dados pessoais, token, e-mail, logs ou chaves:** [`seguranca.md`](./seguranca.md)
- **Tarefas de banco:** [`data-model.md`](./data-model.md)
- **Estratégia de testes da camada:** [`qa-plan.md`](./qa-plan.md) (nunca o checklist final antes da T-14)
- **Ordem e paralelismo:** [`ordem-de-execucao.md`](./ordem-de-execucao.md)

| Fase | Tasks |
|---|---|
| Base | T-01 |
| Infraestrutura | T-02 🧑, T-03 |
| Banco | T-04 |
| Regras e endereço | T-05, T-06 |
| Acesso | T-07 |
| Inscrição | T-08, T-09, T-10 |
| Edição | T-11 |
| Administração | T-12, T-13 |
| Fechamento | T-14 🧑 |

---

## T-01 — Base: compilar sem erro e ter testes
Depende de: nenhuma · RF-12 (parcial)
Arquivos: `package.json`, `vitest.config.ts` (novo), `src/lib/validators.test.ts` (novo), `src/lib/public-forms.functions.ts`, `src/routes/f.$slug.tsx`, `AGENTS.md` e `CLAUDE.md` (copiar os arquivos entregues junto com estas specs)
Fazer:
0. Copiar `AGENTS.md` (mantém o bloco do Lovable) e `CLAUDE.md` para a raiz do projeto.
1. `bun add -d vitest` (se o `bunfig.toml` barrar por versão nova demais, usar a anterior; **não** adicionar exceção). Criar `vitest.config.ts` com ambiente `node`, inclusão `src/**/*.test.ts` e alias `@` → `src`. Adicionar o script `"test": "vitest run"`.
2. Escrever `validators.test.ts` (caracterização; **já foi conferido que passa de primeira**): CPF `529.982.247-25` e `52998224725` → válido; `111.111.111-11` e `529.982.247-26` → inválido; telefone `(11) 91234-5678` → válido, `(11) 1234-5678` (fixo) → válido, `(11) 81234-5678` (11 dígitos sem o 9) → inválido, `(00) 91234-5678` (DDD 00) → inválido; e-mail `a@b.co` → válido, `a@b` → inválido; RG `12.345.678-9` → válido, `111111111` e `123` → inválido.
3. Exportar o tipo `SubmitResult` (ver `plan.md`) em `public-forms.functions.ts`; fazer `submitResponse` retornar `{ ok:true, message: form.success_message }` / `{ ok:false, error }`. Em `f.$slug.tsx`, ler `result.message` (não `success_message`), tratar `form`/`questions` como definidos após a guarda `state !== "open"` (estreitamento de tipo) e remover os erros de tipo.
Verificação: `bunx tsc --noEmit && bun run test && bun run build` (hoje o `tsc` falha com 13 erros).
**O que isso prova:** o projeto passa a compilar sem erros, existe uma rede de testes para o que já funciona (CPF, telefone, e-mail) e a mensagem de sucesso digitada pelo administrador é lida do lugar certo.

## T-02 🧑 — Supabase novo e próprio
Depende de: nenhuma
Arquivos: `.env`
Fazer (no painel do Supabase; conferir antes que a conta não tem 2 projetos gratuitos ativos):
1. Criar o projeto (região mais próxima do Brasil).
2. Aplicar, **em ordem**, as 2 migrações de `supabase/migrations/` (SQL Editor ou `supabase db push`).
3. Auth → definir a política de senha nas configurações de Auth (mínimo de 12 caracteres + complexidade com letras maiúsculas, minúsculas, números e símbolos); criar o usuário administrador com senha longa e forte e **desligar "permitir novos cadastros"**; anotar no relatório que a opção de política de senha está ativa.
4. Copiar URL, chave pública (publishable) e chave de serviço (service role).
5. Atualizar `.env` do repositório **somente** com URL e chave **pública** (as variáveis `VITE_SUPABASE_*` e `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` já presentes). **Nunca** colocar a chave de serviço no repositório.
Verificação:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"intruso@example.com","password":"Senha-Forte-123"}'
```
Esperado: **código 4xx** (cadastro recusado). E `git diff .env` mostra só URL/chave públicas do projeto novo, com política de senha ativa com mín. 12 caracteres.
**O que isso prova:** o banco é seu, tem só o seu usuário com senha forte, e ninguém consegue criar conta.

## T-03 — Esqueleto no ar: rota `/saude` + Cloudflare Workers + subdomínio
Depende de: T-02 · Mitiga os riscos 1 e 2 do plano
Ler: plan.md (Infraestrutura e segredos; Riscos técnicos 1 e 2); seguranca.md (SEC-03); qa-plan.md (verificações por curl)
Arquivos: `src/routes/saude.tsx` (novo), `src/lib/health.ts` (novo) + `src/lib/health.test.ts` (novo); `src/routeTree.gen.ts` é gerado pelo build
Fazer (testes primeiro), parte de CÓDIGO (feita pelo agente):
1. Escreva `health.test.ts` (mostre que falha) e depois `health.ts`: função pura `healthResponse(error)`: sem erro -> status 200 e corpo `{"ok":true,"db":true}`; com erro ou configuração ausente -> status 503 e corpo `{"ok":false}`. O corpo NUNCA contém mensagem de erro, ID de projeto ou qualquer detalhe. Casos de teste: sem erro; com erro; erro com mensagem sensível (o corpo não a contém).
2. Crie a rota de servidor `GET /saude` em `saude.tsx`: consulta o banco com `supabaseAdmin` (select mínimo em `forms`, head:true, limit 1) e responde com `healthResponse`, com `Cache-Control: no-store`. Se as chaves do servidor estiverem ausentes, NÃO lançar exceção: responder 503 `{"ok":false}`. Em caso de falha, o log registra só o código do erro, nunca o objeto de erro nem dados. Consulte a documentação do `@tanstack/react-start` instalado (em `node_modules`) para declarar a rota; não chute a API.
3. NÃO criar `.dev.vars`, `.env.local` nem qualquer arquivo com chaves (a pasta está no OneDrive). A chave secreta existe só como Segredo do Worker.

Verificação local (comandos desta máquina, da seção Comandos do AGENTS.md):
```bash
bun node_modules/vitest/vitest.mjs run
bun node_modules/typescript/bin/tsc --noEmit
bun node_modules/vite/bin/vite.js build
```
Com `bun node_modules/vite/bin/vite.js dev` (porta 8080):
- `curl.exe -i http://localhost:8080/saude` deve responder 503 com `{"ok":false}` e `Cache-Control: no-store` (sem chave local isso é o ESPERADO);
- `curl.exe -s -o NUL -w "%{http_code}\n" http://localhost:8080/auth` deve responder 200.

Parte MANUAL 🧑 (feita pelo dono, o agente NÃO executa):
Workers Builds na Cloudflare conectado ao repositório. O nome do Worker pode ser qualquer um no painel (o Workers Builds usa o nome do painel e sobrescreve o nome gerado pelo projeto). Na configuração de build do painel da Cloudflare: "Comando da build" = `bun run build` e "Comando de implantação" = `npx wrangler deploy` (sem o comando de build o deploy falha, porque o wrangler não encontra a configuração gerada pelo build). As TRÊS chaves (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY`) como tipo Segredo, não "Variável" (variáveis comuns podem ser removidas por novos deploys). `SUPABASE_URL` é a URL completa `https://<id-do-projeto>.supabase.co`, não só o identificador do projeto. Domínio personalizado vinculado: `inscricoes.triadetecnologiaesolucoes.com.br`.

Verificação real:
```bash
curl.exe -s https://inscricoes.triadetecnologiaesolucoes.com.br/saude
curl.exe -s -o NUL -w "%{http_code}\n" https://inscricoes.triadetecnologiaesolucoes.com.br/auth
```
- `/saude` deve responder `{"ok":true,"db":true}`;
- `/auth` deve responder 200, sem erro 1102 no log da Cloudflare. Se aparecer o erro 1102, PARAR e avisar o dono.

**O que isso prova:** a rota existe e falha com segurança sem chave (503, sem vazar nada); no Worker publicado, responde que o banco está acessível, e o plano gratuito aguenta renderizar as páginas.
Status: concluída em 30/09/2026. /saude respondeu {"ok":true,"db":true} no Worker publicado, /auth respondeu 200 e não houve erro 1102.


## T-04 — Migração Fase 0 e tipos
Depende de: T-02 · RF-03, RF-04, RF-08, RF-10 (banco)
Ler: data-model.md (migração e verificação); seguranca.md (revisão das funções do banco); seguranca.md (SEC-02); qa-plan.md (camada de banco)
Arquivos: `supabase/migrations/<timestamp>_fase0_inscricao.sql` (novo, conteúdo de `data-model.md`), `src/integrations/supabase/types.ts`
Fazer:
1. Criar a migração copiando o SQL de `data-model.md` **sem alterá-lo**; aplicar no Supabase.
2. Atualizar `types.ts` conforme a última seção de `data-model.md`.
3. Rodar a verificação do banco e a de concorrência.
Verificação:
Parte de CÓDIGO (agente): criar a migração `supabase/migrations/<timestamp>_fase0_inscricao.sql` com o SQL de `data-model.md` SEM alterá-lo (use um timestamp posterior ao da última migração do repositório) e atualizar `types.ts`; rodar `bun node_modules/typescript/bin/tsc --noEmit`, `bun node_modules/vitest/vitest.mjs run` e `bun node_modules/vite/bin/vite.js build`. O agente NÃO acessa o banco do Supabase nem guarda senhas.
Parte MANUAL 🧑 (dono):
(a) No Supabase, abrir o SQL Editor, colar o conteúdo da migração e rodar (uma única vez; se der erro, NÃO rodar de novo e avisar). 
(b) No SQL Editor, colar o arquivo `verificacao-banco.sql` inteiro e rodar. O resultado é uma tabela; a última linha deve ser `== RESUMO: 47 PASSOU, 0 FALHOU ==`.
(c) Concorrência, no PowerShell, na pasta do projeto (a senha do banco nunca é gravada em arquivo nem colada em conversa): 
```powershell
$s = Read-Host "Cole a string de conexão do Supabase (Session pooler) com a senha" -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new("", $s).Password
bun specs/001-fase-0-no-ar/verificacao-concorrencia.mjs
Remove-Item Env:DATABASE_URL
```
Esperado: `{"ok":5,"full":15}` e quatro linhas PASSOU. A string está em Supabase -> Connect -> "Session pooler"; troque [YOUR-PASSWORD] pela senha do banco (se ela tiver caracteres especiais, redefina para uma senha só com letras e números em Settings -> Database).
Esperado: 47 PASSOU e 5 ok + 15 full.
**O que isso prova:** com 20 pessoas enviando ao mesmo tempo para 5 vagas, entram exatamente 5; o mesmo CPF não entra duas vezes; o inscrito consegue editar sem gastar vaga, mas não consegue trocar o CPF; visitantes sem login não leem nada; e o visitante sem login não consegue ler formulários, perguntas, respostas nem perfis, nem gravar direto na tabela, nem chamar as funções de inscrição.

## T-05 — Regras do endereço (slug)
Depende de: T-04 · RF-11
Ler: spec.md RF-11; plan.md (Regras puras, slug); qa-plan.md 4.1
Arquivos: `src/lib/slug.ts` (novo), `src/lib/slug.test.ts` (novo), `src/lib/exports.ts` (remover `slug`), `src/routes/_authenticated.painel.tsx` (trocar import)
Fazer:
1. Testes que falham primeiro: `validateSlug("skf-corrida-track-field")` → `null`; `"ab"` → mensagem de tamanho; `"Maiuscula"`, `"-abc"`, `"a--b"`, `"com_underline"`, `"com espaco"` → mensagem de formato; `"painel"`, `"editar"`, `"saude"`, `"auth"`, `"formularios"`, `"api"`, `"admin"`, `"assets"`, `"login"` → "Esse nome é reservado pelo sistema"; `suggestSlug("SKF Corrida Track & Field")` → `"skf-corrida-track-field"`; `suggestSlug("Novo formulário", "abc123")` → `"novo-formulario-abc123"`; `suggestSlug("!!!")` → um valor válido (ex.: `formulario`); `sanitizeSlugInput("SKF Corrida Track&Field")` → `"skf-corrida-track-field"`; `sanitizeSlugInput("skf-")` → `"skf-"` (mantém o hífen final enquanto digita); `sanitizeSlugInput("  Corrida  Ação  ")` → `"corrida-acao-"`; `sanitizeSlugInput("-abc")` → `"abc"`; `sanitizeSlugInput("a--b")` → `"a-b"`; entrada com 70 caracteres → corta em 60; `trimSlugEdges("corrida-acao-")` → `"corrida-acao"`.
2. Teste que **lê o arquivo da migração Fase 0** (`supabase/migrations/*_fase0_inscricao.sql`, hoje `20260930204500_fase0_inscricao.sql`; localize por padrão de nome, não por timestamp fixo), extrai os nomes entre aspas simples do `CHECK (slug NOT IN (...))` da constraint `forms_slug_reserved` e confirma que o conjunto é IGUAL ao `RESERVED_SLUGS` do código (os mesmos 9 nomes, em qualquer ordem).
3. Implementar `slug.ts` (mover a função `slug()` que hoje está em `exports.ts`; ela normaliza acentos) e atualizar os imports.
4. `suggestSlug` nas bordas: (a) com sufixo, o sufixo NUNCA é cortado: a base é reduzida para caber em 60 - (tamanho do sufixo + 1) caracteres e hífens das pontas são removidos antes de juntar; (b) o resultado nunca começa nem termina com hífen e tem no máximo 60 caracteres; (c) se o resultado tiver menos de 3 caracteres, acrescenta `-formulario` (ex.: `suggestSlug("5K")` -> `"5k-formulario"`, `suggestSlug("A")` -> `"a-formulario"`). Testes novos, escritos primeiro e vistos falhando: título longo com sufixo mantém o sufixo e passa em `validateSlug`; base de 59 letras com sufixo passa em `validateSlug`; `5K` e `A` geram valores que passam em `validateSlug`; os casos antigos continuam iguais.
Verificação: `bun node_modules/vitest/vitest.mjs run slug` (os testes do slug passam); `bun node_modules/vitest/vitest.mjs run` (suíte completa sem falhas: os 42 testes anteriores mais os novos); `bun node_modules/typescript/bin/tsc --noEmit`; `bun node_modules/vite/bin/vite.js build`.
**O que isso prova:** "SKF Corrida Track & Field" vira `skf-corrida-track-field`, tanto sugerido pelo título quanto digitado no campo; nomes inválidos ou reservados são recusados com a mensagem certa; e a regra do código nunca diverge da regra do banco.

## T-06 — Endereço direto na raiz + editor de endereço
Depende de: T-05 · RF-11
Ler: spec.md RF-11; design/ui-ux.md (Tela A); qa-plan.md 4.1 e 5.4
Arquivos: `src/routes/f.$slug.tsx` → **renomear para** `src/routes/$slug.tsx`, `src/routes/_authenticated.formularios.$id.tsx`, `src/routes/_authenticated.painel.tsx`, `src/lib/slug.ts`, `src/lib/slug.test.ts`
Fazer:
1. Mover a rota pública para `/$slug` (`createFileRoute("/$slug")`, `useParams({ from: "/$slug" })`); nada mais referencia `/f/`. (Nota de segurança: no head de `/editar/$token`, planejado em T-06 e implementado em T-11, incluir meta `referrer=no-referrer` e `robots=noindex, nofollow`).
2. Editor: no cartão "Link de compartilhamento", campo de endereço com prefixo `origin/` que converte ao digitar (`sanitizeSlugInput`), tira hífens das pontas ao sair do campo (`trimSlugEdges`), validação ao digitar (`validateSlug`), `publicUrl = ${origin}/${slug}`, aviso "links já compartilhados deixarão de funcionar" ao trocar em formulário publicado, e `slug` incluído no `save()`. Mapear erros do banco: `23505` → "Esse endereço já está em uso"; `23514`+`forms_slug_reserved` → "Esse nome é reservado pelo sistema"; `forms_slug_format` → mensagem de formato.
3. Painel: criação com `suggestSlug(title, sufixoAleatório)`.
4. Mensagens literais: use exatamente as de `validateSlug` e as do spec.md RF-11, sem ponto final nas mensagens do banco ('Esse endereço já está em uso', 'Esse nome é reservado pelo sistema'). Se houver diferença de pontuação entre o spec.md e o design/ui-ux.md (Tela A), vale o spec.md.
5. Acessibilidade do campo de endereço: o campo tem `id` e o rótulo 'Link de compartilhamento' usa `htmlFor`; `aria-invalid` quando houver erro; a mensagem de erro tem `id` e `role="alert"`, e o campo a referencia com `aria-describedby`.
6. Extrair o mapeamento dos erros do banco para uma função pura `mapSlugDbError(error: { code?: string; message?: string; details?: string }): string | null` em `src/lib/slug.ts` (devolve a mensagem em pt-BR ou `null` se não for erro de endereço), usada pelo editor no lugar do trecho inline. Testes primeiro, com as mensagens reais do Postgres: código `23505` e mensagem `duplicate key value violates unique constraint "forms_slug_key"` -> 'Esse endereço já está em uso'; código `23514` e mensagem com `forms_slug_reserved` -> 'Esse nome é reservado pelo sistema'; código `23514` e mensagem com `forms_slug_format` -> 'Use apenas letras minúsculas, números e hífens.'; qualquer outro erro -> `null`.
Verificação local (agente, comandos desta máquina):
- `Get-ChildItem src -Recurse -Include *.ts,*.tsx | Where-Object { $_.Name -ne 'routeTree.gen.ts' } | Select-String -Pattern '"/f/|/f/\$\{'` -> sem saída.
- `bun node_modules/typescript/bin/tsc --noEmit`; `bun node_modules/vitest/vitest.mjs run slug`; `bun node_modules/vitest/vitest.mjs run` (todos passando, 62 hoje); `bun node_modules/vite/bin/vite.js build`.
- Com `bun node_modules/vite/bin/vite.js dev` (porta 8080, em processo separado): `curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:8080/qualquer-endereco` -> 200 (hoje 404); `curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:8080/f/qualquer` -> 404; `curl.exe -s http://localhost:8080/qualquer-endereco | Select-String -Pattern "Carregando formulário"` imprime uma linha.
- O arquivo `src/routeTree.gen.ts` é regenerado pelo build e pode aparecer no `git status`; é permitido.

Parte MANUAL 🧑 (dono, no site publicado, depois do deploy automático da main; complementa o qa-plan.md 5.4):
1. Painel -> "Novo formulário": ele nasce com endereço do tipo `novo-formulario-` mais 6 caracteres.
2. No editor, digitar "SKF Corrida Track&Field" no campo de endereço: converte sozinho para `skf-corrida-track-field`. Digitar `painel` -> "Esse nome é reservado pelo sistema". Digitar `ab` -> erro de tamanho. Deixar um hífen no fim e sair do campo remove o hífen.
3. Criar um 2º formulário e salvar com o mesmo endereço do 1º -> "Esse endereço já está em uso".
4. Publicar o 1º; abrir `https://inscricoes.triadetecnologiaesolucoes.com.br/skf-corrida-track-field` -> abre o formulário; `.../f/skf-corrida-track-field` -> página não encontrada; `.../endereco-que-nao-existe` -> "não encontrado".
5. Com o formulário publicado, mudar o endereço: aparece o aviso âmbar de que links já compartilhados deixarão de funcionar.
6. Ao fim, apagar os formulários de teste.

**O que isso prova:** o formulário abre em `.../skf-corrida-track-field`, o endereço antigo `/f/...` deixa de existir, endereços inexistentes mostram "não encontrado", e o editor recusa endereço repetido, reservado ou mal formado com mensagem clara.

## T-07 — Só o administrador entra + página inicial
Depende de: T-03 · RF-01, RF-02
Ler: spec.md RF-01 e RF-02; design/ui-ux.md (Tela E); seguranca.md SEC-05
Arquivos: `src/routes/auth.tsx`, `src/routes/index.tsx`
Fazer:
1. `auth.tsx`: remover o modo "criar conta" (campo nome, `signUp`, alternância), o botão Google e o import de `@/integrations/lovable`; remover `minLength` e o placeholder "Mínimo de 6 caracteres" do campo de senha no login (NÃO colocar 12 no HTML do login para não travar o admin; a política fica no Supabase Auth); título fixo "Entrar". **Não mexer** em `src/integrations/lovable/`.
2. `index.tsx`: substituir o placeholder por `beforeLoad` com redirecionamento para `/painel` (o layout autenticado já manda quem não entrou para `/auth`).
Verificação local (comandos desta máquina):
- `bun node_modules/typescript/bin/tsc --noEmit` e `bun node_modules/vite/bin/vite.js build`.
- `Select-String -Path src/routes/auth.tsx -Pattern "lovable|signUp"` -> sem saída.
- Com `bun node_modules/vite/bin/vite.js dev` (porta 8080, em processo separado): `curl.exe -s http://localhost:8080/auth | Select-String -Pattern "Google|Criar conta" -CaseSensitive` -> sem saída (hoje aparecem "Continuar com Google" e "Criar conta"); controle positivo: `curl.exe -s http://localhost:8080/auth | Select-String -Pattern "Entrar"` deve imprimir ao menos uma linha; `curl.exe -s -o NUL -w "%{http_code} %{redirect_url}`n" http://localhost:8080/` -> 30x com destino /painel (hoje: 200 com o placeholder).

Verificação no site publicado (feita pelo dono, depois do deploy automático da main pela Cloudflare):
- `curl.exe -s -o NUL -w "%{http_code} %{redirect_url}`n" https://inscricoes.triadetecnologiaesolucoes.com.br/` -> 30x para /painel.
- `curl.exe -s https://inscricoes.triadetecnologiaesolucoes.com.br/auth | Select-String -Pattern "Google|Criar conta" -CaseSensitive` -> sem saída; controle positivo: `curl.exe -s https://inscricoes.triadetecnologiaesolucoes.com.br/auth | Select-String -Pattern "Entrar"` deve imprimir ao menos uma linha.

Parte MANUAL 🧑 (dono, o agente NÃO executa): (a) no painel do Supabase, em Authentication: cadastro público desligado, provedor Google desligado e política de senha com mínimo de 12 caracteres e exigência de complexidade (SEC-05); (b) no site publicado, entrar com o e-mail e a senha do administrador e ver o painel; sair e confirmar que /painel volta a pedir login.

**O que isso prova:** a tela de entrada só oferece e-mail e senha, e o endereço raiz não mostra mais o "Your app will live here".

## T-08 — Regras puras da inscrição e do e-mail
Depende de: T-01 · RF-03, RF-05, RF-09, RF-13
Ler: spec.md RF-03, RF-05, RF-09, RF-13; plan.md (Regras puras; E-mail); seguranca.md SEC-03 e SEC-09; qa-plan.md 4.2 e 4.6
Arquivos: `src/lib/validators.ts` (exportar `onlyDigits`), `src/lib/inscricao.ts` (novo) + teste, `src/lib/confirmation-email.ts` (novo) + teste, `src/lib/theme.ts` (novo) + teste
Fazer (testes primeiro):
1. `normalizeCPF("529.982.247-25")` = `"52998224725"`; `normalizeCPF("")` = `null`.
2. `findIdentifierQuestion` devolve a 1ª pergunta do tipo `cpf` (ou `undefined`); `findEmailQuestion` idem para `email`.
3. `hideDocument("529.982.247-25")` = `"***.***.***-25"`; `hideDocument("12.345.678-9")` mostra só o final; entrada vazia → vazio.
4. `isHoneypotFilled("")`/`"  "` → `false`; `"http://spam"` → `true`.
5. `mapSubmitStatus` cobre `duplicate`, `full`, `closed`, `unavailable`, `consent_required`, `ok` com as mensagens do `plan.md`; status desconhecido → erro genérico.
6. `escapeHtml('<script>alert(1)</script>')` não contém `<script>`; `buildConfirmationEmail` (a) inclui o link de edição, (b) **não** contém o CPF completo nem o RG completo, (c) escapa HTML vindo do inscrito, (d) diferencia "confirmada" de "atualizada".
7. `sendConfirmationEmail` com `fetchFn` simulado: chama `https://api.resend.com/emails` com `Authorization: Bearer <chave>` e `to` correto; devolve `true` em 200; devolve `false` (e **não lança**) quando o `fetchFn` lança ou responde 500; se falta `apiKey`, devolve `false` sem chamar a rede.
8. `readableTextColor(hex)` em `theme.ts`: esperados `#4f46e5` → `#ffffff`; `#000000` → `#ffffff`; `#ffff00` → `#000000`; `#22c55e` → `#000000`; `#ffffff` → `#000000`. Teste de varredura: para toda cor com canais R, G e B em {0, 51, 102, 153, 204, 255} (216 cores), o contraste WCAG (luminância relativa) entre o texto devolvido e o fundo é >= 4,5 (o teste calcula o contraste por conta própria).
9. `isSafeRecipient(email)` em `confirmation-email.ts`: rejeita destinatários contendo caracteres como `, ; < > "` e espaços antes do envio; testes unitários (`a@b.com` → ok; `a@b.com,c.com`, `a@b.com;x@y.com`, `x<y@z.com>`, `"a"@b.com` → rejeitados).
Verificação: `bun run test && bunx tsc --noEmit && bun run build`.
**O que isso prova:** o e-mail nunca mostra o CPF por inteiro, não deixa um inscrito injetar HTML, rejeita formatos de e-mail maliciosos ou múltiplos destinatários, uma falha de e-mail nunca derruba uma inscrição e os botões garantem legibilidade com qualquer cor de tema.

### Especificações complementares
- `mapSubmitStatus(status)` devolve `{ ok: true }` ou `{ ok: false; error: string; field?: "cpf" | "__consent" }`. duplicate -> error "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador." e field "cpf"; consent_required -> "É necessário aceitar o termo para continuar." e field "__consent"; full -> "O limite de inscrições foi atingido."; closed -> "O prazo de preenchimento encerrou."; unavailable -> "Este formulário não está disponível."; ok -> { ok: true }; qualquer outro valor -> "Não foi possível concluir a inscrição. Tente novamente." (a T-09 troca "cpf" pelo id da pergunta CPF).
- `hideDocument(v)`: substitui por `*` todo caractere alfanumérico, EXCETO os 2 últimos alfanuméricos, e mantém a pontuação. "529.982.247-25" -> "***.***.***-25"; "12.345.678-9" -> "**.***.**8-9"; "" -> ""; com 2 ou menos alfanuméricos, mascara todos.
- `buildConfirmationEmail({ form, questions, answers, editUrl, kind })`, kind "confirmada" | "atualizada", devolve `{ subject, html, text }`. Assunto: "Inscrição confirmada — {título}" ou "Inscrição atualizada — {título}", texto puro sem quebras de linha (remover \r e \n do título). Corpo em pt-BR: saudação curta; frase ("Recebemos sua inscrição." / "Suas respostas foram atualizadas."); lista "Pergunta: resposta" na ordem das perguntas (múltipla escolha = valores separados por vírgula; sem resposta = "—"); perguntas do tipo cpf e rg passam por `hideDocument`; link com a frase "Para corrigir seus dados, acesse:"; sem imagens externas nem rastreadores. Todo texto vindo do inscrito ou do organizador passa por `escapeHtml` no html; `text` é a versão em texto puro.
- `isSafeRecipient(email)`: verdadeiro somente se passar em `isValidEmail`, tiver no máximo 254 caracteres e NÃO contiver espaço, caractere de controle, `,`, `;`, `<`, `>` nem `"`.
- `sendConfirmationEmail({ fetchFn, apiKey, from, to, subject, html, text })`: retorna false sem chamar a rede se faltar apiKey ou from, ou se `!isSafeRecipient(to)`; senão POST em https://api.resend.com/emails com `Authorization: Bearer <apiKey>` e corpo JSON `{ from, to: [to], subject, html, text }`; true se resposta ok; false (sem lançar) se o fetch lançar ou responder não-ok. Nunca registra em log corpo, destinatário nem chave.
- `readableTextColor(hex)`: aceita `#rgb` e `#rrggbb` (maiúsculas ou minúsculas); devolve `#ffffff` ou `#000000`, o de maior contraste; entrada inválida devolve `#ffffff`. O teste de varredura calcula o contraste WCAG com fórmula própria escrita no teste.
- `normalizeCPF` reutiliza `onlyDigits`; string vazia ou sem dígitos devolve `null`. `findIdentifierQuestion`/`findEmailQuestion` recebem as perguntas ordenadas por `position` e devolvem a primeira do tipo pedido.

## T-09 — Servidor de inscrição via banco
Depende de: T-04, T-08 · RF-03, RF-04, RF-05, RF-08, RF-09, RF-12
Ler: plan.md (função de servidor de inscrição); data-model.md (contrato das funções); seguranca.md SEC-02, SEC-03, SEC-04, SEC-09; qa-plan.md 4.3 a 4.6
Arquivos: `src/lib/submit-response.ts` (novo; lógica testável com dependências injetadas) e `src/lib/submit-response.test.ts` (novo); `src/lib/public-forms.functions.ts` (fica fino: só liga as dependências reais ao `handleSubmission`).
Fazer (testes primeiro; mostre-os falhando):
1. `getPublicForm` passa a devolver `consent_text` (no `form`).
2. Em `submit-response.ts`, exportar `submitSchema` (Zod) e `handleSubmission(deps, input)`. `deps` traz: carregar formulário e perguntas, o `rpc` de `submit_response`, o `fetchFn` do e-mail, `getOrigin`, `readEnv` (`RESEND_API_KEY`, `EMAIL_FROM`) e `logError`. A ordem é a do plan.md ("Função de servidor de inscrição"): honeypot (`hp` preenchido responde `{ ok: true, message, emailSent: false }` SEM gravar e SEM chamar o rpc) -> carregar -> `validateAnswer` por pergunta (erro devolve `field`) -> `identifier` -> rpc -> `mapSubmitStatus` -> e-mail seguro com `isSafeRecipient` -> `editUrl`. Devolve `SubmitResult` com `emailSent: boolean`; a mensagem de sucesso vem de `success_message`.
3. Limites do `answers` em `submitSchema` (SEC-02): no máximo 200 chaves; cada chave com até 100 caracteres; cada valor de texto com até 10000 caracteres; tamanho total serializado de até 100 KB. Testes: 3 chaves passa; 200 passa; 201 rejeitado; chave de 101 caracteres rejeitada; valor de 10001 caracteres rejeitado; total acima de 100 KB rejeitado. O erro devolve a mensagem genérica "Não foi possível enviar. Verifique os campos e tente novamente.", sem detalhes.
4. Origem do link de edição (SEC-04, abuso do cabeçalho Host): `getOrigin` só aceita origens de uma lista fixa na constante `ALLOWED_ORIGINS` (`https://inscricoes.triadetecnologiaesolucoes.com.br` e `http://localhost:8080`); qualquer outra origem (inclusive workers.dev) é trocada pela primeira da lista. Teste: uma origem estranha vira `https://inscricoes.triadetecnologiaesolucoes.com.br`.
5. E-mail com tempo limite: o `fetchFn` real passa `signal: AbortSignal.timeout(5000)`; um teste confirma que o `signal` é enviado. Falha, lentidão ou falta de chave nunca derrubam a inscrição (`emailSent: false`).
6. Higiene de logs (SEC-03): em erro de gravação, `logError` recebe só o código do erro e o ID do formulário; um teste confirma que nem o CPF nem o objeto `answers` aparecem nos argumentos do log.
7. O `edit_token` não pode aparecer em nenhum campo do resultado além do `editUrl` (o teste serializa o resultado e procura o token fora do `editUrl`).
8. Testes de `emailSent`: `true` quando o envio dá certo; `false` quando falha (resposta 500 e exceção), quando falta a chave e quando o formulário não tem campo de e-mail.
9. Em `public-forms.functions.ts`, trocar `.inputValidator(...)` por `.validator(...)` (o build avisa que `.inputValidator` está depreciado; as duas formas existem nos tipos instalados). O aviso deve desaparecer do build.

Ajuste pós-revisão (SEC-10, SEC-11, SEC-12, SEC-13, QA-GAP-01, 02, 04 e 05) com os itens abaixo (testes primeiro, vistos falhando; arquivos permitidos neste ajuste: `src/lib/submit-response.ts` e `src/lib/submit-response.test.ts`):
10. SEC-10: remover `http://localhost:8080` de `ALLOWED_ORIGINS` (fica só `https://inscricoes.triadetecnologiaesolucoes.com.br`). Ajustar os testes: origem localhost vira a origem de produção.
11. SEC-12: um valor em lista só é aceito para perguntas do tipo `multi_choice`. Para qualquer outro tipo, uma lista devolve `{ ok: false, error: <erro genérico>, field: q.id }` SEM lançar exceção e SEM chamar o rpc. Testes: CPF como lista, e-mail como lista e texto como lista -> erro e rpc não chamado; `multi_choice` com lista -> aceito.
12. SEC-13: envolver o carregamento do formulário e o rpc em try/catch. Em exceção, devolver `{ ok: false, error: "Não foi possível concluir a inscrição. Tente novamente." }` e chamar `logError("EXCEPTION", form.id)` (ou `"EXCEPTION"` e um ID vazio se o formulário ainda não foi carregado), sem repassar a mensagem original. Testes: rpc que lança; carregamento que lança -> resultado de erro; o log recebe só o código e o ID, nunca a mensagem da exceção.
13. QA-GAP-05: antes de validar, aparar (`trim`) todo valor de texto e cada item das listas. Testes: e-mail com espaço no fim e no início é gravado sem espaços e o e-mail de confirmação é enviado ao endereço aparado (`emailSent: true`).
14. QA-GAP-02: teste da proteção de destinatário na camada do serviço, com entradas que passam em `isValidEmail` mas são barradas por `isSafeRecipient`: `"a"@b.com` (com aspas) e um e-mail com caractere de controle (`ma\u0000ria@b.com`). Esperado: inscrição gravada (rpc chamado), `emailSent: false`, nenhuma chamada de rede. Prove que o teste PODE falhar: remova temporariamente a chamada a `isSafeRecipient` na cópia de trabalho, mostre o teste reprovando, restaure e confirme com `git diff` que a proteção voltou antes do commit.
15. QA-GAP-01 e QA-GAP-04: testes de integração para os status `full` ("O limite de inscrições foi atingido.") e `closed` ("O prazo de preenchimento encerrou."), sem e-mail e sem editUrl; e testes de limite positivo: chave com exatamente 100 caracteres e valor com exatamente 10000 caracteres são aceitos.
16. SEC-11: validar a escolha contra as opções cadastradas. Para `single_choice`, o valor (já aparado) precisa ser exatamente uma das `options` da pergunta (compare também as opções aparadas); para `multi_choice`, cada item da lista precisa ser uma das `options`. Fora disso: `{ ok: false, error: "<rótulo>: Selecione uma das opções disponíveis.", field: q.id }`, sem chamar o rpc. Resposta vazia em pergunta não obrigatória continua aceita; pergunta de escolha sem nenhuma opção cadastrada rejeita qualquer valor; itens de `options` que não sejam texto são ignorados. Testes: valor válido passa; valor fora da lista rejeitado (single e multi, inclusive um item fora da lista no meio de itens válidos); opção cadastrada com espaço nas pontas casa depois de aparada; vazio não obrigatório passa; pergunta sem opções rejeita valor.
17. Reuso: extrair a validação das respostas (tipos, aparar espaços e opções) para uma função exportada `validateAndCleanAnswers(questions, answers)` que devolve `{ ok: true, cleanAnswers } | { ok: false, error, field }`, usada por `handleSubmission`. Os testes existentes continuam passando.
18. SEC-14 (defesa em profundidade para a reutilização na T-11): `validateAndCleanAnswers` rejeita, para qualquer pergunta, um valor que não seja `undefined`, `null`, texto ou lista de textos (número, objeto, booleano, símbolo, lista com item que não é texto ou lista aninhada), devolvendo `{ ok: false, error: <erro genérico>, field: q.id }` sem lançar exceção. Testes (primeiro, falhando): número, objeto, booleano e lista com número, em pergunta de texto, são recusados; os casos legítimos continuam iguais.
Verificação (comandos desta máquina): `bun node_modules/vitest/vitest.mjs run` (suíte completa, incluindo os testes novos de `submit-response`); `bun node_modules/typescript/bin/tsc --noEmit`; `bun node_modules/vite/bin/vite.js build` (sem o aviso de `inputValidator`). A conferência no banco real passa para o roteiro manual da T-10, a primeira tarefa com tela de inscrição.
Revisão: obrigatória por segunda sessão e auditoria independente (camada 2 do playbook).
**O que isso prova:** o servidor é a única porta de entrada, todas as regras (vagas, CPF único, consentimento) vêm do banco, e a inscrição vale mesmo com o e-mail fora do ar indicando corretamente o estado do envio.

## T-10 — Tela de inscrição: consentimento, anti-robô, sucesso com link, mensagens
Depende de: T-06, T-09 · RF-05, RF-08, RF-09, RF-12, RF-13
Ler: spec.md RF-05, RF-08, RF-09, RF-12, RF-13; design/ui-ux.md (Tela B); qa-plan.md 5.1 e 5.2
Arquivos: `src/routes/$slug.tsx`, `src/routes/_authenticated.formularios.$id.tsx` (campo de texto de consentimento na aba "Limites e Termos"; incluir `consent_text` no `save()`), `src/routes/__root.tsx`
Fazer:
1. Caixa de consentimento (texto do formulário) quando existir; `hp` invisível (`tabIndex={-1}`, `autoComplete="off"`, fora da tela); envio com `{ slug, answers, consent, hp }`.
2. Editor: renomear apenas o rótulo da aba existente "Limites" para "Limites e Termos" (a chave interna `limites` não muda) e posicionar o campo de texto de consentimento dentro dela.
3. Usar `readableTextColor` no botão principal de envio.
4. Erros por campo usam `result.field`; erro do consentimento aparece junto da caixa; duplicidade aparece no campo CPF ("CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador.").
5. Tela de sucesso: mostra `result.message`, o `editUrl` com botão "Copiar link", o aviso "guarde este link", e mostra a linha "Enviamos um resumo e o link para o seu e-mail" SOMENTE se `result.emailSent === true`.
6. No layout raiz (`__root.tsx`), trocar `<html lang="en">` por `<html lang="pt-BR">` (a interface é em português; ajuda leitores de tela e buscadores). NÃO alterar `src/lib/error-page.ts` (a página de erro é em inglês). Verificação local: `curl.exe -s http://localhost:8080/auth | Select-String -CaseSensitive 'lang="pt-BR"'` imprime uma linha.
7. Acessibilidade da tela pública: o campo armadilha `hp` leva também `aria-hidden="true"` (além de `tabIndex={-1}`, `autoComplete="off"` e posição fora da tela); cada erro de campo tem `id` e `role="alert"` e o campo o referencia com `aria-invalid` e `aria-describedby`; a caixa de consentimento tem rótulo associado (`htmlFor`); ao falhar o envio, o foco vai para o primeiro campo com erro.
8. A linha "Enviamos um resumo e o link para o seu e-mail." aparece SOMENTE quando `result.emailSent === true`. Enquanto o Resend não estiver configurado (até a T-14), ela NÃO deve aparecer no site publicado, e isso é o esperado.

Ajuste pós-revisão (SEC-15, UX-01, UX-02, UX-03, QA-GAP-06), arquivo permitido neste ajuste: somente `src/routes/$slug.tsx`:
 9. SEC-15: o `<img>` do logotipo leva `referrerPolicy="no-referrer"`.
 10. UX-01: nas perguntas de escolha única e de múltipla escolha, o texto da pergunta ganha um `id` (por exemplo `label-<id da pergunta>`) e o grupo (`role="radiogroup"` ou `role="group"`) usa `aria-labelledby` apontando para ele; nesses dois tipos o texto da pergunta deixa de ser um `<label htmlFor>` ligado à primeira opção (use `<span>` ou `<legend>`). O foco ao errar continua indo para a primeira opção, pelo `id` que já existe nela.
 11. UX-02: ao concluir a inscrição, o bloco de sucesso leva `role="status"` e o foco vai para o título "Tudo certo!" (`tabIndex={-1}` e foco programático).
 12. UX-03: quando o carregamento do formulário falha (`query.isError`), mostrar o título "Não foi possível carregar o formulário", o texto "Verifique sua conexão e tente novamente." e um botão "Tentar de novo" que refaz a consulta (`refetch`), em vez de "Formulário não encontrado".
 13. QA-GAP-06: o botão "Copiar link" aguarda `navigator.clipboard.writeText` e só mostra "Link copiado!" se a cópia funcionou; se falhar ou a API não existir, mostra "Não foi possível copiar. Selecione o link acima e copie manualmente." (o link continua selecionável).

Ajuste 2 (SEC-16, UX-04, UX-06), arquivos permitidos neste ajuste: `src/routes/$slug.tsx` e `src/styles.css`:
 14. SEC-16: em `handleSubmit`, quando o servidor devolver `ok: false` com um `field` que não seja `__consent` nem o ID de nenhuma pergunta carregada (ou sem `field`), a mensagem do servidor vai para o alerta geral (`__form`) e a página chama `query.refetch()` para recarregar o formulário (a pergunta nova passa a aparecer; as respostas já digitadas são mantidas).
 15. UX-04: em `src/styles.css`, desligar a animação `rise` para quem pede movimento reduzido: `@media (prefers-reduced-motion: reduce)` com `animation: none` na classe `rise`.
 16. UX-06: o alerta de erro geral (`__form`, hoje `bg-destructive/10 text-destructive`, contraste de 3,88:1) passa a ter contraste mínimo de 4,5:1: use texto `text-red-800` (ou equivalente) no mesmo fundo (6,77:1). Mantenha `role="alert"`.
 Roteiro manual (dono) depois do deploy: repetir os passos 2 e 3 do roteiro da T-10 e conferir que o alerta de erro geral (por exemplo, formulário com vagas esgotadas e tentar enviar com a página já aberta) está legível.

Ajuste 3 (achados do roteiro manual: BUG-01, BUG-02, QA-GAP-07), arquivos permitidos neste ajuste: `src/lib/options.ts` e `src/lib/options.test.ts` (novos), `src/lib/form-state.ts` e `src/lib/form-state.test.ts` (novos), `src/lib/public-forms.functions.ts`, `src/routes/$slug.tsx` e `src/routes/_authenticated.formularios.$id.tsx`. Itens (testes primeiro, vistos falhando, onde houver lógica pura):
 17. BUG-01 (campo de opções do editor não aceita Enter): criar `normalizeOptions(texto: string): string[]` em `src/lib/options.ts` (aparar cada linha, remover linhas vazias, remover repetidas mantendo a primeira, preservar a ordem; texto vazio -> lista vazia), com testes: "A\nB\n\nB \n" -> ["A","B"]; "  \n" -> []; ordem preservada. No editor, o campo "Opções (uma por linha)" passa a guardar o TEXTO DIGITADO num estado local (um por pergunta, com `key` igual ao ID da pergunta) e a mostrar esse texto cru, para o Enter criar uma nova linha; a lista normalizada (`normalizeOptions`) é gravada em `options` a cada alteração; ao sair do campo (blur) o texto exibido passa a ser a versão normalizada. Ao trocar de pergunta, o campo mostra o texto da pergunta escolhida.
 18. BUG-02 (mensagem errada ao encerrar o formulário): criar `resolvePublicState(form: { status: string; closes_at: string | null; max_responses: number | null }, responsesCount: number, now: Date)` em `src/lib/form-state.ts`, com testes: status "draft" -> "draft"; status "closed" -> "closed"; status "published" com prazo vencido -> "closed"; "published" lotado -> "full"; "published" com prazo vencido E lotado -> "closed"; "published" normal -> "open"; status desconhecido -> "draft". `getPublicForm` passa a usar essa função; para "draft" e "closed" por status devolve só `{ state }` (sem dados do formulário). Em `$slug.tsx`, o estado "closed" mostra o título "Inscrições encerradas" e o texto "Este formulário não está mais recebendo inscrições." (serve para prazo vencido e para encerramento manual). Os demais textos ficam como estão.
 19. QA-GAP-07: trava síncrona contra duplo envio em `handleSubmit` com `useRef` (não com o estado): se já estiver enviando, retorna; liberar no `finally`.
 Roteiro manual (dono) depois do deploy: (a) criar pergunta de múltipla escolha e digitar as opções com Enter (A, Enter, B, Enter, C): três linhas; salvar e reabrir: A, B, C na ordem; uma opção repetida some ao sair do campo; (b) encerrar o formulário e abrir o link: "Inscrições encerradas. Este formulário não está mais recebendo inscrições."; (c) página aberta antes, encerrar e tentar enviar: aparece o alerta e depois a tela "Inscrições encerradas".
Verificação:
Verificação local (agente, comandos desta máquina): `bun node_modules/typescript/bin/tsc --noEmit`; `bun node_modules/vitest/vitest.mjs run`; `bun node_modules/vite/bin/vite.js build`; com `bun node_modules/vite/bin/vite.js dev` (porta 8080, em processo separado): `curl.exe -s http://localhost:8080/auth | Select-String -CaseSensitive 'lang="pt-BR"'` imprime uma linha. O envio real de inscrição NÃO é testável localmente (não há chaves no computador).
Parte MANUAL 🧑 (dono, no site publicado, depois do deploy automático da main):
1. Criar um formulário com Nome, CPF e E-mail; termo de consentimento preenchido; limite de 3 vagas; cor de tema amarela (`#ffff00`); publicar.
2. Abrir o formulário e clicar em "Enviar inscrição" com tudo vazio: campos em vermelho e foco no primeiro erro.
3. Preencher com o CPF `529.982.247-25` e um e-mail com um espaço no fim; NÃO marcar o termo: aparece "É necessário aceitar o termo para continuar." junto da caixa. Marcar e enviar: tela de sucesso com a mensagem do organizador, o link de edição, o aviso "Guarde este link..." e o botão "Copiar link" (mostra "Link copiado!"; ao colar no bloco de notas, o endereço começa com `https://inscricoes.triadetecnologiaesolucoes.com.br/editar/`). A frase sobre e-mail NÃO aparece (esperado até a T-14). O link abre "não encontrado" até a T-11 (esperado).
4. Repetir o mesmo CPF, com e sem pontuação: erro no próprio campo CPF com "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador."
5. Botão do formulário amarelo com texto preto; trocar a cor para `#4f46e5` (azul escuro) e conferir texto branco.
6. No celular (360 px): sem rolagem horizontal; a tecla Tab não foca o campo armadilha.
7. No banco real (SQL Editor do Supabase): `select identifier, left(edit_token, 6) as token_inicio, consented_at from public.responses order by submitted_at desc limit 3;` deve mostrar o CPF só com dígitos, o começo do token e `consented_at` preenchido. Apagar o formulário de teste ao fim (as respostas somem junto).
**O que isso prova:** RF-03, RF-08, RF-12 e RF-13 funcionando como o usuário final vê.

## T-11 — Editar pelo link
Depende de: T-09 · RF-06, RF-13
Ler: spec.md RF-06; plan.md (Edição); design/ui-ux.md (Tela C); seguranca.md SEC-01, SEC-04, SEC-11, SEC-12, SEC-13, SEC-17 e SEC-18; qa-plan.md 4.7, 5.3 e TC-EDIT-05
Arquivos: `src/lib/edit-response.ts` (novo; lógica testável com dependências injetadas) e `src/lib/edit-response.test.ts` (novo); `src/lib/edit-response.functions.ts` (novo; só liga as dependências reais); `src/routes/editar.$token.tsx` (novo); `src/components/QuestionField.tsx` (novo); `src/lib/submit-response.ts` e `src/lib/submit-response.test.ts` (somente para o refator mínimo do item 1, sem mudar comportamento). `src/routes/$slug.tsx` NÃO é alterado.
Fazer (testes primeiro, vistos falhando):
 1. Refator mínimo: em `submit-response.ts`, extrair o schema do `answers` (registro com os limites de 200 chaves, 100 caracteres por chave, 10000 por valor e 100 KB no total) para `export const answersSchema` e usá-lo dentro de `submitSchema`. Os testes existentes seguem passando sem alteração.
 2. `edit-response.ts` exporta: `editTokenSchema` (`/^[0-9a-f]{64}$/`); `updateSchema = z.object({ token: editTokenSchema, answers: answersSchema })`; `shouldSendUpdateEmail(prevUpdatedAt, now, windowMs = 600000)` (verdadeiro só se decorreram 10 minutos ou mais; data inválida ou no futuro -> falso); `handleGetForEdit(deps, { token })`; `handleUpdate(deps, { token, answers })`. `deps`: `loadByToken(token)` (devolve a inscrição com `id`, `answers`, `identifier`, `updated_at`, mais o formulário e as perguntas), `rpcUpdateResponse`, `fetchFn`, `getOrigin`, `readEnv` (`RESEND_API_KEY`, `EMAIL_FROM`), `now` e `logError`.
 3. `handleGetForEdit` devolve `{ state: "open" | "closed" | "not_found", form?, questions?, answers? }`. "closed" quando o formulário não está publicado ou o prazo venceu; vagas esgotadas NÃO impedem a edição; token inválido ou desconhecido -> "not_found". PRIVACIDADE (SEC-17): a resposta da pergunta de CPF sai MASCARADA com `hideDocument`; o CPF completo e o `edit_token` nunca saem do servidor.
 4. `handleUpdate`: (a) token com formato inválido -> "not_found"; (b) carrega inscrição, formulário e perguntas; (c) o valor da pergunta de CPF enviado pelo navegador é IGNORADO: a resposta e o `identifier` são os guardados na inscrição; na edição a pergunta de CPF não é obrigatória (uma pergunta de CPF adicionada depois da inscrição não trava a edição); (d) valida as demais respostas com `validateAndCleanAnswers` (a MESMA função da inscrição: tipos, aparar espaços, opções de escolha); (e) lê o `updated_at` anterior ANTES de chamar o rpc; (f) chama `update_response` e mapeia "not_found", "closed" (estado de edição encerrada) e "identifier_locked" ("O CPF não pode ser alterado."); (g) e-mail "Inscrição atualizada" SÓ se `shouldSendUpdateEmail`, usando `getOrigin` para o link, `createTimedFetch` e `isSafeRecipient`; falha, lentidão ou falta de chave nunca derrubam a edição (`emailSent: false`); (h) devolve `{ ok: true, emailSent }` ou `{ ok: false, error, field? }`; (i) exceções (SEC-13): erro genérico "Não foi possível salvar. Tente novamente." e log só com `EXCEPTION` e o ID da inscrição, nunca o token nem as respostas.
 5. Testes: token com formato inválido e token desconhecido; formulário encerrado e prazo vencido; vagas esgotadas não bloqueiam; CPF mascarado na leitura e o CPF completo ausente da resposta serializada; o token ausente de qualquer resposta e de qualquer log; navegador enviando outro CPF -> o guardado prevalece; pergunta de CPF adicionada depois não trava a edição; opção removida -> "Selecione uma das opções disponíveis."; lista ou objeto em campo de texto -> erro genérico; janela de 10 minutos com relógio injetado: 9 min 59 s sem e-mail e `emailSent: false`, 10 min 00 s envia, e menos de 10 minutos depois da inscrição não envia; falha do Resend (resposta 500 e exceção), falta de chave e formulário sem campo de e-mail -> `emailSent: false` com a edição salva; exceção do rpc -> erro genérico e log `EXCEPTION`; o e-mail usa a origem permitida.
 6. `edit-response.functions.ts`: as duas funções de servidor com `method: "POST"` (SEC-18) e `.validator(...)`; só ligam as dependências reais (`supabaseAdmin`, `getRequest`, variáveis de ambiente, `Date.now`).
 7. `QuestionField.tsx`: desenha UMA pergunta com todas as regras de acessibilidade da T-10 (rótulo associado; grupos de escolha com `aria-labelledby`; erro com `id`, `role="alert"`, `aria-invalid` e `aria-describedby`; máscaras com `applyMask`) e aceita `readOnly`. 
 8. `editar.$token.tsx`: no `head`, `<meta name="referrer" content="no-referrer">` e `<meta name="robots" content="noindex, nofollow">`; logotipo com `referrerPolicy="no-referrer"`; tema do formulário (cor, fonte, logotipo); selo "Editando inscrição" e a instrução "Altere os campos desejados e clique em 'Salvar alterações'."; perguntas preenchidas; CPF somente leitura, mascarado, com cadeado e o aviso "O CPF não pode ser alterado."; SEM caixa de consentimento e SEM contagem de vagas; botão "Salvar alterações" / "Salvando..." com `readableTextColor`; banner "Alterações salvas!" e, SOMENTE se `emailSent === true`, "Alterações salvas! Enviamos um resumo atualizado para o seu e-mail."; estados "Carregando dados da inscrição...", "Edição encerrada" ("Este formulário não aceita mais alterações."), "Inscrição não encontrada" ("Verifique se o link está correto.") e erro de carregamento com "Tentar de novo" (como na T-10); erro com campo desconhecido vai para o alerta geral e recarrega o formulário; foco no primeiro erro; alerta geral com contraste mínimo de 4,5:1 (`text-red-800`); textos EXATOS da Tela C do ui-ux.md.
 9. Higiene: nenhuma chamada a `console.*`; o token não é gravado em armazenamento do navegador.

Ajuste pós-revisão (SEC-19, SEC-20, UX-07, UX-08, QA-GAP-09, QA-GAP-10), arquivos permitidos neste ajuste: `src/lib/edit-response.ts`, `src/lib/edit-response.test.ts`, `src/lib/edit-response.functions.ts`, `src/lib/edit-response.functions.test.ts` (novo), `src/lib/public-forms.functions.ts`, `src/lib/public-forms.functions.test.ts` (novo), `src/components/QuestionField.tsx` e `src/routes/editar.$token.tsx`. Itens (testes primeiro, vistos falhando, onde houver lógica):
 10. SEC-20: `handleGetForEdit` devolve só as respostas de perguntas que existem e mascara com `hideDocument` qualquer valor, de qualquer tipo de pergunta, cujos dígitos sejam iguais ao `identifier` da inscrição. Testes: pergunta de CPF apagada; tipo do campo alterado para texto; valor com pontuação; um valor que não é o CPF não é mascarado.
 11. SEC-19 (edição): extrair UMA função compartilhada de carregamento por token (hoje o carregamento está copiado nas duas funções de servidor) que LANÇA um erro genérico quando o banco devolve `error` em qualquer das três consultas (inscrição, formulário, perguntas), em vez de tratar como "não encontrado". `handleGetForEdit` ganha `try/catch`: registra `EXCEPTION` e o ID (ou vazio, se ainda não houver) e relança um erro genérico, sem a mensagem original (a tela já mostra "Não foi possível carregar o formulário" com "Tentar de novo"). `handleUpdate` segue devolvendo "Não foi possível salvar. Tente novamente.". Token inexistente continua `not_found`. Testes: erro do banco na leitura e ao salvar não vira "não encontrado"; a exceção do carregamento não expõe a mensagem original; o log leva só `EXCEPTION` e o ID, nunca o token.
 12. SEC-19 (leitura pública e inscrição): em `public-forms.functions.ts`, `getPublicForm` e `loadFormAndQuestions` passam a lançar erro genérico quando o banco devolve `error`; slug inexistente continua `not_found`. As telas já tratam falha de carregamento com "Tentar de novo" e a inscrição já captura exceções (SEC-13).
 13. QA-GAP-09: testes dos dois arquivos de funções com `createServerFn` simulado: as funções da edição são `method: "POST"` (trocar por GET deve reprovar o teste) e os itens 11 e 12 (erro do banco).
 14. UX-07: no `QuestionField`, o aviso de somente leitura ganha `id` e entra no `aria-describedby` do campo (junto com o erro, se houver).
 15. UX-08 e QA-GAP-10: em `editar.$token.tsx`, ao iniciar um salvamento limpar o banner de sucesso anterior; e uma trava síncrona contra duplo envio com `useRef` (como na tela pública), liberada no `finally`.
 16. SEC-21: em `handleUpdate`, toda pergunta cuja resposta GUARDADA (em `response.answers`) tem dígitos iguais ao `identifier` da inscrição, seja qual for o tipo atual da pergunta, é tratada como o CPF: o valor enviado pelo navegador é ignorado, vale o guardado, e a pergunta não é obrigatória na edição. Testes (primeiro, falhando): tipo alterado para texto e a pessoa salva o que a leitura devolveu (mascarado) -> o valor guardado NÃO muda; valor forjado nesse campo é ignorado; uma pergunta comum não é afetada; pergunta de CPF de tipo cpf continua protegida como antes.

Verificação: `bun node_modules/vitest/vitest.mjs run edit-response`; `bun node_modules/vitest/vitest.mjs run` (suíte completa, os 108 anteriores seguem passando); `bun node_modules/typescript/bin/tsc --noEmit`; `bun node_modules/vite/bin/vite.js build`; com `bun node_modules/vite/bin/vite.js dev` (porta 8080, em processo separado): `curl.exe -s http://localhost:8080/editar/x | Select-String -Pattern 'no-referrer'` e a mesma busca por `noindex` imprimem uma linha cada. O salvamento real NÃO é testável localmente (não há chaves no computador).
Parte MANUAL (dono, no site publicado, depois do deploy automático da main):
 1. Crie um formulário com Nome, CPF, E-mail e uma pergunta de escolha única (Distância: 5 km e 10 km), limite de 3 vagas, cor amarela e termo preenchido. Inscreva-se com o CPF `529.982.247-25` escolhendo 5 km e copie o link de edição.
 2. Abra o link (em outro navegador ou no celular): tema (cor, fonte, logotipo), selo "Editando inscrição", respostas preenchidas, CPF MASCARADO (`***.***.***-25`) com cadeado e "O CPF não pode ser alterado.", sem caixa de termo e sem contagem de vagas.
 3. Troque para 10 km e clique em "Salvar alterações": aparece "Alterações salvas!" (sem a frase do e-mail, esperado até a T-14).
 4. No painel do administrador, a tabela de respostas mostra "10 km" e continua com UMA resposta (nenhuma vaga extra).
 5. Inscreva mais duas pessoas (CPFs `111.444.777-35` e `390.533.447-05`) para lotar as 3 vagas; a primeira pessoa ainda consegue editar (vagas esgotadas não impedem a edição).
 6. Encerre o formulário no painel e recarregue o link: "Edição encerrada. Este formulário não aceita mais alterações." Reabra o formulário.
 7. Abra `https://inscricoes.triadetecnologiaesolucoes.com.br/editar/token-falso` e o link real com UM caractere trocado: "Inscrição não encontrada. Verifique se o link está correto."
 8. No celular (360 px): sem rolagem horizontal. No PowerShell: `curl.exe -s https://inscricoes.triadetecnologiaesolucoes.com.br/editar/x | Select-String -Pattern 'no-referrer'` e a busca por `noindex` imprimem uma linha cada.
 9. No SQL Editor do Supabase: `select submitted_at, updated_at from public.responses order by updated_at desc limit 3;` mostra `updated_at` maior que `submitted_at` na inscrição editada. Apague o formulário de teste ao fim.
O e-mail de "Inscrição atualizada" e a janela de 10 minutos só serão verificáveis na T-14 (Resend real); aqui são cobertos pelos testes com relógio injetado.
Revisão: obrigatória por segunda sessão e auditoria independente (camada 2).
**O que isso prova:** o inscrito corrige a própria distância sem chamar você, sem gastar vaga e sem conseguir trocar o CPF; e o token na URL não é vazado para serviços externos nem indexado por buscadores.

## T-12 — Administração: copiar link de edição e exportações leves
Depende de: T-09 · RF-07
Ler: spec.md RF-07; plan.md (Interface, Respostas); design/ui-ux.md (Tela D); qa-plan.md 5.5; seguranca.md SEC-19
Arquivos: `src/routes/_authenticated.formularios.$id_.respostas.tsx` (o arquivo atual `_authenticated.formularios.$id.respostas.tsx` é RENOMEADO com `git mv`), `src/lib/exports.ts`, `src/lib/exports.test.ts` (novo), `src/lib/routes.test.ts` (novo) e `src/routeTree.gen.ts` (regenerado pelo build).
Fazer (testes primeiro onde houver lógica, vistos falhando):
1. BUG-03 (o botão "Ver respostas" não abre nada: a rota de respostas é filha do editor, que não tem `<Outlet />`): renomear o arquivo para `_authenticated.formularios.$id_.respostas.tsx` (o `_` depois de `$id` a torna irmã do editor) e trocar `$id/respostas` por `$id_/respostas` nas strings de `createFileRoute` e `useParams`. Os `Link` existentes não mudam.
2. Teste de contrato `src/lib/routes.test.ts`: o arquivo novo existe, o antigo não existe, e em `routeTree.gen.ts` a rota de respostas tem `AuthenticatedRoute` (e NÃO a rota do editor) como pai.
3. SEC-19 (admin): o `queryFn` lança erro quando QUALQUER das três consultas (formulário, perguntas, respostas) devolve `error`; a tela mostra "Não foi possível carregar as respostas." com o botão "Tentar de novo" (em vez de "Nenhuma resposta ainda").
4. A consulta de respostas inclui `edit_token`. Nova coluna "Ações" com o botão "Copiar link de edição" por linha. O link é `${ALLOWED_ORIGINS[0]}/editar/${token}` (sempre o domínio de produção, porque o link vai para o inscrito). A cópia aguarda `navigator.clipboard.writeText`; sucesso: toast "Link de edição copiado!"; falha ou API ausente: toast "Não foi possível copiar o link.". O token nunca aparece na tela nem em log.
5. `exportToExcel` e `exportToPDF` passam a importar `xlsx`, `jspdf` e `jspdf-autotable` DINAMICAMENTE dentro da função (assíncronas); os botões aguardam, ficam desabilitados enquanto exportam e, em falha, mostram o toast "Não foi possível exportar. Tente novamente.".
6. Exportar `buildRows` (função pura) e testar em `exports.test.ts`: o CPF sai COMPLETO e sem máscara (ex.: "529.982.247-25"); listas viram texto separado por ", "; resposta ausente vira vazio; o cabeçalho é "Enviado em" mais os rótulos; acentos preservados.
Verificação (agente, comandos desta máquina): `bun node_modules/vitest/vitest.mjs run exports`; `bun node_modules/vitest/vitest.mjs run routes`; `bun node_modules/vitest/vitest.mjs run` (os 178 anteriores seguem passando); `bun node_modules/typescript/bin/tsc --noEmit`; `bun node_modules/vite/bin/vite.js build`; depois do build, `Select-String -Path .output/server/*.mjs -Pattern "xlsx" -List` NÃO deve listar o arquivo de entrada (`index.mjs`) e o tamanho compactado do Worker deve ficar abaixo de 3 MB.
Parte MANUAL 🧑 (dono, no site publicado, depois do deploy): (1) no editor de um formulário com inscrições, clicar "Ver respostas": a tabela abre, com contagem, vagas e prazo; (2) o CPF aparece COMPLETO na tabela; (3) "Copiar link de edição" mostra o aviso; colar numa janela anônima abre a edição daquela pessoa (CPF mascarado); (4) "Exportar Excel" e "Exportar PDF": acentos corretos, CPF completo e todas as respostas; (5) sair da conta e abrir `/formularios/<id>/respostas` direto: vai para `/auth`, sem dados; (6) "← Editor" volta ao editor; (7) no celular (360 px) a tabela rola para o lado e os botões são tocáveis.
**O que isso prova:** você recupera o link de qualquer inscrito com um clique e as exportações continuam funcionando com o sistema mais leve.

## T-13 — Revisão de segredos
Depende de: T-10
Ler: seguranca.md (segredos); qa-plan.md (somente o item de segredos do checklist final)
Arquivos: `.gitignore`
Fazer: conferir que nenhuma chave secreta está no repositório (`git grep -n "sb_secret_\|SERVICE_ROLE_KEY=\|re_[A-Za-z0-9]\{20,\}"` sem resultado; nomes de variáveis no código são permitidos, valores não) e que `.dev.vars` está no `.gitignore` e que o `.env` traz só chaves públicas do projeto **novo**.
Verificação: comando acima sem saída (nenhuma linha); `git diff --stat main -- .env` mostra só URL/chave pública.
**O que isso prova:** nenhuma senha ou chave privada foi parar no GitHub.

## T-14 🧑 — E-mail real, monitor e teste ponta a ponta
Depende de: T-10, T-11, T-12, T-03
Ler: spec.md (cenários-chave); qa-plan.md seções 6 e 7; seguranca.md (checklist final)
Fazer:
1. Resend: criar conta, **verificar o subdomínio de envio** (registros DNS na Cloudflare; pode levar alguns minutos), cadastrar `RESEND_API_KEY` e `EMAIL_FROM` como **Segredo** no Worker.
2. Monitor externo gratuito chamando `https://inscricoes.<dominio>/saude` a cada poucos minutos (evita a pausa do banco e avisa de queda).
3. Rodar os **5 cenários-chave** do `spec.md` no endereço real, no celular, **com gravação de tela**; garantir como regra operacional que todo formulário publicado tem limite de vagas definido; exportar Excel e PDF; guardar um Excel de backup ao final.
Verificação: os 5 cenários do `spec.md` passam; `curl https://inscricoes.<dominio>/saude` → `ok`; o e-mail chega com o CPF ocultado e o link funciona.
**O que isso prova:** o sistema está pronto para o primeiro evento real.

---

## Fluxo de execução recomendado

1. Abrir o Claude Code / Antigravity em **plan mode** apontando para `specs/001-fase-0-no-ar/plan.md` e pedir revisão antes de codar.
2. Executar **uma task por vez**, rodando a verificação antes de seguir. Não misturar tasks.
3. **Padrão Writer/Reviewer** nas tasks sensíveis (T-04, T-08, T-09, T-11): uma segunda sessão, em contexto limpo, revisa só o diff contra `plan.md` e `spec.md`, reportando apenas lacunas de corretude ou de requisito (não estilo).
4. Ao final, rodar os cenários-chave do `spec.md`.
