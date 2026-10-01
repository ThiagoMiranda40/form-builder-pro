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
