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

### 4.8 Validação de Data de Nascimento e Datas
| ID | Cenário | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-DATE-01** | Data de nascimento igual à data de hoje em São Paulo | Recusada: "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura." | Ninguém pode nascer hoje no momento de se inscrever. |
| **TC-DATE-02** | Data de nascimento no futuro | Recusada: "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura." | Bloqueia digitação acidental de anos futuros. |
| **TC-DATE-03** | Data de nascimento válida no passado (ex.: ontem, 1981-12-20) | Aceita com sucesso | Datas legítimas de nascimento passam normalmente. |
| **TC-DATE-04** | Data de nascimento anterior a 1900-01-01 (ex.: 1899-12-31) | Recusada: "Data de nascimento inválida." | Impede anos irreais ou erros de digitação grosseiros. |
| **TC-DATE-05** | Data inexistente no calendário (ex.: 2026-02-30 ou 2026-13-01) | Recusada: "Data de nascimento inválida." (ou "Data inválida." no tipo date) | Valida calendário real por ida e volta em UTC. |
| **TC-DATE-06** | Data de nascimento de hoje ou futura enviada diretamente ao servidor | Recusada no navegador e no servidor com a mesma mensagem | Regra de negócio "data de nascimento de hoje ou futura é recusada no navegador e no servidor" aplicada estritamente. |
| **TC-DATE-07** | Pergunta do tipo Data de nascimento no formulário público | O formulário público desenha o tipo Data de nascimento com seletor e limites (`type="date"`, `min="1900-01-01"`, `max` no dia anterior a hoje em São Paulo e `autoComplete="bday"`) | Garante que o formulário público desenha o tipo Data de nascimento com seletor e limites no navegador. |

### 4.9 Editor: Reordenação de Perguntas e Controles Acessíveis (T-34)
| ID | Cenário | Resultado Esperado | O que prova em linguagem simples |
|---|---|---|---|
| **TC-ORDER-01** | `normalizePositions` em lista vazia ou desordenada | Devolve nova lista com posições sequenciais 0, 1, 2... sem mutar a entrada | Mantém integridade da sequência de posições. |
| **TC-ORDER-02** | `moveByStep` para cima (-1) no primeiro item ou para baixo (1) no último | Devolve cópia com a mesma ordem | Impede movimentos fora dos limites da lista. |
| **TC-ORDER-03** | `moveByStep` em item intermediário | Troca posição com vizinho e normaliza posições sequenciais (0, 1, 2...) | Move item por passo com setas acessíveis. |
| **TC-ORDER-04** | `moveToIndex` para o mesmo índice ou fora dos limites | Devolve cópia inalterada ou limita ao intervalo válido | Operação neutra e segura ao soltar no mesmo ponto ou além dos extremos. |
| **TC-ORDER-05** | `moveToIndex` reposicionando item | Reposiciona o item no novo índice e devolve posições sequenciais 0..n-1 | Garante arrastar e soltar consistente. |
| **TC-ORDER-06** | `insertionIndex` com `afterId` existente | Retorna índice imediatamente seguinte ao item | Nova pergunta entra logo abaixo da selecionada. |
| **TC-ORDER-07** | `insertionIndex` com `afterId` nulo ou inexistente | Retorna tamanho da lista (fim) | Sem pergunta selecionada, insere no final. |
| **TC-ORDER-08** | `moveAnnouncement` para nova posição | Retorna texto literal: "Pergunta movida para a posição {n} de {total}." | Anuncia para leitores de tela em aria-live. |
| **TC-ORDER-09** | Checagens estáticas em `routes.test.ts` | Confirma os 4 aria-labels literais, `lg:sticky`, AlertDialog, textos exatos de exclusão e adição, ausência de `<span onClick>` e ausência de dependências dnd externas | Garante conformidade de código sem bibliotecas extras. |

---


## 5. Roteiro de Teste Exploratório por Tela

Roteiro para percorrer manualmente em **computador** e em **celular** antes de liberar para o público.

### 5.1 Tela Pública de Inscrição (`/$slug`)
- [ ] **No celular (360px):** Abrir no navegador do celular; verificar se nenhum elemento transborda horizontalmente e se os campos ocupam toda a largura útil.
- [ ] **Máscara dinâmica:** Digitar o CPF e conferir se os pontos e traço surgem sozinhos sem travar a digitação.
- [ ] **Sugestão de domínio no e-mail:** Ao sair de uma pergunta do tipo e-mail digitada com erro comum de domínio (ex.: `maria@gmial.com`), deve surgir logo abaixo a dica *"Você quis dizer maria@gmail.com?"* e o botão *"Usar este endereço"*, que corrige o campo ao ser clicado (`aria-live="polite"`), sem bloquear o envio se a pessoa optar por manter o digitado.
- [ ] **Confirmação de e-mail:** Abaixo de cada pergunta do tipo e-mail, deve surgir o campo *"Confirme seu e-mail"*. Se os dois campos forem diferentes (desconsiderando maiúsculas e espaços nas pontas), o envio deve ser bloqueado no navegador com o foco indo para o campo de confirmação e exibindo *"Os e-mails não são iguais."*.
- [ ] **Contraste:** Criar um formulário com cor de tema amarela (`#ffff00`) e outro com azul escuro (`#4f46e5`); o texto do botão deve ficar **preto puro** no amarelo e **branco puro** no azul, perfeitamente legíveis.
- [ ] **Validação de obrigatórios:** Clicar em "Enviar inscrição" com tudo vazio; a tela deve marcar os campos em vermelho e focar automaticamente no primeiro erro.
- [ ] **Anti-robô:** O campo invisível de armadilha não deve ser visível nem acessível com a tecla Tab.
- [ ] **Consentimento e Links Legais:** Se o formulário tiver termo, surge a linha *"Leia os Termos de Uso e a Política de Privacidade."* com os dois links (`target="_blank"`, `rel="noopener noreferrer"`, sublinhados, contraste mínimo 4,5:1) contendo o texto para leitor de tela *" (abre em outra aba)"*.
- [ ] **Rótulo da caixa de consentimento:** A caixa de aceite deve exibir o rótulo *"Declaro que li e concordo com os termos acima, com os Termos de Uso e com a Política de Privacidade."*. Desmarcar e tentar enviar deve exibir: *"É necessário aceitar o termo para continuar."*.
- [ ] **Descrição com quebras de linha preservadas:** Abrir o formulário público no computador e no celular; as linhas da descrição aparecem exatamente como digitadas, com uma linha em branco entre blocos de texto (`whitespace-pre-line`).
- [ ] **Formulário sem descrição:** Num formulário de teste com descrição vazia ou apagada, não aparece parágrafo vazio acima das perguntas.
- [ ] **Bloco de vagas e prazo no computador:** No formulário da SKF (40 vagas, prazo 07/10), o bloco aparece logo abaixo da descrição com "40 vagas restantes" e "07/10/2026 às 23:59", visivelmente maior que o texto.
- [ ] **Vagas e prazo no celular (360px):** No celular (360 px), os dois cartões ficam um sobre o outro, sem rolagem lateral.
- [ ] **Alerta de últimas vagas:** Num formulário de teste com limite de 5 vagas, o cartão fica âmbar com o selo textual *"Últimas vagas"*.
- [ ] **Alerta de prazo iminente:** Num formulário de teste com prazo para hoje, exibe o selo *"Encerra hoje"*; para amanhã, *"Encerra amanhã"*.
- [ ] **Formulário sem limite e sem prazo:** Num formulário de teste sem limite de vagas e sem prazo cadastrados, o bloco não aparece.
- [ ] **Fuso horário fixo:** O horário do prazo exibido é rigorosamente o mesmo no computador e no celular (fuso de São Paulo).
- [ ] **Data de nascimento no formulário público:** O seletor não deixa escolher hoje nem datas futuras (`max` fixado no dia anterior a hoje em São Paulo).
- [ ] **Tentativa de envio de data de nascimento de hoje ou futura:** Recusada no navegador e no servidor com *"Informe uma data de nascimento válida: não pode ser hoje nem uma data futura."*.
- [ ] **Envio com data de nascimento válida:** Enviar uma inscrição de teste com data válida: concluída com sucesso, e o e-mail de confirmação recebido mostra a data em dd/mm/aaaa.
- [ ] **Procedimento manual de teste em formulário de teste (T-24b):** (1) criar um formulário de teste com uma pergunta do tipo "Data de nascimento"; (2) abrir o link público: o campo mostra o seletor de data, e o seletor não deixa escolher hoje nem datas futuras; (3) enviar uma inscrição de teste com data válida: funciona; (4) só depois, no formulário da SKF, trocar o tipo da pergunta "Data de Nascimento" para "Data de nascimento" e conferir o seletor no link público; (5) apagar o formulário de teste.
- [ ] **Dicas (tooltips) nos cartões de vagas e prazo (T-27):** No formulário público, passar o mouse, focar com o teclado ou tocar no cartão de vagas exibe a dica *"Vagas ainda disponíveis neste formulário. Quando restam 10 ou menos, aparece o aviso Últimas vagas."*; no cartão de prazo, exibe *"Data e hora limite para enviar a inscrição, no horário de Brasília."*.
- [ ] **Rodapé de documentos legais:** Abaixo do cartão do formulário (em todos os estados: aberto, sucesso, indisponível, encerrado, esgotado, não encontrado), exibe `<nav aria-label="Documentos legais">` com *"Termos de Uso · Política de Privacidade"*, ambos abrindo em nova aba com texto para leitor de tela.



### 5.2 Tela de Sucesso da Inscrição
- [ ] **Ordem dos blocos:** O aviso de e-mail (quando enviado) deve vir posicionado **antes** do cartão do link de edição.
- [ ] **Bloco em destaque de e-mail enviado (`emailSent === true`):** Exibe caixa destacada verde clara com anel e ícone de envelope (`aria-hidden`), contendo na ordem:
  1. *"Enviamos um resumo e o link para o seu e-mail."* em `text-base font-semibold`.
  2. *"Enviado para: <endereço>"* com o e-mail em negrito e `break-all`.
  3. *"Não chegou? Procure na caixa de spam ou lixo eletrônico."* com contraste mínimo de 4,5:1.
- [ ] **Aviso de falha no envio de e-mail (`emailSent === false` com pergunta de e-mail):** Exibe aviso âmbar abaixo do link: *"Não conseguimos enviar o e-mail agora. Guarde o link acima: é a sua forma de corrigir seus dados."*.
- [ ] **Formulário sem pergunta de e-mail:** Nenhuma mensagem sobre e-mail deve aparecer (só o link de edição e a mensagem de sucesso).
- [ ] **Botão Copiar Link:** Clicar em "Copiar link"; deve surgir o aviso "Link copiado!" e colar o endereço correto no bloco de notas.

### 5.3 Página de Edição do Participante (`/editar/{token}`)
- [ ] **CPF bloqueado:** O campo do CPF deve exibir o CPF mascarado (`***.***.***-25`) com fundo acinzentado, ícone de cadeado e aviso *"O CPF não pode ser alterado."*, sem permitir digitação.
- [ ] **Aparência do evento:** A página deve exibir o logotipo, a cor e a **fonte** configuradas no tema do formulário.
- [ ] **Salvamento:** Alterar um dado (ex.: tamanho de camiseta ou distância) e salvar; deve surgir *"Alterações salvas!"*.
- [ ] **Formulário fechado:** Entrar no painel, encerrar o formulário e recarregar o link de edição no celular; deve exibir a tela estática *"Edição encerrada - Este formulário não aceita mais alterações."*.

### 5.4 Painel do Administrador e Editor (`/painel` e `/formularios/$id`)
- [ ] **Sugestão de endereço:** Digitar o título "Copa Primavera de Vôlei"; o campo de endereço deve preencher sozinho com `copa-primavera-de-volei`.
- [ ] **Aviso de quebra:** Em formulário já publicado, alterar uma letra do endereço; deve surgir o alerta âmbar avisando que links já divulgados deixarão de funcionar.
- [ ] **Descrição do formulário (crescimento automático, borda e contador):** No editor do formulário, digitar uma descrição com várias linhas: o campo cresce sozinho conforme o conteúdo (mínimo de 4 linhas, máximo de 24rem com rolagem), possui borda visível, anel de foco e exibe o contador "N/1000" abaixo à direita ligado por `aria-describedby`.
- [ ] **Alerta de caracteres e limite máximo:** Digitar mais de 900 caracteres na descrição: o contador muda de cor para tom âmbar escuro (com contraste >= 4,5:1) e o campo impede ultrapassar 1000 caracteres (`maxLength={1000}`).
- [ ] **Aba Limites e Termos:** O rótulo da aba deve ser exatamente "Limites e Termos" (classe `capitalize` removida, sem produzir "Limites E Termos"), contendo o campo de vagas, a data de encerramento e a caixa do texto de consentimento LGPD.
- [ ] **Gráfico de respostas por dia no painel (T-27):** O gráfico exibe os últimos 7 dias com estrutura acessível (`role="group"` e `aria-label` com resumo); cada barra é um gatilho interativo com dica informando data completa, dia da semana e respostas (ex.: *"sexta-feira, 02/10/2026 (hoje): N respostas"*); a barra de hoje mostra o número acima (quando > 0).
- [ ] **Dicas (tooltips) nos cards e no gráfico do painel (T-27):** No painel, passar o mouse sobre cada um dos 4 cards estatísticos e cada barra do gráfico: a dica aparece com a explicação correta; com o teclado (Tab), o foco chega a cada card e cada barra abrindo a dica; no celular, tocar num card ou barra abre a dica; os números, visual e atualização automática continuam funcionando perfeitamente.
- [ ] **Cursor global em elementos interativos (T-27):** Passar o mouse sobre botões, links, abas, caixas de seleção, listas de opções e botão de entrar: mãozinha (`cursor: pointer`) em todos; elementos desativados mostram cursor de bloqueado (`cursor: not-allowed`); campos de texto mantêm cursor de digitação (`cursor: text`).
- [ ] **Atualização automática no painel:** As consultas do painel atualizam a cada 30 segundos sem recarregar a página inteira; perto do título é exibido "Atualizado às HH:mm" (fuso de São Paulo); o painel segue carregando normalmente.
- [ ] **Atualização em tempo real (teste prático do painel):** Num formulário de teste, enviar uma inscrição pelo celular: em até cerca de 30 segundos o painel reflete a nova inscrição e o "Atualizado às HH:mm" avança sem recarregar.
- [ ] **Configuração do tipo Data de nascimento no editor:** No editor do formulário da SKF (`/formularios/$id`), trocar o tipo da pergunta "Data de Nascimento" para "Data de nascimento" (com a dica *"Não aceita hoje nem datas futuras"*) e salvar.
- [ ] **Edição na própria pergunta (T-34):** Clicar numa pergunta abre os campos de edição ali mesmo no cartão (rótulo, texto de ajuda, tipo, obrigatória e opções), e o painel lateral mostra a mesma pergunta sincronizada; editar o rótulo no cartão muda o painel e vice-versa; clicar de novo no cabeçalho da pergunta a recolhe.
- [ ] **Painel lateral fixo na rolagem (T-34):** No computador (≥ 1024 px), com a lista comprida, o painel lateral acompanha a rolagem (`lg:sticky`) e não fica escondido pelo cabeçalho fixo do `AppShell` (`lg:top-24`); no celular, o painel fica abaixo e a edição no cartão funciona.
- [ ] **Adicionar pergunta abaixo da selecionada (T-34):** Com a pergunta 2 selecionada, "+ Adicionar pergunta" cria a 3ª, aberta, com o cursor no rótulo e "Nova pergunta" selecionado (digitar substitui); sem nenhuma selecionada, vai para o fim.
- [ ] **Persistência de posições após adicionar pergunta (T-34):** Depois de adicionar abaixo da 2ª, recarregar a página SEM clicar em Salvar: a nova pergunta continua na 3ª posição e as demais seguem a ordem esperada no banco.
- [ ] **Arrastar por alça nativa (T-34):** Arrastar pela alça a pergunta 4 para entre a 1 e a 2 mostra uma linha de inserção e, ao soltar, ela fica na 2ª; recarregar sem salvar volta à ordem antiga; clicar em Salvar e recarregar mantém a nova.
- [ ] **Reordenação acessível por teclado (T-34):** Com Tab, chegar nos botões "Mover pergunta {n} para cima" e "Mover pergunta {n} para baixo" e acioná-los com Enter ou Espaço; os de cima e de baixo ficam desabilitados no primeiro e no último; anúncio acessível em `aria-live` ("Pergunta movida para a posição {n} de {total}.").
- [ ] **Excluir com confirmação em AlertDialog (T-34):** O botão "Excluir pergunta {n}" abre o diálogo com o título "Excluir esta pergunta?", a descrição "As respostas já enviadas a ela deixam de aparecer na tabela e nas exportações. Esta ação não pode ser desfeita." e os botões "Cancelar" e "Excluir"; "Cancelar" e Esc não excluem; "Excluir" exclui e o foco vai para a pergunta seguinte.
- [ ] **Formulário público na ordem salva (T-34):** O formulário público do teste mostra as perguntas na ordem salva e aceita uma inscrição de teste.
- [ ] **Salvar e Publicar continuam funcionando (T-34):** "Salvar" e "Publicar" continuam gravando normalmente.
- [ ] **Celular: cartões, edição no cartão e setas (T-34):** No celular, cartões, edição no cartão e setas funcionam (arrastar não é esperado no toque).

### 5.5 Tabela de Respostas e Exportações (`/formularios/$id/respostas`)
- [ ] **Abrir a página:** No editor, clicar "Ver respostas"; a tabela deve abrir.
- [ ] **Datas de respostas em dd/mm/aaaa:** Na tabela de respostas, perguntas com resposta de data (ex.: data de nascimento no formulário da SKF) são exibidas no formato dd/mm/aaaa por manipulação de texto.
- [ ] **Datas em dd/mm/aaaa no Excel e no PDF:** O Excel e o PDF baixados mostram perguntas de data formatadas em dd/mm/aaaa.
- [ ] **Preservação de inscrições antigas:** As inscrições antigas continuam intactas e com seus dados preservados.
- [ ] **Validação de data de nascimento na edição pelo painel:** Na tela de respostas, ao editar uma das duas inscrições com nascimento igual a 02/10/2026, o diálogo exige uma data válida para salvar.

- [ ] **Coluna "Atualizado em":** Posicionada logo após "Enviado em", exibe a data e hora da alteração em pt-BR ou "—" quando a inscrição nunca foi editada.
- [ ] **Selo de inscrição editada:** Linhas de inscrições retificadas exibem o selo textual *"Editada"* ao lado da data e fundo âmbar claro.
- [ ] **Resumo de respostas, vagas, editadas e prazo:** Cabeçalho exibe `"{n} resposta(s)"` + (se houver limite) `" de {v} vagas"` + (se houver editadas) `" · {e} editada(s)"` + (se houver prazo) `" · prazo {data}"`.
- [ ] **Filtro de editadas:** Havendo inscrições editadas, exibe o botão alternador *"Mostrar só editadas"* / *"Mostrar todas"* (`aria-pressed`).
- [ ] **Filtro vazio:** Caso o filtro esteja ativo e não haja inscrições correspondentes, exibe *"Nenhuma inscrição editada."*.
- [ ] **CPF completo na tabela e nas exportações:** Os números de CPF devem aparecer completos e sem ofuscação na visualização do administrador e nas planilhas/PDFs gerados.
- [ ] **Copiar link de qualquer inscrito:** Clicar no botão "Copiar link de edição" na nova coluna de Ações; o link copiado deve abrir diretamente a edição daquela pessoa específica.
- [ ] **Botão Excluir por linha:** Na coluna de Ações, ao lado de "Copiar link de edição", botão discreto "Excluir" em tom destrutivo (`text-destructive`).
- [ ] **Diálogo de confirmação:** Ao clicar em "Excluir", abre o `AlertDialog` com título "Excluir esta inscrição?", corpo explicativo contendo nome e data de envio, foco inicial no botão "Cancelar" e tecla Esc para cancelar.
- [ ] **Exclusão com sucesso:** Ao confirmar em "Excluir inscrição", a linha é removida da tabela, surge o toast "Inscrição excluída.", o resumo de vagas/respostas atualiza e o link de edição daquela inscrição passa a exibir "Inscrição não encontrada".
- [ ] **Exportação Excel e PDF com datas formatadas:** Baixar o PDF e o Excel (ex.: formulário da SKF); a data de nascimento e outras perguntas de data saem formatadas em dd/mm/aaaa, com todas as respostas preenchidas e com acentuação correta em português.
- [ ] **Atualização automática na tela de respostas:** A tela exibe "Atualizado às HH:mm" perto do título; ao enviar uma inscrição pelo celular num formulário de teste, em até cerca de 30 segundos a nova linha aparece na tabela sem recarregar a tela e o horário de atualização avança; o botão manual "Atualizar" continua operacional.
- [ ] **Edição de inscrição pelo painel:** Na tabela de respostas, clicar em "Editar" abre o diálogo com os campos preenchidos; trocar um dado (ex.: a distância) e salvar: a tabela mostra o novo valor imediatamente e o selo "Editada".
- [ ] **CPF bloqueado na edição pelo admin:** No diálogo de edição, o CPF aparece bloqueado (`readOnly`) com a nota "O CPF não pode ser alterado.".
- [ ] **Alerta de e-mail alterado e envio de confirmação:** No diálogo, trocar o e-mail da inscrição: ao salvar, surge a pergunta "O e-mail foi alterado. Enviar o e-mail de confirmação com o link de edição para {novo e-mail}?" com "Enviar agora" e "Agora não"; clicando em "Enviar agora", o e-mail chega na caixa de entrada, o link abre a página de edição e ela funciona.
- [ ] **Reenviar e-mail com o link de edição:** No diálogo, o botão secundário "Reenviar e-mail com o link de edição" pede confirmação exibindo o endereço de destino completo; ao confirmar, o e-mail é enviado pelo Resend e o botão é desativado por 60 segundos.
- [ ] **Edição em formulário encerrado:** Encerrar o formulário de teste e editar uma inscrição novamente pelo painel: a edição salva normalmente (o dono pode retificar mesmo após encerramento).
- [ ] **Reflexo nas exportações:** Após editar a inscrição pelo painel, exportar a planilha Excel: o arquivo baixado reflete os novos valores atualizados.
- [ ] **Segurança de autorização (dono):** Usuário autenticado que não é dono do formulário não consegue editar respostas nem disparar o reenvio de e-mail (retorna erro genérico de não encontrado sem revelar a existência).
- [ ] **Proteção de rota:** Sem login, o endereço de respostas leva a /auth e não mostra dados.
- [ ] **Busca de inscrições (T-26):** Buscar "ricardo" acha a inscrição; buscar um CPF só com números acha; buscar parte do telefone acha; buscar "livia" acha "Lívia"; buscar "02/10/2026" acha as datas.
- [ ] **Limpar busca e contador (T-26):** Clicar em "Limpar busca" volta à lista completa e o contador exibe "Mostrando N de N inscrições" com anúncio polido a leitores de tela.
- [ ] **Ordenação de inscrições (T-26):** As 4 ordens funcionam: "Mais recentes primeiro" (padrão), "Mais antigas primeiro" (mostrando a primeira inscrição no topo), "Nome (A a Z)" e "Nome (Z a A)" (com "Álvaro" ordenado entre "Alice" e "Bruno", e inscritos sem nome por último nas duas direções).
- [ ] **Rolagem da tabela e colunas fixas (T-26):** A barra de rolagem horizontal aparece junto da tabela (altura máxima 70vh) sem rolar a página; o cabeçalho fica fixo ao rolar para baixo e a coluna do nome fica fixa à esquerda ao rolar para a direita.
- [ ] **Densidade e não quebra de linha (T-26):** CPF, telefone e datas ficam em linha única (`whitespace-nowrap`), com números tabulares e sem quebra feia.
- [ ] **Card de detalhes da inscrição (T-26):** Clicar em qualquer ponto da linha (ou focar e pressionar Enter ou Espaço) abre o `ResponseDetailDialog`; os botões da linha não abrem o card; no card, os botões "Editar", "Copiar link de edição", "Reenviar e-mail" e "Excluir" funcionam.
- [ ] **Exportação Excel e PDF ordenadas (T-26):** O Excel e o PDF saem com todas as inscrições (ignoram filtro e busca) ordenadas de acordo com o `sortMode` selecionado na tela.
- [ ] **Regressão de ações da linha (T-26):** "Editar", "Copiar link de edição", "Excluir" e "Mostrar só editadas" continuam funcionando perfeitamente como antes.
- [ ] **Responsividade mobile 360 px (T-26):** No celular (360 px), apenas a área da tabela rola horizontalmente (a página não vaza) e o card de detalhes ocupa a tela inteira com boa legibilidade.
- [ ] **Acessibilidade por teclado (T-26):** Navegando com a tecla Tab, o foco chega à área da tabela (`role="region"` com `tabIndex={0}`) e as setas direcionais rolam seu conteúdo.
- [ ] **Coluna do nome sem congelar no celular (T-26b):** No celular em pé (menos de 768 px), rolar a tabela para a direita mostra e-mail, telefone e as demais colunas, e a coluna do nome rola junto sem esconder os dados.
- [ ] **Nome com reticências no celular (T-26b):** No celular, o nome aparece cortado com reticências (largura máxima); tocar na linha abre o card de detalhes com todos os dados completos.
- [ ] **Dica de toque em telas pequenas (T-26b):** A frase "Toque numa linha para ver todos os dados." aparece acima da tabela no celular e NÃO aparece no computador (a partir de 768 px).
- [ ] **Coluna do nome fixa no desktop/tablet (T-26b):** No computador e no tablet na horizontal (≥ 768 px), a coluna do nome continua fixa à esquerda ao rolar a tabela lateralmente.
- [ ] **Cabeçalho fixo preservado (T-26b):** O cabeçalho da tabela continua fixo no topo ao rolar para baixo em todos os tamanhos de tela.

### 5.6 Tela de Entrada (`/auth`)
- [ ] **Apenas e-mail e senha:** Não pode existir botão de "Criar conta", nem link alternativo, nem botão de login com o Google.
- [ ] **Redirecionamento:** Acessar o endereço raiz (`/`); deve redirecionar automaticamente para `/painel` (se logado) ou `/auth` (se deslogado).

### 5.7 Páginas Legais (`/legal/termos-de-uso` e `/legal/politica-de-privacidade`)
- [ ] **Abertura em nova aba sem login:** Os links `/legal/termos-de-uso` e `/legal/politica-de-privacidade` abrem em nova aba sem exigir autenticação.
- [ ] **Conteúdo dos Termos de Uso:** Exibe 10 itens com CNPJ "43.425.201/0001-43", e-mail "contato@triadetecnologiaesolucoes.com.br", foro "Cajamar/SP", data de atualização "01/10/2026", link "Ver também: Política de Privacidade" e dica "Você pode fechar esta aba para voltar ao formulário.".
- [ ] **Conteúdo da Política de Privacidade:** Exibe 11 itens com CNPJ, e-mail de contato, prazos de retenção e resposta ("30 dias" e "15 dias"), data de atualização "01/10/2026", link "Ver também: Termos de Uso" e dica "Você pode fechar esta aba para voltar ao formulário.".
- [ ] **Responsividade em 360 px:** As duas páginas leem bem no celular (360 px), sem overflow horizontal e com tipografia legível.

### 5.8 Identidade do Link
- [ ] **Ícone e título na aba:** A aba do navegador mostra o ícone da Corre Time e o título "Inscrições | Corre Time".
- [ ] **Prévia no WhatsApp:** Ao enviar para si mesmo, no WhatsApp, o link de um formulário: a prévia mostra a imagem com a logo (se aparecer a prévia antiga, o WhatsApp guardou cache: acrescente `?v=2` ao fim do link e envie de novo).
- [ ] **Robots noindex:** `curl.exe -s https://inscricoes.corretime.com.br/legal/termos-de-uso | findstr robots` mostra "noindex".
- [ ] **Nome e descrição no HTML:** No PowerShell, `[Console]::OutputEncoding = [Text.Encoding]::UTF8` e depois `curl.exe -s https://inscricoes.corretime.com.br/skf-trackfield-jkiguatemi | Select-String -Pattern "og:title","og:description"` mostra o nome e a descrição do formulário.
- [ ] **Prévia com dados do evento no WhatsApp:** Enviar para si mesmo no WhatsApp o link com `?v=3` no fim: a prévia mostra "SKF Running Team" e a descrição, com a imagem da logo.
- [ ] **Prévia genérica para formulário inexistente:** Um link de formulário que não existe continua mostrando a prévia genérica.

### 5.9 Link do Cliente Somente Leitura (`/c/$token` e Editor) (T-25 / M-20)
- [ ] **Gerar link no editor:** No editor de um formulário de teste, clicar em "Gerar link do cliente": o cartão exibe o link gerado; o botão "Copiar" funciona com feedback visual/sonoro.
- [ ] **Visualização anônima somente leitura:** Abrir o link gerado numa janela anônima (sem login): exibe título do evento, selo "Somente leitura", contadores de inscrições, vagas restantes (se houver), prazo (se houver), indicador "Atualizado às HH:mm" e a tabela com TODAS as inscrições e CPF completo, sem nenhum botão de editar ou excluir.
- [ ] **Interação na tabela e card de detalhes:** Busca rápida por texto, 4 modos de ordenação, cabeçalho fixo e coluna do nome fixa funcionam; clicar numa linha abre o card de detalhes sem botões de ação (somente leitura).
- [ ] **Exportações:** "Baixar Excel" e "Baixar PDF" baixam os arquivos corretos com as datas em dd/mm/aaaa e ordenação ativa; o PDF baixado abre e imprime normalmente.
- [ ] **Atualização periódica quase em tempo real:** Enviar uma nova inscrição no formulário de teste pelo celular: em até cerca de 30 segundos ela surge na tela do cliente sem recarregar a página.
- [ ] **Regenerar link do cliente:** No editor, acionar "Gerar novo link" e confirmar: o link anterior passa a exibir na hora "Este link não é válido ou foi desativado. Peça um novo link a quem o compartilhou.".
- [ ] **Desativar link do cliente:** No editor, acionar "Desativar link" e confirmar: o novo link também deixa de funcionar imediatamente.
- [ ] **Token inexistente ou inválido via cURL:** Requisição cURL contra `/c/0000000000000000000000000000000000000000000000000000000000000000` não retorna dados de inscrições e a página possui tag `noindex`.
- [ ] **Responsividade em 360 px:** No celular, a página não possui rolagem lateral (apenas a tabela rola internamente) e os botões de ação permanecem acessíveis.
- [ ] **Segurança estrita de dados (O link do cliente nunca expõe links de edição):** O link do cliente nunca expõe tokens de edição (`edit_token`) ou URLs de edição em nenhuma parte da tela, no HTML gerado, nos diálogos de detalhes, nos relatórios baixados (Excel/PDF) ou nos payloads das funções de servidor.

### 5.10 Imprimir do Link do Cliente e Polimento da Auditoria (T-37)
- [ ] **Baixar PDF idêntico ao da produção:** Na tela do cliente (`/c/$token`), "Baixar PDF" gera o arquivo exatamente igual ao da produção (orientação paisagem, cabeçalho roxo, todas as colunas, sem barra de rolagem). O PDF baixado abre e imprime normalmente.
- [ ] **Contador no singular com 1 inscrição (UX-12):** Quando o formulário tem exatamente 1 inscrição recebida, o contador exibe *"1 inscrição"* no singular (e no plural com 0 ou 2+ inscrições).
- [ ] **Ctrl+P nativo sem rolagem ou corte:** Acionar Ctrl+P diretamente na tela do cliente (sem usar o botão) aplica `@media print` removendo alturas máximas e barras de rolagem da tabela.
- [ ] **Acessibilidade de rótulo no ShareLinkCard (UX-13):** O campo com a URL do cliente no editor possui rótulo devidamente associado via `htmlFor` e `id` ou elemento não-rótulo sem falha de acessibilidade.
- [ ] **Teste de regressão SEC-26 (Injeção CSV/Excel):** Teste automatizado em `src/lib/exports.test.ts` confirma que respostas iniciadas por `=`, `+`, `-` ou `@` são exportadas pela biblioteca `xlsx` (`aoa_to_sheet`) estritamente com tipo texto (`t === "s"`) e sem propriedade de fórmula (`f`).

### 5.11 Texto Próprio na Prévia do Link do Cliente (T-39 e T-40)
- [ ] **Meta tags específicas no HTML inicial:** No PowerShell: `((curl.exe -s https://spec-001-fase-0-no-ar-form-builder-pro.triadetecnologiaesolucoes.workers.dev/c/0000000000000000000000000000000000000000000000000000000000000012) -split '<meta') | Select-String 'og:title|og:description|robots|referrer'` mostra o título e a descrição novos, e `noindex, nofollow` e `no-referrer`.
- [ ] **Prévia de cartão no WhatsApp:** No WhatsApp (conversa com você mesmo), colar esse endereço mostra o cartão com o título "NÃO COMPARTILHE: lista de inscritos | Corre Time" e a descrição "Acesso restrito, só leitura, com dados pessoais. Não é o link de inscrição.", e o aviso aparece mesmo em tela pequena.
- [ ] **Sem regressão na prévia do formulário público:** Colar o link de um formulário de inscrição (`.../<slug>`) continua mostrando o nome e a descrição do formulário (sem regressão).
- [ ] **Segurança em links desconhecidos:** O endereço dos 64 zeros continua mostrando "Link não encontrado", sem nenhum dado.

### 5.12 Editor: Edição no Cartão, Arrastar, Painel Sticky e Adicionar Abaixo (T-34)
- [ ] **Edição direta na pergunta e sincronia:** Clicar numa pergunta abre os campos de edição ali mesmo (rótulo, texto de ajuda, tipo, obrigatória e opções), refletindo simultaneamente no painel lateral; clicar novamente recolhe.
- [ ] **Painel lateral sticky na rolagem:** Em telas grandes (≥ 1024 px), o painel acompanha a rolagem suavemente sem ser escondido pelo cabeçalho fixo do sistema.
- [ ] **Inserção contextual de pergunta:** Com uma pergunta selecionada, "+ Adicionar pergunta" insere logo abaixo dela com foco automático e texto "Nova pergunta" selecionado; sem seleção, insere no fim.
- [ ] **Reordenação por arrasto (DND):** Arrastar pela alça exibe linha de inserção e reordena ao soltar com anúncio acessível em `aria-live`.
- [ ] **Setas de reordenação acessíveis:** Botões "Mover pergunta {n} para cima/baixo" acessíveis por teclado (Tab/Enter/Espaço), desabilitados no primeiro e último itens.
- [ ] **Exclusão segura com AlertDialog:** Botão "Excluir pergunta {n}" abre diálogo modal com título "Excluir esta pergunta?" e confirmação obrigatória.
- [ ] **Testes automatizados unitários:** Suíte `src/lib/question-order.test.ts` valida funções puras de reordenação e anúncios de movimento.

### 5.13 Correções do Editor: Largura, Barra Fixa, Foco e Posições (T-34b)
- [ ] **Contenção de largura com textos longos:** Pergunta com rótulo de 200 caracteres e texto de ajuda de 200 caracteres (inclusive sem espaço) não causa rolagem horizontal em 1024 px ou 1280 px; o painel lateral permanece fixo à direita e os cabeçalhos exibem reticências (`truncate`).
- [ ] **Formulário real com textos longos (SKF):** Inspeção visual na prévia do formulário SKF confirma ausência total de overflow horizontal e alinhamento do painel.
- [ ] **Barra de salvar fixa na rolagem:** Barra `sticky bottom-4 z-20` permanece sempre visível na base durante a rolagem, exibindo status e botão "Salvar", sem cobrir "+ Adicionar pergunta" ao final.
- [ ] **Sincronia de estado modificado (Dirty State):** Edição de qualquer campo ou reordenação alterna o status para "Alterações não salvas"; salvar ou reverter as mudanças retorna para "Tudo salvo".
- [ ] **Atalho de teclado Ctrl+S / Cmd+S:** Pressionar Ctrl+S ou Cmd+S aciona o salvamento imediato do formulário.
- [ ] **Interceptação ao fechar/recarregar:** Tentativa de recarregar a página ou fechar a aba com alterações pendentes dispara o aviso de confirmação padrão do navegador (`beforeunload`).
- [ ] **Foco único do rótulo:** Adicionar nova pergunta foca o rótulo com texto selecionado; fechar e reabrir a mesma pergunta posteriormente NÃO foca nem seleciona o texto.
- [ ] **Persistência imediata de posições no banco:** Ao adicionar pergunta abaixo de outra, `positionsToPersist` grava as posições de todas as perguntas no banco; recarregar sem salvar mantém a ordem da tela.
- [ ] **Responsividade da barra no mobile:** Em telas < 1024 px, a barra de salvar fixa permanece visível e funcional.
- [ ] **Testes automatizados de regressão e pureza:** Suítes `question-order.test.ts` (`positionsToPersist`), `editor-dirty.test.ts` (`editorSnapshot`, `isEditorDirty`) e `routes.test.ts` (verificação estática de `minmax(0,1fr)`, ausência de `grid-cols-[1fr_360px]`, `sticky bottom-4`, textos e atalhos).

### 5.14 Editor: Enter nas Opções, Adicionar Abaixo na Pergunta e Painel sem Aba Pergunta (T-34c)
- [ ] **Enter nas opções de escolha múltipla e única:** Digitar uma opção e apertar Enter abre uma linha nova vazia sem apagar o que foi digitado; repetir 3 vezes; ao sair do campo (`onBlur`) as linhas vazias são limpas e as opções normalizadas. Pressionar Enter no meio do texto continua funcionando.
- [ ] **Botão "+" contextual em cada pergunta:** Em cada pergunta há um botão "+" com dica "Adicionar uma pergunta logo abaixo desta" e `aria-label` "Adicionar pergunta abaixo da pergunta {n}". Clicar na pergunta 1, sem rolar até o fim, cria a nova logo abaixo dela, aberta, com o cursor no rótulo; clicar no "+" da última pergunta cria a nova no fim da lista.
- [ ] **Adicionar pergunta na barra fixa:** Na barra fixa de salvar, clicar no botão secundário "+ Adicionar pergunta" adiciona logo abaixo da pergunta selecionada ou, sem nenhuma selecionada, no fim, sem rolar a página.
- [ ] **Proteção contra clique duplo:** Dar dois cliques rápidos no botão "+" aciona o estado `adding` e cria apenas uma única pergunta.
- [ ] **Painel lateral sem a aba Pergunta:** O painel lateral tem exclusivamente as abas "Aparência" e "Limites e Termos" e abre por padrão em "Aparência". Ambas as abas continuam funcionando normalmente (troca de cor, limite de vagas, encerramento, consentimento e salvamento).
- [ ] **Edição direta no cartão preservada:** A edição dos dados da pergunta continua funcionando diretamente no cartão aberto (rótulo, ajuda, tipo, obrigatória e opções).
- [ ] **Responsividade da barra e botões em 360 px:** Em telas estreitas (< 1024 px e celular em 360 px), a barra fixa exibe os dois botões (adicionar e salvar) em `flex-wrap` sem cortar nada, e o painel lateral fica abaixo da lista de perguntas.
- [ ] **Inspeção visual do formulário real da SKF:** Abrir o formulário da SKF na prévia só para olhar (sem salvar, sem adicionar e sem excluir): o layout permanece contido na largura e sem a aba "Pergunta" no painel.
- [ ] **Verificação de largura com textos longos (reteste T-34b):** Pergunta com rótulo de 200 caracteres e texto de ajuda de 200 caracteres (inclusive letras sem espaço) não cria rolagem horizontal na página.
- [ ] **Testes automatizados estáticos:** Suíte `src/lib/routes.test.ts` valida que `QuestionEditFields.tsx` não contém `setText(options.join`, que o editor contém "Adicionar pergunta abaixo da pergunta" e "Adicionar uma pergunta logo abaixo desta", que o editor não contém `setTab("pergunta")`, `"pergunta" | "aparencia"` nem `tab === "pergunta"`, e que o editor contém o estado `adding`.

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
- [ ] **Verificação de Banco:** a última linha do `verificacao-banco.sql` no SQL Editor é `== RESUMO: 52 PASSOU, 0 FALHOU ==`.
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
