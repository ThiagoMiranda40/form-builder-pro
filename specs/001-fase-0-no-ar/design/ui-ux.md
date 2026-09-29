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
6. [Tela E — Tela de Entrada /auth (Acesso Único do Administrador)](#6-tela-e--tela-de-entrada-auth)
7. [Padrões de Markup e Classes Reutilizadas](#7-padrões-de-markup-e-classes-reutilizadas)
8. [Propostas de Mudança no spec / plan / tasks](#8-propostas-de-mudança-no-spec--plan--tasks)
9. [Ideias para a Fase 1](#9-ideias-para-a-fase-1)

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
  - Fundo claro (ex.: `#ffff00`, `#22c55e`, `#ffffff`) → Texto escuro (`#0f172a`).
  - A cor de fundo escolhida pelo organizador **nunca é alterada**.
  - A regra é executada pela função pura `readableTextColor(hex)` em `src/lib/theme.ts`.

### 1.3 Alvos de Toque Mobile-first (WCAG 2.5.5 / 2.5.8)
- Em telas móveis (360 px), todos os botões, checkboxes, radios e inputs possuem altura mínima de `44px` ou preenchimento vertical generoso (`py-2.5` a `py-3`) com área de toque mínima de `44 x 44 px`.

---

## 2. Tela A — Editor de Formulário

### 2.1 Objetivo e Fluxo
- **Objetivo:** Permitir ao administrador configurar um endereço amigável para o formulário (RF-11) com sanitização ao digitar, aviso de quebra em formulário já publicado, e campo de texto de consentimento LGPD opcional (RF-08).
- **Fluxo do Administrador:**
  ```mermaid
  flowchart TD
      A[Acessa Editor /formularios/:id] --> B[Cartão 'Link de compartilhamento']
      B --> C[Visualiza prefixo dinâmico window.location.origin + campo slug]
      C --> D[Digita novo endereço no campo]
      D --> E{Sanitização ao digitar}
      E -->|Converte acentos/espaços/símbolos| F[Exibe slug formatado]
      E -->|Menor que 3 caracteres| G[Erro em linha: 'O endereço deve ter entre 3 e 60 caracteres.']
      E -->|Nome reservado auth, painel, etc.| H[Erro em linha: 'Esse nome é reservado pelo sistema.']
      E -->|Válido| I[Validação local OK]
      I --> J{Formulário já publicado?}
      J -->|Sim| K[Exibe alerta âmbar: 'Atenção: como este formulário já está publicado, links já compartilhados deixarão de funcionar se você alterar o endereço.']
      J -->|Não| L[Sem alerta de quebra]
      K --> M[Clica em 'Salvar']
      L --> M
      M --> N{Resposta do Banco ao Salvar}
      N -->|Erro 23505| O[Exibe erro no campo: 'Esse endereço já está em uso.']
      N -->|Sucesso| P[Toast: 'Formulário salvo!' e atualiza URL completa]
  ```

### 2.2 Wireframes de Baixa Fidelidade

#### Mobile (360 px)
```text
+------------------------------------+
| [← Painel]   [Publicado]           |
| [Ver respostas] [Salvar] [Encerrar]|
+------------------------------------+
| LINK DE COMPARTILHAMENTO           |
|                                    |
| Endereço do formulário:            |
| +--------------------------------+ |
| | https://meudominio.com/        | | <- window.location.origin/
| +--------------------------------+ |
| | skf-corrida-track-field        | | <- inputClass
| +--------------------------------+ |
| (i) Minúsculas, números e hífens.  |
|                                    |
| [!] ATENÇÃO: Como este formulário  |
| já está publicado, links já        |
| compartilhados deixarão de         |
| funcionar se você alterar o        |
| endereço.                          |
|                                    |
| [ Copiar link ] [ Abrir link ↗ ]   |
+------------------------------------+
| ABAS DO EDITOR                     |
| [Pergunta] [Aparência] [Limites]   |
+------------------------------------+
| (Aba Limites selecionada)          |
|                                    |
| Limite de respostas / vagas        |
| [ 50                             ] |
|                                    |
| Prazo final (data e hora)          |
| [ 15/10/2026 23:59               ] |
|                                    |
| Texto de consentimento (LGPD)      |
| +--------------------------------+ |
| | Declaro que li e concordo com  | | <- inputClass (textarea)
| | o regulamento do evento...     | |
| +--------------------------------+ |
| Opcional. Se preenchido, os        |
| participantes deverão marcar o     |
| aceite obrigatoriamente.           |
+------------------------------------+
```

#### Desktop (≥ 1024 px)
```text
+----------------------------------------------------------------------------------------------------+
| [← Painel]  [● Publicado]                          [Ver respostas]  [Salvar]  [Encerrar formulário] |
+----------------------------------------------------------------------------------------------------+
| LINK DE COMPARTILHAMENTO                                                                           |
| Endereço do formulário:                                                                            |
| +-----------------------------------------------+--------------------------------+ [ Copiar link ] |
| | https://meudominio.com/                       | skf-corrida-track-field        | [ Abrir link ↗ ]|
| +-----------------------------------------------+--------------------------------+                 |
| [!] Atenção: como este formulário já está publicado, links já compartilhados deixarão de funcionar |
|     se você alterar o endereço.                                                                    |
+----------------------------------------------------------------------------------------------------+
| PERGUNTAS DO FORMULÁRIO                          | CONFIGURAÇÕES                                   |
| +----------------------------------------------+ | [ Pergunta ] [ Aparência ] [ Limites ]          |
| | 1. [CPF] CPF do Atleta                   ::: | |                                                 |
| | 2. [Texto] Nome completo                 ::: | | Limite de respostas / vagas:                    |
| | 3. [Escolha única] Modalidade            ::: | | [ 50                                          ] |
| +----------------------------------------------+ |                                                 |
| [ + Adicionar pergunta                       ] | | Prazo final (data e hora):                      |
|                                                  | | [ 15/10/2026, 23:59                           ] |
|                                                  | |                                                 |
|                                                  | | Texto de consentimento (LGPD):                  |
|                                                  | | +---------------------------------------------+ |
|                                                  | | | Declaro que concordo com o regulamento...   | |
|                                                  | | +---------------------------------------------+ |
|                                                  | | Opcional. Se preenchido, o aceite é           |
|                                                  | | obrigatório para concluir a inscrição.        |
+----------------------------------------------------------------------------------------------------+
```

### 2.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Padrão / Carregado** | Prefixo `${window.location.origin}/` exibido como bloco não editável (`bg-white/60 text-muted-foreground text-xs px-3 py-2 rounded-l-lg`); campo de slug com valor atual (`inputClass`). |
| **Digitando Slug** | Execução de `sanitizeSlugInput`: converte acentos para letras simples, maiúsculas para minúsculas, caracteres especiais e espaços viram hífen único. Mantém hífen final temporário para digitação contínua. |
| **Blur do Slug** | Disparo de `trimSlugEdges`: remove hífen residual do início ou fim. |
| **Erro: Tamanho inválido** | Texto vermelho abaixo do campo: *"O endereço deve ter entre 3 e 60 caracteres."*. |
| **Erro: Caracteres inválidos** | Texto vermelho: *"Use apenas letras minúsculas, números e hífens."*. |
| **Erro: Nome reservado** | Texto vermelho: *"Esse nome é reservado pelo sistema."* (para `auth`, `painel`, `formularios`, `api`, `saude`, `admin`, `assets`, `login`, `editar`). |
| **Erro do Banco ao Salvar (23505)** | Conflito de unicidade retornado no save: *"Esse endereço já está em uso."*. |
| **Aviso: Formulário Publicado** | Bloco âmbar (`bg-amber-50 text-amber-800 ring-1 ring-amber-200/80 rounded-lg p-3 text-xs`) visível quando `form.status === "published"` e o slug foi alterado: *"Atenção: como este formulário já está publicado, links já compartilhados deixarão de funcionar se você alterar o endereço."*. |
| **Salvando** | Botão "Salvar" desabilitado com texto *"Salvando..."*. |
| **Sucesso** | Toast via Sonner: *"Formulário salvo com sucesso!"*. |

### 2.4 Textos Exatos da Interface
- **Rótulo do slug:** "Endereço do formulário"
- **Erro tamanho:** "O endereço deve ter entre 3 e 60 caracteres."
- **Erro formato:** "Use apenas letras minúsculas, números e hífens."
- **Erro reservado:** "Esse nome é reservado pelo sistema."
- **Erro banco (23505):** "Esse endereço já está em uso."
- **Alerta de republicação:** "Atenção: como este formulário já está publicado, links já compartilhados deixarão de funcionar se você alterar o endereço."
- **Rótulo do consentimento:** "Texto de consentimento (LGPD)"
- **Ajuda do consentimento:** "Opcional. Se preenchido, o participante só poderá concluir a inscrição após marcar a caixa de aceite."

### 2.5 Markup e Classes Reutilizadas (de `_authenticated.formularios.$id.tsx`)
- Cartão de compartilhamento: `<div className="glass rounded-2xl p-4">`.
- Helper `Field` para agrupamento: `<Field label="Endereço do formulário">`.
- Classe padrão de input: `inputClass = "w-full rounded-lg bg-white/80 px-3 py-2 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"`.
- Botão salvar: `<button className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:bg-white disabled:opacity-60">`.
- Botão copiar link: `<button className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-brand/90">`.

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
      P -->|CPF Duplicado| Q[Erro no campo CPF: 'CPF já inscrito. Use o link de edição enviado ao seu e-mail.']
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
|     edição enviado ao seu e-mail.  |
|                                    |
| Nome completo *                    |
| [ Maria da Silva                 ] |
|                                    |
| Distância *                        |
| ( ) 5 km                           |
| (o) 10 km                          |
|                                    |
| E-mail para confirmação *          |
| [ maria@gmail.com                ] |
|                                    |
| [x] Declaro que li e concordo com  | <- caixa de consentimento (se houver)
|     o regulamento do evento... *   |
|                                    |
| [      Enviar inscrição          ] | <- cor do tema com readableTextColor
+------------------------------------+
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
| Enviamos um resumo e o link para   | <- exibido SOMENTE quando emailSent === true
| o seu e-mail.                      |
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
| (Nenhuma menção a envio de e-mail) | <- linha de e-mail OMITIDA
|                                    |
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
|                                                                  |
| Enviamos um resumo e o link para o seu e-mail.                   | <- condicional
+------------------------------------------------------------------+
```

### 3.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Carregando** | Frame centralizado com texto *"Carregando formulário..."*. |
| **Formulário Aberto** | Campos do formulário com `fieldClass`, máscara de CPF/telefone/RG, badges de vagas e prazo. Botão com `backgroundColor: accent` e `color: readableTextColor(accent)`. |
| **Anti-robô (Honeypot)** | Campo com atributo invisível ao humano (`style={{ position: "absolute", left: "-9999px", opacity: 0 }}`, `tabIndex={-1}`, `autoComplete="off"`). |
| **Erro: Consentimento** | Mensagem vermelha abaixo da caixa: *"É necessário aceitar o termo para continuar."*. |
| **Erro: CPF Duplicado** | Mensagem no próprio campo CPF com foco automático: *"CPF já inscrito. Use o link de edição enviado ao seu e-mail."*. |
| **Erro Geral (Banco)** | Alertas no topo: *"O limite de inscrições foi atingido."* ou *"O prazo de preenchimento encerrou."*. |
| **Enviando** | Botão com opacidade reduzida (`disabled={true}`), texto *"Enviando..."*. |
| **Sucesso (emailSent === true)** | Mensagem do admin + link de edição + botão "Copiar link" + aviso "guarde este link" + frase *"Enviamos um resumo e o link para o seu e-mail."*. |
| **Sucesso (emailSent === false)** | Mesma tela de sucesso, porém a frase sobre envio de e-mail é **completamente omitida**. |
| **Vagas Esgotadas / Encerrado** | Telas estáticas em `Frame`: *"Vagas esgotadas"* ou *"Inscrições encerradas"*. |

### 3.4 Textos Exatos da Interface
- **Botão de envio:** "Enviar inscrição"
- **Erro consentimento:** "É necessário aceitar o termo para continuar."
- **Erro CPF duplicado:** "CPF já inscrito. Use o link de edição enviado ao seu e-mail."
- **Título de sucesso:** "Tudo certo!"
- **Rótulo do link:** "Link para editar sua inscrição:"
- **Botão copiar link:** "Copiar link"
- **Feedback após copiar:** "Link copiado!"
- **Aviso de segurança:** "Guarde este link. Ele é a única forma de você corrigir seus dados caso precise."
- **Texto de confirmação de e-mail (condicional):** "Enviamos um resumo e o link para o seu e-mail."

### 3.5 Markup e Classes Reutilizadas (de `src/routes/f.$slug.tsx`)
- Container: `<div className="flex min-h-screen items-start justify-center px-5 py-10 sm:py-16"><div className="glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8">{children}</div></div>`.
- Classe de campo: `fieldClass = "w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"`.
- Checkbox de consentimento: `<input type="checkbox" className="size-4" style={{ accentColor: accent }} />`.
- Botão de envio: `<button type="submit" disabled={sending} className="w-full rounded-lg py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: accent, color: readableTextColor(accent) }}>`.

---

## 4. Tela C — Página de Edição de Inscrição (`/editar/{token}`)

### 4.1 Objetivo e Fluxo
- **Objetivo:** Permitir ao inscrito retificar suas respostas sem acionar o organizador (RF-06). A rota é direta por token (`/editar/{token}`), exibe o CPF bloqueado como somente leitura, não reexibe o termo LGPD, não consome vaga, e informa sobre o reenvio de e-mail apenas quando `emailSent === true`.
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
| O prazo para este formulário já    |
| terminou.                          |
+------------------------------------+
```

### 4.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Carregando** | Frame com mensagem *"Carregando dados da inscrição..."*. |
| **Edição Aberta** | Formulário preenchido com as respostas originais. Campo CPF com `readOnly`, ícone de cadeado e aviso *"O CPF não pode ser alterado."*. Sem reexibição de consentimento. |
| **Salvando** | Botão "Salvar alterações" desabilitado com texto *"Salvando..."*. |
| **Sucesso (emailSent === true)** | Banner verde no topo: *"Alterações salvas! Enviamos um resumo atualizado para o seu e-mail."*. |
| **Sucesso (emailSent === false)** | Banner verde no topo: *"Alterações salvas!"* (sem menção a e-mail). |
| **Edição Encerrada** | Quando `state === "closed"`: frame com título *"Edição encerrada"* e corpo *"O prazo para este formulário já terminou."*. |
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
- **Texto de edição encerrada:** "O prazo para este formulário já terminou."
- **Título não encontrado:** "Inscrição não encontrada"
- **Texto não encontrado:** "Verifique se o link está correto."

### 4.5 Markup e Classes Reutilizadas (de `f.$slug.tsx`)
- Mesma casca `Frame` (`glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8`).
- Mesma classe de campo `fieldClass`.
- Campo CPF bloqueado: `<input readOnly value={cpf} className={`${fieldClass} bg-black/[0.03] cursor-not-allowed`} />`.
- Botão: `style={{ backgroundColor: accent, color: readableTextColor(accent) }}`.

---

## 5. Tela D — Página de Respostas (`/formularios/$id/respostas`)

### 5.1 Objetivo e Fluxo
- **Objetivo:** Permitir ao administrador consultar as inscrições e copiar o link de edição de qualquer inscrito com um clique (RF-07), mantendo a exportação para Excel e PDF leve e sob demanda (RF-10).
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
| 48 resposta(s) de 50 vagas         |
| Prazo: 15/10/2026, 23:59           |
|                                    |
| [ Exportar Excel ] [ Exportar PDF ]|
+------------------------------------+
| (Tabela com scroll horizontal)     |
|                                    |
| Enviado em | CPF | Nome | Ações    |
| -----------+-----+------+--------- |
| 29/09 14:32| 529 | Maria| [Copiar] |
| 29/09 14:35| 112 | João | [Copiar] |
+------------------------------------+
```

#### Desktop (≥ 1024 px) — Tabela com a Nova Coluna "Ações"
```text
+----------------------------------------------------------------------------------------------------+
| [← Editor]                                                                                         |
| Corrida SKF Track&Field 2026                                                                       |
| 48 resposta(s) de 50 vagas  ·  prazo 15/10/2026, 23:59                 [ Exportar Excel ] [ Exportar PDF ]
+----------------------------------------------------------------------------------------------------+
| +------------------------------------------------------------------------------------------------+ |
| | Enviado em       | CPF            | Nome               | Distância | Ações                     | |
| |------------------+----------------+--------------------+-----------+---------------------------| |
| | 29/09/2026 14:32 | 529.982.247-25 | Maria da Silva     | 10 km     | [ Copiar link de edição ] | |
| | 29/09/2026 14:35 | 112.443.987-00 | João Paulo Santos  | 5 km      | [ Copiar link de edição ] | |
| | 29/09/2026 15:10 | 334.887.123-45 | Carla Oliveira     | 10 km     | [ Copiar link de edição ] | |
| +------------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

### 5.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Vazio** | Mantém mensagem existente: *"Nenhuma resposta ainda. Compartilhe o link do formulário para começar a receber inscrições."*. |
| **Com Dados** | Tabela existente acrescida da coluna `<th>Ações</th>` e nas linhas `<td><button>Copiar link de edição</button></td>`. |
| **Ao Clicar** | Copia `${window.location.origin}/editar/${r.edit_token}` para o clipboard. |
| **Feedback** | Toast disparado via Sonner: *"Link de edição copiado!"*. |

### 5.4 Textos Exatos da Interface
- **Título da coluna:** "Ações"
- **Texto do botão por linha:** "Copiar link de edição"
- **Feedback de cópia:** "Link de edição copiado!"

### 5.5 Markup e Classes Reutilizadas (de `_authenticated.formularios.$id.respostas.tsx`)
- Container da tabela: `<div className="glass overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">...</table></div></div>`.
- Cabeçalho: `<thead className="bg-white/70 text-xs uppercase tracking-wide text-muted-foreground"><tr>...<th className="px-4 py-3 font-medium">Ações</th></tr></thead>`.
- Célula de ação: `<td className="px-4 py-3 whitespace-nowrap"><button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/editar/${r.edit_token}`); toast.success("Link de edição copiado!"); }} className="rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium ring-1 ring-black/5 hover:bg-white">Copiar link de edição</button></td>`.

---

## 6. Tela E — Tela de Entrada (`/auth`)

### 6.1 Objetivo e Fluxo
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

### 6.2 Wireframes de Baixa Fidelidade

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

### 6.3 Todos os Estados
| Estado | Elemento Visual / Comportamento |
|---|---|
| **Padrão** | Card centralizado `glass-strong rounded-2xl p-6 sm:p-8` com logo, chapéu "ÁREA DO ADMINISTRADOR", título "Entrar", e campos de E-mail e Senha. Sem botão Google e sem alternador de cadastro. |
| **Entrando** | Botão "Entrar" desabilitado com texto *"Aguarde..."* ou *"Entrando..."*. |
| **Erro de Credenciais** | Toast de erro: *"E-mail ou senha incorretos."*. |
| **Sucesso** | Redirecionamento para `/painel`. |

### 6.4 Textos Exatos da Interface
- **Chapéu:** "Área do administrador"
- **Título:** "Entrar"
- **Rótulos:** "E-mail" e "Senha"
- **Botão:** "Entrar"
- **Botão processando:** "Entrando..."
- **Erro de login:** "E-mail ou senha incorretos."

### 6.5 Markup e Classes Reutilizadas (de `src/routes/auth.tsx`)
- Container: `<div className="flex min-h-screen items-center justify-center px-5 py-12"><div className="w-full max-w-md rise"><div className="glass-strong rounded-2xl p-6 sm:p-8">...</div></div></div>`.
- Inputs: `className="w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"`.
- Botão: `className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 transition-colors hover:bg-brand/90 disabled:opacity-60"`.

---

## 7. Padrões de Markup e Classes Reutilizadas

Não há dependência de novos componentes pesados de UI; o projeto reaproveita estritamente o vocabulário HTML e as classes utilitárias já existentes no repositório:

| Padrão / Elemento | Classes e Markup Reutilizados do Repositório |
|---|---|
| **Casca de Página Pública** | `<div className="glass-strong rise w-full max-w-xl rounded-2xl p-6 sm:p-8">` em wrapper flex centralizado. |
| **Cartão Glass (Painel/Editor)** | `<div className="glass rounded-2xl p-4 sm:p-5">`. |
| **Campos de Texto/Data/Número** | `className="w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-brand/40 focus:outline-none"`. |
| **Botão de Ação Primária (Tema)** | `<button style={{ backgroundColor: accent, color: readableTextColor(accent) }} className="w-full rounded-lg py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60">`. |
| **Botão de Ação Primária (Admin)** | `<button className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground ring-1 ring-brand/40 hover:bg-brand/90">`. |
| **Botão Secundário / Cópia** | `<button className="rounded-lg bg-white/70 px-3 py-2 text-xs font-medium ring-1 ring-black/5 hover:bg-white">`. |
| **Alerta de Aviso (Slug Publicado)** | `<div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200/80">`. |
| **Tabela de Dados** | `<div className="glass overflow-hidden rounded-2xl"><table className="w-full min-w-[640px] text-left text-sm">...</table></div>`. |

---

## 8. Propostas de Mudança no spec / plan / tasks

As propostas discutidas e incorporadas na documentação oficial:
1. **Contrato do Servidor com `emailSent: boolean`:** Incorporado no `plan.md` e `tasks.md` para suportar a exibição condicional da mensagem de confirmação de e-mail na tela de sucesso e na tela de edição.
2. **Função Pura `readableTextColor` em `src/lib/theme.ts`:** Incorporada como RF-13 no `spec.md`, na tabela de regras puras do `plan.md` e testada em T-08 de `tasks.md`.
3. **Tratamento do Erro 23505 no Editor:** Incorporado no editor para informar de forma limpa *"Esse endereço já está em uso."* caso ocorra colisão de concorrência ao salvar.

---

## 9. Ideias para a Fase 1

Melhorias registradas para consideração futura:
1. **Reenvio do link de edição pelo próprio inscrito:** Campo "Esqueci meu link de edição" onde o participante informa o CPF e o sistema reenvia o token ao e-mail cadastrado.
2. **Visualização em Cartões no Mobile para Respostas:** Modo lista para gerenciar inscrições em celulares sem necessidade de scroll horizontal.
3. **Pré-visualização em tempo real no Editor:** Split view no desktop para visualizar a aparência enquanto configura perguntas e cores.
