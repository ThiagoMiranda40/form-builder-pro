# Projeto de UI/UX — Spec 001 (Fase 0): Form Builder Pro

> **Documento:** Especificação de Interface e Experiência do Usuário (UI/UX) — Versão Revisada e Aprovada  
> **Origem dos requisitos:** `docs/PRD-form-builder-pro.md` (v2.1), `specs/001-fase-0-no-ar/spec.md`, `plan.md` e `tasks.md`  
> **Status:** Documentação de Design Aprovada  
> **Princípio orientador:** Estrutura antes de estilo. Estender a linguagem visual existente no repositório (Tailwind v4, utilitários `glass` e `glass-strong`, paleta oklch, tipografia Inter/Space Grotesk, classes utilitárias e helpers existentes) sem redesign e sem dependência de componentes externos. Mobile-first para telas públicas (360 px de base).

---

## Índice
1. [Diretrizes Transversais de Design e Acessibilidade](#1-diretrizes-transversais-de-design-e-acessibilidade)
2. [Tela A — Editor de Formulário (Endereço Personalizado e Consentimento)](#2-tela-a--editor-de-formulário)
3. [Tela B — Formulário Público (Inscrição, Consentimento e Sucesso)](#3-tela-b--formulário-público)
4. [Tela C — Nova Página /editar/{token} (Edição pelo Inscrito)](#4-tela-c--página-de-edição-de-inscrição-editartoken)
5. [Tela D — Página de Respostas (Copiar Link de Edição)](#5-tela-d--página-de-respostas)
6. [Tela E — Páginas legais (`/legal/termos-de-uso` e `/legal/politica-de-privacidade`)](#6-tela-e--páginas-legais)
7. [Tela F — Tela de Entrada /auth (Acesso Único do Administrador)](#7-tela-f--tela-de-entrada-auth)
8. [Tela G — Painel Principal /painel (Gráfico por Dia e Atualização Automática)](#8-tela-g--painel-principal-painel)
9. [Padrões de Markup e Classes Reutilizadas](#9-padrões-de-markup-e-classes-reutilizadas)
10. [Propostas de Mudança no spec / plan / tasks](#10-propostas-de-mudança-no-spec--plan--tasks)
11. [Ideias para a Fase 1](#11-ideias-para-a-fase-1)

---

## 1. Diretrizes Transversais de Design e Acessibilidade

### 1.1 Sistema Visual Existente no Repositório
Conforme verificado em `src/styles.css` e nas rotas existentes:
- **Cores base:** Fundo com gradiente suave fixo (`--gradient-app: linear-gradient(135deg, #eef1f8 0%, #e9eef7 50%, #e6ecf6 100%)`), cartões com efeito de vidro suave (`glass` e `glass-strong`), bordas sutis com anel de opacidade (`ring-1 ring-black/5`).
- **Tipografia:** `Space Grotesk` para títulos (`font-display`), `Inter` para corpo e rótulos (`font-body`), serifada condicional (`font-serif`).
- **Arredondamento:** Base de `rounded-lg` (`8px`) para inputs/botões e `rounded-2xl` (`16px`) para cartões.
- **Micro-interações:** Animação de entrada `rise` (fade in com deslocamento vertical de 8px).

### 1.2 Regra de Contraste Dinâmico dos Botões (RF-13, WCAG 1.4.3 / 1.4.11)
- O organizador pode definir qualquer cor hexadecimal como tema do formulário (`theme.color`), incluindo tons claros (ex.: `#ffff00`, `#22c55e`, `#ffffff`) ou escuros (ex.: `#4f46e5`, `#000000`).
- **Regra:** O texto do botão principal de submissão (tanto em `/$slug` quanto em `/editar/$token`) e do badge circular de sucesso deve ter **o maior contraste possível** com a cor do tema:
  - Fundo escuro (ex.: `#4f46e5`, `#000000`) → Texto branco (`#ffffff`).
  - Fundo claro (ex.: `#ffff00`, `#22c55e`, `#ffffff`) → Texto preto puro (`#000000`).
  - Motivo técnico: com `#0f172a`, o pior caso medido de contraste é 4,23:1 (abaixo do limiar); com `#000000`, o pior caso medido é 4,58:1, o que garante conformidade estrita com o WCAG AA (>= 4,5:1) para qualquer cor de tema possível.
  - A cor de fundo escolhida pelo organizador **nunca é alterada**.
  - A regra é executada pela função pura `readableTextColor(hex)` em `src/lib/theme.ts`.

### 1.3 Alvos de Toque Mobile-first (WCAG 2.5.5 / 2.5.8)
- A regra de alvos de toque mínimos de 44px (ou preenchimento vertical `py-2.5` a `py-3` com área de toque mínima de `44 x 44 px`) vale para as telas públicas (`/$slug` e `/editar/{token}`) e para a tela de autenticação `/auth`.
- A tabela de respostas do administrador (`/formularios/$id/respostas`) mantém a densidade de dados e o botão compacto atual (`py-1.5`), adequado para a visualização de múltiplas linhas pelo administrador em desktop.

---

## 2. Tela A — Editor de Formulário

### 2.1 Objetivo e Fluxo
- **Objetivo:** Permitir ao administrador configurar endereço personalizado amigável (RF-11), texto de consentimento LGPD (RF-08), e editar perguntas diretamente no próprio cartão na lista (T-34, T-34b, T-34c), reordenar perguntas por arrastar nativo ou por setas acessíveis, inserir novas perguntas no botão "+" de cada cartão ou "+ Adicionar pergunta" contextual com foco automático no rótulo, barra fixa de salvar com atalho Ctrl+S/Cmd+S, e painel lateral com rolagem fixa (lg:sticky) simplificado com as abas "Aparência" e "Limites e Termos" (aba "Pergunta" removida).
- **Fluxo do Administrador:**
  ```mermaid
  flowchart TD
      A[Acessa Editor /formularios/:id] --> B[Visualiza Cartão de Compartilhamento e Lista de Perguntas]
      B --> C{Ação na Lista de Perguntas}
      C -->|Clica no cabeçalho da pergunta| D[Seleciona e expande: abre QuestionEditFields no próprio cartão]
      C -->|Clica novamente na aberta| E[Recolhe a pergunta: selected = null]
      C -->|Arrasta pela alça| F[Arrasto nativo: mostra linha de inserção antes/depois e move ao soltar]
      C -->|Clica em Mover para cima/baixo| G[Move 1 posição com teclado/mouse e anuncia em aria-live]
      C -->|Clica no botão '+' do cartão| H1[Insere logo abaixo da pergunta correspondente]
      C -->|Clica em '+ Adicionar pergunta'| H2[Insere logo abaixo da selecionada ou no fim]
      H1 --> I[Grava posições com positionsToPersist e foca no rótulo com 'Nova pergunta' selecionado]
      H2 --> I
      C -->|Clica em 'Excluir pergunta'| J[Abre AlertDialog: 'Excluir esta pergunta?']
      J -->|Cancelar ou Esc| K[Fecha diálogo e devolve foco ao botão de exclusão]
      J -->|Excluir| L[Exclui no banco, normaliza posições e foca na próxima pergunta]
      B --> M[Painel Lateral de Configurações]
      M --> N[Acompanha a rolagem a partir de 1024px: lg:sticky lg:top-24]
      M --> O[Abas Aparência e Limites e Termos: configurações gerais]
  ```

### 2.2 Wireframes de Baixa Fidelidade

#### Mobile (360 px)
```text
+------------------------------------+
| [← Painel]   [Publicado]           |
| [Ver respostas] [Salvar] [Encerrar]|
+------------------------------------+
| LINK DE COMPARTILHAMENTO           |
| Endereço: https://dominio.com/...  |
+------------------------------------+
| PERGUNTAS DO FORMULÁRIO            |
|                                    |
| [::] [ 1. CPF (cpf)          ] [↑][↓][+][✕]
|                                    |
| [::] [ 2. Nome completo (text) ] [↑][↓][+][✕]
| +--------------------------------+ |
| | Rótulo da pergunta:            | | <- QuestionEditFields no cartão
| | [ Nome completo              ] | |
| | Texto de ajuda:                | |
| | [ Opcional                   ] | |
| | Tipo: [ Texto curto          ] | |
| | [x] Resposta obrigatória       | |
| +--------------------------------+ |
|                                    |
| [ + Adicionar pergunta           ] |
| A nova pergunta entra logo abaixo  |
| da pergunta selecionada.           |
|                                    |
| [● Alterações não salvas           |
|  [+ Adicionar pergunta] [Salvar] ] | <- Barra fixa (sticky bottom-4)
+------------------------------------+
| CONFIGURAÇÕES (Abaixo da lista)    |
| [ Aparência ] [ Limites e Termos ] |
+------------------------------------+
```

#### Desktop (≥ 1024 px) — Painel Lateral com `lg:sticky` e Barra de Salvar Fixa
```text
+----------------------------------------------------------------------------------------------------+
| [← Painel]  [● Publicado]                          [Ver respostas]  [Salvar]  [Encerrar formulário] |
+----------------------------------------------------------------------------------------------------+
| LINK DE COMPARTILHAMENTO                                                                           |
| Endereço: https://meudominio.com/skf-corrida-track-field                          [ Copiar link ]  |
+----------------------------------------------------------------------------------------------------+
| PERGUNTAS DO FORMULÁRIO (min-w-0)                 | CONFIGURAÇÕES (Acompanha a rolagem: lg:sticky)  |
|                                                  | [ Aparência ] [ Limites e Termos ]              |
| <ol>                                             |                                                 |
| <li> [::] [ 1. CPF (cpf)       ] [↑][↓][+][✕] </li> | Limite de respostas / vagas:                  |
|                                                  | [ 50                                          ] |
| <li> [::] [ 2. Nome (text) ▼   ] [↑][↓][+][✕] </li> |                                                 |
| +----------------------------------------------+ | Prazo final (data e hora):                      |
| | Rótulo: [ Nome completo                    ] | | [ 15/10/2026, 23:59                           ] |
| | Ajuda:  [ Opcional                         ] | |                                                 |
| | Tipo:   [ Texto curto                      ] | | Texto de consentimento (LGPD):                  |
| | [x] Resposta obrigatória                     | | +---------------------------------------------+ |
| +----------------------------------------------+ | | Declaro que concordo com o regulamento...   | |
|                                                  | +---------------------------------------------+ |
| <li> [::] [ 3. Modalidade      ] [↑][↓][+][✕] </li> | Opcional. Se preenchido, o aceite é           |
| </ol>                                            | obrigatório para concluir a inscrição.          |
|                                                  |                                                 |
| [ + Adicionar pergunta                       ] |                                                 |
| A nova pergunta entra logo abaixo da pergunta    |                                                 |
| selecionada.                                     |                                                 |
|                                                  |                                                 |
| [● Alterações não salvas  [+ Adicionar pergunta] [Salvar]] | <- Barra de salvar fixa               |
+----------------------------------------------------------------------------------------------------+
```

### 2.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Padrão / Carregado** | Prefixo `${window.location.origin}/` exibido como bloco não editável (`bg-white/60 text-muted-foreground text-xs px-3 py-2 rounded-l-lg`); campo de slug com valor atual (`inputClass`). Lista de perguntas em `<ol>` com botões acessíveis e alça de arrasto. Layout com grade `lg:grid-cols-[minmax(0,1fr)_360px]`, coluna esquerda com `min-w-0`, `<ol>` e `<li>` com `min-w-0`, cabeçalhos flexíveis com `truncate` e campos de texto `w-full min-w-0`, prevenindo qualquer rolagem horizontal da página mesmo com rótulos ou ajudas longas (até 200 caracteres sem espaço). |
| **Pergunta Recolhida** | Item `<li>` exibindo botão de cabeçalho (`aria-expanded="false"`) com número, rótulo, tipo e texto de ajuda com truncamento visual de linha única, acompanhado dos botões independentes de arrastar ("Arrastar pergunta {n}"), mover para cima ("Mover pergunta {n} para cima"), mover para baixo ("Mover pergunta {n} para baixo"), adicionar pergunta abaixo ("Adicionar pergunta abaixo da pergunta {n}") e excluir ("Excluir pergunta {n}"). Mover para cima fica desabilitado no primeiro item; mover para baixo no último. Alça com `cursor-grab`; botões com cursor pointer e alvo mínimo de 32 px. |
| **Pergunta Selecionada / Aberta** | Botão de cabeçalho com `aria-expanded="true"` e `aria-controls`. Dentro do cartão da pergunta surge o componente `QuestionEditFields` (rótulo com maxLength 200, texto de ajuda com maxLength 200 e placeholder "Opcional", tipo de campo, caixa "Resposta obrigatória" e, para tipos de escolha, gerenciamento de opções). No campo de opções (múltipla e única escolha), a tecla Enter abre nova linha no fim do texto sem resetar a digitação (sem `useEffect` sobrescrevendo o texto); a normalização das opções ocorre ao sair do campo (`onBlur`). Clicar novamente no cabeçalho fecha a edição (`selected = null`). Reabrir a mesma pergunta posteriormente não foca nem seleciona o texto do rótulo (proteção contra sobrescrita acidental). |
| **Arrastando Pergunta (DND Nativo)** | Acionado exclusivamente ao pressionar a alça de arrasto (`pointerdown` ativa `draggable` no `<li>`). No `dragstart`: `effectAllowed = "move"` e transferência de id via `text/plain`. Item arrastado exibe opacidade reduzida. Nos itens sobre os quais se passa o mouse (`dragover`), calcula se o cursor está na metade superior ou inferior e exibe linha visual de inserção antes ou depois. No `drop`, reposiciona via `moveToIndex`. Ao final (`dragend` / `pointerup`), limpa estados de arrasto e anuncia via `aria-live="polite"` ("Pergunta movida para a posição {n} de {total}."). As novas posições alteram o snapshot local e ativam o status de alterações não salvas. |
| **Painel Lateral com Rolagem (Desktop)** | A partir de 1024 px (`lg:`), o painel lateral `<aside>` acompanha a rolagem da página: `lg:sticky lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:top-24`, sem ser obstruído pelo cabeçalho fixo do `AppShell` (`z-30`) e mantendo-se perfeitamente visível à direita sem que textos longos o empurrem para fora da tela. O painel lateral possui apenas duas abas: "Aparência" e "Limites e Termos", abrindo por padrão em "Aparência" (a aba "Pergunta" foi removida, já que a edição é realizada no próprio cartão). Em telas menores (< 1024 px), permanece no fluxo normal abaixo da lista. |
| **Barra de Salvar Fixa (Sticky Bottom)** | Na base da coluna esquerda, após a dica de adicionar pergunta, barra `sticky bottom-4 z-20 mt-4` com acabamento `glass-strong rounded-xl ring-1 ring-black/10 px-4 py-3`. À esquerda exibe `<p role="status">` com "Alterações não salvas" (precedido por ponto âmbar `aria-hidden`) quando o editor está modificado, ou "Tudo salvo" quando o estado reflete o último salvamento. À direita, grupo com quebra de linha flexível (`flex-wrap`) contendo o botão secundário "+ Adicionar pergunta" (`title="Adiciona logo abaixo da pergunta selecionada ou, se nenhuma estiver selecionada, no fim da lista"`) e o botão primário "Salvar" (com texto "Salvando..." e desabilitado durante persistência). Fica sempre visível na rolagem e não cobre o botão de adicionar pergunta ao chegar no fim. |
| **Aviso ao Fechar/Recarregar (beforeunload)** | Enquanto houver alterações locais não salvas (`isEditorDirty === true`), o editor intercepta tentativas de recarregar a página ou fechar a aba disparando a confirmação padrão do navegador (`beforeunload`). O estado limpo é restaurado após salvar com sucesso ou quando modificações são revertidas (ex.: mover pergunta e devolvê-la à posição original). |
| **Atalho de Teclado (Ctrl+S / Cmd+S)** | Pressionar Ctrl+S (no Windows/Linux) ou Cmd+S (no macOS) executa imediatamente a função `save()`, prevenindo o comportamento padrão do navegador e salvando todas as configurações e perguntas sem necessidade de cliques. |
| **Adicionar Pergunta** | A inserção de pergunta pode ser feita em três locais: (1) no botão "+" do cabeçalho de cada cartão (adiciona logo abaixo daquela pergunta específica com `addQuestion(q.id)`); (2) no botão secundário "+ Adicionar pergunta" da barra fixa (adiciona logo abaixo da selecionada ou no fim); (3) no botão tracejado "+ Adicionar pergunta" do fim da lista. Todas as ações usam o estado `adding` para desabilitar os botões e impedir duplo clique. Todas as demais perguntas da lista têm suas posições atualizadas imediatamente no banco via `positionsToPersist`, garantindo que mesmo recarregando sem clicar em Salvar a ordem da tela é rigorosamente preservada no banco. Em caso de falha de rede na atualização das posições, exibe alerta *"Não foi possível reordenar as perguntas. Clique em Salvar para corrigir a ordem."*. A nova pergunta fica selecionada, aberta, com rolagem suave até ela (`scrollIntoView({ block: "nearest" })`), foco no campo de rótulo e o texto padrão "Nova pergunta" selecionado para substituição imediata apenas no momento da criação. Abaixo do botão do fim há a dica: *"A nova pergunta entra logo abaixo da pergunta selecionada."*. |
| **Excluir com Confirmação (AlertDialog)** | O botão "Excluir pergunta {n}" abre diálogo modal `AlertDialog` com título *"Excluir esta pergunta?"*, descrição *"As respostas já enviadas a ela deixam de aparecer na tabela e nas exportações. Esta ação não pode ser desfeita."*, foco inicial em *"Cancelar"* e botão destrutivo *"Excluir"*. Ao cancelar ou pressionar Esc, o foco retorna ao botão de exclusão de origem. Ao confirmar, exclui no banco, normaliza as posições locais e move o foco para o cabeçalho da próxima pergunta (ou anterior, ou botão de adicionar). Sem uso de `window.confirm`. |
| **Digitando Slug** | Execução de `sanitizeSlugInput`: converte acentos para letras simples, maiúsculas para minúsculas, caracteres especiais e espaços viram hífen único. Mantém hífen final temporário para digitação contínua. |
| **Blur do Slug** | Disparo de `trimSlugEdges`: remove hífen residual do início ou fim. |
| **Erro: Tamanho inválido** | Texto vermelho abaixo do campo: *"O endereço deve ter entre 3 e 60 caracteres."*. |
| **Erro: Caracteres inválidos** | Texto vermelho: *"Use apenas letras minúsculas, números e hífens."*. |
| **Erro: Nome reservado** | Texto vermelho: *"Esse nome é reservado pelo sistema."* (para `auth`, `painel`, `formularios`, `api`, `saude`, `admin`, `assets`, `login`, `editar`). |
| **Erro do Banco ao Salvar (23505)** | Conflito de unicidade retornado no save: *"Esse endereço já está em uso."*. |
| **Aviso: Formulário Publicado** | Bloco âmbar (`bg-amber-50 text-amber-800 ring-1 ring-amber-200/80 rounded-lg p-3 text-xs`) visível quando `form.status === "published"` e o slug foi alterado: *"Atenção: como este formulário já está publicado, links já compartilhados deixarão de funcionar se você alterar o endereço."*. |
| **Descrição do Formulário (Edição)** | Campo textarea com crescimento automático conforme o conteúdo (ref + efeito a cada mudança e no carregamento: mínimo de 4 linhas, máximo de 24rem com rolagem vertical). Aparência de campo editável: `rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-slate-700 ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none resize-none`. Acessibilidade: `aria-label="Descrição do formulário"`, placeholder explicativo e contador `"N/1000"` (`text-xs text-slate-600`, contraste >= 4,5:1, ligado por `aria-describedby`, cor âmbar escuro a partir de 900 caracteres, `maxLength={1000}`). |
| **Abas do Editor** | Botões com texto exato sem transformação CSS (`capitalize` removido): "Aparência" e "Limites e Termos" (a aba "Pergunta" foi removida). |
| **Salvando** | Botão "Salvar" desabilitado com texto *"Salvando..."*. |
| **Sucesso** | Toast via Sonner com os textos já usados no código: *"Alterações salvas."* ao salvar alterações e *"Formulário publicado! O link já pode ser compartilhado."* ao publicar. |

### 2.4 Textos Exatos da Interface
- **Rótulo do slug:** "Endereço do formulário"
- **Erro tamanho:** "O endereço deve ter entre 3 e 60 caracteres."
- **Erro formato:** "Use apenas letras minúsculas, números e hífens."
- **Erro reservado:** "Esse nome é reservado pelo sistema."
- **Erro banco (23505):** "Esse endereço já está em uso."
- **Alerta de republicação:** "Atenção: como este formulário já está publicado, links já compartilhados deixarão de funcionar se você alterar o endereço."
- **Toast ao salvar alterações:** "Alterações salvas."
- **Toast ao publicar formulário:** "Formulário publicado! O link já pode ser compartilhado."
- **Rótulo do consentimento:** "Texto de consentimento (LGPD)"
- **Ajuda do consentimento:** "Opcional. Se preenchido, o participante só poderá concluir a inscrição após marcar a caixa de aceite."
- **Aria-label da descrição:** "Descrição do formulário"
- **Placeholder da descrição:** "Descrição exibida para quem for se inscrever. As quebras de linha que você digitar aparecem na tela de inscrição."
- **Rótulo exato da aba:** "Limites e Termos"
- **Tipo de campo Data de nascimento (Editor):** Rótulo "Data de nascimento", dica "Não aceita hoje nem datas futuras"
- **Botão adicionar pergunta:** "+ Adicionar pergunta"
- **Ajuda do botão adicionar pergunta:** "A nova pergunta entra logo abaixo da pergunta selecionada."
- **Título padrão da pergunta nova:** "Nova pergunta"
- **Placeholder do texto de ajuda da pergunta:** "Opcional"
- **Rótulo da caixa obrigatória:** "Resposta obrigatória"
- **Aria-label da alça de arrasto:** "Arrastar pergunta {n}"
- **Aria-label mover para cima:** "Mover pergunta {n} para cima"
- **Aria-label mover para baixo:** "Mover pergunta {n} para baixo"
- **Aria-label adicionar pergunta abaixo:** "Adicionar pergunta abaixo da pergunta {n}"
- **Título do botão adicionar abaixo na pergunta:** "Adicionar uma pergunta logo abaixo desta"
- **Título do botão adicionar na barra fixa:** "Adiciona logo abaixo da pergunta selecionada ou, se nenhuma estiver selecionada, no fim da lista"
- **Aria-label excluir pergunta:** "Excluir pergunta {n}"
- **Anúncio de movimento (aria-live):** "Pergunta movida para a posição {n} de {total}."
- **Aviso de falha na reordenação automática:** "Não foi possível reordenar as perguntas. Clique em Salvar para corrigir a ordem."
- **Título do diálogo de exclusão de pergunta:** "Excluir esta pergunta?"
- **Descrição do diálogo de exclusão de pergunta:** "As respostas já enviadas a ela deixam de aparecer na tabela e nas exportações. Esta ação não pode ser desfeita."
- **Botão cancelar exclusão de pergunta:** "Cancelar"
- **Botão confirmar exclusão de pergunta:** "Excluir"
- **Status de alterações pendentes na barra de salvar:** "Alterações não salvas"
- **Status de tudo salvo na barra de salvar:** "Tudo salvo"
- **Botão salvar na barra:** "Salvar"
- **Texto do botão enquanto salva:** "Salvando..."

---

## 3. Tela B — Formulário Público

### 3.1 Objetivo e Fluxo
- **Objetivo:** Permitir ao inscrito preencher seus dados, validar CPF único (RF-03), aceitar termo LGPD se houver (RF-08), ser protegido contra robôs (RF-09), e receber a tela de confirmação com mensagem personalizada (RF-12), link de edição (RF-05) e aviso condicional de e-mail.
- **Fluxo do Inscrito:**
  ```mermaid
  flowchart TD
      A[Acessa /:slug] --> B{Status do Formulário}
      B -->|not_found| C[Exibe tela: 'Formulário não encontrado']
      B -->|draft| D[Exibe tela: 'Formulário indisponível']
      B -->|closed| E[Exibe tela: 'Inscrições encerradas']
      B -->|full| F[Exibe tela: 'Vagas esgotadas']
      B -->|open| G[Exibe Formulário com Tema Customizado]
      G --> H[Preenche respostas]
      H --> I{Tem Consentimento?}
      I -->|Sim| J[Exibe caixa de aceite]
      I -->|Não| K[Sem caixa de aceite]
      J --> L{Marcou aceite?}
      L -->|Não| M[Erro em linha: 'É necessário aceitar o termo para continuar.']
      L -->|Sim| N[Clica em 'Enviar inscrição']
      K --> N
      N --> O[Envia payload com campo hp invisível]
      O --> P{Validação do Servidor e Banco}
      P -->|CPF Duplicado| Q[Erro no campo CPF: 'CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador.']
      P -->|Vagas Esgotadas no Envio| R[Alerta: 'O limite de inscrições foi atingido.']
      P -->|Prazo Expirado no Envio| S[Alerta: 'O prazo de preenchimento encerrou.']
      P -->|Sucesso| T[Exibe Tela de Sucesso]
      T --> U[Mensagem personalizada do admin]
      T --> V[Link de edição + Botão Copiar + Aviso 'guarde este link']
      T --> W{emailSent === true?}
      W -->|Sim| X[Exibe: 'Enviamos um resumo e o link para o seu e-mail.']
      W -->|Não| Y[Oculta linha de e-mail]
  ```

### 3.2 Wireframes de Baixa Fidelidade

#### Formulário Aberto — Mobile (360 px)
```text
+------------------------------------+
| [ Logotipo do Evento ]             |
|                                    |
| Corrida SKF Track&Field 2026       |
| Etapa Parque Ibirapuera            |
| (12 vagas restantes)  (Prazo: 15/out)
+------------------------------------+
| CPF *                              |
| [ 529.982.247-25                 ] |
| (X) CPF já inscrito. Use o link de | <- erro ancorado no campo CPF
|     edição enviado ao seu e-mail   |
|     ou fale com o organizador.     |
|                                    |
| Nome completo *                    |
| [ Maria da Silva                 ] |
|                                    |
| Distância *                        |
| ( ) 5 km                           |
| (o) 10 km                          |
|                                    |
| E-mail para confirmação *          |
| [ maria@gmial.com                ] |
| (i) Você quis dizer maria@gmail.com? [ Usar este endereço ] | <- sugestão de domínio no blur
|                                    |
| Confirme seu e-mail *              |
| [ maria@gmail.com                ] |
| (X) Os e-mails não são iguais.     | <- erro quando os campos diferem
|                                    |
| [Texto do consentimento definido ] |
| [pelo organizador do evento...   ] |
|                                    |
| Leia os Termos de Uso e a          | <- links em nova aba com texto para leitor
| Política de Privacidade.           |
|                                    |
| [x] Declaro que li e concordo com  | <- novo rótulo da caixa
|     os termos acima, com os Termos |
|     de Uso e com a Política de     |
|     Privacidade. *                 |
|                                    |
| [      Enviar inscrição          ] | <- cor do tema com readableTextColor
+------------------------------------+
| Termos de Uso · Política de Priv.  | <- rodapé discreto em todos os estados (<nav>)
```

#### Tela de Sucesso — Estado 1: `emailSent === true` (Mobile 360 px)
```text
+------------------------------------+
|                                    |
|               ( ✓ )                | <- fundo cor do tema + readableTextColor
|            Tudo certo!             |
|                                    |
| Inscrição confirmada! Nos vemos    | <- mensagem personalizada do admin
| na largada com muita energia!      |
|                                    |
| +--------------------------------+ |
| | [✉] Enviamos um resumo e o     | | <- bloco em destaque (verde claro com anel)
| |     link para o seu e-mail.    | |
| |                                | |
| | Enviado para:                  | |
| | maria@gmail.com                | | <- em negrito e break-all
| |                                | |
| | Não chegou? Procure na caixa   | | <- contraste mínimo 4,5:1
| | de spam ou lixo eletrônico.    | |
| +--------------------------------+ |
|                                    |
| +--------------------------------+ |
| | Link para editar sua inscrição: | |
| |                                | |
| | https://meudominio.com/        | |
| | editar/a8f12c...               | |
| |                                | |
| | [ 📋 Copiar link ]             | |
| |                                | |
| | [!] Guarde este link:          | |
| | Ele é a única forma de você    | |
| | corrigir seus dados caso       | |
| | precise.                       | |
| +--------------------------------+ |
|                                    |
+------------------------------------+
```

#### Tela de Sucesso — Estado 2: `emailSent === false` (Mobile 360 px)
```text
+------------------------------------+
|                                    |
|               ( ✓ )                |
|            Tudo certo!             |
|                                    |
| Inscrição confirmada! Nos vemos    |
| na largada com muita energia!      |
|                                    |
| +--------------------------------+ |
| | Link para editar sua inscrição: | |
| |                                | |
| | https://meudominio.com/        | |
| | editar/a8f12c...               | |
| |                                | |
| | [ 📋 Copiar link ]             | |
| |                                | |
| | [!] Guarde este link:          | |
| | Ele é a única forma de você    | |
| | corrigir seus dados caso       | |
| | precise.                       | |
| +--------------------------------+ |
|                                    |
| +--------------------------------+ |
| | [!] Não conseguimos enviar o   | | <- aviso âmbar (se houver campo de e-mail)
| |     e-mail agora. Guarde o     | |
| |     link acima: é a sua forma  | |
| |     de corrigir seus dados.    | |
| +--------------------------------+ |
| (Sem campo de e-mail no formulário | <- nenhuma menção a e-mail se não houver pergunta
| nada sobre e-mail é exibido)       |
+------------------------------------+
```

#### Desktop (640 px centralizado)
```text
+------------------------------------------------------------------+
|                                                                  |
|                              ( ✓ )                               |
|                           Tudo certo!                            |
|                                                                  |
|      Inscrição confirmada! Nos vemos na largada com energia!     |
|                                                                  |
| +--------------------------------------------------------------+ |
| | [✉] Enviamos um resumo e o link para o seu e-mail.           | | <- bloco destacado
| | Enviado para: maria@gmail.com                                | |
| | Não chegou? Procure na caixa de spam ou lixo eletrônico.     | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Link para consultar ou alterar sua inscrição:                | |
| |                                                              | |
| | +------------------------------------------+ [ Copiar link ] | |
| | | https://meudominio.com/editar/           |                 | |
| | | a8f12c33-91b4-4e20-94d0-c3d97b9e0231     |                 | |
| | +------------------------------------------+                 | |
| |                                                              | |
| | [!] Guarde este link: ele é a única forma de você corrigir   | |
| |     seus dados caso precise.                                 | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### 3.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Carregando** | Frame centralizado com texto *"Carregando formulário..."*. |
| **Formulário Aberto** | Campos do formulário com `fieldClass`, máscara de CPF/telefone/RG. Botão com `backgroundColor: accent` e `color: readableTextColor(accent)`. |
| **Descrição com quebras de linha** | Parágrafo de descrição utilizando `normalizeDescription(form.description)` exibido somente quando não for vazio (evita parágrafo vazio acima das perguntas). Classes: `whitespace-pre-line break-words text-sm leading-relaxed text-slate-700`, preservando as quebras de linha digitadas e gerando espaçamento legível entre blocos. |
| **Destaque de Vagas e Prazo** | Bloco `<div role="group" aria-label="Vagas e prazo" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">` com cartões em destaque (`rounded-xl bg-white px-4 py-3 ring-1 ring-black/10`). Se apenas um existir, ocupa a largura inteira. Se ambos forem nulos, não renderiza. Cartão de Vagas: rótulo *"Vagas"*, valor `number` (`text-3xl font-bold text-slate-900`) e `label` (*"vaga restante"* ou *"vagas restantes"* em `text-sm text-slate-700`). Cartão de Prazo: rótulo *"Inscrições até"*, valor `dateText` (`text-2xl font-bold text-slate-900`) e `timeText` com prefixo *"às"* em `text-sm text-slate-700`, ambos calculados no fuso fixo "America/Sao_Paulo". |
| **Urgência de Vagas e Prazo** | Quando `urgent` for verdadeiro: fundo âmbar `bg-amber-50 ring-amber-300`, valor em `text-amber-950` e selo de texto explicativo (`rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900`). Vagas urgentes (<= 10 restantes): selo *"Últimas vagas"*. Prazo urgente: selo *"Encerra hoje"* ou *"Encerra amanhã"*. A cor nunca é o único sinal e o contraste respeita >= 4,5:1. Cores do tema não são aplicadas nesses cartões. |
| **Sugestão de E-mail (Blur)** | Ao sair de campo de e-mail com erro de digitação de domínio comum (ex.: gmial.com), exibe abaixo em `aria-live="polite"`: *"Você quis dizer <sugestão>?"* e o botão *"Usar este endereço"*. |
| **Confirmação de E-mail** | Segundo campo obrigatório de confirmação exibido abaixo de cada e-mail. Se divergirem, bloqueia o envio com foco e erro: *"Os e-mails não são iguais."*. |
| **Anti-robô (Honeypot)** | Campo com atributo invisível ao humano (`style={{ position: "absolute", left: "-9999px", opacity: 0 }}`, `tabIndex={-1}`, `autoComplete="off"`). |
| **Consentimento e Links Legais** | Se o formulário tiver texto de consentimento: exibe o texto, seguido imediatamente da linha *"Leia os Termos de Uso e a Política de Privacidade."* com os dois links (`target="_blank"`, `rel="noopener noreferrer"`, sublinhados, contraste >= 4,5:1) contendo o texto para leitor de tela *" (abre em outra aba)"*. Caixa de aceite com rótulo *"Declaro que li e concordo com os termos acima, com os Termos de Uso e com a Política de Privacidade."*. |
| **Rodapé de Documentos Legais** | Em **todos os estados** da tela pública (aberto, sucesso, indisponível, encerrado, esgotado, não encontrado), abaixo do cartão principal, exibe `<nav aria-label="Documentos legais">` com *"Termos de Uso · Política de Privacidade"* abrindo em nova aba com texto para leitor de tela. |
| **Erro: Consentimento** | Mensagem vermelha abaixo da caixa: *"É necessário aceitar o termo para continuar."*. |
| **Erro: CPF Duplicado** | Mensagem no próprio campo CPF com foco automático: *"CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador."*. |
| **Erro Geral (Banco)** | Alertas no topo: *"O limite de inscrições foi atingido."* ou *"O prazo de preenchimento encerrou."*. |
| **Enviando** | Botão com opacidade reduzida (`disabled={true}`), texto *"Enviando..."*. |
| **Sucesso (emailSent === true)** | Bloco em destaque verde claro com anel e envelope ANTES do link: *"Enviamos um resumo e o link para o seu e-mail."*, *"Enviado para: <endereço>"* e *"Não chegou? Procure na caixa de spam ou lixo eletrônico."*, seguido do cartão do link de edição e do rodapé legal. |
| **Sucesso (emailSent === false com e-mail)** | Cartão do link de edição seguido de aviso âmbar: *"Não conseguimos enviar o e-mail agora. Guarde o link acima: é a sua forma de corrigir seus dados."* e do rodapé legal. |
| **Sucesso (sem pergunta de e-mail)** | Cartão do link de edição sem nenhuma menção a e-mail, seguido do rodapé legal. |
| **Campo Data de nascimento** | `<input type="date">` com `autoComplete="bday"` e limites no seletor (`min="1900-01-01"` e `max` igual ao dia anterior a hoje em São Paulo via `birthdateBounds(now)`). |
| **Erro: Data de nascimento (hoje/futura)** | Mensagem vermelha abaixo do campo: *"Informe uma data de nascimento válida: não pode ser hoje nem uma data futura."*. |
| **Erro: Data de nascimento (inválida)** | Mensagem vermelha abaixo do campo: *"Data de nascimento inválida."* (quando formato/calendário for inválido ou a data for anterior a 1900-01-01). |
| **Vagas Esgotadas / Encerrado** | Telas estáticas em `Frame`: *"Vagas esgotadas"* ou *"Inscrições encerradas"*, com rodapé legal abaixo do cartão. |

### 3.4 Textos Exatos da Interface
- **Botão de envio:** "Enviar inscrição"
- **Rótulo confirmação de e-mail:** "Confirme seu e-mail"
- **Erro divergência de e-mail:** "Os e-mails não são iguais."
- **Sugestão de e-mail:** "Você quis dizer "
- **Botão aplicar sugestão:** "Usar este endereço"
- **Linha de introdução aos links legais:** "Leia os Termos de Uso e a Política de Privacidade."
- **Texto acessível de link em nova aba:** " (abre em outra aba)"
- **Rótulo da caixa de consentimento:** "Declaro que li e concordo com os termos acima, com os Termos de Uso e com a Política de Privacidade."
- **Aria-label do rodapé legal:** "Documentos legais"
- **Links do rodapé legal:** "Termos de Uso" e "Política de Privacidade"
- **Erro consentimento:** "É necessário aceitar o termo para continuar."
- **Erro CPF duplicado:** "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador."
- **Título de sucesso:** "Tudo certo!"
- **Aviso e-mail enviado (título do bloco):** "Enviamos um resumo e o link para o seu e-mail."
- **Aviso e-mail enviado (destinatário):** "Enviado para: "
- **Aviso e-mail enviado (ajuda spam):** "Não chegou? Procure na caixa de spam ou lixo eletrônico."
- **Aviso e-mail falhou:** "Não conseguimos enviar o e-mail agora. Guarde o link acima: é a sua forma de corrigir seus dados."
- **Rótulo do link:** "Link para editar sua inscrição:"
- **Botão copiar link:** "Copiar link"
- **Feedback após copiar:** "Link copiado!"
- **Aviso de segurança:** "Guarde este link. Ele é a única forma de você corrigir seus dados caso precise."
- **Texto de inscrições encerradas:** "Este formulário não está mais recebendo inscrições."
- **Aria-label do grupo vagas e prazo:** "Vagas e prazo"
- **Rótulo do cartão de vagas:** "Vagas"
- **Sufixo de vaga restante singular:** "vaga restante"
- **Sufixo de vagas restantes plural:** "vagas restantes"
- **Selo de vagas urgentes:** "Últimas vagas"
- **Rótulo do cartão de prazo:** "Inscrições até"
- **Prefixo de horário:** "às"
- **Selo de encerramento hoje:** "Encerra hoje"
- **Selo de encerramento amanhã:** "Encerra amanhã"
- **Erro data de nascimento hoje ou futura:** "Informe uma data de nascimento válida: não pode ser hoje nem uma data futura."
- **Erro data de nascimento inválida:** "Data de nascimento inválida."
- **Erro data genérica inválida:** "Data inválida."


### 3.5 Markup e Classes Reutilizadas (de `src/routes/f.$slug.tsx`)
- Container: `<div className="flex min-h-screen items-start justify-center px-5 py-10 sm:py-16"><div className="glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8">{children}</div></div>`.
- Classe de campo: `fieldClass = "w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"`.
- Checkbox de consentimento: `<input type="checkbox" className="size-4" style={{ accentColor: accent }} />`.
- Botão de envio: `<button type="submit" disabled={sending} className="w-full rounded-lg py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: accent, color: readableTextColor(accent) }}>`.

---

## 4. Tela C — Página de Edição de Inscrição (`/editar/{token}`)

### 4.1 Objetivo e Fluxo
- **Objetivo:** Permitir ao inscrito retificar suas respostas sem acionar o organizador (RF-06). A rota é direta por token (`/editar/{token}`), exibe o CPF bloqueado como somente leitura, aplica a **fonte do tema** (`theme.font`: `body`/`display`/`serif`, utilizando a mesma lógica `fontClass` do formulário público), além do logotipo e da cor (`accent` com `readableTextColor`), não reexibe o termo LGPD, não consome vaga, e informa sobre o reenvio de e-mail apenas quando `emailSent === true`.
- **Fluxo do Inscrito:**
  ```mermaid
  flowchart TD
      A[Acessa link /editar/:token] --> B[Carrega dados via getResponseForEdit]
      B --> C{Estado da Resposta}
      C -->|not_found| D[Tela: 'Inscrição não encontrada']
      C -->|closed| E[Tela: 'Edição encerrada - O prazo para este formulário já terminou.']
      C -->|open| F[Exibe formulário com respostas preenchidas]
      F --> G[Campo CPF bloqueado / somente leitura]
      F --> H[Inscrito altera dados desejados]
      H --> I[Clica em 'Salvar alterações']
      I --> J[updateResponseByToken no servidor/banco]
      J --> K{Resultado}
      K -->|identifier_locked| L[Erro: 'O CPF não pode ser alterado.']
      K -->|Sucesso| M[Exibe banner: 'Alterações salvas!']
      M --> N{emailSent === true?}
      N -->|Sim| O[Complementa texto: 'Enviamos um resumo atualizado para o seu e-mail.']
      N -->|Não| P[Sem menção a e-mail]
  ```

### 4.2 Wireframes de Baixa Fidelidade

#### Mobile (360 px) — Formulário Aberto
```text
+------------------------------------+
| [ Logotipo do Evento ]             |
|                                    |
| [ EDITANDO INSCRIÇÃO ]             |
| Corrida SKF Track&Field 2026       |
|                                    |
| Altere os campos desejados e       |
| clique em "Salvar alterações".     |
+------------------------------------+
| CPF (Identificador da inscrição)   |
| +--------------------------------+ |
| | 529.982.247-25              🔒 | | <- readOnly com fundo sutil
| +--------------------------------+ |
| [i] O CPF não pode ser alterado.   |
|                                    |
| Nome completo *                    |
| [ Maria da Silva Santos          ] |
|                                    |
| Distância *                        |
| ( ) 5 km                           |
| (o) 10 km   <-- alterou de 5 km    |
|                                    |
| E-mail *                           |
| [ maria.santos@gmail.com         ] |
|                                    |
| [      Salvar alterações         ] | <- cor do tema com readableTextColor
+------------------------------------+
```

#### Mobile (360 px) — Confirmação (Estado 1: `emailSent === true`)
```text
+------------------------------------+
| [ Logotipo do Evento ]             |
|                                    |
| +--------------------------------+ |
| | [✓] ALTERAÇÕES SALVAS          | |
| | Suas alterações foram salvas.  | |
| | Enviamos um resumo atualizado  | | <- exibido SOMENTE quando emailSent === true
| | para o seu e-mail.             | |
| +--------------------------------+ |
|                                    |
| CPF                                |
| [ 529.982.247-25              🔒 ] |
|                                    |
| Distância                          |
| ( ) 5 km                           |
| (o) 10 km                          |
|                                    |
| [ Salvar alterações (desabilit.) ] |
+------------------------------------+
```

#### Mobile (360 px) — Confirmação (Estado 2: `emailSent === false`)
```text
+------------------------------------+
| [ Logotipo do Evento ]             |
|                                    |
| +--------------------------------+ |
| | [✓] ALTERAÇÕES SALVAS          | |
| | Suas alterações foram salvas.  | | <- SEM menção a envio de e-mail
| +--------------------------------+ |
|                                    |
| CPF                                |
| [ 529.982.247-25              🔒 ] |
|                                    |
| Distância                          |
| ( ) 5 km                           |
| (o) 10 km                          |
|                                    |
| [ Salvar alterações (desabilit.) ] |
+------------------------------------+
```

#### Mobile (360 px) — Edição Encerrada
```text
+------------------------------------+
| [ Logotipo do Evento ]             |
|                                    |
|           ( ⏱ )                    |
|      Edição encerrada              |
|                                    |
| Este formulário não aceita mais    |
| alterações.                        |
+------------------------------------+
```

### 4.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Carregando** | Frame com mensagem *"Carregando dados da inscrição..."*. |
| **Edição Aberta** | Formulário preenchido com as respostas originais. Campo CPF com `readOnly` exibindo o CPF MASCARADO (`***.***.***-25`), ícone de cadeado e aviso *"O CPF não pode ser alterado."*. Sem reexibição de consentimento. |
| **Salvando** | Botão "Salvar alterações" desabilitado com texto *"Salvando..."*. |
| **Sucesso (emailSent === true)** | Banner verde no topo: *"Alterações salvas! Enviamos um resumo atualizado para o seu e-mail."*. |
| **Sucesso (emailSent === false)** | Banner verde no topo: *"Alterações salvas!"* (sem menção a e-mail). |
| **Edição Encerrada** | Quando `state === "closed"`: frame com título *"Edição encerrada"* e corpo *"Este formulário não aceita mais alterações."* (vale tanto para prazo vencido quanto para encerramento manual). |
| **Não Encontrado** | Quando `state === "not_found"`: título *"Inscrição não encontrada"* e corpo *"Verifique se o link está correto."*. |

### 4.4 Textos Exatos da Interface
- **Badge identificadora:** "Editando inscrição"
- **Instrução:** "Altere os campos desejados e clique em 'Salvar alterações'."
- **Aviso CPF:** "O CPF não pode ser alterado."
- **Botão salvar:** "Salvar alterações"
- **Botão salvando:** "Salvando..."
- **Sucesso com e-mail:** "Alterações salvas! Enviamos um resumo atualizado para o seu e-mail."
- **Sucesso sem e-mail:** "Alterações salvas!"
- **Título de edição encerrada:** "Edição encerrada"
- **Texto de edição encerrada:** "Este formulário não aceita mais alterações."
- **Título não encontrado:** "Inscrição não encontrada"
- **Texto não encontrado:** "Verifique se o link está correto."

### 4.5 Markup e Classes Reutilizadas (de `f.$slug.tsx`)
- Mesma casca `Frame` (`glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8`).
- Tipografia do tema aplicada na raiz do container com `fontClass` (`theme?.font === "display" ? "font-display" : theme?.font === "serif" ? "font-serif" : "font-body"`).
- Mesma classe de campo `fieldClass`.
- Campo CPF bloqueado: `<input readOnly value="***.***.***-25" className={`${fieldClass} bg-black/[0.03] cursor-not-allowed`} />`.
- Botão: `style={{ backgroundColor: accent, color: readableTextColor(accent) }}`.

---

## 5. Tela D — Página de Respostas (`/formularios/$id/respostas`)

### 5.1 Objetivo e Fluxo
- **Objetivo:** Permitir ao administrador consultar as inscrições e copiar o link de edição de qualquer inscrito com um clique (RF-07), mantendo a exportação para Excel e PDF leve e sob demanda (RF-10).
- **Nota sobre a rota:** A rota de respostas é irmã do editor (não filha), para abrir pelo botão 'Ver respostas'.
- **Fluxo do Administrador:**
  ```mermaid
  flowchart TD
      A[Acessa /formularios/:id/respostas] --> B[Visualiza tabela existente]
      B --> C[Localiza o participante]
      C --> D[Clica em 'Copiar link de edição' na nova coluna 'Ações']
      D --> E[Copia origin/editar/token para o clipboard]
      E --> F[Toast: 'Link de edição copiado!']
      B --> G[Clica em 'Exportar Excel' ou 'Exportar PDF']
      G --> H[Import dinâmico de xlsx/jspdf e download]
  ```

### 5.2 Wireframes de Baixa Fidelidade

#### Mobile (360 px) — Tabela com Scroll Horizontal Existente
```text
+------------------------------------+
| [← Editor]                         |
| Corrida SKF Track&Field 2026       |
| 48 resposta(s) · 3 editada(s)      |
| de 50 vagas                        |
| Prazo: 15/10/2026, 23:59           |
|                                    |
| [ Mostrar só editadas ]            | <- filtro ativo se houver editadas
| [ Exportar Excel ] [ Exportar PDF ]|
+------------------------------------+
| (Tabela com scroll horizontal)     |
|                                    |
| Enviado em | Atualizado em | CPF...|
| -----------+---------------+------ |
| 29/09 14:32| 30/09 10:15   | 529...| <- linha com fundo âmbar e selo [Editada]
| 29/09 14:35| —             | 112...|
+------------------------------------+
```

#### Desktop (≥ 1024 px) — Tabela com a Nova Coluna "Ações" e "Atualizado em"
```text
+----------------------------------------------------------------------------------------------------+
| [← Editor]                                                                                         |
| Corrida SKF Track&Field 2026                                                                       |
| 48 resposta(s) · 3 editada(s) de 50 vagas  ·  prazo 15/10/2026, 23:59                               |
| [ Mostrar só editadas ]                                                 [ Exportar Excel ] [ Exportar PDF ]
+----------------------------------------------------------------------------------------------------+
| +------------------------------------------------------------------------------------------------+ |
| | Enviado em       | Atualizado em            | CPF            | Nome          | Ações           | |
| |------------------+--------------------------+----------------+---------------+-----------------| |
| | 29/09/2026 14:32 | 30/09 10:15  [Editada]   | 529.982.247-25 | Maria Silva   | [ Copiar link ] | | <- âmbar
| | 29/09/2026 14:35 | —                        | 112.443.987-00 | João Paulo    | [ Copiar link ] | |
| | 29/09/2026 15:10 | 30/09 12:40  [Editada]   | 334.887.123-45 | Carla Lima    | [ Copiar link ] | | <- âmbar
| +------------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

### 5.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Vazio** | Mantém mensagem existente: *"Nenhuma resposta ainda. Compartilhe o link do formulário para começar a receber inscrições."*. |
| **Com Dados** | Tabela acrescida da coluna `<th>Atualizado em</th>` (logo após "Enviado em") e `<th>Ações</th>`. |
| **Linha Editada** | Linha com fundo âmbar claro sutil, data/hora da última alteração em pt-BR e selo textual *"Editada"* (`bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 text-xs font-medium`). Linha não editada exibe *"—"*. |
| **Resumo de Respostas** | Exibe `"{n} resposta(s)"` + (se houver limite) `" de {v} vagas"` + (se houver editadas) `" · {e} editada(s)"` + (se houver prazo) `" · prazo {data}"`. |
| **Filtro de Editadas** | Havendo editadas, botão *"Mostrar só editadas"* / *"Mostrar todas"* (`aria-pressed`). Quando ativado, filtra a tabela exibindo apenas as inscrições editadas. |
| **Filtro Vazio** | Quando o filtro está ativo e não há inscrições correspondentes: *"Nenhuma inscrição editada."*. |
| **Ao Clicar em Copiar** | Copia o link com o domínio de produção (`ALLOWED_ORIGINS[0]`): `${ALLOWED_ORIGINS[0]}/editar/${r.edit_token}` para o clipboard. |
| **Feedback** | Toast disparado via Sonner: *"Link de edição copiado!"*. |
| **Falha ao copiar** | Toast disparado via Sonner: *"Não foi possível copiar o link."*. |
| **Ao Clicar em Excluir** | Abre o diálogo `AlertDialog` com título *"Excluir esta inscrição?"*, texto *"Isto apaga de vez as respostas de {nome} (enviada em {data}). O CPF e a vaga voltam a ficar livres e o link de edição deixa de funcionar. Esta ação não pode ser desfeita."*, foco inicial em *"Cancelar"* (Esc também cancela) e botão destrutivo *"Excluir inscrição"*. |
| **Ao Clicar em Editar** | Na coluna de Ações, o botão *"Editar"* possui nome acessível `aria-label="Editar inscrição de {nome}"` (usando a resposta da pergunta de nome, se houver). Ao clicar, abre o diálogo `AdminEditResponseDialog` (`Dialog` de `src/components/ui/dialog.tsx`) com título *"Editar inscrição"* e descrição *"Altere as respostas da inscrição. O CPF não pode ser modificado."*. Os campos são renderizados com `QuestionField` preenchidos com os valores atuais. O campo de CPF é bloqueado como `readOnly` com ícone de cadeado e a nota *"O CPF não pode ser alterado."* (mesmo padrão da página de edição). |
| **Ações do Diálogo de Edição** | Botões *"Salvar alterações"* e *"Cancelar"*. Durante o salvamento, todos os campos e botões ficam desabilitados e o botão exibe *"Salvando..."*. Foco e tecla Esc funcionam normalmente. Erros de validação (campos obrigatórios, e-mail inválido, etc.) aparecem junto ao campo. |
| **Sucesso da Edição** | Toast *"Inscrição atualizada."*, a tabela de respostas é recarregada e a linha correspondente passa a exibir o selo *"Editada"*. |
| **Aviso de E-mail Alterado** | Se a resposta da pergunta de e-mail foi alterada, o diálogo apresenta o alerta: *"O e-mail foi alterado. Enviar o e-mail de confirmação com o link de edição para {novo e-mail}?"* com os botões *"Enviar agora"* e *"Agora não"*. |
| **Reenviar E-mail com Link de Edição** | Dentro do diálogo, há sempre o botão secundário *"Reenviar e-mail com o link de edição"*. Ao clicar, exibe confirmação com o endereço completo: *"Deseja reenviar o e-mail com o link de edição para {e-mail}?"* com os botões *"Reenviar e-mail"* e *"Cancelar"*. Ao confirmar, envia o e-mail pelo Resend, exibe toast *"E-mail com o link de edição enviado."* e desativa o botão por 60 segundos após cada clique. |
| **Exclusão com Sucesso** | Toast disparado via Sonner: *"Inscrição excluída."* e recarrega a consulta. Se a última linha for excluída, a tabela passa a exibir o estado vazio. |
| **Falha na Exclusão** | Caso a exclusão falhe ou o banco retorne 0 linhas: toast *"Não foi possível excluir. Tente novamente."*. O botão fica desabilitado durante o envio. |
| **Formato de Datas nas Respostas** | Perguntas do tipo data (`field_type === "date"`) são exibidas na tabela no formato `dd/mm/aaaa` por manipulação direta de texto (evitando desvios de fuso horário). O mesmo formato é preservado nas exportações em Excel e PDF via `buildRows`. Nenhuma outra coluna é alterada. |
| **Atualização Automática** | A consulta de respostas atualiza periodicamente a cada 30 segundos (`refetchInterval: 30_000`, `refetchIntervalInBackground: false`). Perto do título da tela, é exibido o texto *"Atualizado às HH:mm"* (`text-xs text-slate-600`, fuso de São Paulo, a partir de `dataUpdatedAt`, sem `aria-live`). O botão manual *"Atualizar"* continua disponível. |
| **Barra de Ferramentas da Tabela** | Acima da tabela, barra compacta com campo de busca (`type="search"`, `aria-label="Buscar inscrição"`, placeholder *"Buscar por nome, CPF, e-mail, telefone..."*), botão *"Limpar busca"* quando houver texto digitado, seletor de ordenação (`aria-label="Ordem das inscrições"`) com as opções *"Mais recentes primeiro"*, *"Mais antigas primeiro"*, *"Nome (A a Z)"* e *"Nome (Z a A)"* (as opções de nome só aparecem se houver pergunta de nome), e contador de resultados com `aria-live="polite"` (*"Mostrando {n} de {total} inscrições"*). Sem correspondências: exibe *"Nenhuma inscrição encontrada para “{texto}”."*. |
| **Área da Tabela e Rolagem** | Contêiner com `role="region"`, `aria-label="Tabela de inscrições"`, `tabIndex={0}`, `overflow-auto` e altura máxima `max-h-[70vh]`. A barra de rolagem horizontal fica sempre visível junto à tabela sem rolar a página inteira. Cabeçalho fixo no topo (`sticky top-0`, fundo opaco, `py-2`, sem quebra de linha) em todos os tamanhos. Havendo pergunta de nome, ela só fica fixa à esquerda a partir de 768 px (`md:sticky md:left-0 md:z-10` nas células e `md:z-30` no cabeçalho, com sombra lateral `md:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]`). No celular (< 768 px), o nome rola junto com as demais colunas (não congela para não esconder os outros dados), com largura máxima e reticências (`max-w-[11rem] truncate md:max-w-none md:overflow-visible` na célula e cabeçalho, e `title` com o nome completo). Acima da tabela, quando houver linhas e `onRowClick`, exibe dica exclusiva para celular: *"Toque numa linha para ver todos os dados."* (`text-xs text-slate-600 md:hidden`). Células em linha única (`whitespace-nowrap`), exceto perguntas de texto longo (largura máxima 20rem com quebra). Datas com `tabular-nums`. |
| **Interação com a Linha** | A linha inteira é clicável e focável (`cursor-pointer`, `data-clickable`, `tabIndex={0}`, `aria-label="Abrir detalhes da inscrição de {nome}"`). Clicar na linha ou pressionar Enter/Espaço abre o `ResponseDetailDialog`. Cliques dentro da coluna de "Ações" e seleção de texto com o mouse não disparam a abertura do card. |
| **Card de Detalhes da Inscrição** | Diálogo modal (`ResponseDetailDialog`, tela cheia em 360 px) com título exibindo o nome do inscrito, metadados de "Enviado em" e "Atualizado em" (com selo "Editada" quando aplicável), slot de ações em destaque no topo com 4 botões (*"Editar"*, *"Copiar link de edição"*, *"Reenviar e-mail"* com confirmação e *"Excluir"*), seguido da lista de todas as perguntas com respostas completas e formatadas via `formatAnswer` (CPF completo e textos longos com quebra). |
| **Erro de carga** | *"Não foi possível carregar as respostas."* e o botão *"Tentar de novo"*. |

### 5.4 Textos Exatos da Interface
- **Dica de toque no celular:** "Toque numa linha para ver todos os dados."
- **Coluna de atualização:** "Atualizado em"
- **Selo de linha editada:** "Editada"
- **Botão filtro só editadas:** "Mostrar só editadas"
- **Botão filtro todas:** "Mostrar todas"
- **Filtro vazio:** "Nenhuma inscrição editada."
- **Título da coluna de ações:** "Ações"
- **Texto do botão por linha:** "Copiar link de edição"
- **Texto do botão de exclusão:** "Excluir"
- **Título do diálogo de exclusão:** "Excluir esta inscrição?"
- **Texto do diálogo de exclusão:** "Isto apaga de vez as respostas de {nome} (enviada em {data}). O CPF e a vaga voltam a ficar livres e o link de edição deixa de funcionar. Esta ação não pode ser desfeita."
- **Botão cancelar exclusão:** "Cancelar"
- **Botão confirmar exclusão:** "Excluir inscrição"
- **Sucesso da exclusão:** "Inscrição excluída."
- **Falha da exclusão:** "Não foi possível excluir. Tente novamente."
- **Texto do botão editar:** "Editar"
- **Aria-label do botão editar:** "Editar inscrição de " (seguido do nome)
- **Título do diálogo de edição:** "Editar inscrição"
- **Descrição do diálogo de edição:** "Altere as respostas da inscrição. O CPF não pode ser modificado."
- **Aviso de CPF bloqueado na edição:** "O CPF não pode ser alterado."
- **Botão salvar alterações:** "Salvar alterações"
- **Botão salvando alterações:** "Salvando..."
- **Sucesso da edição pelo admin:** "Inscrição atualizada."
- **Aviso de e-mail alterado:** "O e-mail foi alterado. Enviar o e-mail de confirmação com o link de edição para {novo e-mail}?"
- **Botão enviar agora:** "Enviar agora"
- **Botão agora não:** "Agora não"
- **Botão reenviar e-mail:** "Reenviar e-mail com o link de edição"
- **Confirmação de reenvio:** "Deseja reenviar o e-mail com o link de edição para {e-mail}?"
- **Botão confirmar reenvio:** "Reenviar e-mail"
- **Sucesso do reenvio:** "E-mail com o link de edição enviado."
- **Falha no reenvio:** "Não foi possível enviar o e-mail. Tente novamente."
- **Feedback de cópia:** "Link de edição copiado!"
- **Falha ao copiar:** "Não foi possível copiar o link."
- **Indicador de atualização periódica:** "Atualizado às " (seguido de HH:mm)
- **Aria-label do campo de busca:** "Buscar inscrição"
- **Placeholder do campo de busca:** "Buscar por nome, CPF, e-mail, telefone..."
- **Botão limpar busca:** "Limpar busca"
- **Aria-label da ordem:** "Ordem das inscrições"
- **Opções de ordenação:** "Mais recentes primeiro", "Mais antigas primeiro", "Nome (A a Z)", "Nome (Z a A)"
- **Contador de inscrições filtradas:** "Mostrando {n} de {total} inscrições"
- **Busca sem resultados:** "Nenhuma inscrição encontrada para “{texto}”."
- **Aria-label da região da tabela:** "Tabela de inscrições"
- **Aria-label da linha da tabela:** "Abrir detalhes da inscrição de " (seguido do nome)
- **Título do diálogo de detalhes:** Nome do participante
- **Erro de carga:** "Não foi possível carregar as respostas."
- **Botão de retry:** "Tentar de novo"
- **Erro de exportação:** "Não foi possível exportar. Tente novamente."

### 5.5 Markup e Classes Reutilizadas (de `_authenticated.formularios.$id.respostas.tsx`)
- Container da tabela: `<div className="glass overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">...</table></div></div>`.
- Cabeçalho: `<thead className="bg-white/70 text-xs uppercase tracking-wide text-muted-foreground"><tr>...<th className="px-4 py-3 font-medium">Ações</th></tr></thead>`.
- Célula de ação: `<td className="px-4 py-3 whitespace-nowrap"><button onClick={() => { navigator.clipboard.writeText(`${ALLOWED_ORIGINS[0]}/editar/${r.edit_token}`).then(() => toast.success("Link de edição copiado!")).catch(() => toast.error("Não foi possível copiar o link.")); }} className="rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium ring-1 ring-black/5 hover:bg-white">Copiar link de edição</button></td>`.

---

## 6. Tela E — Páginas legais (`/legal/termos-de-uso` e `/legal/politica-de-privacidade`)

### 6.1 Objetivo e Fluxo
- **Objetivo:** Disponibilizar páginas públicas de Termos de Uso e Política de Privacidade acessíveis sem login, integradas ao fluxo de consentimento do formulário e com links em nova aba para consulta antes ou durante o preenchimento.
- **Rotas:** `/legal/termos-de-uso` e `/legal/politica-de-privacidade` (endereços compostos com prefixo `legal/`, garantindo que nunca colidam com slugs de formulários nem exijam ampliação de palavras reservadas).
- **Conteúdo Estruturado:** Fonte única de dados em `src/content/legal.ts` contendo `{ title, updatedAt, paragraphs: string[] }`.
- **Renderização Segura:** O texto dos parágrafos suporta marcação de negrito com `**…**`, processada via função pura `parseInline` em `src/lib/legal-inline.ts` que retorna nós `{ text, bold }`, sem gerar HTML cru e sem uso de `dangerouslySetInnerHTML`.

### 6.2 Wireframes de Baixa Fidelidade

#### Mobile (360 px) e Desktop (Max 672 px centralizado)
```text
+------------------------------------+
| [ F ] FormulárioLab                |
|                                    |
| Termos de Uso                      |
| Última atualização: 01/10/2026     |
|                                    |
| 1. O que é este sistema. Este site |
| permite que você se inscreva em... |
|                                    |
| 2. Quem pode usar. Qualquer...     |
| ...                                |
|                                    |
| Ver também: Política de Priv.  ↗   |
|                                    |
| (i) Você pode fechar esta aba para |
|     voltar ao formulário.          |
+------------------------------------+
```

### 6.3 Estrutura e Comportamento
- **Casca e Estilo:** Cartão centralizado com mesmo efeito de vidro suave do `Frame` (`glass-strong rounded-2xl p-6 sm:p-8 max-w-2xl w-full rise`).
- **Cabeçalho:** `<h1>` semântico com o título do documento ("Termos de Uso" ou "Política de Privacidade") e linha de metadados: *"Última atualização: 01/10/2026"*.
- **Parágrafos:** Lista de parágrafos legíveis e espaçados (`space-y-4 text-sm leading-relaxed text-slate-700`), com termos em negrito realçados.
- **Rodapé do Documento:** Link para a outra página legal correspondente (*"Ver também: Política de Privacidade"* ou *"Ver também: Termos de Uso"*) e dica sutil para o usuário: *"Você pode fechar esta aba para voltar ao formulário."*.
- **Metatags (`head`):** Título da página definido como `"Termos de Uso"` ou `"Política de Privacidade"`.

### 6.4 Textos Exatos da Interface
- **Título Termos:** "Termos de Uso"
- **Título Política:** "Política de Privacidade"
- **Data de atualização:** "Última atualização: 01/10/2026"
- **Link cruzado para Política:** "Ver também: Política de Privacidade"
- **Link cruzado para Termos:** "Ver também: Termos de Uso"
- **Dica de navegação:** "Você pode fechar esta aba para voltar ao formulário."

---

## 7. Tela F — Tela de Entrada (`/auth`)

### 7.1 Objetivo e Fluxo
- **Objetivo:** Garantir acesso único e seguro ao administrador do sistema (RF-01), eliminando links públicos de cadastro e autenticação de terceiros (Google/Lovable Cloud).
- **Fluxo do Administrador:**
  ```mermaid
  flowchart TD
      A[Acessa /auth ou redirecionado de /] --> B{Sessão ativa?}
      B -->|Sim| C[Redireciona para /painel]
      B -->|Não| D[Exibe formulário simples: E-mail e Senha]
      D --> E[Submete credenciais]
      E --> F{Autenticação Supabase}
      F -->|Erro| G[Toast: 'E-mail ou senha incorretos.']
      F -->|Sucesso| C
  ```

### 7.2 Wireframes de Baixa Fidelidade

#### Mobile (360 px) e Desktop (Max 420 px centralizado)
```text
+------------------------------------+
|               [ F ]                |
|           FormulárioLab            |
|                                    |
| +--------------------------------+ |
| | ÁREA DO ADMINISTRADOR          | |
| | Entrar                         | |
| |                                | |
| | E-mail                         | |
| | [ admin@triade.com.br        ] | |
| |                                | |
| | Senha                          | |
| | [ ••••••••••••               ] | |
| |                                | |
| | [          Entrar            ] | |
| +--------------------------------+ |
+------------------------------------+
```

### 7.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Padrão** | Card centralizado `glass-strong rounded-2xl p-6 sm:p-8` com logo, chapéu "ÁREA DO ADMINISTRADOR", título "Entrar", e campos de E-mail e Senha. Sem botão Google e sem alternador de cadastro. |
| **Entrando** | Botão "Entrar" desabilitado com texto *"Aguarde..."* ou *"Entrando..."*. |
| **Erro de Credenciais** | Toast de erro: *"E-mail ou senha incorretos."*. |
| **Sucesso** | Redirecionamento para `/painel`. |

### 7.4 Textos Exatos da Interface
- **Chapéu:** "Área do administrador"
- **Título:** "Entrar"
- **Rótulos:** "E-mail" e "Senha"
- **Botão:** "Entrar"
- **Botão processando:** "Entrando..."
- **Erro de login:** "E-mail ou senha incorretos."

### 7.5 Markup e Classes Reutilizadas (de `src/routes/auth.tsx`)
- Container: `<div className="flex min-h-screen items-center justify-center px-5 py-12"><div className="w-full max-w-md rise"><div className="glass-strong rounded-2xl p-6 sm:p-8">...</div></div></div>`.
- Inputs: `className="w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"`.
- Botão: `className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 transition-colors hover:bg-brand/90 disabled:opacity-60"`.

---

## 8. Tela G — Painel Principal (`/painel`)

### 8.1 Objetivo e Fluxo
- **Objetivo:** Oferecer ao administrador uma visão consolidada de todos os formulários, métricas gerais de respostas e gráfico visual com as inscrições realizadas nos últimos 7 dias, mantendo as informações sempre frescas por meio de atualização periódica em segundo plano.
- **Estrutura:** Mantém os quatro cards de métricas (Formulários, Inscrições totais, Publicados e Última resposta) e a lista de formulários sem alterações estruturais.
- **Gráfico de Respostas por Dia (Últimos 7 Dias):**
  - Alimenta-se da função pura `countByDay(responses.map(r => r.submitted_at), 7, new Date())` com datas agrupadas no fuso fixo "America/Sao_Paulo" (`timeZone: "America/Sao_Paulo"`), devolvendo 7 itens do mais antigo ao dia atual.
  - Cada coluna é estruturada como `flex h-full flex-1 flex-col items-center justify-end gap-1`.
  - Altura da barra calculada proporcionalmente ao pico dos últimos 7 dias: `Math.max(4, Math.round((total / peak) * 80))` px, preservando a opacidade visual existente.
  - Exibição de valor numérico: acima de cada barra com `total > 0`, é exibido o número de inscrições (`text-[10px] font-medium text-slate-700`).
  - Rótulos inferiores: inicial do dia da semana (`label`: "D", "S", "T", "Q", "Q", "S", "S") e data abreviada (`dateText`: "dd/mm") para identificação inequívoca.
  - Acessibilidade: o bloco do gráfico possui `role="img"` e atributo `aria-label` textual detalhado descrevendo o resumo da série temporal (ex.: *"Respostas por dia nos últimos 7 dias: 26/09 0, 27/09 2, ... 02/10 35"*).
- **Atualização Automática:**
  - Ambas as consultas do painel (lista de formulários e estatísticas) possuem `refetchInterval: 30_000` (30 segundos) e `refetchIntervalInBackground: false`.
  - Próximo ao título "Painel", é exibido o horário da última atualização: *"Atualizado às HH:mm"* (`text-xs text-slate-600`, fuso de Brasília/São Paulo, calculado a partir de `dataUpdatedAt`, sem `aria-live`).

### 8.2 Textos Exatos da Interface
- **Indicador de atualização periódica:** "Atualizado às " (seguido de HH:mm)
- **Aria-label do gráfico:** "Respostas por dia nos últimos 7 dias: {resumo}"
- **Dicas (Tooltips) dos Cards do Painel:**
  - *Formulários publicados:* "Formulários com status publicado, entre todos os seus formulários."
  - *Respostas totais:* "Soma das respostas de todos os formulários, abertos, rascunhos e encerrados."
  - *Respostas nos 7 dias:* "Respostas enviadas nos últimos 7 dias, hoje incluído, em todos os formulários."
  - *Prazos próximos:* "Formulários com prazo de encerramento nos próximos 3 dias."
- **Dicas (Tooltips) das Barras do Gráfico:**
  - Formato: `"{weekdayName}, {dd/mm/aaaa}: {n} {resposta|respostas}"` (acrescentando `"(hoje)"` no dia atual; ex.: *"sexta-feira, 02/10/2026 (hoje): 35 respostas"*).
- **Dicas (Tooltips) dos Cartões de Vagas e Prazo (Formulário Público):**
  - *Vagas:* "Vagas ainda disponíveis neste formulário. Quando restam 10 ou menos, aparece o aviso Últimas vagas."
  - *Prazo:* "Data e hora limite para enviar a inscrição, no horário de Brasília."

### 8.3 Cursor Global e Comportamento de Dicas (Tooltips)
- **Regra de Cursor Global:**
  - Elementos clicáveis exibem `cursor: pointer`: `button:not(:disabled)`, `[role="button"]:not([aria-disabled="true"])`, `[role="tab"]`, `[role="menuitem"]`, `[role="option"]`, `a[href]`, `summary`, `select:not(:disabled)`, `label[for]`, `input[type="checkbox"]:not(:disabled)`, `input[type="radio"]:not(:disabled)`, `input[type="file"]:not(:disabled)`, `input[type="submit"]:not(:disabled)` e `[data-clickable]`.
  - Elementos desabilitados exibem `cursor: not-allowed`: `:disabled` e `[aria-disabled="true"]`.
  - Entradas de texto preservam o cursor padrão de texto (`cursor: text`).
- **Comportamento das Dicas (Tooltips):**
  - Gerenciadas por `TooltipProvider` (`delayDuration={150}`).
  - Acionadas por mouse (`hover`), teclado (`focus-visible`) e toque no celular (`touch`), com cada cartão e barra implementado como gatilho focável `<button type="button">` com `cursor-help`.
  - Acessibilidade: o atributo `aria-label` do gatilho contém o rótulo, valor e texto explicativo, garantindo que a informação esteja disponível a leitores de tela sem depender da dica visual.
  - O gráfico deixa de usar `role="img"` e passa a usar `role="group"` com o `aria-label` de resumo, expondo os botões interativos das barras para foco e leitor de tela.
  - Conteúdo da dica (`TooltipContent`) com largura `max-w-xs`, contraste garantido mínimo de 4,5:1 e `motion-reduce:animate-none`.

---

## 8b. Tela F — Link do cliente (`/c/$token`) e Cartão no Editor

### 8b.1 Cartão no Editor (`ShareLinkCard`)
- **Localização:** Logo abaixo do cartão "Link de compartilhamento" no editor de formulário (`_authenticated.formularios.$id.tsx`).
- **Título:** "Link do cliente (somente leitura)"
- **Descrição:** "Quem tiver este link vê todas as inscrições, inclusive CPF, e-mail e telefone, mas não consegue alterar nada. Compartilhe só com quem precisa."
- **Estado sem token:**
  - Botão principal: "Gerar link do cliente".
- **Estado com token:**
  - Campo de texto somente leitura exibindo a URL completa gerada com a origem canônica (`ALLOWED_ORIGINS[0]`): `${origin}/c/${token}`, com associação de rótulo acessível via `htmlFor` e `id` (UX-13, corrigido na T-37).
  - Botão "Copiar": copia o link para a área de transferência com feedback sonoro/visual ("Link copiado!") e anúncio de status via Sonner.
  - Botão "Abrir": abre a URL em uma nova aba com `target="_blank"` e `rel="noopener noreferrer"`.
  - Botão "Gerar novo link": abre `AlertDialog` com título "Gerar novo link do cliente?" e texto "O link atual deixará de funcionar na hora. Continuar?".
  - Botão "Desativar link": abre `AlertDialog` com título "Desativar link do cliente?" e texto "Quem usa o link perderá o acesso na hora. Continuar?".
  - Todos os diálogos possuem suporte a foco acessível e tecla Esc.
  - Ações de gerar, regenerar ou revogar atualizam o estado do editor sem recarregar a página.

### 8b.2 Tela Pública do Cliente (`/c/$token`)
- **Objetivo:** Permitir que representantes do cliente (ex.: SKF) visualizem, busquem, ordenem e baixem relatórios em Excel e PDF em tempo quase real, sem permissão para editar ou excluir dados (o PDF baixado pode ser impresso pelo leitor).
- **Metadados (Head):**
  - Título: "Inscrições recebidas | Corre Time" (CLIENT_LINK_TAB_TITLE)
  - `description`: "Acesso restrito, só leitura, com dados pessoais. Não é o link de inscrição." (CLIENT_LINK_DESCRIPTION)
  - `og:title`: "NÃO COMPARTILHE: lista de inscritos | Corre Time" (CLIENT_LINK_OG_TITLE)
  - `og:description`: "Acesso restrito, só leitura, com dados pessoais. Não é o link de inscrição." (CLIENT_LINK_DESCRIPTION)
  - `robots`: "noindex, nofollow"
  - `referrer`: "no-referrer"
- **Cabeçalho:**
  - Título do formulário e selo "Somente leitura" (`rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-black/5`).
  - Contadores em destaque: "{N} inscrições" (com forma no singular "1 inscrição" quando N = 1; UX-12 corrigido na T-37), "{V} vagas restantes" (apenas se houver limite de vagas configurado) e "Prazo: dd/mm/aaaa às HH:mm" (calculado no fuso de Brasília/São Paulo, apenas se houver prazo final).
  - Indicador de tempo: "Atualizado às HH:mm" (com atualização periódica a cada 30 segundos via react-query, sem refetch em segundo plano).
  - Ações globais:
    - Botão "Baixar Excel": gera planilha XLSX via `exportToExcel` de `exports.ts` considerando `field_type` das perguntas e a ordenação ativa com todas as inscrições.
    - Botão "Baixar PDF": gera documento PDF via `exportToPDF` de `exports.ts` com a ordenação ativa e todas as inscrições (o layout aprovado em paisagem com cabeçalho roxo pode ser impresso pelo leitor de PDF). Em impressão direta pelo navegador (Ctrl+P), a página aplica classes `print:` para remover barra de rolagem e altura máxima.
- **Tabela e Detalhes:**
925:   - Componente compartilhado `ResponsesTable` (T-26) sem `renderRowActions` e sem `showUpdatedAt`.
926:   - CPF completo como gravado no banco de dados (sem truncamento, em uma única linha).
927:   - Sem botões de editar, excluir ou copiar link de edição em nenhuma parte da tela.
928:   - Clique na linha (`onRowClick`) abre o `ResponseDetailDialog` sem o slot `actions` (exibição puramente em modo de leitura).
929:   - Busca rápida e ordenação pelas 4 modalidades mantidas e sincronizadas com as exportações.
930: - **Estados da Tela:**
931:   - **Carregando:** feedback com mensagem "Carregando inscrições...".
932:   - **Não encontrado (`not_found`):** "Este link não é válido ou foi desativado. Peça um novo link a quem o compartilhou." (sem expor nenhum dado nem detalhe técnico).
933:   - **Erro de rede / servidor:** mensagem clara de falha com botão "Tentar de novo".
934:   - **Responsividade:** em 360 px a página não possui rolagem horizontal; apenas a área interna da tabela rola lateralmente.
935: 
936: ---
937: 
938: ## 9. Padrões de Markup e Classes Reutilizadas
939: 
940: Não há dependência de novos componentes pesados de UI; o projeto reaproveita estritamente o vocabulário HTML e as classes utilitárias já existentes no repositório:
941: 
942: | Padrão / Elemento | Classes e Markup Reutilizados do Repositório |
943: |---|---|
944: | **Casca de Página Pública** | `<div className="glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8">` em wrapper flex centralizado. |
945: | **Cartão Glass (Painel/Editor)** | `<div className="glass rounded-2xl p-4 sm:p-5">`. |
946: | **Campos de Texto/Data/Número** | `className="w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"`. |
947: | **Botão de Ação Primária (Tema)** | `<button style={{ backgroundColor: accent, color: readableTextColor(accent) }} className="w-full rounded-lg py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60">`. |
948: | **Botão de Ação Primária (Admin)** | `<button className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90">`. |
949: | **Botão Secundário / Cópia** | `<button className="rounded-lg bg-white/70 px-3 py-2 text-xs font-medium ring-1 ring-black/5 hover:bg-white">`. |
950: | **Alerta de Aviso (Slug Publicado)** | `<div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200/80">`. |
951: | **Tabela de Dados** | `<div className="glass overflow-hidden rounded-2xl"><table className="w-full min-w-[640px] text-left text-sm">...</table></div>`. |
952: 
953: ---
954: 
955: ## 10. Propostas de Mudança no spec / plan / tasks
956: 
957: As propostas discutidas e incorporadas na documentação oficial:
958: 1. **Rótulo da Aba no Editor:** Renomear o rótulo da aba existente de "Limites" para **"Limites e Termos"** (mantendo a chave interna `limites`), posicionando o campo de consentimento LGPD junto às configurações de encerramento e capacidade do formulário.
959: 2. **Contrato do Servidor com `emailSent: boolean`:** Incorporado no `plan.md` e `tasks.md` para suportar a exibição condicional da mensagem de confirmação de e-mail na tela de sucesso e na tela de edição.
960: 3. **Função Pura `readableTextColor` em `src/lib/theme.ts`:** Incorporada como RF-13 no `spec.md`, na tabela de regras puras do `plan.md` e testada em T-08 de `tasks.md`, devolvendo `#ffffff` ou `#000000` para garantir contraste >= 4,5:1.
961: 4. **Tratamento do Erro 23505 no Editor:** Incorporado no editor para informar de forma limpa *"Esse endereço já está em uso."* caso ocorra colisão de concorrência ao salvar.
962: 5. P-NN [Tela C] CPF mascarado na edição (SEC-17), aprovada pelo dono.
963: 6. P-NN [Tela B] O estado 'Inscrições encerradas' vale também para o encerramento manual e usa texto neutro, aprovada pelo dono.
964: 7. P-NN [Tela D] O link copiado usa sempre o domínio de produção, aprovada pelo dono.
965: 8. P-NN [Tela B] bloco do e-mail em destaque, sugestão de domínio e confirmação de e-mail; [Tela D] coluna Atualizado em e filtro de editadas, aprovadas pelo dono.
966: 9. P-NN [Tela D] exclusão de inscrição pelo painel, para atender pedidos de exclusão (LGPD), aprovada pelo dono.
967: 10. P-NN [Tela B e Tela E] links para Termos e Política em nova aba, rodapé e páginas legais, aprovadas pelo dono.
968: 11. P-NN [Editor e formulário público] descrição com quebras de linha e campo de edição maior, aprovadas pelo dono.
969: 12. P-NN [Formulário público] vagas e prazo em destaque, aprovadas pelo dono.
970: 13. P-NN [Painel e Respostas] gráfico por dia, atualização automática e datas em dd/mm/aaaa, aprovadas pelo dono.
971: 14. P-NN [Respostas] edição pelo painel e reenvio de e-mail, aprovadas pelo dono.
972: 15. P-NN [Editor e formulário público] tipo Data de nascimento com validação, aprovada pelo dono.
973: 16. P-NN [Painel, Formulário público e geral] cursor de mãozinha global e dicas nos cards e gráficos, aprovadas pelo dono.
974: 17. P-NN [Respostas] busca, ordenação, rolagem da tabela e card de detalhes, aprovadas pelo dono.
975: 18. P-NN [Respostas] coluna do nome sem congelar no celular e dica de toque, aprovada pelo dono.
976: 19. P-NN [Editor e Tela F] link do cliente somente leitura, aprovado pelo dono.
977: 20. P-NN [Tela F e Editor] Imprimir abre o mesmo PDF em nova aba, contador no singular (UX-12) e acessibilidade de rótulo no ShareLinkCard (UX-13), aprovada pelo dono (T-37).
21. P-NN [Editor] Edição na própria pergunta, arrastar para reordenar, painel lateral fixo na rolagem (lg:sticky), adicionar pergunta logo abaixo da selecionada e exclusão com diálogo de confirmação AlertDialog, aprovada pelo dono (T-34 / M-32).
22. P-NN [Editor] Enter nas opções sem reescrita a cada tecla, botão "+" em cada pergunta para inserção contextual direta, botão secundário "+ Adicionar pergunta" na barra fixa e painel lateral simplificado exclusivamente com abas "Aparência" e "Limites e Termos" (aba "Pergunta" removida), aprovada pelo dono (T-34c / M-36, M-37).


> **Nota de Privacidade:** A frase sobre fontes do Google no item 10 da Política deve ser removida quando o item C-d hospedar as fontes no próprio site.

---

## 11. Ideias para a Fase 1

Melhorias registradas para consideração futura:
1. **Reenvio do link de edição pelo próprio inscrito:** Campo "Esqueci meu link de edição" onde o participante informa o CPF e o sistema reenvia o token ao e-mail cadastrado.
2. **Visualização em Cartões no Mobile para Respostas:** Modo lista para gerenciar inscrições em celulares sem necessidade de scroll horizontal.
3. **Pré-visualização em tempo real no Editor:** Split view no desktop para visualizar a aparência enquanto configura perguntas e cores.
