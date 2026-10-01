# Plano de QA e Estratégia de Testes — Spec 001 (Fase 0): Form Builder Pro

> **Documento:** Estratégia de Qualidade, Matriz de Risco e Plano de Testes  
> **Origem dos requisitos:** `specs/001-fase-0-no-ar/spec.md`, `plan.md`, `data-model.md`, `tasks.md`, `ui-ux.md` e `seguranca.md`  
> **Status:** Documento Oficial de QA (Fase 0) — antes de qualquer linha de código  
> **Público-alvo:** Administrador e executor do projeto (com explicações em linguagem simples, sem exigir leitura de código para validar)  

---

## 1. Resumo Executivo e Princípio de Qualidade

Este plano define como garantir que o Form Builder Pro funcione perfeitamente antes de ser divulgado para participantes reais.

**Princípio orientador:** *Um teste que só confirma o caminho óbvio tem valor baixo; a segurança de um sistema está em testar o que acontece nas fronteiras, nos erros e nas tentativas de burlar as regras.*

Para quem gerencia o projeto sem programar:
- **Você não precisa inspecionar código:** Todas as verificações técnicas críticas deste plano possuem uma tradução direta em linguagem simples explicando exatamente o que foi provado.
- **A prova final é visual:** O encerramento da validação utiliza gravação de tela dos 5 cenários-chave em computador e celular, gerando evidência irrefutável de funcionamento.

---

## 2. Matriz de Priorização por Risco (Probabilidade × Impacto)

Nem todos os requisitos exigem o mesmo tempo de teste. O esforço é distribuído multiplicando a **Probabilidade de falha** (complexidade da regra e novidade do código) pelo **Impacto no mundo real** se falhar (vazamento de dados, constrangimento de participantes ou perda de vagas).

Escala: 1 (Baixo), 2 (Médio), 3 (Alto/Crítico). **Score = Probabilidade × Impacto (1 a 9).**

| Requisito | Probabilidade (1-3) | Impacto (1-3) | Score (1-9) | Nível de Rigor | O que está em jogo |
|---|:---:|:---:|:---:|:---:|---|
| **RF-03 — Inscrição única por CPF** | 3 | 3 | **9 (Máximo)** | Rigor Máximo | Participante ocupar mais de 1 vaga ou burlar regras de inscrição variando pontos, traços ou espaços. |
| **RF-04 — Limite de vagas seguro** | 3 | 3 | **9 (Máximo)** | Rigor Máximo | Concorrência simultânea provocar overbooking (entrar 52 pessoas num evento com 50 vagas). |
| **RF-06 — Editar inscrição pelo link** | 3 | 3 | **9 (Máximo)** | Rigor Máximo | Participante alterar o CPF de outro, consumir vagas indevidas ou disparar e-mails repetidos em loop. |
| **RF-01 — Acesso único do administrador** | 2 | 3 | **6 (Alto)** | Rigor Alto | Terceiros criarem contas no sistema e acessarem inscrições alheias. |
| **RF-08 — Consentimento LGPD** | 2 | 3 | **6 (Alto)** | Rigor Alto | Coleta de dados pessoais sem aceite comprovado ou falha jurídica no registro de consentimento. |
| **RF-10 — Proteção de dados (RLS)** | 2 | 3 | **6 (Alto)** | Rigor Alto | Invasor consultar banco diretamente e baixar lista completa de participantes com CPF. |
| **RF-05 — E-mail com link de edição** | 2 | 2 | **4 (Médio)** | Rigor Médio | E-mail vazar CPF completo, falhar silenciosamente ou travar a inscrição na tela. |
| **RF-09 — Proteção contra robôs (hp)** | 2 | 2 | **4 (Médio)** | Rigor Médio | Scripts automatizados sujarem o banco com cadastros fantasmas. |
| **RF-11 — Endereço personalizado (slug)** | 2 | 2 | **4 (Médio)** | Rigor Médio | Conflito com páginas internas do sistema (`/auth`, `/painel`) ou caracteres quebrados na URL. |
| **RF-13 — Contraste do tema (WCAG)** | 2 | 2 | **4 (Médio)** | Rigor Médio | Botão com texto ilegível (ex.: branco sobre amarelo), impedindo participantes de concluir. |
| **RF-07 — Admin copia link de edição** | 1 | 2 | **2 (Baixo)** | Rigor Básico | Cópia rápida de link para suporte ao participante. |
| **RF-02 — Redirecionamento da raiz** | 1 | 1 | **1 (Mínimo)** | Rigor Básico | Visitante que abre a URL sem caminho ser levado à tela correta. |
| **RF-12 — Mensagem de sucesso** | 1 | 1 | **1 (Mínimo)** | Rigor Básico | Texto personalizado cadastrado pelo admin aparecer no final. |

---

## 3. Estratégia de Teste por Camada (Pirâmide de Testes)

Nesta Fase 0, **não utilizaremos ferramentas pesadas de automação de navegador (como Playwright ou Cypress)**. O motivo é prático: para um produto de uso interno e equipe enxuta, testes de navegador são lentos, quebram com pequenos ajustes visuais e atrasam o lançamento.

Adotamos uma distribuição inteligente em **4 camadas complementares**:

```text
       ▲
      / \     [ 4 ] Validação Manual Ponta a Ponta com Gravação (5 cenários)
     /---\
    /     \    [ 3 ] Verificação de Infraestrutura e Rotas (cURL, tsc, build)
   /-------\
  /         \   [ 2 ] Verificação de Regras no Banco Real (32 testes SQL + Concorrência)
 /-----------\
/             \  [ 1 ] Testes Unitários de Regras Puras no Vitest (Milissegundos)
---------------
```

### Camada 1: Testes Unitários (Vitest) — A Base
- **O que cobre:** Funções de cálculo, sanitização e formatação puras que rodam em memória sem precisar de banco nem de internet.
- **Arquivos:** `validators.test.ts`, `slug.test.ts`, `inscricao.test.ts`, `confirmation-email.test.ts`, `theme.test.ts`.
- **Velocidade:** Executa em menos de 2 segundos.
- **Tradução:** Garante que "1 + 1 é sempre 2" em máscaras, validações de CPF, cálculo de contraste e segurança de e-mails.

### Camada 2: Verificação do Banco de Dados Real (SQL e Concorrência)
- **O que cobre:** As funções atômicas dentro do Postgres (`submit_response` e `update_response`), travas de concorrência (`FOR UPDATE`), políticas de acesso (RLS) e regras de unicidade.
- **Ferramentas:** `verificacao-banco.sql` no SQL Editor do Supabase (47 verificações, incluindo permissões) e `verificacao-concorrencia.mjs` (20 envios simultâneos para 5 vagas).
- **Tradução:** Garante que o banco de dados é imune a fraudes e que nenhuma vaga a mais é criada, mesmo se dezenas de pessoas clicarem no botão no mesmo milésimo de segundo.

### Camada 3: Verificação de Infraestrutura e Rotas (cURL, Compilação e Deploy)
- **O que cobre:** Rotas HTTP compiladas (`/saude`, `/$slug`, `/editar/$token`), ausência de erros TypeScript (`tsc --noEmit`), compilação do Cloudflare Worker (`bun run build`), cabeçalhos de segurança (`no-referrer`, `noindex`) e ausência de segredos commitados.
- **Ferramentas:** Scripts de terminal e cURL contra o servidor local ou de homologação.
- **Tradução:** Garante que o sistema compila sem avisos quebrados, que o servidor suporta as rotas sem travar e que links de edição não vazam para o Google.

### Camada 4: Validação Manual Ponta a Ponta com Gravação de Tela
- **O que cobre:** O fluxo real do participante no celular e do administrador no computador.
- **Tradução:** É o teste que qualquer pessoa entende: abrir a página, preencher, ver o resultado na tela, receber o e-mail e corrigir os dados.

---

## 4. Casos de Teste Faltantes (Análise de Fronteiras e Valores Limite)

Esta seção identifica exatamente **o que ainda não estava coberto** nos testes iniciais de `verificacao-banco.sql` e `tasks.md`, adicionando casos de borda essenciais.

### 4.1 Endereço do Formulário (Slug) — Limites de Caracteres
| ID | Entrada Testada | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-SLUG-01** | `ab` (2 caracteres) | Recusado com erro de tamanho | Impede endereços curtos demais que poluem o sistema. |
| **TC-SLUG-02** | `abc` (3 caracteres) | Aceito com sucesso | Garante que o tamanho mínimo permitido (3) funciona. |
| **TC-SLUG-03** | String com 60 caracteres válidos | Aceito com sucesso | Garante que o tamanho máximo permitido (60) funciona. |
| **TC-SLUG-04** | String com 61 caracteres | Cortado para 60 no sanitizador ou erro | Impede URLs gigantes que quebram links e layout. |
| **TC-SLUG-05** | `-evento` (hífen no início) | Recusado ou hífen inicial removido | URLs não podem começar com traço. |
| **TC-SLUG-06** | `evento-` (hífen no fim ao sair) | Hífen final removido no blur (`evento`) | URLs não terminam com traço pendente. |
| **TC-SLUG-07** | `corrida---skf` (múltiplos hífens) | Convertido para `corrida-skf` | Remove repetições feias na barra de endereço. |
| **TC-SLUG-08** | Todos os nomes reservados (`auth`, `painel`, `formularios`, `api`, `saude`, `admin`, `assets`, `login`, `editar`) | Recusados com "Esse nome é reservado pelo sistema" | Impede que um organizador tome o endereço do painel ou do login. |

### 4.2 CPF — Formatação, Máscaras e Espaços
| ID | Entrada Testada | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-CPF-01** | `529.982.247-25` (com máscara) | Válido, gravado como `52998224725` | Aceita formato comum com pontos e traço. |
| **TC-CPF-02** | `52998224725` (somente números) | Válido, gravado como `52998224725` | Aceita quando a pessoa cola sem pontuação. |
| **TC-CPF-03** | `  529.982.247-25  ` (espaços nas pontas) | Normalizado e aceito | Espaços acidentais ao copiar/colar são limpos. |
| **TC-CPF-04** | `111.111.111-11` (dígitos repetidos) | Recusado: "CPF inválido" | Barra CPFs conhecidos como matematicamente falsos. |
| **TC-CPF-05** | `529.982.247-26` (dígito verificador errado) | Recusado: "CPF inválido" | Pega erros de digitação de números individuais. |
| **TC-CPF-06** | `529.982.247` (incompleto) | Recusado: "CPF inválido" | Não deixa passar documento pela metade. |

### 4.3 Limites de Vagas (Valores Extremos)
| ID | Cenário | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-VAGA-01** | `max_responses = NULL` (sem limite) | Permite inscrições sem travar em nenhum teto | Formulários abertos/livres funcionam normalmente. |
| **TC-VAGA-02** | `max_responses = 1` (caso limite mínimo) | 1ª inscrição entra com sucesso; 2ª recebe `full` | O controle funciona mesmo com apenas uma vaga disponível. |
| **TC-VAGA-03** | `max_responses = 0` | Rejeita qualquer envio com status `full` | Permite fechar vagas imediatamente sem despublicar. |

### 4.4 Prazos e Fuso Horário de Brasília (UTC-3)
| ID | Cenário | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-TIME-01** | Envio 5 segundos ANTES do prazo final | Inscrição aceita com status `ok` | Participante no último minuto consegue se inscrever. |
| **TC-TIME-02** | Envio 5 segundos APÓS o prazo final | Inscrição recusada com status `closed` | O fechamento é pontual e automático. |
| **TC-TIME-03** | Prazo configurado para `23:59` de Brasília | O banco compara considerando o fuso de Brasília | Evita que o formulário encerre 3 horas mais cedo por confusão com UTC. |

### 4.5 Tamanho das Respostas e Múltipla Escolha
| ID | Cenário | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-RESP-01** | Resposta de texto com exatamente 5.000 caracteres | Aceita com sucesso | Garante que o limite generoso de texto longo funciona. |
| **TC-RESP-02** | Resposta de texto com 5.001 caracteres | Rejeitada: "Resposta muito longa" | Impede envio de textos abusivos. |
| **TC-RESP-03** | Pergunta de múltipla escolha com 3 itens marcados | Salvo como lista e exportado com separação por vírgula | Participante seleciona mais de uma opção sem corromper a planilha. |
| **TC-RESP-04** | Pergunta obrigatória de múltipla escolha com lista vazia `[]` | Rejeitada: "Este campo é obrigatório" | Impede enviar pergunta obrigatória sem selecionar nada. |
| **TC-RESP-05** | Payload com 200 chaves de perguntas no JSON | Aceito pelo schema Zod | Formulários grandes e legítimos são processados. |
| **TC-RESP-06** | Payload malicioso com 201 chaves | Bloqueado com erro 400 | Protege a CPU do Worker contra ataques de sobrecarga. |

### 4.6 E-mail e Proteção contra Spam
| ID | Cenário | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-MAIL-01** | Destinatário `maria@empresa.com.br` | Aceito e e-mail enviado | Fluxo normal de envio com subdomínio verificado. |
| **TC-MAIL-02** | Destinatário com vírgula `a@b.com,c@d.com` | Rejeitado por `isSafeRecipient` | Impede usar o sistema para disparar para múltiplos e-mails. |
| **TC-MAIL-03** | Destinatário com quebra de linha `a@b.com\r\nBcc:...` | Rejeitado por `isSafeRecipient` | Protege contra injeção de cabeçalhos de e-mail. |
| **TC-MAIL-04** | Formulário SEM pergunta de e-mail | Inscrição concluída, link na tela, `emailSent: false` | O sistema funciona perfeitamente sem campo de e-mail. |
| **TC-MAIL-05** | Formulário SEM pergunta de CPF | Múltiplas pessoas se inscrevem sem colisão | Formulários de pesquisa ou contato funcionam sem exigir CPF. |

### 4.7 Edição pelo Link e Janela de 10 Minutos
| ID | Cenário | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-EDIT-01** | Inscrito edita resposta pela 1ª vez | Salvo no banco, e-mail de atualização enviado | O participante corrige seus dados com sucesso. |
| **TC-EDIT-02** | Inscrito edita novamente 2 minutos depois | Salvo no banco, **nenhum e-mail disparado**, tela avisa apenas que salvou | Impede spam e esgotamento da cota de 100 e-mails/dia. |
| **TC-EDIT-03** | Inscrito edita novamente após 11 minutos | Salvo no banco e novo e-mail disparado | Após a janela de segurança, nova confirmação é enviada. |
| **TC-EDIT-04** | Tentativa de adulterar 1 caractere no link de edição | Retorna página "Inscrição não encontrada" | Links incorretos ou falsos não acessam dados de ninguém. |
| **TC-EDIT-05** | Inscrito edita menos de 10 minutos depois de se inscrever | Salvo no banco, nenhum e-mail disparado | A confirmação da inscrição conta como o último e-mail da janela. |

---

## 5. Roteiro de Teste Exploratório por Tela

Roteiro para percorrer manualmente em **computador** e em **celular** antes de liberar para o público.

### 5.1 Tela Pública de Inscrição (`/$slug`)
- [ ] **No celular (360px):** Abrir no navegador do celular; verificar se nenhum elemento transborda horizontalmente e se os campos ocupam toda a largura útil.
- [ ] **Máscara dinâmica:** Digitar o CPF e conferir se os pontos e traço surgem sozinhos sem travar a digitação.
- [ ] **Contraste:** Criar um formulário com cor de tema amarela (`#ffff00`) e outro com azul escuro (`#4f46e5`); o texto do botão deve ficar **preto puro** no amarelo e **branco puro** no azul, perfeitamente legíveis.
- [ ] **Validação de obrigatórios:** Clicar em "Enviar inscrição" com tudo vazio; a tela deve marcar os campos em vermelho e focar automaticamente no primeiro erro.
- [ ] **Anti-robô:** O campo invisível de armadilha não deve ser visível nem acessível com a tecla Tab.
- [ ] **Consentimento:** Se o formulário tiver termo, desmarcar e tentar enviar; deve surgir o aviso: *"É necessário aceitar o termo para continuar."*.

### 5.2 Tela de Sucesso da Inscrição
- [ ] **Botão Copiar Link:** Clicar em "Copiar link"; deve surgir o aviso "Link copiado!" e colar o endereço correto no bloco de notas.
- [ ] **Aviso condicional de e-mail:** 
  - Se o e-mail foi enviado: deve exibir *"Enviamos um resumo e o link para o seu e-mail."*.
  - Se o envio falhou ou o formulário não tem e-mail: essa frase **não deve aparecer** (só o link na tela).

### 5.3 Página de Edição do Participante (`/editar/{token}`)
- [ ] **CPF bloqueado:** O campo do CPF deve exibir o CPF mascarado (`***.***.***-25`) com fundo acinzentado, ícone de cadeado e aviso *"O CPF não pode ser alterado."*, sem permitir digitação.
- [ ] **Aparência do evento:** A página deve exibir o logotipo, a cor e a **fonte** configuradas no tema do formulário.
- [ ] **Salvamento:** Alterar um dado (ex.: tamanho de camiseta ou distância) e salvar; deve surgir *"Alterações salvas!"*.
- [ ] **Formulário fechado:** Entrar no painel, encerrar o formulário e recarregar o link de edição no celular; deve exibir a tela estática *"Edição encerrada - Este formulário não aceita mais alterações."*.

### 5.4 Painel do Administrador e Editor (`/painel` e `/formularios/$id`)
- [ ] **Sugestão de endereço:** Digitar o título "Copa Primavera de Vôlei"; o campo de endereço deve preencher sozinho com `copa-primavera-de-volei`.
- [ ] **Aviso de quebra:** Em formulário já publicado, alterar uma letra do endereço; deve surgir o alerta âmbar avisando que links já divulgados deixarão de funcionar.
- [ ] **Aba Limites e Termos:** O rótulo da aba deve ser exatamente "Limites e Termos", contendo o campo de vagas, a data de encerramento e a caixa do texto de consentimento LGPD.

### 5.5 Tabela de Respostas e Exportações (`/formularios/$id/respostas`)
- [ ] **Abrir a página:** No editor, clicar "Ver respostas"; a tabela deve abrir.
- [ ] **CPF completo na tabela e nas exportações:** Os números de CPF devem aparecer completos e sem ofuscação na visualização do administrador e nas planilhas/PDFs gerados.
- [ ] **Copiar link de qualquer inscrito:** Clicar no botão "Copiar link de edição" na nova coluna de Ações; o link copiado deve abrir diretamente a edição daquela pessoa específica.
- [ ] **Exportação Excel e PDF:** Clicar nos botões de exportar; os arquivos baixados devem conter todas as respostas preenchidas e com acentuação correta em português.
- [ ] **Proteção de rota:** Sem login, o endereço de respostas leva a /auth e não mostra dados.

### 5.6 Tela de Entrada (`/auth`)
- [ ] **Apenas e-mail e senha:** Não pode existir botão de "Criar conta", nem link alternativo, nem botão de login com o Google.
- [ ] **Redirecionamento:** Acessar o endereço raiz (`/`); deve redirecionar automaticamente para `/painel` (se logado) ou `/auth` (se deslogado).

---

## 6. Roteiro do Teste Ponta a Ponta com Gravação de Tela (5 Cenários-Chave)

Este é o roteiro obrigatório da task final (T-14). Prepare o celular e o computador com o gravador de tela ativo para registrar cada um dos 5 passos:

### Cenário 1: Inscrição Completa e Retificação pelo Próprio Participante
1. **Ação:** No computador, crie um formulário com título "Treino Oficial", adicione os campos Nome, CPF, E-mail e Distância (opções: 5 km e 10 km). Defina tema com cor verde (`#22c55e`). Publique o formulário.
2. **Ação:** No celular, abra o link gerado (`.../treino-oficial`), preencha com seu nome, seu CPF real, seu e-mail e selecione "5 km". Clique em "Enviar inscrição".
3. **O que você vê na tela (Esperado):** Surge a tela de sucesso com o botão verde e texto preto legível, o link de edição e a frase informando que o resumo foi enviado por e-mail.
4. **Ação:** Abra sua caixa de entrada, localize o e-mail recebido, confirme que o CPF está mascarado (ex.: `***.***.***-25`) e clique no link de edição recebido.
5. **Ação:** No link aberto, troque a opção de "5 km" para "10 km" e clique em "Salvar alterações".
6. **O que você vê na tela (Esperado):** Surge o banner de sucesso confirmando as alterações. No painel do administrador, a tabela atualiza para "10 km" e o total de respostas permanece exatamente 1.

### Cenário 2: Bloqueio de CPF Duplicado
1. **Ação:** No celular, abra novamente o formulário público do Cenário 1.
2. **Ação:** Tente se inscrever novamente informando o mesmo CPF anterior (primeiro com pontos e traço, depois sem pontuação).
3. **O que você vê na tela (Esperado):** O envio é recusado imediatamente e surge em vermelho no próprio campo do CPF a mensagem:  
   *"CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador."*. Nenhuma inscrição duplicada é gravada no banco.

### Cenário 3: Limite Seguro de Vagas sob Concorrência
1. **Ação:** No painel, crie um formulário com limite de exatamente 3 vagas.
2. **Ação:** No terminal, execute `verificacao-concorrencia.mjs` (20 envios para 5 vagas).
3. **O que você vê na tela (Esperado):** No painel do administrador, a contagem de respostas trava rigorosamente em **3**. No terminal, exatamente 5 retornam ok e 15 retornam full ("vagas esgotadas"). Nenhuma vaga excedente foi aberta.

### Cenário 4: Endereço Amigável e Preservação de Links
1. **Ação:** No editor, altere o endereço do formulário de `treino-oficial` para `etapa-ibirapuera` e salve.
2. **Ação:** No navegador, tente abrir o endereço antigo (`.../treino-oficial`); deve exibir página de "Formulário não encontrado".
3. **Ação:** Abra o novo endereço (`.../etapa-ibirapuera`); o formulário carrega perfeitamente.
4. **Ação:** Abra o link de edição recebido no e-mail do Cenário 1 (`/editar/{token}`); a edição continua abrindo perfeitamente, provando que o link do inscrito independe do endereço público.

### Cenário 5: Isolamento de Acesso do Administrador
1. **Ação:** Abra uma janela anônima e acesse a URL raiz do sistema.
2. **O que você vê na tela (Esperado):** Você é levado para a tela `/auth`, onde só existem os campos E-mail e Senha. Não há opção de cadastro.
3. **Ação:** Tente disparar uma chamada cURL simulando criação de conta (`/auth/v1/signup`).
4. **O que você vê na tela (Esperado):** Retorno de erro 4xx recusando o cadastro. O banco de dados só pode ser operado pelo seu usuário.

---

## 7. Checklist de "Pronto para Produção" (Definition of Done)

Marque cada item antes de considerar o sistema oficialmente no ar para eventos reais:

- [ ] **Compilação e Tipos:** O comando `bunx tsc --noEmit` executa sem nenhum erro (0 erros).
- [ ] **Bateria de Testes Automatizados:** O comando `bun run test` executa todas as suítes no Vitest e 100% dos testes passam.
- [ ] **Verificação de Banco:** a última linha do `verificacao-banco.sql` no SQL Editor é `== RESUMO: 47 PASSOU, 0 FALHOU ==`.
- [ ] **Teste de Concorrência:** O teste de 20 envios simultâneos para 5 vagas retorna exatamente 5 `ok` e 15 `full`.
- [ ] **Segredos no Git:** O comando `git grep -n "sb_secret_\|SERVICE_ROLE_KEY=\|re_[A-Za-z0-9]"` não encontra nenhum segredo no código.
- [ ] **Cadastro Público Desativado:** O painel do Supabase está com "Allow new users to sign up" desmarcado e o teste cURL de signup retorna erro 4xx.
- [ ] **Subdomínio de E-mail Verificado:** O subdomínio da Tríade no Resend está com status "Verified" no DNS.
- [ ] **Monitor de Saúde Ativo:** O serviço de monitoramento externo gratuito está chamando `/saude` a cada 5 minutos, evitando a pausa do banco de dados gratuito.
- [ ] **Gravação de Tela Concluída:** Os 5 cenários-chave foram executados, gravados e arquivados com sucesso.
- [ ] **Regra Operacional das Vagas:** Confirmado que todos os formulários reais cadastrados possuem um limite de vagas definido.

---

## 8. Modelo Padronizado para Relato de Bugs

Caso você ou algum participante encontre um comportamento inesperado durante os testes, utilize este modelo simples para registrar:

```markdown
### [BUG] Título curto e objetivo (Ex.: "Mensagem de erro de CPF não sumiu ao corrigir o número")

- **Gravidade:** [Crítica / Alta / Média / Baixa]
  *(Crítica = dados vazando ou ninguém consegue se inscrever; Baixa = detalhe estético)*
- **Onde ocorreu:** [Celular / Computador] — [Tela: /$slug, /editar, /painel, /auth]
- **Passos para reproduzir:**
  1. Abri o formulário no endereço /corrida-2026.
  2. Digitei um CPF com número errado e tentei enviar.
  3. Corrigi o número para um CPF válido e cliquei de novo.
- **O que era esperado:** O aviso vermelho deveria sumir e a inscrição ser aceita.
- **O que aconteceu de verdade:** A mensagem de erro continuou travada na tela.
- **Evidência:** [Anexo do print de tela ou vídeo curto]
```

---

## 9. Onde o Padrão "Writer / Reviewer" é Obrigatório

O padrão **Writer/Reviewer** (onde o Antigravity ou uma segunda sessão de IA revisa apenas o código alterado contra as regras do documento em contexto limpo) é obrigatório nas tasks de maior risco técnico:

1. **Task T-04 (Migração de Banco e Transações):**
   - **Por que é crítico:** Mexe com a transação que segura vagas e CPFs sob concorrência. Se houver falha de sintaxe ou de permissão, o sistema todo trava.
   - **Foco do Reviewer:** Conferir se `FOR UPDATE` está na linha do formulário, se `search_path = public` está fixado e se `REVOKE` tirou o acesso público das funções.

2. **Task T-08 (Regras Puras de Inscrição, E-mail e Contraste):**
   - **Por que é crítico:** Ocultação de documentos pessoais (LGPD), contraste acessível das cores e higienização de e-mails para evitar abusos de spam.
   - **Foco do Reviewer:** Conferir se `hideDocument` nunca deixa escapar o CPF completo, se `isSafeRecipient` rejeita listas de e-mails maliciosas e se a varredura das 216 cores de contraste passa no cálculo matemático.

3. **Task T-09 (Servidor de Inscrição e Higiene de Logs):**
   - **Por que é crítico:** É o coração do backend. Conecta o navegador ao banco de dados com a chave de serviço.
   - **Foco do Reviewer:** Conferir se nenhum dado do participante é despejado em `console.error`, se o limite de 200 chaves no Zod está ativo e se o token de edição nunca é devolvido fora da URL de edição.

4. **Task T-11 (Edição pelo Link e Janela de 10 Minutos):**
   - **Por que é crítico:** Autorização baseada exclusivamente no token de 64 caracteres.
   - **Foco do Reviewer:** Conferir se o campo CPF está estritamente bloqueado contra alteração, se a leitura do `updated_at` anterior impede o bombardeio de e-mails em menos de 10 minutos e se as tags `no-referrer` e `noindex` estão presentes no cabeçalho da página.

---

## 10. Itens Posteriores (Fase 1)

Para manter o foco estrito na entrega da Fase 0, as seguintes melhorias de QA e infraestrutura ficam registradas para a Fase 1:
- Automação completa de testes de interface no navegador com Playwright.
- Testes automatizados de carga com k6 simulando centenas de participantes simultâneos.
- Substituição da biblioteca `xlsx 0.18.5` por exportador leve e nativo.
- Mecanismo automatizado de recuperação de link de edição pelo próprio participante com reenvio para o e-mail cadastrado.
