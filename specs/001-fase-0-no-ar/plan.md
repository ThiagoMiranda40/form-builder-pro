# Plan — Spec 001: Fase 0 no ar

> Herda as decisões do PRD (seção 5 e 6): monolito serverless em **Cloudflare Workers**, **Supabase próprio**, **Resend**. Não reabrir.

## Estado real do repositório (medido em 29/09/2026)

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | **Falha:** 13 erros, todos em `src/routes/f.$slug.tsx` |
| `bun run build` | **Passa.** O Nitro já gera `.output/server/wrangler.json` (compat. `nodejs_compat`, assets em `../public`, nome `thiagomiranda40-form-builder-pro`) e `.wrangler/deploy/config.json` |
| Verificação local | **`vite preview` não funciona** (procura `dist/server/server.js`; o build vai para `.output`). Funcionam: `vite dev` e o **Worker compilado no runtime da Cloudflare** via `npx wrangler dev --config .output/server/wrangler.json` (testado: `/auth` 200, `/f/x` 200, rota inexistente 404) |
| Tamanho do Worker | 4,0 MB descompactado, **0,86 MB compactado** (limite gratuito: 3 MB). Sem risco hoje |
| `eslint .` | **344 problemas** (336 são só formatação). **Não usar lint como critério.** Não reformatar o repositório inteiro nesta feature |
| Testes | **Não existe executor de testes.** Vitest 5 foi instalado e rodou com o Vite 8 do projeto (2 testes de CPF passaram) |
| Gerenciador de pacotes | **bun** (`bun.lock`); `bunfig.toml` bloqueia versões com menos de 24 h e exige confirmação antes de qualquer exceção |
| Bug real | `f.$slug.tsx` lê `result.success_message` e `result.field`; o servidor devolve `message` e nunca `field`. A mensagem de sucesso personalizada **nunca** aparece (RF-12) |
| `.env` do repositório | Aponta para o projeto **antigo do Lovable Cloud**. Precisa apontar para o projeto novo (chaves públicas) |
| Já existe e será reaproveitado | `validateAnswer` e máscaras (`src/lib/validators.ts`, usados no navegador e no servidor); `supabaseAdmin` (`client.server.ts`); `getRequest` de `@tanstack/react-start/server` (usado em `auth-middleware.ts`); estados `not_found/draft/closed/full` em `getPublicForm` |
| Existe mas **sem uso** | `requireSupabaseAuth` (`auth-middleware.ts`): não é necessário nesta feature |
| **Não existe** (será criado) | executor de testes, `slug.ts`, `inscricao.ts`, e-mail, rota `/saude`, rota de edição, migração Fase 0 |

**Arquivos gerados pelo Lovable — não editar:** `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `lovable/index.ts`. Exceção: `types.ts` (atualizado à mão, ver `data-model.md`). `routeTree.gen.ts` é regenerado pelo build; confirmar no diff.

## Abordagem técnica

### Rotas

| Hoje | Depois |
|---|---|
| `/f/$slug` (`f.$slug.tsx`) | **`/$slug`** (`$slug.tsx`) — endereço logo após a barra (RF-11). O arquivo antigo é apagado |
| — | **`/editar/$token`** (`editar.$token.tsx`) — independe do slug |
| — | **`/saude`** — rota de servidor (GET) que consulta o banco e devolve JSON |
| `/`, `/auth`, `/painel`, `/formularios/$id`, `/formularios/$id/respostas` | `/` passa a redirecionar |

Rotas fixas têm prioridade sobre `/$slug`. Como o slug é uma palavra só, `/auth`, `/painel`, `/saude`, `/editar` e `/formularios` nunca colidem; mesmo assim ficam **reservados** no banco e no código. Arquivos de `public/` (ex.: `robots.txt`) são servidos antes do Worker. Uma URL desconhecida cai no estado `not_found` que já existe.

### Função de servidor de inscrição (`submitResponse`, reescrita)

Entrada: `{ slug, answers, consent: boolean, hp: string }` (Zod, como hoje). Saída (tipo discriminado, corrige os erros de tipo do `f.$slug.tsx`):

```ts
type SubmitResult =
  | { ok: true; message: string; editUrl?: string; emailSent: boolean }
  | { ok: false; error: string; field?: string };   // field = id da pergunta com erro
```

Ordem:
1. `hp` preenchido → responde `{ ok: true, message, emailSent: false }` **sem gravar** (RF-09).
2. Carrega formulário e perguntas com `supabaseAdmin` (agora incluindo `consent_text`).
3. Valida cada resposta com `validateAnswer` (mesma função do navegador). Erro → `{ ok:false, error, field: q.id }`.
4. `identifier = normalizeCPF(resposta da 1ª pergunta do tipo cpf)` (ou `null`).
5. `supabaseAdmin.rpc("submit_response", { p_slug, p_answers, p_identifier, p_consented })`.
6. Mapeia `status`: `duplicate` → "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador." (com `field` = pergunta CPF) · `full` → "O limite de inscrições foi atingido." · `closed` → "O prazo de preenchimento encerrou." · `unavailable` → "Este formulário não está disponível." · `consent_required` → "É necessário aceitar o termo para continuar." (`field: "__consent"`).
7. `ok`: monta `editUrl = origin + "/editar/" + edit_token`, com `origin = new URL(getRequest().url).origin`; tenta enviar o e-mail (falha nunca derruba a inscrição; `emailSent` registra se o envio foi bem-sucedido); devolve `{ ok:true, message, editUrl, emailSent }`. **A mensagem vem de `success_message` (corrige RF-12).**

### Edição (`src/lib/edit-response.functions.ts`, novo)

- `getResponseForEdit({ token })` → `{ state: "open" | "closed" | "not_found", form, questions, answers }` (via `supabaseAdmin`; formulário encerrado/prazo vencido → `closed`).
- `updateResponseByToken({ token, answers })` → valida com `validateAnswer`, calcula `identifier` do campo CPF, chama `update_response`, mapeia `identifier_locked` → "O CPF não pode ser alterado.", envia novo e-mail com "Inscrição atualizada", devolve `{ ok: true, emailSent: boolean }`.
- Tela: mesmas perguntas, valores preenchidos, **campo CPF somente leitura**, sem consentimento de novo, sem vaga consumida.

### Regras puras (testáveis sem banco), em `src/lib/`

| Arquivo | Funções |
|---|---|
| `slug.ts` (novo; `slug()` sai de `exports.ts`) | `RESERVED_SLUGS`, `sanitizeSlugInput(v)` (conversão ao digitar; mantém hífen final), `trimSlugEdges(v)` (ao sair do campo), `validateSlug(v): string \| null` (mensagens pt-BR do spec), `suggestSlug(title, suffix?)` |
| `inscricao.ts` (novo) | `normalizeCPF`, `findIdentifierQuestion`, `findEmailQuestion`, `hideDocument` (mostra só os 2 últimos caracteres: `***.***.***-25`), `isHoneypotFilled`, `mapSubmitStatus` |
| `confirmation-email.ts` (novo) | `escapeHtml`, `buildConfirmationEmail({form, questions, answers, editUrl, kind})`, `sendConfirmationEmail({fetchFn, apiKey, from, to, subject, html, text})` → `boolean`, **nunca lança** |
| `theme.ts` (novo) | `readableTextColor(hex)`: devolve a cor de texto (`#ffffff` ou `#000000`) de maior contraste com o fundo informado |

`normalizeCPF` reaproveita a lógica de dígitos de `validators.ts` (hoje `onlyDigits` não é exportada; exportar).

### E-mail (Resend)

`POST https://api.resend.com/emails` com `Authorization: Bearer $RESEND_API_KEY` e corpo `{ from, to:[email], subject, html, text }`. Remetente em subdomínio dedicado da Tríade (verificado por DNS na Cloudflare). Todo texto vindo do inscrito passa por `escapeHtml`; CPF e RG passam por `hideDocument`. Link: `editUrl`.

### Interface

- **Editor** (`_authenticated.formularios.$id.tsx`): no cartão "Link de compartilhamento", campo de **endereço** (prefixo `origin/` + campo editável) que converte com `sanitizeSlugInput` ao digitar, aplica `trimSlugEdges` ao sair do campo e valida em tempo real via `validateSlug`; `publicUrl` passa a ser `${origin}/${slug}` (hoje `/f/${slug}`, linha 99); aviso ao trocar o endereço de formulário publicado; campo de **texto de consentimento** (opcional). `save()` inclui `slug` e `consent_text`. Erros do banco: `23505` → "Esse endereço já está em uso"; `23514` com `forms_slug_reserved` → "Esse nome é reservado pelo sistema"; `forms_slug_format` → mensagem do formato.
- **Painel** (`_authenticated.painel.tsx`): criação usa `suggestSlug` (título + sufixo aleatório curto, sem colidir).
- **Respostas**: consulta inclui `edit_token` e `slug` do formulário; botão "Copiar link de edição" por linha (`${origin}/editar/${token}`). O administrador lê `edit_token` direto sob as regras de acesso já existentes (`responses_owner_read`). `xlsx` e `jspdf` passam a ser importados **dinamicamente** dentro dos botões de exportar (hoje entram no bundle do servidor e da tela inicial; não é bloqueante, só reduz peso e partida).
- **Formulário público** (`$slug.tsx`): caixa de consentimento (se houver texto), campo `hp` invisível (`tabIndex=-1`, `autoComplete="off"`, fora da tela), tela de sucesso com `editUrl`.
- **Entrada** (`auth.tsx`): remove modo "criar conta" e o botão Google (e o import de `lovable`); o arquivo `integrations/lovable/` e a dependência ficam intocados. `/`: redirecionamento para `/painel` em `beforeLoad`.

### Infraestrutura e segredos

| Nome | Onde | Público? | Uso |
|---|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` do repositório (**trocar para o projeto novo**) | sim | Navegador e build |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Worker, como **Segredo** | não | `process.env` no servidor (`auth-middleware.ts`, `client.server.ts`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker, **Segredo** | **nunca no repo** | `supabaseAdmin` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Worker, **Segredo** | não | E-mail |

Regra: cadastrar como **Segredo**, não como variável de build (variáveis de build somem a cada deploy). Deploy: Workers Builds (Git) com build `bun run build` e deploy `npx wrangler deploy` (deve usar o `.wrangler/deploy/config.json` gerado; **validar em T-03**; alternativa: `npx nitro deploy --prebuilt`). Domínio: "Domínio Personalizado" do Worker no painel (o DNS do domínio precisa estar na Cloudflare).

### Como cada camada é verificada

| Camada | Verificação |
|---|---|
| Regras puras | Vitest (`bun run test`) |
| Banco (vagas, CPF, edição, consentimento, permissões) | Script SQL/psql do `data-model.md` (já executado com sucesso em Postgres 16) |
| Rotas e redirecionamentos | `bun run dev` (ou `wrangler dev` no Worker compilado) + `curl` |
| Ponta a ponta | Roteiro dos cenários-chave do `spec.md`, com gravação de tela |
| Sempre | `bunx tsc --noEmit` e `bun run build` |

## Riscos técnicos e premissas

| # | Risco / premissa | Mitigação |
|---|---|---|
| 1 | **10 ms de CPU** por requisição no Workers gratuito pode não bastar para a renderização no servidor (erro 1102) | Medir em T-03 (o log de invocação mostra CPU). Se falhar: Workers pago (a partir de US$ 5/mês) |
| 2 | `process.env` precisa estar preenchido dentro do Worker | `/saude` consulta o banco; se falhar, é isto |
| 3 | A API de rotas de servidor do TanStack Start (para `/saude`) varia entre versões | Conferir na documentação da versão instalada (`@tanstack/react-start` 1.168.x) |
| 4 | Vitest recém-lançado pode ser barrado pela regra de 24 h do `bunfig.toml` | Usar a versão anterior; **nunca** adicionar exceção sem perguntar |
| 5 | A lista de slugs reservados existe em dois lugares (código e migração) | Teste automático em T-05 compara as duas listas |
| 6 | Supabase gratuito pausa após 7 dias sem uso e não tem backup | `/saude` + monitor externo (T-14); exportar o Excel ao encerrar cada formulário |
| 7 | 100 e-mails/dia no Resend gratuito | E-mail nunca bloqueia a inscrição; o link aparece na tela; RF-07 |
| 8 | Renomear o endereço quebra links já divulgados do formulário | Aviso no editor; sem redirecionamento (Fase 1) |
| 9 | Uma conta Supabase gratuita permite 2 projetos ativos | Conferir antes de T-02 |

## Fora de escopo (técnico)

Não regenerar `types.ts` por CLI; não migrar dados do projeto Lovable antigo (não há formulário real); não reformatar o repositório para zerar o lint; não remover a dependência do Lovable; não criar redirecionamentos de `/f/...`; sem testes de interface (jsdom); sem captcha; sem cache; sem fila de e-mail.
