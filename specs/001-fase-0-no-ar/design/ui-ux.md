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
      N -->|Sucesso| P[Toast: 'Alterações salvas.' ou 'Formulário publicado! O link já pode ser compartilhado.']
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
| [Pergunta] [Aparência] [Limites e Termos] |
+------------------------------------+
| (Aba Limites e Termos selecionada) |
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
| +----------------------------------------------+ | [ Pergunta ] [ Aparência ] [ Limites e Termos ] |
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
| **Formulário Aberto** | Campos do formulário com `fieldClass`, máscara de CPF/telefone/RG, badges de vagas e prazo. Botão com `backgroundColor: accent` e `color: readableTextColor(accent)`. |
| **Sugestão de E-mail (Blur)** | Ao sair de campo de e-mail com erro de digitação de domínio comum (ex.: gmial.com), exibe abaixo em `aria-live="polite"`: *"Você quis dizer <sugestão>?"* e o botão *"Usar este endereço"*. |
| **Confirmação de E-mail** | Segundo campo obrigatório de confirmação exibido abaixo de cada e-mail. Se divergirem, bloqueia o envio com foco e erro: *"Os e-mails não são iguais."*. |
| **Anti-robô (Honeypot)** | Campo com atributo invisível ao humano (`style={{ position: "absolute", left: "-9999px", opacity: 0 }}`, `tabIndex={-1}`, `autoComplete="off"`). |
| **Erro: Consentimento** | Mensagem vermelha abaixo da caixa: *"É necessário aceitar o termo para continuar."*. |
| **Erro: CPF Duplicado** | Mensagem no próprio campo CPF com foco automático: *"CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador."*. |
| **Erro Geral (Banco)** | Alertas no topo: *"O limite de inscrições foi atingido."* ou *"O prazo de preenchimento encerrou."*. |
| **Enviando** | Botão com opacidade reduzida (`disabled={true}`), texto *"Enviando..."*. |
| **Sucesso (emailSent === true)** | Bloco em destaque verde claro com anel e envelope ANTES do link: *"Enviamos um resumo e o link para o seu e-mail."*, *"Enviado para: <endereço>"* e *"Não chegou? Procure na caixa de spam ou lixo eletrônico."*, seguido do cartão do link de edição. |
| **Sucesso (emailSent === false com e-mail)** | Cartão do link de edição seguido de aviso âmbar: *"Não conseguimos enviar o e-mail agora. Guarde o link acima: é a sua forma de corrigir seus dados."*. |
| **Sucesso (sem pergunta de e-mail)** | Cartão do link de edição sem nenhuma menção a e-mail. |
| **Vagas Esgotadas / Encerrado** | Telas estáticas em `Frame`: *"Vagas esgotadas"* ou *"Inscrições encerradas"*. |

### 3.4 Textos Exatos da Interface
- **Botão de envio:** "Enviar inscrição"
- **Rótulo confirmação de e-mail:** "Confirme seu e-mail"
- **Erro divergência de e-mail:** "Os e-mails não são iguais."
- **Sugestão de e-mail:** "Você quis dizer "
- **Botão aplicar sugestão:** "Usar este endereço"
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
| **Resumo de Respostas** | Exibe `"{n} resposta(s)"` ou, havendo respostas editadas, `"{n} resposta(s) · {e} editada(s)"`. |
| **Filtro de Editadas** | Havendo editadas, botão *"Mostrar só editadas"* / *"Mostrar todas"* (`aria-pressed`). Quando ativado, filtra a tabela exibindo apenas as inscrições editadas. |
| **Filtro Vazio** | Quando o filtro está ativo e não há inscrições correspondentes: *"Nenhuma inscrição editada."*. |
| **Ao Clicar em Copiar** | Copia o link com o domínio de produção (`ALLOWED_ORIGINS[0]`): `${ALLOWED_ORIGINS[0]}/editar/${r.edit_token}` para o clipboard. |
| **Feedback** | Toast disparado via Sonner: *"Link de edição copiado!"*. |
| **Falha ao copiar** | Toast disparado via Sonner: *"Não foi possível copiar o link."*. |
| **Ao Clicar em Excluir** | Abre o diálogo `AlertDialog` com título *"Excluir esta inscrição?"*, texto *"Isto apaga de vez as respostas de {nome} (enviada em {data}). O CPF e a vaga voltam a ficar livres e o link de edição deixa de funcionar. Esta ação não pode ser desfeita."*, foco inicial em *"Cancelar"* (Esc também cancela) e botão destrutivo *"Excluir inscrição"*. |
| **Exclusão com Sucesso** | Toast disparado via Sonner: *"Inscrição excluída."* e recarrega a consulta. Se a última linha for excluída, a tabela passa a exibir o estado vazio. |
| **Falha na Exclusão** | Caso a exclusão falhe ou o banco retorne 0 linhas: toast *"Não foi possível excluir. Tente novamente."*. O botão fica desabilitado durante o envio. |
| **Erro de carga** | *"Não foi possível carregar as respostas."* e o botão *"Tentar de novo"*. |

### 5.4 Textos Exatos da Interface
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
- **Feedback de cópia:** "Link de edição copiado!"
- **Falha ao copiar:** "Não foi possível copiar o link."
- **Erro de carga:** "Não foi possível carregar as respostas."
- **Botão de retry:** "Tentar de novo"
- **Erro de exportação:** "Não foi possível exportar. Tente novamente."

### 5.5 Markup e Classes Reutilizadas (de `_authenticated.formularios.$id.respostas.tsx`)
- Container da tabela: `<div className="glass overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">...</table></div></div>`.
- Cabeçalho: `<thead className="bg-white/70 text-xs uppercase tracking-wide text-muted-foreground"><tr>...<th className="px-4 py-3 font-medium">Ações</th></tr></thead>`.
- Célula de ação: `<td className="px-4 py-3 whitespace-nowrap"><button onClick={() => { navigator.clipboard.writeText(`${ALLOWED_ORIGINS[0]}/editar/${r.edit_token}`).then(() => toast.success("Link de edição copiado!")).catch(() => toast.error("Não foi possível copiar o link.")); }} className="rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium ring-1 ring-black/5 hover:bg-white">Copiar link de edição</button></td>`.

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
1. **Rótulo da Aba no Editor:** Renomear o rótulo da aba existente de "Limites" para **"Limites e Termos"** (mantendo a chave interna `limites`), posicionando o campo de consentimento LGPD junto às configurações de encerramento e capacidade do formulário.
2. **Contrato do Servidor com `emailSent: boolean`:** Incorporado no `plan.md` e `tasks.md` para suportar a exibição condicional da mensagem de confirmação de e-mail na tela de sucesso e na tela de edição.
3. **Função Pura `readableTextColor` em `src/lib/theme.ts`:** Incorporada como RF-13 no `spec.md`, na tabela de regras puras do `plan.md` e testada em T-08 de `tasks.md`, devolvendo `#ffffff` ou `#000000` para garantir contraste >= 4,5:1.
4. **Tratamento do Erro 23505 no Editor:** Incorporado no editor para informar de forma limpa *"Esse endereço já está em uso."* caso ocorra colisão de concorrência ao salvar.
5. P-NN [Tela C] CPF mascarado na edição (SEC-17), aprovada pelo dono.
6. P-NN [Tela B] O estado 'Inscrições encerradas' vale também para o encerramento manual e usa texto neutro, aprovada pelo dono.
7. P-NN [Tela D] O link copiado usa sempre o domínio de produção, aprovada pelo dono.
8. P-NN [Tela B] bloco do e-mail em destaque, sugestão de domínio e confirmação de e-mail; [Tela D] coluna Atualizado em e filtro de editadas, aprovadas pelo dono.
9. P-NN [Tela D] exclusão de inscrição pelo painel, para atender pedidos de exclusão (LGPD), aprovada pelo dono.

---

## 9. Ideias para a Fase 1

Melhorias registradas para consideração futura:
1. **Reenvio do link de edição pelo próprio inscrito:** Campo "Esqueci meu link de edição" onde o participante informa o CPF e o sistema reenvia o token ao e-mail cadastrado.
2. **Visualização em Cartões no Mobile para Respostas:** Modo lista para gerenciar inscrições em celulares sem necessidade de scroll horizontal.
3. **Pré-visualização em tempo real no Editor:** Split view no desktop para visualizar a aparência enquanto configura perguntas e cores.
