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
| `confirmation-email.ts` (novo) | `escapeHtml`, `isSafeRecipient(email)`, `buildConfirmationEmail({form, questions, answers, editUrl, kind})`, `sendConfirmationEmail({fetchFn, apiKey, from, to, subject, html, text})` → `boolean`, **nunca lança** |
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

#### Prévias da Cloudflare (Worker Previews)

Nas branches que não são de produção, a Cloudflare executa `bun run build` seguido de `npx wrangler preview`. Detalhes e requisitos da arquitetura:
- **Segredos e variáveis:** O ambiente de prévia do Worker Previews **NÃO herda segredos nem variáveis da produção**. Os 5 segredos necessários (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`) devem ser cadastrados na aba Base de Prévias da Cloudflare.
- **Pré-requisitos técnicos:**
  1. Wrangler versão `4.135.0` ou mais recente instalado como dependência do projeto (`devDependencies`), garantindo que comandos executem a versão do projeto e não dependam de instalação global da máquina de build.
  2. O arquivo de configuração do Worker (`.output/server/wrangler.json`, gerado pelo Nitro durante o build) deve conter obrigatoriamente a chave `"previews": {}`. Caso o Nitro/TanStack Start não suporte inserção direta via configuração, a chave é injetada via script de pós-build (`scripts/add-previews-block.mjs`), acionado transparentemente por `bun run build`.
- **Formato do endereço da prévia:** `<nome-da-branch>-form-builder-pro.triadetecnologiaesolucoes.workers.dev` (ex.: `spec-001-fase-0-no-ar-form-builder-pro.triadetecnologiaesolucoes.workers.dev`).

### Decisões de segurança

- **Proteção do link de edição:** A rota `/editar/$token` inclui as meta tags `referrer: "no-referrer"` e `robots: "noindex, nofollow"`, impedindo que o token na URL vaze em requisições a imagens/links externos (ex.: logotipo do tema configurado pelo organizador) ou seja indexado por motores de busca.
- **Higiene de logs:** O servidor nunca registra o objeto `answers` ou dados pessoais em logs. Erros capturados em handlers ou middlewares (`start.ts` e `client.server.ts` quando decorrentes da inscrição) registram apenas a mensagem/código da falha e o ID do formulário.
- **Tamanho do payload:** O schema Zod de submissão limita o objeto `answers` a no máximo 200 chaves (`.refine(obj => Object.keys(obj).length <= 200)`), protegendo o tempo de CPU do Worker.
- **Limite de reenvio de e-mail por edição:** O e-mail de atualização só é disparado se tiverem passado pelo menos 10 minutos desde o último salvamento daquela inscrição (medido lendo o `updated_at` anterior antes de chamar `update_response`). Dentro da janela, os dados são salvos normalmente, `emailSent` retorna `false` e a interface não afirma envio de e-mail.
- **Destinatário seguro:** A função `isSafeRecipient(email)` em `confirmation-email.ts` rejeita destinatários contendo caracteres como `, ; < > "` e espaços antes de invocar a API do Resend.
- **Autenticação:** Política de senha forte (mínimo 12 caracteres + complexidade) configurada diretamente no Supabase Auth.

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

## M-46 — Convite em lote para o grupo do WhatsApp

> Herda `docs/arquitetura/architecture.md` e `docs/arquitetura/adr/ADR-001` a `ADR-005`. Fonte: `specs/001-fase-0-no-ar/m46/prd-m46-grupo-whatsapp.md`.

### Estado real do repositório (medido em 12/11/2026, commit `524ac2b`)
- Base: TanStack Start + Nitro em Cloudflare Workers, Supabase, Resend, bun, vitest. Comandos padrão da seção Comandos do `AGENTS.md`.
- Envio atual de e-mail é unitário: um `fetch` por mensagem em `confirmation-email.ts` (linha 213). Não existe envio em lote.
- Reaproveitáveis verificados nos arquivos: `parseBrazilMobile`, `whatsappUrl`, `firstNameOf`, `whatsappGreeting` (`whatsapp.ts`); `escapeHtml`, `isSafeRecipient` (`confirmation-email.ts`); `verifyShareSession`, `shareCookieName`, `parseCookieHeader` (`share.ts`); `findEmailQuestionWithAnswer` (`admin-response.ts`); `findNameQuestion` (`responses-table.ts`).
- O formulário público carrega colunas por lista explícita (`public-forms.functions.ts`, linhas 72 e 125): a coluna nova não vai para o público por acidente.
- A página do administrador `_authenticated.formularios.$id_.respostas.tsx` lê formulário, perguntas e respostas direto do Supabase pelo cliente autenticado (linha 88); a do cliente (`c.$token.tsx`) usa `getSharedResponses` (servidor). O painel novo precisa funcionar nos dois contextos recebendo dados por propriedades e chamando funções de servidor distintas por contexto.
- **Não medido aqui:** `bun install` e `bun run test` (o ambiente de planejamento não tem acesso ao registro). A T-45 tem de registrar a linha de base real (tipos, testes, build) antes de mexer em qualquer coisa.
- Premissas abertas: plano da Cloudflare do Worker (P1) e plano do Resend (P2) **não confirmados**; o projeto é desenhado para caber no pior caso (Free e 100 e-mails por dia).

### Abordagem técnica
1. **Banco primeiro** (risco): migração com coluna, duas tabelas e a função atômica; tudo fechado a `anon` e `authenticated`.
2. **Núcleo puro** em `src/lib/invite.ts`: validação do link do grupo, mensagem padrão, montagem do `wa.me` (reusa `whatsappUrl`), geração do `.vcf`, seleção de elegíveis, fatiamento. Sem rede, sem cookie, sem banco (ARQ-04).
3. **E-mail em lote** em `src/lib/invite-email.ts`: constrói o HTML e o assunto de cada item, faz **um** `POST https://api.resend.com/emails/batch` por fatia (até 50 itens, 1 destinatário por item, cabeçalho `Idempotency-Key`), interpreta a resposta item a item. `fetch` e chave entram por parâmetro (testável).
4. **Funções de servidor** em `src/lib/invite.functions.ts`, duas entradas que compartilham o mesmo núcleo: administrador (usuário autenticado, dono do formulário) e cliente (token + `share_code_hash` preenchido + cookie de sessão válido; reaproveita o padrão de `getSharedResponses`). Cada fatia reautoriza.
5. **Telas** em `src/components/GroupInvitePanel.tsx` (organismo único, dados por propriedades), campo no editor (Tela H), cartão de confirmação e e-mail (Tela J), aviso no formulário (Tela K).
6. **Publicar cedo, administrador primeiro:** a T-45 e a T-46 não mudam nenhum comportamento visível; o **Marco 0** é o arquivo de contatos (T-55, sem banco nem servidor); o **Marco 1** é o administrador (T-45, T-46, T-47, T-48, T-50, T-52, T-51); o **Marco 2** é o cliente (T-49, T-53). A ordem de execução está na tabela do `tasks.md`.

### Arquitetura aplicável (herdada, não reaberta)
| ID | Como se aplica aqui |
|---|---|
| ADR-001 / ARQ-01 | nenhuma biblioteca ou API do WhatsApp; `package.json` e `bun.lock` sem diff em toda a M-46 |
| ADR-002 / ARQ-06 / RQ-01, RQ-03, RQ-05 | só `/emails/batch`, fatias de 50, `Idempotency-Key` `<batchId>:<fatia>`, 1 destinatário por item, no máximo 20 chamadas externas por requisição |
| ADR-003 / ARQ-02 | tabelas e função só para service role |
| ADR-004 / ARQ-03, ARQ-04, ARQ-07 | escrita do cliente só com `share_code_hash` + sessão; núcleo sem cookie; regex do link do grupo |
| ADR-005 / ARQ-05 / RQ-02, RQ-04 | intervalo 10 min e orçamento 80/24 h dentro de `invite_create_batch`; valores por variáveis `INVITE_MIN_INTERVAL_MINUTES` e `INVITE_DAILY_BUDGET` com esses padrões |

### Arquivos e interfaces afetados
Novos: `supabase/migrations/20261113090000_convite_em_lote_grupo_whatsapp.sql`, `src/lib/invite.ts` (+ `.test.ts`), `src/lib/invite-email.ts` (+ `.test.ts`), `src/lib/invite.functions.ts` (+ `.test.ts`), `src/components/GroupInvitePanel.tsx`, `specs/001-fase-0-no-ar/verificacao-banco-m46.sql`, `specs/001-fase-0-no-ar/verificacao-concorrencia-m46.mjs`.
Alterados: `src/integrations/supabase/types.ts` (à mão), `src/routes/_authenticated.formularios.$id.tsx` (campo no editor), `src/routes/_authenticated.formularios.$id_.respostas.tsx` (painel do administrador), `src/routes/c.$token.tsx` (painel do cliente), `src/lib/submit-response.ts`, `src/lib/confirmation-email.ts`, `src/routes/$slug.tsx` (confirmação e aviso), `src/lib/share.functions.ts` (somente se a T-49 precisar expor o estado de proteção ao painel), `src/lib/routes.test.ts` e os `.md` da spec.

### Modelo de dados
Ver `data-model.md` (seção "Migração T-45").

### Contratos (funções de servidor)
Administrador: `setGroupLinkAdmin`, `startInviteBatchAdmin`, `sendNextSliceAdmin`, `getInviteStatusAdmin`, `markInvitedAdmin`. Cliente: as mesmas com sufixo `Client`, mais `setGroupLinkClient`, recebendo `token`. Todas recebem o `formId` do contexto autorizado (nunca confiam em `formId` do corpo para o cliente: ele vem do token) e validam `batchId` e `responseId` contra esse formulário (SEC-40). Retornos como união discriminada (`{state:"ok"|"refused"|"locked"|...}`), sem mensagens técnicas. Detalhes exatos ficam nas "Especificações complementares" de cada tarefa.

### Infraestrutura, segredos e passos manuais
- Nenhum segredo novo: usa `RESEND_API_KEY`, `EMAIL_FROM`, `SHARE_SESSION_SECRET` existentes. Variáveis **opcionais** novas: `INVITE_MIN_INTERVAL_MINUTES` (padrão 10) e `INVITE_DAILY_BUDGET` (padrão 80); sem elas, valem os padrões.
- Passos do dono (🧑): aplicar a migração no SQL Editor (mesmo banco para prévia e produção, como nas anteriores); conferir em Resend > Settings > Usage o limite diário real; conferir o plano do Worker em Cloudflare > Workers & Pages > Plans; decidir o texto jurídico do e-mail.
- Limites que importam: Resend gratuito 100 e-mails por dia e 3.000 por mês (página de preços, a confirmar na conta); Worker Free 50 chamadas externas e 10 ms de CPU por requisição, pago 10.000 e 30 s (documentação, 12/11/2026).

### Riscos técnicos e premissas
- P1 e P2 não confirmadas (acima); se o Worker for pago ou o Resend Pro, só sobra folga.
- O painel precisa conviver com dois modos de dados (cliente Supabase autenticado vs servidor por token): se o acoplamento ficar grande, a T-52 entrega o painel com propriedades e a T-53 liga o modo do cliente.
- `Idempotency-Key` do Resend vale 24 h: reenvio explícito depois disso usa lote novo (chave nova).
- Entrega do e-mail não é prova de leitura; o painel diz `enviado`, não `lido`.

### Fora de escopo (técnico)
Fila externa, Queues, tabela de bloqueio e descadastro (EV-04), limpeza automática (EV-05), WhatsApp Business Platform (EV-03), migração de convites antigos (não existem).

## Decisões registradas

- **01/10/2026 — Domínio canônico e subdomínio de e-mail:** O endereço canônico do app passa a ser `https://inscricoes.corretime.com.br` e o subdomínio de envio de e-mail passa a ser `envio.corretime.com.br` (remetente `inscricoes@envio.corretime.com.br`). O endereço antigo (`inscricoes.triadetecnologiaesolucoes.com.br`) continua ligado ao mesmo Worker só para links de teste já emitidos; nenhum link novo o usa.
