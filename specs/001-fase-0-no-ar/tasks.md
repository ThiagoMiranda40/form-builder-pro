# Tasks — Spec 001: Fase 0 no ar

**Comandos de verificação padrão** (toda task termina com eles verdes): `bunx tsc --noEmit` · `bun run test` · `bun run build`.
**Não usar lint como critério** (344 erros de formatação já existentes).
**Tasks com comportamento seguem TDD:** escrever o teste que falha → implementar → rodar a suíte inteira.
**Marcadas 🧑 são passos manuais seus** (painéis externos); as demais o Claude Code / Antigravity executa.
**Ordem = risco primeiro:** infraestrutura (T-02, T-03) antes do código de negócio.

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
3. Auth → criar o usuário administrador (e-mail + senha) e **desligar "permitir novos cadastros"**.
4. Copiar URL, chave pública (publishable) e chave de serviço (service role).
5. Atualizar `.env` do repositório **somente** com URL e chave **pública** (as variáveis `VITE_SUPABASE_*` e `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` já presentes). **Nunca** colocar a chave de serviço no repositório.
Verificação:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"intruso@example.com","password":"Senha-Forte-123"}'
```
Esperado: **código 4xx** (cadastro recusado). E `git diff .env` mostra só URL/chave públicas do projeto novo.
**O que isso prova:** o banco é seu, tem só o seu usuário, e ninguém consegue criar conta.

## T-03 — Esqueleto no ar: rota `/saude` + Cloudflare Workers + subdomínio
Depende de: T-02 · Mitiga os riscos 1 e 2 do plano
Arquivos: `src/routes/saude.tsx` (novo; `routeTree.gen.ts` é regenerado pelo build), `.gitignore` (acrescentar `.dev.vars`)
Fazer:
1. Criar a rota de servidor `GET /saude`: consulta o banco com `supabaseAdmin` (`select` de 1 linha em `forms`, `head:true`) e responde JSON `{ "ok": true, "db": true }` com `Cache-Control: no-store`; em erro, status 503 e `{ "ok": false }`. (Conferir na documentação do `@tanstack/react-start` instalado a forma de declarar rota de servidor.)
2. Local: **`vite preview` não funciona neste projeto** (procura `dist/server/server.js`; o Nitro gera `.output`). Duas opções que funcionam (testadas com o build atual): `bun run dev` (servidor de desenvolvimento) ou, para rodar o **Worker compilado no runtime da Cloudflare**, `bun run build && npx wrangler dev --config .output/server/wrangler.json --ip 127.0.0.1 --port 8788`, com os valores das variáveis em um arquivo `.dev.vars` (ignorado pelo git). Chamar `/saude` na porta escolhida.
3. 🧑 Cloudflare → Workers Builds conectado ao repositório: build `bun run build`, deploy `npx wrangler deploy` (se não achar a configuração gerada em `.wrangler/deploy/config.json`, usar `npx nitro deploy --prebuilt`). Cadastrar **como Segredo**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Vincular o **Domínio Personalizado** `inscricoes.<domínio da Tríade>`.
Verificação:
```bash
curl -s https://inscricoes.<dominio>/saude          # {"ok":true,"db":true}
curl -s -o /dev/null -w "%{http_code}\n" https://inscricoes.<dominio>/auth    # 200
```
E no painel da Cloudflare (Workers → Logs) as invocações de `/auth` **sem erro 1102** ("Worker exceeded resource limits").
**O que isso prova:** o sistema está publicado no seu subdomínio, o servidor consegue falar com o banco e o plano gratuito aguenta renderizar as páginas. **Se aparecer o erro 1102, pare aqui e me avise** (a saída é o plano pago do Workers).

## T-04 — Migração Fase 0 e tipos
Depende de: T-02 · RF-03, RF-04, RF-08, RF-10 (banco)
Arquivos: `supabase/migrations/<timestamp>_fase0_inscricao.sql` (novo, conteúdo de `data-model.md`), `src/integrations/supabase/types.ts`
Fazer:
1. Criar a migração copiando o SQL de `data-model.md` **sem alterá-lo**; aplicar no Supabase.
2. Atualizar `types.ts` conforme a última seção de `data-model.md`.
3. Rodar a verificação do banco e a de concorrência.
Verificação:
```bash
psql "$DATABASE_URL" -f specs/001-fase-0-no-ar/verificacao-banco.sql     # 32 linhas "PASSOU", nenhuma "FALHOU"
# concorrência: 5 vagas, 20 envios ao mesmo tempo
psql "$DATABASE_URL" -c "INSERT INTO forms(owner_id,slug,status,max_responses) SELECT id,'teste-concorrencia','published',5 FROM auth.users LIMIT 1;"
seq 1 20 | xargs -P 20 -I{} psql "$DATABASE_URL" -At -c "SELECT (submit_response('teste-concorrencia','{}','cpf{}'))->>'status';" | sort | uniq -c
psql "$DATABASE_URL" -c "DELETE FROM forms WHERE slug='teste-concorrencia';"
bunx tsc --noEmit
```
Esperado: **32 PASSOU**, e na concorrência **`5 ok` + `15 full`**.
**O que isso prova:** com 20 pessoas enviando ao mesmo tempo para 5 vagas, entram exatamente 5; o mesmo CPF não entra duas vezes; o inscrito consegue editar sem gastar vaga, mas não consegue trocar o CPF; visitantes sem login não leem nada.

## T-05 — Regras do endereço (slug)
Depende de: T-04 · RF-11
Arquivos: `src/lib/slug.ts` (novo), `src/lib/slug.test.ts` (novo), `src/lib/exports.ts` (remover `slug`), `src/routes/_authenticated.painel.tsx` (trocar import)
Fazer:
1. Testes que falham primeiro: `validateSlug("skf-corrida-track-field")` → `null`; `"ab"` → mensagem de tamanho; `"Maiuscula"`, `"-abc"`, `"a--b"`, `"com_underline"`, `"com espaco"` → mensagem de formato; `"painel"`, `"editar"`, `"saude"`, `"auth"`, `"formularios"`, `"api"`, `"admin"`, `"assets"`, `"login"` → "Esse nome é reservado pelo sistema"; `suggestSlug("SKF Corrida Track & Field")` → `"skf-corrida-track-field"`; `suggestSlug("Novo formulário", "abc123")` → `"novo-formulario-abc123"`; `suggestSlug("!!!")` → um valor válido (ex.: `formulario`); `sanitizeSlugInput("SKF Corrida Track&Field")` → `"skf-corrida-track-field"`; `sanitizeSlugInput("skf-")` → `"skf-"` (mantém o hífen final enquanto digita); `sanitizeSlugInput("  Corrida  Ação  ")` → `"corrida-acao-"`; `sanitizeSlugInput("-abc")` → `"abc"`; `sanitizeSlugInput("a--b")` → `"a-b"`; entrada com 70 caracteres → corta em 60; `trimSlugEdges("corrida-acao-")` → `"corrida-acao"`.
2. Teste que **lê o arquivo da migração Fase 0** e confirma que a lista de reservados do SQL é idêntica a `RESERVED_SLUGS`.
3. Implementar `slug.ts` (mover a função `slug()` que hoje está em `exports.ts`; ela normaliza acentos) e atualizar os imports.
Verificação: `bun run test -- slug && bunx tsc --noEmit && bun run build`.
**O que isso prova:** "SKF Corrida Track & Field" vira `skf-corrida-track-field`, tanto sugerido pelo título quanto digitado no campo; nomes inválidos ou reservados são recusados com a mensagem certa; e a regra do código nunca diverge da regra do banco.

## T-06 — Endereço direto na raiz + editor de endereço
Depende de: T-05 · RF-11
Arquivos: `src/routes/f.$slug.tsx` → **renomear para** `src/routes/$slug.tsx`, `src/routes/_authenticated.formularios.$id.tsx`, `src/routes/_authenticated.painel.tsx`
Fazer:
1. Mover a rota pública para `/$slug` (`createFileRoute("/$slug")`, `useParams({ from: "/$slug" })`); nada mais referencia `/f/`.
2. Editor: no cartão "Link de compartilhamento", campo de endereço com prefixo `origin/` que converte ao digitar (`sanitizeSlugInput`), tira hífens das pontas ao sair do campo (`trimSlugEdges`), validação ao digitar (`validateSlug`), `publicUrl = ${origin}/${slug}`, aviso "links já compartilhados deixarão de funcionar" ao trocar em formulário publicado, e `slug` incluído no `save()`. Mapear erros do banco: `23505` → "Esse endereço já está em uso"; `23514`+`forms_slug_reserved` → "Esse nome é reservado pelo sistema"; `forms_slug_format` → mensagem de formato.
3. Painel: criação com `suggestSlug(title, sufixoAleatório)`.
Verificação:
```bash
! grep -rn '"/f/\|/f/\${' src --include=*.ts --include=*.tsx | grep -v routeTree.gen   # nenhuma referência sobrando
bunx tsc --noEmit && bun run test && bun run build
bun run dev -- --host 127.0.0.1 --port 5173 &  sleep 8
curl -s -o /dev/null -w "%{http_code}\n" 127.0.0.1:5173/qualquer-endereco   # esperado 200 (hoje: 404, a rota não existe)
curl -s -o /dev/null -w "%{http_code}\n" 127.0.0.1:5173/f/qualquer          # esperado 404 (rota antiga removida)
curl -s 127.0.0.1:5173/qualquer-endereco | grep -o "Carregando formulário"  # o servidor entrega a casca; os dados chegam no navegador
```
E o roteiro manual (com o banco real): criar formulário, mudar o endereço para `skf-corrida-track-field`, publicar, abrir `/<endereço>`.
**O que isso prova:** o formulário abre em `.../skf-corrida-track-field`, o endereço antigo `/f/...` deixa de existir, endereços inexistentes mostram "não encontrado", e o editor recusa endereço repetido, reservado ou mal formado com mensagem clara.

## T-07 — Só o administrador entra + página inicial
Depende de: T-03 · RF-01, RF-02
Arquivos: `src/routes/auth.tsx`, `src/routes/index.tsx`
Fazer:
1. `auth.tsx`: remover o modo "criar conta" (campo nome, `signUp`, alternância), o botão Google e o import de `@/integrations/lovable`; título fixo "Entrar". **Não mexer** em `src/integrations/lovable/`.
2. `index.tsx`: substituir o placeholder por `beforeLoad` com redirecionamento para `/painel` (o layout autenticado já manda quem não entrou para `/auth`).
Verificação:
```bash
bunx tsc --noEmit && bun run build
! grep -rn "lovable\|signUp" src/routes/auth.tsx
bun run dev -- --host 127.0.0.1 --port 5173 & sleep 8
curl -s 127.0.0.1:5173/auth | grep -c "Google\|Criar conta"      # esperado 0 (hoje aparecem "Continuar com Google" e "Criar conta")
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" 127.0.0.1:5173/   # esperado 30x com destino /painel (hoje: 200 com o placeholder)
```
**O que isso prova:** a tela de entrada só oferece e-mail e senha, e o endereço raiz não mostra mais o "Your app will live here".

## T-08 — Regras puras da inscrição e do e-mail
Depende de: T-01 · RF-03, RF-05, RF-09
Arquivos: `src/lib/validators.ts` (exportar `onlyDigits`), `src/lib/inscricao.ts` (novo) + teste, `src/lib/confirmation-email.ts` (novo) + teste
Fazer (testes primeiro):
1. `normalizeCPF("529.982.247-25")` = `"52998224725"`; `normalizeCPF("")` = `null`.
2. `findIdentifierQuestion` devolve a 1ª pergunta do tipo `cpf` (ou `undefined`); `findEmailQuestion` idem para `email`.
3. `hideDocument("529.982.247-25")` = `"***.***.***-25"`; `hideDocument("12.345.678-9")` mostra só o final; entrada vazia → vazio.
4. `isHoneypotFilled("")`/`"  "` → `false`; `"http://spam"` → `true`.
5. `mapSubmitStatus` cobre `duplicate`, `full`, `closed`, `unavailable`, `consent_required`, `ok` com as mensagens do `plan.md`; status desconhecido → erro genérico.
6. `escapeHtml('<script>alert(1)</script>')` não contém `<script>`; `buildConfirmationEmail` (a) inclui o link de edição, (b) **não** contém o CPF completo nem o RG completo, (c) escapa HTML vindo do inscrito, (d) diferencia "confirmada" de "atualizada".
7. `sendConfirmationEmail` com `fetchFn` simulado: chama `https://api.resend.com/emails` com `Authorization: Bearer <chave>` e `to` correto; devolve `true` em 200; devolve `false` (e **não lança**) quando o `fetchFn` lança ou responde 500; se falta `apiKey`, devolve `false` sem chamar a rede.
Verificação: `bun run test && bunx tsc --noEmit && bun run build`.
**O que isso prova:** o e-mail nunca mostra o CPF por inteiro, não deixa um inscrito injetar HTML, e uma falha do serviço de e-mail nunca derruba uma inscrição.

## T-09 — Servidor de inscrição via banco
Depende de: T-04, T-08 · RF-03, RF-04, RF-05, RF-08, RF-09, RF-12
Arquivos: `src/lib/public-forms.functions.ts`
Fazer:
1. `getPublicForm` passa a devolver `consent_text` (no `form`).
2. Reescrever `submitResponse` conforme "Função de servidor de inscrição" do `plan.md` (honeypot → validação com `validateAnswer` devolvendo `field` → `identifier` → `rpc("submit_response")` → `mapSubmitStatus` → e-mail → `editUrl` com `getRequest()`). Segredos lidos de `process.env` (`RESEND_API_KEY`, `EMAIL_FROM`).
3. Nenhum caminho de resposta pode conter o `edit_token` além do `editUrl`.
Verificação: `bun run test && bunx tsc --noEmit && bun run build`; suíte do T-08 continua verde; e no banco real, chamar a função pela interface (T-10) e conferir uma linha nova em `responses` com `identifier`, `edit_token` e `consented_at` preenchidos conforme o formulário.
**O que isso prova:** o servidor é a única porta de entrada, todas as regras (vagas, CPF único, consentimento) vêm do banco, e a inscrição vale mesmo com o e-mail fora do ar.

## T-10 — Tela de inscrição: consentimento, anti-robô, sucesso com link, mensagens
Depende de: T-06, T-09 · RF-05, RF-08, RF-09, RF-12
Arquivos: `src/routes/$slug.tsx`, `src/routes/_authenticated.formularios.$id.tsx` (campo de texto de consentimento; incluir `consent_text` no `save()`)
Fazer:
1. Caixa de consentimento (texto do formulário) quando existir; `hp` invisível (`tabIndex={-1}`, `autoComplete="off"`, fora da tela); envio com `{ slug, answers, consent, hp }`.
2. Erros por campo usam `result.field`; erro do consentimento aparece junto da caixa; duplicidade aparece no campo CPF.
3. Tela de sucesso: mostra `result.message` e, se houver, o `editUrl` com botão "Copiar link" e o aviso "guarde este link".
Verificação: `bunx tsc --noEmit && bun run test && bun run build`; roteiro manual no formulário publicado: inscrever com CPF novo (sucesso + link), repetir o CPF com máscara (recusa no campo CPF), formulário com termo sem marcar (bloqueia), mensagem de sucesso personalizada aparece.
**O que isso prova:** RF-03, RF-08 e RF-12 funcionando como o usuário final vê.

## T-11 — Editar pelo link
Depende de: T-09 · RF-06
Arquivos: `src/lib/edit-response.functions.ts` (novo), `src/routes/editar.$token.tsx` (novo)
Fazer (testes das partes puras primeiro, reaproveitando `inscricao.ts`):
1. `getResponseForEdit` e `updateResponseByToken` conforme o `plan.md` (`identifier_locked` → "O CPF não pode ser alterado."; formulário encerrado/prazo vencido → estado `closed`; token desconhecido → `not_found`).
2. Tela: tema do formulário, perguntas preenchidas, **CPF somente leitura**, sem consentimento, sem vaga; ao salvar mostra "Alterações salvas" e o novo e-mail é enviado ("Inscrição atualizada").
Verificação: `bun run test && bunx tsc --noEmit && bun run build`; roteiro manual do cenário 1 do `spec.md` (5 km → 10 km); abrir o link com o formulário encerrado (mostra "edição encerrada"); abrir `/editar/token-falso` (mostra "não encontrado").
**O que isso prova:** o inscrito corrige a própria distância sem chamar você, sem gastar vaga e sem conseguir trocar o CPF.

## T-12 — Administração: copiar link de edição e exportações leves
Depende de: T-09 · RF-07
Arquivos: `src/routes/_authenticated.formularios.$id.respostas.tsx`, `src/lib/exports.ts`
Fazer:
1. A consulta de respostas inclui `edit_token`; o formulário inclui `slug` se necessário; botão "Copiar link de edição" por linha (`${origin}/editar/${token}`).
2. Importar `xlsx` e `jspdf` **dinamicamente** dentro dos botões de exportar.
Verificação: `bunx tsc --noEmit && bun run test && bun run build`; conferir que `.output/server` deixou de conter `xlsx`/`jspdf` no caminho da tela inicial (`grep -l "xlsx" .output/server/*.mjs` sem a rota de entrada) e o tamanho compactado do Worker (`tar czf - .output/server | wc -c`) permanece **abaixo de 3 MB**; exportar Excel e PDF continuam funcionando no navegador.
**O que isso prova:** você recupera o link de qualquer inscrito com um clique e as exportações continuam funcionando com o sistema mais leve.

## T-13 — Revisão de segredos
Depende de: T-10
Arquivos: `.gitignore`
Fazer: conferir que nenhuma chave secreta está no repositório (`git grep -n "sb_secret_\|SERVICE_ROLE_KEY=\|re_[A-Za-z0-9]\{20,\}"` sem resultado; nomes de variáveis no código são permitidos, valores não) e que `.dev.vars` está no `.gitignore` e que o `.env` traz só chaves públicas do projeto **novo**.
Verificação: comando acima sem saída (nenhuma linha); `git diff --stat main -- .env` mostra só URL/chave pública.
**O que isso prova:** nenhuma senha ou chave privada foi parar no GitHub.

## T-14 🧑 — E-mail real, monitor e teste ponta a ponta
Depende de: T-10, T-11, T-12, T-03
Fazer:
1. Resend: criar conta, **verificar o subdomínio de envio** (registros DNS na Cloudflare; pode levar alguns minutos), cadastrar `RESEND_API_KEY` e `EMAIL_FROM` como **Segredo** no Worker.
2. Monitor externo gratuito chamando `https://inscricoes.<dominio>/saude` a cada poucos minutos (evita a pausa do banco e avisa de queda).
3. Rodar os **5 cenários-chave** do `spec.md` no endereço real, no celular, **com gravação de tela**; exportar Excel e PDF; guardar um Excel de backup ao final.
Verificação: os 5 cenários do `spec.md` passam; `curl https://inscricoes.<dominio>/saude` → `ok`; o e-mail chega com o CPF ocultado e o link funciona.
**O que isso prova:** o sistema está pronto para o primeiro evento real.

---

## Fluxo de execução recomendado

1. Abrir o Claude Code / Antigravity em **plan mode** apontando para `specs/001-fase-0-no-ar/plan.md` e pedir revisão antes de codar.
2. Executar **uma task por vez**, rodando a verificação antes de seguir. Não misturar tasks.
3. **Padrão Writer/Reviewer** nas tasks sensíveis (T-04, T-08, T-09, T-11): uma segunda sessão, em contexto limpo, revisa só o diff contra `plan.md` e `spec.md`, reportando apenas lacunas de corretude ou de requisito (não estilo).
4. Ao final, rodar os cenários-chave do `spec.md`.
