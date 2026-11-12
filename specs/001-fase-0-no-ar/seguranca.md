# Revisão de Segurança — Spec 001 (Fase 0): Form Builder Pro

> **Documento:** Revisão de Segurança de Aplicação (AppSec) acoplada ao `plan.md`  
> **Referência estrutural:** OWASP Top 10:2025  
> **Status:** Incorporado aos documentos da Spec 001 — nenhum código alterado  
> **Escopo avaliado:** `spec.md`, `plan.md`, `data-model.md`, `tasks.md`, `ui-ux.md` e código real existente  

---

## 1. Resumo Executivo

A arquitetura proposta para a Fase 0 do Form Builder Pro é **notavelmente enxuta e segura por padrão** em seus pilares estruturais mais sensíveis:
1. **Regras atômicas no banco:** Limite de vagas, CPF único e consentimento LGPD são executados em transação única com `FOR UPDATE` via função `SECURITY DEFINER` com `SET search_path = public`, eliminando condições de corrida (*race conditions*).
2. **Privilégio mínimo rigoroso:** Permissões públicas de leitura direta em `forms` e `questions` foram revogadas (`REVOKE SELECT ... FROM anon`). As funções `submit_response` e `update_response` são inacessíveis para `anon` e `authenticated`, podendo ser executadas exclusivamente pelo backend via `service_role`.
3. **Isolamento de credenciais:** Nenhuma chave privada ou de serviço está presente no repositório ou no histórico do Git. Chaves do Supabase no repositório são estritamente públicas (`anon/publishable`).
4. **Proteção de dados pessoais (LGPD):** O CPF e o RG nunca trafegam completos em mensagens de e-mail (função `hideDocument` exibindo apenas os 2 dígitos finais). Textos de participantes passam por `escapeHtml`.

Foram identificados **9 pontos de atenção**, classificados estritamente conforme o escopo da Fase 0 (40 a 60 inscrições, 1 único administrador, formulários públicos em subdomínio próprio):
- **0 itens Bloqueantes (A):** Nenhuma falha estrutural impede o início do desenvolvimento dentro das premissas declaradas.
- **6 itens Recomendados para a Fase 0 e baratos (B):** Medidas preventivas de baixo custo e alta eficácia (SEC-01: política `no-referrer` + `noindex, nofollow` em `/editar/{token}`; SEC-02: limite de 200 chaves no payload JSON; SEC-03: higienização de logs do servidor; SEC-04: proteção contra bombardeio de e-mails na edição em loop com janela de 10 min e cota de vagas; SEC-05: política de senha forte no Supabase Auth sem validação restritiva em tela; SEC-09: validação estrita de destinatário com `isSafeRecipient`).
- **3 itens para a Fase 1 (C):** Risco aceito da biblioteca `xlsx 0.18.5` (que apenas gera planilhas e não lê arquivos externos), enumeração de CPF (inerente à regra de negócio aprovada) e expiração temporal dedicada do link de edição.

---

## 2. Tabela de Achados de Segurança

| ID | Categoria OWASP:2025 | Classificação | Severidade | Cenário de Ataque (1 frase) | Correção Concreta e Mínima |
|---|---|---|---|---|---|
| **SEC-01** | A01 / A04 (Controle de Acesso / Criptografia) | **(B) Recomendado Fase 0** | Média | O logotipo do tema aponta para uma URL externa configurada pelo admin; ao abrir `/editar/{token}`, navegadores sem `no-referrer` podem vazar o token de edição no cabeçalho `Referer` ao carregar a imagem externa. | No `<head>` de `/editar/{token}`, definir `referrer=no-referrer` e robots `noindex, nofollow` (em `$slug.tsx` e `editar.$token.tsx`). |
| **SEC-02** | A05 / A10 (Injeção / Condições Excepcionais) | **(B) Recomendado Fase 0** | Média | Um atacante envia um JSON malicioso contendo milhares de chaves arbitrárias no campo `answers`, consumindo CPU no Worker e provocando estouro do limite de 10ms (erro 1102 da Cloudflare). | No schema Zod de submissão (`submitSchema` em `public-forms.functions.ts`), limitar o número máximo de chaves do objeto `answers` para no máximo 200 chaves (`.refine(obj => Object.keys(obj).length <= 200)`). |
| **SEC-03** | A09 (Falhas de Log e Auditoria) | **(B) Recomendado Fase 0** | Média | Uma falha não tratada na gravação da resposta faz o middleware capturar o erro e serializar o objeto com CPF e respostas no log do Cloudflare Workers, expondo dados pessoais da LGPD. | Na task T-09, assegurar que logs de erro registrem apenas código/mensagem da falha e ID do formulário, nunca o objeto `answers` ou CPF (inclusive em `console.error` de `start.ts` e `client.server.ts`). |
| **SEC-04** | A06 / A10 (Design Inseguro / Abuso de Recursos) | **(B) Recomendado Fase 0** | Média | Um atacante inscreve o e-mail de uma vítima, recebe o link de edição na tela e edita repetidamente em loop, bombardeando a vítima de e-mails e esgotando a cota diária de 100 envios do Resend. | Reenviar e-mail de confirmação após edição no máximo 1 vez a cada 10 minutos por inscrição, verificando o `updated_at` antes de chamar `update_response` (a edição salva normalmente, `emailSent: false`); e adotar a regra operacional de que todo formulário deve ter limite de vagas. |
| **SEC-05** | A07 (Falhas de Autenticação) | **(B) Recomendado Fase 0** | Baixa | O administrador define uma senha fraca de 6 dígitos ao criar a conta no Supabase, ou fica trancado para fora se o frontend aplicar restrições arbitrárias de `minLength` no login. | Definir a política de senha mínima (12 caracteres + complexidade) diretamente nas configurações de Auth do Supabase e usar senha longa na T-02; na tela de login (`auth.tsx`), apenas remover `minLength` e o placeholder "Mínimo de 6 caracteres". |
| **SEC-06** | A03 (Cadeia de Suprimentos) | **(C) Fase 1** | Baixa | Um atacante explora falha de Prototype Pollution ou ReDoS na biblioteca `xlsx 0.18.5` através do upload de um arquivo XLSX malformado. | **Risco Aceito:** O projeto só utiliza a biblioteca para GERAR planilhas limpas a partir de JSON e nunca para ler arquivos enviados. Na Fase 1, substituir por `exceljs` ou CSV nativo. |
| **SEC-07** | A06 (Enumeração de Dados Pessoais) | **(C) Fase 1** | Baixa | Um terceiro testa CPFs no formulário para descobrir se determinadas pessoas estão inscritas no evento através do retorno "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador.". | **Risco Aceito:** Inerente à regra de negócio da Fase 0 (RF-03) para permitir que o usuário saiba que deve usar o link de edição. Na Fase 1, avaliar rate-limiting por IP na Cloudflare. |
| **SEC-08** | A01 / A07 (Gestão de Sessão e Tokens) | **(C) Fase 1** | Baixa | Um participante retém o link de edição permanentemente e, caso o organizador reabra o formulário meses depois para outro evento, o token antigo permite alterar a resposta histórica. | **Risco Aceito:** O banco já bloqueia edições com status diferente de `published` ou prazo vencido. Na Fase 1, adicionar data de expiração própria (`edit_token_expires_at`) e botão de revogação. |
| **SEC-09** | A05 / A06 (Injeção em Destinatário / Relay) | **(B) Recomendado Fase 0** | Média | A validação básica `isValidEmail` aceita listas de e-mails ou caracteres de cabeçalho (ex.: `a@b.com,c.com` ou `x<y@z.com>`), permitindo envio múltiplo ou comportamento anômalo no provedor de e-mail. | Criar função `isSafeRecipient(email)` em `confirmation-email.ts` que rejeita expressamente caracteres de separação e controle (`, ; < > "` e espaços) antes de despachar a chamada para a API do Resend. |
| **SEC-10** | A05 | **(B) Recomendado Fase 0** | Baixa | Um pedido com cabeçalho Host forjado como localhost faria o link de edição do e-mail apontar para localhost, inutilizando o link de quem se inscreveu. | Remover `http://localhost:8080` de `ALLOWED_ORIGINS` (o desenvolvimento local não tem chaves, então não envia inscrições). | T-09 (ajuste) |
| **SEC-11** | A04 | **(B) Recomendado Fase 0** | Baixa | Um participante envia, numa pergunta de escolha, um valor fora da lista de opções e ele é gravado. | Validar no servidor que o valor pertence às `options` da pergunta, na inscrição e na edição (mesma função nas duas). | T-09 (ajuste) e T-11 |
| **SEC-12** | A04 | **(B) Recomendado Fase 0** | Baixa | Uma requisição forjada envia uma lista no lugar do texto no CPF e derruba a função com exceção (erro 500), ou grava lista em campo de e-mail ou texto. | Aceitar lista somente em perguntas `multi_choice`; qualquer outro tipo com lista devolve erro genérico, sem lançar exceção. | T-09 (ajuste) e T-11 |
| **SEC-13** | A09 | **(B) Recomendado Fase 0** | Baixa | Uma falha de rede ou do banco lança exceção não tratada e a mensagem original da falha sobe para o navegador e para o log da plataforma. | Capturar a exceção, devolver erro genérico e registrar só o código `EXCEPTION` e o ID do formulário. | T-09 (ajuste) e T-11 |
| **SEC-14** | A04 | **(B) Recomendado Fase 0** | Baixa | A função de validação reutilizada pela edição (T-11), chamada sem o schema da inscrição, aceitaria números, objetos e booleanos em perguntas de texto e os gravaria como estão. | `validateAndCleanAnswers` rejeita qualquer valor que não seja texto ou lista de textos (erro genérico, sem lançar exceção), para não depender do schema de quem a chama. | T-09 (ajuste 2) e T-11 |
| **SEC-15** | A05 | **(B) Recomendado Fase 0** | Baixa | Ao abrir um formulário cujo logotipo é hospedado em outro site, o navegador informa o endereço da página ao servidor da imagem. | `referrerPolicy="no-referrer"` no `<img>` do logotipo (o IP do visitante continua visível ao servidor da imagem, o que é inerente a imagem externa e fica aceito). | T-10 (ajuste) |
| **SEC-16** | A10 | **(B) Recomendado Fase 0** | Baixa | Se o formulário muda depois que a pessoa abriu a página (por exemplo, uma pergunta obrigatória nova), o servidor recusa a inscrição com o erro de um campo que a página não conhece e a pessoa não vê nenhuma mensagem. | Quando o servidor devolver um campo desconhecido, mostrar a mensagem no alerta geral e recarregar o formulário. | T-10 (ajuste 2) |
| **SEC-17** | A01 | **(B) Recomendado Fase 0** | Baixa | Um link de edição encaminhado ou vazado mostraria o CPF completo de quem se inscreveu na página de edição. | A página de edição recebe o CPF MASCARADO (`***.***.***-25`); o servidor guarda o CPF original e ignora qualquer CPF enviado pelo navegador. | T-11 |
| **SEC-18** | A09 | **(B) Recomendado Fase 0** | Baixa | Funções de servidor em GET colocam os dados na URL da chamada, e o token de edição pararia em logs e caches. | As duas funções da edição usam `method: "POST"`; o token nunca vai na URL de uma chamada. | T-11 |
| **SEC-19** | A09 | **(B) Recomendado Fase 0** | Baixa | Uma falha do banco ou da rede nas leituras e na gravação é tratada como "não encontrado" (a pessoa vê "Formulário não encontrado" ou "Inscrição não encontrada" por um erro passageiro) ou sobe como exceção com a mensagem original. | Os carregamentos lançam um erro genérico quando o banco devolve erro; as funções capturam, registram só `EXCEPTION` e o ID, e as telas mostram "Não foi possível carregar" ou "Não foi possível salvar" com "Tentar de novo". | T-11 (ajuste), também em `getPublicForm` e no carregamento da inscrição |
| **SEC-20** | A01 | **(B) Recomendado Fase 0** | Baixa | O CPF completo volta ao navegador, na leitura da edição, quando a pergunta de CPF foi apagada ou teve o tipo alterado pelo organizador. | Devolver só respostas de perguntas que existem e mascarar qualquer valor cujos dígitos sejam iguais ao CPF guardado (`identifier`), seja qual for o tipo da pergunta. | T-11 (ajuste) |
| **SEC-21** | A04 | **(B) Recomendado Fase 0** | Baixa | Se o organizador mudou o tipo da pergunta de CPF para texto e a pessoa salva a edição sem mexer, o valor mascarado (`***.***.***-25`) volta ao servidor e sobrescreve o CPF guardado. | Na atualização, toda pergunta cuja resposta GUARDADA tem os mesmos dígitos do `identifier` é tratada como o CPF, qualquer que seja o tipo atual: o valor enviado pelo navegador é ignorado e vale o guardado. | T-11 (ajuste 2) |
| **SEC-22** | A01 / A04 / A09 | **(B) Recomendado Fase 0** | Média | Nova rota de gravação do administrador (`adminUpdateResponse` e `resendEditLink`) poderia permitir acesso indevido ou vazamento de dados se não validar dono e dados. | Dono verificado estritamente no servidor via middleware de autenticação (nunca aceita id do cliente); erro genérico de "não encontrado" sem revelar existência caso não exista ou pertença a outro dono; funções com `method: "POST"`; atualização de `answers` sem migração e sem tocar em campos sensíveis (`identifier`, `edit_token`, `submitted_at`, `consented_at`); nenhum dado pessoal (e-mail ou CPF) registrado em logs. | T-23 |
| **SEC-23** | A06 / A10 | **(C) Fase 1** | Baixa | Reenvio de e-mail com o link de edição não possui limitação persistente no banco de dados, podendo consumir cota de e-mails em caso de disparos repetidos. | **Risco Aceito:** A ação é exclusiva do dono autenticado do formulário no painel (não acessível ao público). Na interface, o botão é desativado por 60 segundos após cada clique para prevenir disparos acidentais em sequência. | T-23 |
| **SEC-24** | A01 / A04 | **(B) Recomendado Fase 0** | Média | Um terceiro não autorizado deduz ou acessa tokens de compartilhamento para obter respostas e dados pessoais (incluindo CPF completo). | Token de 256 bits (64 hex minúsculos gerados via `crypto.getRandomValues`); erro genérico idêntico (`not_found`) para token inválido, desconhecido, revogado ou regenerado (sem tocar o banco quando o token é malformado); consulta restrita com lista explícita de colunas (nunca `SELECT *`); exclusão rigorosa de colunas sensíveis (`edit_token`, `identifier`, `consented_at`, `share_token`, `owner_id`); cabeçalhos `noindex, nofollow` e `no-referrer` na rota `/c/$token`; respostas carregadas sob demanda via POST (sem dados no HTML inicial). | T-25 |
| **SEC-25** | A01 / A06 | **(C) Fase 1** | Baixa | Link do cliente permanente sem prazo de expiração automático e sem limite de acessos por IP. | **Risco Aceito por decisão do dono:** O token de 256 bits é matematicamente imune à força bruta; o administrador tem controle total para regenerar ou revogar o link a qualquer momento no editor; na Fase 1, avaliar rate-limiting e expiração automática. | T-25 |
| **SEC-26** | A03 / A05 | **(C) Informativo** | Baixa | Possível injeção de fórmulas CSV/Excel (CSV Injection) em respostas que começam com `=`, `+`, `-` ou `@`. | **Verificado / Risco Aceito:** Respostas começadas por `=`, `+`, `-` ou `@` saem como texto no `.xlsx` gerado (verificado via teste de regressão em `src/lib/exports.test.ts`: cada célula possui tipo texto `t === 's'` e não tem a propriedade `f`); NÃO aplicar prefixo de aspa, que alteraria os dados (por exemplo um telefone `+55...`). | T-37 |
| **SEC-27** | A01 (Controle de Acesso) | **(C) Informativo** | Baixa | Duplicação de formulário por usuário não autorizado ou vazamento de respostas no clone. | **Informativo / Seguro por Padrão:** A duplicação é feita no navegador com o cliente autenticado, onde só o dono lê e grava (regras de acesso do banco / RLS); não copia respostas, nem link do cliente (`share_token`), nem prazo (`closes_at`), e não há função de servidor nova. | T-41 |
| **SEC-28** | A01 / A05 | **(C) Informativo** | Baixa | Abertura de conversa no WhatsApp a partir do painel. | **Informativo / Seguro por Padrão:** O botão só existe na tela do administrador; o link usa `rel="noopener noreferrer"` para não enviar o endereço do painel ao WhatsApp; o número do inscrito é enviado ao WhatsApp apenas quando o administrador clica; nenhuma mensagem é enviada automaticamente. | T-43 |
| **SEC-29** | A05 / A10 (Abuso de Recursos / Perda de Dados) | **(B) Recomendado Fase 0** | Alta | Honeypot preenchido acidentalmente por autofill do navegador descartava silenciosamente a submissão retornando falso sucesso, causando perda de inscrição legítima. | Renomear campo para nome opaco (`zq_trap_7f3`), adicionar atributos anti-autofill (`autoComplete="off"`, `data-lpignore="true"`, `data-1p-ignore="true"`, `data-form-type="other"`, etc.), devolver erro recuperável (`ok: false` com "Não foi possível enviar. Recarregue a página e tente novamente."), limpar `hp` no cliente em caso de erro mantendo respostas digitadas, e registrar log de erro de servidor apenas com código `HONEYPOT` e slug/ID do formulário sem dados pessoais (SEC-03). | T-24d |
| **SEC-30** | A01 / A04 (Controle de Acesso / Design Inseguro) | **(B) Recomendado Fase 0** | Alta | O organizador ou cliente confunde o link privado de acompanhamento (`/c/<token>`) com o link público de inscrição e o compartilha em grupo, expondo CPF, RG, telefone e e-mail dos inscritos. | Exigir código de acesso de 10 caracteres gerado pelo sistema (`crypto.getRandomValues` no alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) para todo link criado ou regenerado; sem sessão válida, `getSharedResponses` retorna `{ state: "locked" }` sem título, perguntas ou respostas; diferenciar claramente no painel `Link público de inscrição` e `Link privado do cliente` (com alerta âmbar e aviso ao copiar). | T-44 |
| **SEC-31** | A07 (Falhas de Identificação e Autenticação) | **(B) Recomendado Fase 0** | Média | Um terceiro que obteve a URL `/c/<token>` tenta adivinhar o código de acesso por força bruta automatizada. | Comparação do hash SHA-256 com sal de 16 bytes em tempo constante; registrar falhas em `forms.share_failed_attempts` e, ao atingir 5 erros consecutivos, bloquear por 15 minutos (`share_locked_until`), retornando `{ state: "locked_out" }` mesmo que o código correto seja enviado durante o bloqueio. | T-44 |
| **SEC-32** | A02 / A09 (Criptografia / Falhas de Log e Auditoria) | **(B) Recomendado Fase 0** | Média | Armazenamento do código de acesso em texto puro no banco ou vazamento do código, do `share_token` completo ou do cookie de sessão em logs de erro do Worker. | Nunca persistir o código em texto puro (gravar apenas `share_code_hash` e `share_code_salt`); exibir o código uma única vez na resposta de geração/regeneração; proibir que `console.error`/`logError` incluam token completo, código ou cookie (registrar apenas código de erro e `formId`). | T-44 |
| **SEC-33** | A01 / A05 (Gestão de Sessão e Configuração) | **(B) Recomendado Fase 0** | Média | Cookie de sessão do link compartilhado interceptável via script (XSS), enviado em canal inseguro ou omitido nas chamadas RPC em `/_serverFn/...` caso use caminho restrito `/c/<token>`. | Emitir cookie nomeado por formulário (`fbp_share_<16 hex do SHA-256 do token>`) assinado com HMAC-SHA256 contendo `{ f: formId, v: share_code_version, exp }`, com flags `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` e `Max-Age` até `expiraEm`, validando assinatura em tempo constante, ID do formulário, versão e expiração no servidor. | T-44 |
| **SEC-34** | A01 / A07 (Invalidação de Sessão) | **(B) Recomendado Fase 0** | Média | Após vazamento do código de acesso, usuários que já desbloquearam o link continuariam acessando as respostas pela sessão antiga mesmo depois de o administrador trocar o código. | Incrementar `share_code_version` a cada criação, regeneração de código (`regenerateAccessCode`), regeneração de link ou desativação (`revokeShareLink`); `getSharedResponses` rejeita qualquer cookie cuja versão `v` divirja de `forms.share_code_version`, retornando `{ state: "locked" }`. | T-44 |
| **SEC-35** | A07 (Gestão de Sessão) | **(C) Risco Aceito** | Baixa | A validade da sessão de 30 dias após a data de fechamento do formulário (`max(closes_at, agora) + 30 dias`) mantém o acesso aberto caso o cliente utilize um computador público ou compartilhado. | **Risco Aceito por decisão do dono:** Prioriza a praticidade para o cliente acompanhar o evento sem redigitar o código diariamente; o administrador pode invalidar todas as sessões imediatamente no painel clicando em `"Gerar novo código"` ou `"Desativar link"`. | T-44 |
| **SEC-36** | A02 / A05 (Gestão de Segredos) | **(B) Recomendado Fase 0** | Média | Ausência ou comprometimento do segredo de assinatura de sessão `SHARE_SESSION_SECRET` no ambiente do Worker. | Ler `SHARE_SESSION_SECRET` exclusivamente de `process.env` (cadastrado como Secret no Cloudflare em produção e prévia); se ausente, `unlockSharedLink` falha de forma segura (não emite cookie e retorna erro genérico) registrando log sem dados sensíveis; a rotação do segredo invalida imediatamente todas as sessões ativas. | T-44 |

---

## 3. Resultado das Auditorias Automatizadas

### 3.1 Auditoria de Dependências (`npm audit`)
- **Execução:** Realizada em ambiente de isolamento (`scratch`) sem alterar nenhum arquivo do repositório ou o `bun.lock`.
- **Resultado:** 1 vulnerabilidade de alta gravidade identificada:
  - **Pacote:** `xlsx` (versão instalada: `0.18.5`).
  - **Advisories:** [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (Prototype Pollution) e [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) (ReDoS).
  - **Avaliação de Risco:** **Nulo para a Fase 0.** As falhas conhecidas de `xlsx` ocorrem exclusivamente no *parser* de arquivos não confiáveis recebidos de usuários (`XLSX.read`/`XLSX.readFile`). O Form Builder Pro apenas invoca `XLSX.utils.book_new()`, `aoa_to_sheet()` e `writeFile()` para gerar saídas na máquina do administrador. Não há funcionalidade de importação de planilhas no produto.

### 3.2 Varredura de Segredos no Código e Histórico (`git log` e varredura estática)
- **Execução:** Varredura em todo o histórico do Git procurando padrões de chaves secretas do Supabase (`sb_secret_`, JWTs de serviço com `service_role`) e chaves de API do Resend (`re_[A-Za-z0-9]`).
- **Resultado:** **Nenhum segredo vazado.**
  - O arquivo `.env` versionado contém exclusivamente: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (chaves de escopo público do Supabase, destinadas ao navegador).
  - O arquivo `.gitignore` já inclui `.dev.vars` (onde ficarão as variáveis locais do Worker).
  - A chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`) e as credenciais do Resend (`RESEND_API_KEY`) nunca foram commitadas no repositório.

---

## 4. Análise Específica das Superfícies da Feature

### 4.1 Token de Edição (`/editar/{token}`)
- **Entropia e Geração:** O token é gerado no banco com `replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`, totalizando 64 caracteres hexadecimais com 244 bits de entropia aleatória. É imune a adivinhação ou força bruta.
- **Armazenamento em texto puro:** O token é armazenado em texto claro na tabela `responses.edit_token`. Isso é uma decisão pragmática decorrente do requisito RF-07 ("Administrador copia o link de edição"). Se o token fosse armazenado como hash (como em senhas), o administrador não conseguiria recuperá-lo para retransmitir ao participante que perdeu o e-mail. Como o banco de dados é de uso exclusivo do administrador único e as políticas de RLS impedem leitura anônima, a decisão é aceitável para a Fase 0.
- **Restrição de Privilégios do Token:**
  - O token permite **apenas** ler as respostas associadas a ele e atualizar essas respostas.
  - O banco impede a troca do CPF (`r.identifier IS DISTINCT FROM p_identifier` retorna `identifier_locked`).
  - O banco rejeita alterações se o formulário estiver fechado ou com prazo vencido (`status <> 'published' OR closes_at < now()`).
  - O token **não** permite deletar a inscrição, não permite ver outras inscrições e não permite criar novas vagas.
- **Vazamento via Referer e Indexação:** O logotipo do formulário é uma URL externa configurável. Para garantir que o token na URL não seja vazado para domínios externos de imagem nem indexado por buscadores, a rota `/editar/{token}` deve incluir meta tags `referrer=no-referrer` e `robots=noindex, nofollow` (SEC-01).

### 4.2 Funções do Banco (`submit_response` e `update_response`)
- **Segurança da Definição:** As duas funções usam `SECURITY DEFINER` e fixam `SET search_path = public`. Isso previne a criação de esquemas maliciosos ou sequestro de busca de operadores/tabelas.
- **Permissões (Grants):**
  - `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;`
  - `GRANT EXECUTE ON FUNCTION ... TO service_role;`
  Isso garante que nenhum invasor com cliente PostgREST possa chamar essas funções diretamente com tokens anônimos ou de usuário. Apenas o backend do TanStack Start no Cloudflare Worker (portador da `service_role`) tem autorização para dispará-las.
- **Concorrência e Vagas:** A linha do formulário é bloqueada com `SELECT * FROM forms WHERE slug = p_slug FOR UPDATE;`, garantindo a serialização exata dos envios e impedindo qualquer condição de corrida em vagas e CPF único.

### 4.3 Uso da Chave de Serviço no Servidor
- A chave de serviço (`supabaseAdmin`) só é importada dinamicamente dentro de funções executadas no servidor (`client.server.ts`), não sendo empacotada no bundle do cliente.
- As chamadas de cliente para servidor utilizam `createServerFn` do TanStack Start, que em `src/start.ts` conta com o `csrfMiddleware` ativado para bloquear requisições forjadas entre sites.

### 4.4 Proteção de Dados Pessoais (CPF, RG e LGPD)
- **E-mails:** A função `hideDocument` substitui os dígitos iniciais de CPF e RG por asteriscos, exibindo apenas o sufixo (ex.: `***.***.***-25`).
- **Sanitização:** Todo texto submetido passa por `escapeHtml` antes de ser inserido no template HTML do e-mail, neutralizando qualquer tentativa de injeção de tags ou scripts no cliente de e-mail do participante.
- **Consentimento:** O timestamp do aceite é gravado atomicamente em `responses.consented_at` apenas quando o formulário possui `consent_text` cadastrado.

### 4.5 Autenticação do Administrador
- O sistema é de administrador único. Na task T-02, novos cadastros são desativados no console do Supabase (`disable signup`).
- A política de complexidade de senha (mínimo 12 caracteres e regras de complexidade) deve ser configurada diretamente no painel do Supabase Auth (T-02).
- Na tela `/auth`, foram eliminados o fluxo de cadastro e o botão do Google OAuth, e removidos o `minLength={6}` e o placeholder restritivo do campo de senha (T-07). A verificação via cURL prevista em T-02 assegura que qualquer chamada direta para a rota de signup da API do Supabase seja rejeitada com erro 4xx.

---

## 5. Propostas de Mudança nos Documentos da Spec (Incorporadas)

As propostas de segurança detalhadas abaixo foram integradas aos documentos do projeto:

### 5.1 No `spec.md`
- **RF-06:** Acrescentada a regra de que o e-mail após edição é enviado no máximo 1 vez a cada 10 minutos por inscrição; a edição é salva normalmente mesmo quando o e-mail não é enviado.

### 5.2 No `plan.md`
- **Nova seção "Decisões de segurança":**
  1. `referrer: no-referrer` e `robots: noindex, nofollow` em `/editar/$token`.
  2. Higiene de logs: nunca registrar o objeto `answers`, apenas código do erro e ID do formulário (inclusive nos `console.error` de `start.ts`/`client.server.ts` decorrentes da inscrição).
  3. Limite de 200 chaves no campo `answers` no schema Zod de submissão.
  4. Limite de e-mail por edição (janela de 10 min baseada no `updated_at` anterior).
  5. Função `isSafeRecipient` rejeitando caracteres `, ; < > "` e espaços antes do envio.
  6. Política de senha forte no Supabase Auth.

### 5.3 No `tasks.md`
- **T-02:** Configurar política de senha forte (mínimo 12 caracteres + complexidade) no painel do Supabase Auth e anotar no relatório que a opção está ativa.
- **T-06 e T-11:** No head da rota `/editar/$token`, incluir meta tags `referrer=no-referrer` e `robots=noindex, nofollow`, com verificação via cURL em T-11.
- **T-07:** Remover `minLength` e o placeholder "Mínimo de 6 caracteres" do campo de senha no login de `auth.tsx`.
- **T-08:** Implementar `isSafeRecipient` com testes unitários para aceitar e-mails limpos e rejeitar listas ou caracteres maliciosos.
- **T-09:** Exportar schema Zod com limite de 200 chaves em `answers` com testes (3 ok, 201 rejeitado) e teste de higienização de logs.
- **T-11:** Implementar limite de 10 minutos para reenvio de e-mail na edição com testes via `fetchFn` simulado e relógio injetado.
- **T-14:** Registrar como premissa operacional que todo formulário publicado deve ter limite de vagas definido.

---

## 6. Checklist de Revisão Sem Código (Perguntas Diretas)

Copie e cole estas perguntas diretamente no prompt do seu assistente de IA durante ou após a implementação para validar se as defesas de segurança estão ativas no código real, sem precisar interpretar arquivos:

1. **Sobre o Token de Edição, Referer e Indexação:**
   > *"Abra o arquivo `src/routes/editar.$token.tsx`. A meta tag de `referrer` está configurada como `no-referrer` e a meta tag de `robots` está configurada como `noindex, nofollow` para impedir que o token da URL seja enviado a servidores externos ou indexado por buscadores?"*
   - ✅ **Resposta segura:** "Sim, a propriedade referrer está como no-referrer e robots como noindex, nofollow no head da rota /editar/$token."
   - 🚩 **Alerta:** "Não encontrei essas meta tags configuradas no arquivo."

2. **Sobre Chaves Secretas e Variáveis:**
   > *"No repositório do Git, alguma ocorrência de `SUPABASE_SERVICE_ROLE_KEY` ou `RESEND_API_KEY` tem o valor da chave escrito diretamente no código ou no arquivo `.env`?"*
   - ✅ **Resposta segura:** "Não. Todas são lidas de `process.env` no servidor e o `.env` possui somente a URL e a chave pública anon/publishable."
   - 🚩 **Alerta:** "Encontrei um valor de chave atribuído diretamente em um arquivo do projeto."

3. **Sobre Permissões do Banco de Dados:**
   > *"Na migração SQL da Fase 0, as funções `submit_response` e `update_response` possuem `REVOKE ALL ... FROM anon, authenticated` e `GRANT EXECUTE ... TO service_role`?"*
   - ✅ **Resposta segura:** "Sim, as permissões para anon e authenticated foram revogadas e apenas a role service_role tem permissão de execução."
   - 🚩 **Alerta:** "As funções ainda estão liberadas para PUBLIC ou anon."

4. **Sobre Exposição de CPF e RG em E-mails:**
   > *"No arquivo de envio de e-mail (`src/lib/confirmation-email.ts`), os valores de CPF e RG são tratados com a função `hideDocument` antes de serem interpolados no template?"*
   - ✅ **Resposta segura:** "Sim, todos os campos de CPF e RG passam por `hideDocument` exibindo apenas os últimos dígitos, e todos os textos passam por `escapeHtml`."
   - 🚩 **Alerta:** "Os valores de CPF ou RG são enviados completos no corpo do e-mail."

5. **Sobre Bloqueio de Cadastro Público e Campo de Senha:**
   > *"Na tela `src/routes/auth.tsx`, os botões de cadastro e Google foram removidos, e o campo de senha está sem restrição de `minLength` no formulário?"*
   - ✅ **Resposta segura:** "Sim, não há botões de cadastro nem Google, e o campo de senha não impõe minLength no HTML."
   - 🚩 **Alerta:** "Ainda existe a opção 'Criar conta' ou o campo de senha impõe restrição em tela."

6. **Sobre Proteção Contra Bombardeio de E-mails na Edição:**
   > *"Na função de edição (`updateResponseByToken`), existe a regra de que o e-mail de confirmação só é reenviado se tiverem passado mais de 10 minutos desde o último `updated_at` da inscrição?"*
   - ✅ **Resposta segura:** "Sim, se a edição ocorrer dentro de 10 minutos do updated_at anterior, a alteração é salva mas nenhum e-mail é disparado, retornando emailSent: false."
   - 🚩 **Alerta:** "Todo salvamento de edição dispara um novo e-mail imediatamente sem limite de tempo."

7. **Sobre Logs de Erro com Dados Pessoais:**
   > *"No manipulador de submissão do formulário (`src/lib/public-forms.functions.ts`), se ocorrer um erro na chamada ao banco, o payload de respostas do usuário é enviado para o `console.error`?"*
   - ✅ **Resposta segura:** "Não, apenas a mensagem técnica de erro e o ID do formulário são logados, sem imprimir o objeto answers ou o CPF."
   - 🚩 **Alerta:** "O objeto `data` ou `data.answers` completo é impresso no log de erro."

8. **Sobre Validação Estrita do Destinatário de E-mail:**
   > *"Antes de chamar a API do Resend, a função `isSafeRecipient` confere se o endereço de e-mail contém vírgulas, ponto-e-vírgula ou caracteres de controle?"*
   - ✅ **Resposta segura:** "Sim, a função isSafeRecipient rejeita e-mails com caracteres como vírgula, ponto-e-vírgula, colchetes angulares ou aspas antes de enviar."
   - 🚩 **Alerta:** "O endereço é passado diretamente para o Resend apenas com a validação padrão de e-mail."

---

## 7. Nota Informativa de Segurança — T-24c (Data do Evento e Limites de Idade)

- **Dados Públicos e Ausência de Dados Pessoais:** As colunas `event_date`, `event_time`, `event_location` na tabela `forms` e `settings` na tabela `questions` constituem metadados de configuração pública do formulário e não armazenam dados pessoais de participantes.
- **Migração Aditiva e RLS Existente:** A migração adiciona apenas colunas com valores anuláveis ou padrão (`DEFAULT '{}'::jsonb`), sendo 100% aditiva e retrocompatível. As políticas de segurança em nível de linha (RLS) existentes já cobrem as novas colunas sem necessidade de novas políticas ou privilégios adicionais.
- **Validação de Negócio no Servidor:** A regra de idade é executada e conferida no servidor em todos os três caminhos de gravação (inscrição pública via `submit-response`, edição pelo link via `edit-response` e edição administrativa pelo painel via `admin-response.functions`).
- **Preservação de Inscrições Existentes:** Na edição de inscrições já gravadas, o limite etário só é exigido caso a data de nascimento seja efetivamente alterada em relação ao valor anteriormente gravado (`previousAnswers`), prevenindo invalidação indevida de cadastros prévios por alterações em outros campos.

---

## 8. Nota de Segurança — T-24d (Honeypot Seguro contra Perda de Inscrição)

- **Causa Raiz do Incidente:** O campo honeypot anti-robô (`hp`), anteriormente renderizado com `name="hp"` e sem atributos anti-autofill exaustivos, vinha sendo capturado e preenchido inadvertidamente por extensões e gerenciadores de preenchimento automático de navegadores (Chrome Autofill, gerenciadores de senhas). Como a implementação retornava falsamente `{ ok: true, emailSent: false }` sem gravar no banco de dados e sem gerar token de edição, o participante legítimo recebia tela de "sucesso", porém a inscrição era perdida silenciosamente.
- **Princípio de Resiliência:** Nenhuma submissão legítima pode ser descartada sem feedback de erro claro e recuperável.
- **Defesas Integradas (SEC-29):**
  1. **Nome Opaco:** O input no DOM passa a utilizar `name="zq_trap_7f3"` e `id="zq_trap_7f3"`, destituído de significado semântico para analisadores heurísticos de formulário.
  2. **Atributos Anti-Preenchimento:** Combinação de `autoComplete="off"`, `data-lpignore="true"` (LastPass), `data-1p-ignore="true"` (1Password), `data-form-type="other"`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`, sem elemento `<label>` associado e estilizado fora da visão do usuário (`aria-hidden="true"`, `tabIndex={-1}`).
  3. **Resposta de Erro Orientada ao Usuário (`HONEYPOT_ERROR_MESSAGE`):** Caso o campo seja enviado preenchido, o servidor devolve explicitamente `{ ok: false, error: "Não foi possível enviar. O seu navegador pode ter preenchido um campo automaticamente. Confira os seus dados e clique em Enviar novamente. Se o erro continuar, apague os campos preenchidos automaticamente e digite as informações você mesmo." }` sem persistir dados no banco e sem induzir o usuário a recarregar a página (o que causaria perda dos dados digitados).
  4. **Preservação de Dados Digitados:** O cliente, ao receber o erro do servidor, exibe a mensagem no alerta superior geral (`role="alert"`) e limpa exclusivamente o estado `hp`, mantendo todas as respostas, confirmações de e-mail e o consentimento preenchidos pelo usuário para que ele possa submeter novamente sem recarregar a página.
  5. **Auditoria Limpa de Logs (SEC-03):** O evento de disparo do honeypot é registrado no servidor com `deps.logError("HONEYPOT", data.slug)` registrando unicamente o código `"HONEYPOT"` e o slug do formulário; o log `HONEYPOT` não contém dados pessoais, CPF, e-mail ou respostas.

---

## 9. Revisão de segurança — M-46 Convite em lote para o grupo do WhatsApp (SEC-37 a SEC-48)

Modo: **desenho** (antes do código). Acréscimo ao `specs/001-fase-0-no-ar/seguranca.md` (continua a numeração a partir de SEC-37). Lidos: `prd-m46-grupo-whatsapp.md`, `ui-ux-m46.md`, `architecture.md` (versão de 12/11/2026: seções 4.3 e 5, ARQ-01 a ARQ-07, ADR-001 a ADR-005). Código medido no commit `524ac2b`.

### 1. Resumo executivo
**Pode ir ao ar só depois de fechar os 4 achados A (SEC-37 a SEC-40).** Os quatro são decisões de projeto baratas, todas já previstas ou propostas na arquitetura; nenhuma é falha do código atual. Totais desta revisão: 4 A, 6 B, 2 C.

Em uma frase por risco:
- Sem as regras certas, qualquer pessoa com um link antigo do cliente poderia mandar e-mail para todos os inscritos em nome da organização (SEC-37).
- Se o campo do link do grupo aceitar qualquer endereço, o envio em massa vira um canal de golpe com a reputação do domínio (SEC-38).
- As tabelas novas precisam nascer fechadas ao acesso direto pelo navegador (SEC-39) e cada ação precisa conferir que o lote pertence ao formulário do usuário (SEC-40).
- O risco de LGPD mais relevante é a finalidade e a forma de sair: o e-mail atual diz "não responda" (SEC-44).

Não rodei: auditoria de dependências (npm audit e similares) e inventário SBOM, porque este ambiente não alcança os registros de pacotes (a instalação de dependências retorna 403). A feature não deve acrescentar dependência (ARQ, checklist item 10), então o risco novo de cadeia de suprimentos é nulo; as dependências atuais seguem sem varredura nova desde a T-44.

### 2. Tabela de achados

Origem: arquitetura (4.3 fronteiras, ARQ, ADR) ou análise de abuso. "Onde aplicar": tarefas ainda não existem (SDD vem a seguir): a definir.

| ID | Categoria | Classe | Severidade | Cenário de ataque (1 frase) | Correção mínima | Onde aplicar |
|---|---|---|---|---|---|---|
| SEC-37 | A01 / ASVS v5.0.0-8.2.1 | **A** | Alta | Quem achou um link de cliente antigo (sem código) usa as novas ações para mandar e-mail a todos os inscritos ou trocar o link do grupo. | Funções de escrita do cliente exigem `share_code_hash` preenchido e sessão válida; link legado só lê (ARQ-03, ADR-004); teste por função | a definir |
| SEC-38 | A05 / A06 / ASVS v5.0.0-1.3.x | **A** | Alta | Alguém com sessão do cliente (ou o próprio cliente por engano) coloca no campo "Link do grupo" um endereço de golpe, que sai em e-mail para dezenas de pessoas a partir de um domínio confiável. | Aceitar só `^https://chat\.whatsapp\.com/[A-Za-z0-9]+$`, até 200 caracteres, sem espaços; rejeitar maiúsculas no host, `@`, `%`, porta, redirecionamento; montar o `href` do e-mail só a partir do valor validado (ARQ-07); texto do e-mail fixo, sem campo livre do cliente | a definir |
| SEC-39 | A01 / A05 / ASVS v5.0.0-8.2.x, 13.x | **A** | Alta | Alguém com a chave pública do banco lê, insere ou altera `invite_batches` e `invite_deliveries`, ou chama `invite_create_batch`, e provoca envios ou apaga o histórico. | Migração com RLS ligado, `REVOKE ALL` das tabelas e da função de `PUBLIC, anon, authenticated`, `GRANT` só a `service_role`; função com `SECURITY DEFINER` apenas se precisar, com `search_path` fixo; teste de banco com a chave pública (ARQ-02, ADR-003) | a definir |
| SEC-40 | A01 / ASVS v5.0.0-8.2.2 | **A** | Alta | Um cliente do link A envia o identificador de lote ou de inscrição de outro formulário e dispara envio ou lê status de outro evento. | Toda função recebe o formulário do contexto autorizado (dono ou token) e confere `batch.form_id` e `delivery.form_id` iguais a ele antes de agir; nunca confiar em id vindo da tela; teste com ids de outro formulário | a definir |
| SEC-41 | A06 / ASVS v5.0.0-2.4.1 | B | Alta | Alguém com acesso válido repete o disparo para esgotar os 100 e-mails por dia do Resend e deixar sem confirmação as inscrições novas de qualquer formulário. | Função SQL atômica: intervalo de 10 min por formulário, orçamento de 80 por 24 h no sistema, reserva de 20 para confirmações, destinatários limitados às inscrições do formulário; "reenviar" exige parâmetro explícito e também entra na conta (ARQ-05, ADR-005) | a definir |
| SEC-42 | A05 / ASVS v5.0.0-1.2.x | B | Média | Um nome de inscrito ou título de formulário com HTML ou quebras de linha altera o corpo ou o assunto do e-mail de convite. | Reusar `escapeHtml`; assunto limitado a 120 caracteres sem caracteres de controle; destinatário só por `isSafeRecipient`; 1 destinatário por item, sem `cc`/`bcc` (RQ-05) | a definir |
| SEC-43 | A05 / ASVS v5.0.0-1.2.x | B | Média | Um nome de inscrito com quebra de linha ou ponto e vírgula injeta campos extras (por exemplo, outro telefone ou endereço) no arquivo .vcf que o cliente importa na agenda. | Gerar o .vcf no navegador a partir dos dados já carregados (sem nova rota); escapar `\`, `;`, `,` e quebra de linha pelo formato vCard; remover caracteres de controle; limitar o nome a 100 caracteres; telefone só do formato normalizado `+55DDDNÚMERO`; nome do arquivo fixo `inscritos.vcf` | a definir |
| SEC-44 | LGPD / A06 | B | Alta | Inscritos recebem mensagem sem entender por quê e sem canal para pedir que parem (o e-mail atual diz "não responda"). | Finalidade registrada (informar sobre o evento em que se inscreveu); texto do e-mail com origem do contato e forma real de pedir descadastro (P-07: `Reply-To` do cliente ou instrução clara); aviso de que o número fica visível no grupo; entregas apagadas com a inscrição (cascata, compatível com a T-42); redação final com o advogado | a definir |
| SEC-45 | A09 / ASVS v5.0.0-16.2.x, 16.5.x | B | Média | Logs de erro do envio gravam e-mail, telefone, token do link ou o link do grupo (quem tiver o link entra no grupo). | Registrar só código de erro, `formId` e `batchId`; nunca endereço, telefone, link do grupo, token, código ou cookie (mesma regra da SEC-32) | a definir |
| SEC-46 | A06 | B | Média | O link do grupo vaza antes da inscrição porque vai no carregamento público do formulário, e atletas falsos ou robôs entram no grupo. | Não incluir `whatsapp_group_link` no que a página pública carrega; devolvê-lo só no retorno da inscrição concluída (e no e-mail); recomendar ao cliente ativar a aprovação de entrada no grupo | a definir |
| SEC-47 | A02 / A06 | C | Baixa | Devoluções e reclamações de spam reduzem a reputação do domínio de envio e prejudicam também as confirmações. | Gatilho EV-04: ao primeiro pedido de descadastro ou reclamação, tabela de bloqueio e link de saída; conferir SPF e DKIM do domínio no Resend (fora do código) | — |
| SEC-48 | A05 | C | Baixa | Um telefone ou nome com caracteres estranhos quebra a mensagem do `wa.me` ou direciona a outra conversa. | Já tratado: `wa.me` só com telefone de `parseBrazilMobile` (11 dígitos validados) e texto com `encodeURIComponent`; abrir em nova aba com `rel="noopener noreferrer"`; telefone não aparece na lista. Verificar por teste | — |

Fronteiras do `architecture.md` 4.3: ver seção 4.3 desta revisão.

### 3. Resultado das auditorias automatizadas

#### 3.1 Dependências vulneráveis
**Não executado.** Este ambiente não alcança os registros de pacotes (instalação retorna 403). A feature não deve acrescentar dependências (checklist item 10: diferença vazia em `package.json` e `bun.lock`). O dono ou o agente deve rodar `bun audit` (ou equivalente) na máquina de desenvolvimento antes de promover.

#### 3.2 Segredos no código e no histórico
Varredura por padrões (chave `re_...` do Resend, JWT `eyJ...`, chave de serviço do Supabase atribuída em texto) sobre os arquivos versionados e sobre o histórico (142 commits) no commit `524ac2b`: **um único resultado**, em `src/lib/submit-response.test.ts` (linha 411), dentro de um teste que simula `readEnv`. Parece valor de teste, não chave real, mas **não foi validado contra o provedor**; o dono deve conferir olhando a linha e, se for uma chave real, revogá-la no Resend. O mesmo texto aparece no histórico em um commit (`81875e6`, T-09). Nenhum outro padrão foi encontrado. Varredura por padrões não é prova de ausência (ferramenta dedicada, como gitleaks, não foi executada).

#### 3.3 Inventário de componentes (SBOM)
**Não gerado** (precisa baixar a ferramenta CycloneDX; sem acesso à rede de pacotes aqui). Gerar na máquina de desenvolvimento quando a M-46 estiver implementada, para registrar que não houve componente novo.

### 4. Análise das superfícies

#### 4.1 Percurso OWASP Top 10:2025
| Categoria | Aplica? | Decisão |
|---|---|---|
| A01 Controle de acesso | Sim, central | SEC-37, 39, 40; teste de autorização por função |
| A02 Configuração incorreta | Sim | SEC-39 (grants), SEC-47 (domínio de e-mail) |
| A03 Cadeia de suprimentos | Pouco | Sem dependência nova; varredura não executada (3.1) |
| A04 Falhas criptográficas | Pouco | Sem cripto nova; sessão e segredo já tratados (SEC-33, SEC-36) |
| A05 Injeção | Sim | SEC-38, 42, 43, 48 |
| A06 Design inseguro | Sim | SEC-41, 44, 46 |
| A07 Autenticação | Reaproveita T-44 | Sessão por fatia reautorizada (ARQ do fluxo 4.2) |
| A08 Integridade | Pouco | Idempotência por fatia (RQ-03) |
| A09 Logs | Sim | SEC-45 |
| A10 Condições excepcionais | Sim | Resposta inesperada do Resend vira "pendente", nunca "enviado" (ADR-002) |

#### 4.2 Superfícies reais
- **Disparo em massa de e-mail.** É a superfície nova de maior dano: usa o domínio da organização e dado pessoal de dezenas de pessoas. Mitigada por SEC-37, 38, 41, 42.
- **Escrita pelo link do cliente.** Hoje o link é só de leitura. As ações novas exigem sessão válida; verificar que cada fatia reautoriza e que "Gerar novo código" ou "Desativar link" interrompe lotes em andamento (a próxima fatia recusa).
- **CSRF.** O administrador usa autenticação por cabeçalho (não cookie) e o cliente usa cookie `SameSite=Lax` (SEC-33), que não segue em envio de formulário de outro site. Verificada, sem achado novo; confirmar na implementação que as funções novas são POST.
- **.vcf.** Gerado no navegador com dados já carregados (mesmo padrão dos exports Excel e PDF): não cria rota nem leitura nova (SEC-43).
- **Link do grupo como credencial.** Quem tem o link entra no grupo. Ele só aparece após a inscrição e no e-mail (SEC-46). Aprovação de entrada no grupo é recomendação ao cliente, não controle do sistema.
- **Tabelas e função novas.** Só service role (SEC-39). Lição da T-44: a função SQL de limite existia e não era usada; aqui a função é o caminho único (ARQ-05).

#### 4.3 Fronteiras de confiança do `architecture.md` 4.3
| Fronteira | Resultado |
|---|---|
| Navegador do cliente para o servidor (token, cookie, link do grupo, mensagem) | Achados SEC-37, 38, 40; a mensagem editada fica só no navegador (usada no `wa.me`), nunca vai ao e-mail (P-13 abaixo) |
| Link do grupo para o e-mail e o `wa.me` | SEC-38, SEC-48 |
| Resposta do inscrito para o corpo do e-mail | SEC-42 |
| Servidor para o Resend | Verificada, sem achado novo: chave só em variável de ambiente; 1 destinatário por item (RQ-05) |
| Download do .vcf | SEC-43 |

### 5. Propostas de mudança nos documentos da spec
#### 5.1 No `spec.md`
- Requisito de segurança novo: nível ASVS **L2** para a M-46 (dado pessoal), com os capítulos V1, V2, V3, V4, V7, V8, V13, V14 e V16 (Anexo A).
- RF-08 e RF-03 do PRD condicionados a link protegido com sessão (ADR-004); RNF-04 com os valores 10 min e 80 por 24 h.
- P-13 [ui-ux/spec]: o corpo do e-mail de convite é fixo; "Editar mensagem do convite" (Tela I) vale só para o botão do WhatsApp e não é enviada ao servidor.
- Retenção: entregas apagadas junto com a inscrição ou o formulário.
#### 5.2 No `plan.md`
- Ordem: migração com REVOKE e função de limite antes de qualquer tela; funções de escrita do cliente depois do teste de autorização (SEC-37, 40); validação do link do grupo como função pura primeiro (SEC-38).
#### 5.3 No `tasks.md`
- Tarefas de revisão obrigatória por segunda sessão: a da migração com função de limite (SEC-39, 41) e a das funções de escrita do cliente (SEC-37, 40).
#### 5.4 No `data-model.md`
- `invite_batches` e `invite_deliveries` guardam só ids; sem e-mail, telefone ou link em texto na tabela de entregas (o link usado pode ser guardado no lote como texto já validado, acessível só por service role; avaliar na SDD se vale o risco de vazamento do link por backup ou relatório).

### 6. Checklist de revisão sem código (cole no agente antes de aprovar)
1. "Mostre o teste que chama cada função de escrita do cliente com link sem código e com link com código mas sem sessão. Todas devem recusar." (SEC-37)
2. "Mostre a função que valida o link do grupo e o teste com ao menos 8 endereços falsos: outro domínio, `http`, usuário@, porta, `%`, espaços, maiúsculas no host, endereço com mais de 200 caracteres. Todos recusados." (SEC-38)
3. "Mostre a migração das tabelas novas: RLS ligado, REVOKE de PUBLIC, anon e authenticated, GRANT só para service_role. Rode uma consulta com a chave pública e mostre que é negada." (SEC-39)
4. "Chame as funções com um `batchId` e um `responseId` de outro formulário e mostre que são recusados." (SEC-40)
5. "Dispare dois lotes ao mesmo tempo no mesmo formulário e mostre que só um é criado. Mostre a recusa por orçamento diário e a reserva para confirmações." (SEC-41)
6. "Crie uma inscrição cujo nome tenha `<script>`, quebra de linha e aspas. Mostre o corpo do e-mail e o assunto gerados, escapados." (SEC-42)
7. "Gere o .vcf para um nome com `;`, vírgula e quebra de linha e mostre que não surgem campos novos." (SEC-43)
8. "Mostre o texto final do e-mail de convite, com origem do contato e forma de pedir descadastro." (SEC-44)
9. "Provoque uma falha de envio e mostre o log: não pode conter e-mail, telefone, link do grupo, token, código nem cookie." (SEC-45)
10. "Mostre a resposta pública do formulário (antes de se inscrever) e confirme que não contém o link do grupo." (SEC-46)
11. "Gere um novo código de acesso no meio de um lote de teste e mostre que a próxima fatia é recusada." (4.2)
12. "Mostre a saída de `git diff main -- package.json bun.lock`: vazia."

### 7. Riscos aceitos e gatilhos de reavaliação
| Risco | Decisão | Gatilho de reavaliação |
|---|---|---|
| SEC-47 reputação do domínio | Aceito agora (C) | Primeira reclamação de spam, taxa de devolução alta no painel do Resend, ou pedido de descadastro (EV-04) |
| Robôs ou atletas falsos entram no grupo (resíduo de SEC-46) | Aceito, com recomendação de aprovação de entrada no grupo | Primeiro estranho no grupo |
| L3 recusado ou adiado | **Pendente de decisão do dono** (ver Anexo A) | Antes da promoção |
| Contagem diária só conta convites, não confirmações | Aceito (reserva de 20) | Medir o uso real do Resend por 2 semanas |

### Anexo A. Cobertura ASVS
- **Nível escolhido: L2.** Motivo: o produto guarda dado pessoal (nome, telefone, e-mail, CPF, RG).
- **L3 recomendado nesta área.** Gatilho aplicável da regra da skill: **histórico de incidente** (exposição do link privado em 02/11/2026). Requisitos L3 mais relevantes: capítulos V8 (6 requisitos L3) e V16 (1). A skill recomenda adotá-los para a área de convites e link do cliente. **Decisão do dono: pendente.** Se não adotar, registrar em "Riscos aceitos" com nome, data e gatilho.
- **Capítulos incluídos:** V1, V2, V3, V4, V7, V8, V13, V14, V16 (133 requisitos L1+L2 selecionados pelo filtro da skill). **Excluídos, com motivo:** V5 arquivos (não há upload; o .vcf é gerado, não recebido), V6 autenticação, V9 e V10 (reaproveitam o que a T-44 e a conta do administrador já têm; não há login novo), V11 e V12 (sem criptografia nova; transporte seguro é do provedor), V15 (sem arquitetura nova de terceiros), V17 (não se aplica).
- **Status:** os 133 requisitos estão em **"Não verificado"**, porque a revisão é de desenho: não existe código para provar. Gerar a tabela com `node scripts/filtrar_asvs.mjs --nivel 2 --incluir V1,V2,V3,V4,V7,V8,V13,V14,V16` e preencher status e prova na revisão pós-implementação. Os achados SEC-37 a SEC-46 já cobrem, em desenho, as áreas V1, V2, V8, V13 e V16.
- Rodapé: requisitos OWASP ASVS v5.0.0, CC BY-SA 4.0, https://github.com/OWASP/ASVS. Este documento não é certificação.

### Anexo B. Decisões de segurança documentadas
- **Permissões:** administrador (dono do formulário) e cliente com link protegido e sessão válida podem convidar; link sem código só lê.
- **Sessão:** a mesma da T-44 (30 dias após o fechamento, invalidada ao gerar novo código); cada fatia do lote reautoriza.
- **Segredos:** `RESEND_API_KEY` e `EMAIL_FROM` já existem como variáveis do servidor; nenhum segredo novo.
- **Retenção:** entregas de convite apagadas junto com a inscrição e o formulário; sem prazo próprio por enquanto (EV-05 trata a limpeza).
- **Tipos de arquivo:** o único arquivo é o .vcf gerado no navegador; nenhum upload.

### Anexo C. Skills, agentes e integrações de terceiros
Não se aplica a esta feature (nenhuma skill, servidor MCP ou agente de terceiros entra no produto).
