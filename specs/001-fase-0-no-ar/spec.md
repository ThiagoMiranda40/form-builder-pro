# Spec 001 — Fase 0: colocar o Form Builder Pro no ar

> Origem: `docs/PRD-form-builder-pro.md` (v2.1). Esta spec descreve **comportamento**; a tecnologia está em `plan.md`.

## O quê e por quê

O sistema já cria formulários, valida CPF, aplica prazo e vagas e exporta Excel/PDF, mas tem lacunas que impedem o uso real: o mesmo CPF pode se inscrever várias vezes, o limite de vagas pode estourar quando vários enviam ao mesmo tempo, o inscrito não tem como corrigir seus dados, não há aviso de privacidade, o endereço do formulário é um código aleatório e qualquer pessoa pode criar conta.

Esta feature fecha essas lacunas para que **um único administrador** publique formulários de 40 a 60 inscrições em um subdomínio próprio, com endereços legíveis como `inscricoes.<domínio>/skf-corrida-track-field`.

## Requisitos

### RF-01 — Acesso único do administrador
Como administrador, quero ser a única pessoa que entra na área de gestão, para que ninguém mais crie formulários ou veja inscrições.
**Critério:** Dado um visitante na tela de entrada, então só existe e-mail + senha (sem "criar conta" e sem login por terceiros); quando alguém tenta criar uma conta por qualquer meio, então é recusado.

### RF-02 — Página inicial
Como visitante, quero cair em uma página útil ao abrir o endereço raiz.
**Critério:** Dado o endereço raiz, quando abro, então sou levado à área de gestão (se já entrei) ou à tela de entrada.

### RF-03 — Inscrição única por CPF
Como administrador, quero que o mesmo CPF não se inscreva duas vezes no mesmo formulário, para não gastar vagas com duplicidade.
**Critério:** Dado o CPF `529.982.247-25` já inscrito, quando alguém envia `52998224725` (com ou sem pontos e traço), então recebe "CPF já inscrito. Use o link de edição enviado ao seu e-mail ou fale com o organizador." e nada é gravado. Formulários sem campo CPF não têm essa regra.

### RF-04 — Limite de vagas seguro
Como administrador, quero que o número de inscrições nunca ultrapasse o limite, mesmo com muitas pessoas enviando ao mesmo tempo.
**Critério:** Dado limite de 5 vagas e 20 envios simultâneos, então exatamente 5 são gravados e 15 recebem "vagas esgotadas".

### RF-05 — E-mail de confirmação com link de edição
Como inscrito, quero receber por e-mail o resumo do que enviei e um link para corrigir depois.
**Critério:** Dado um envio válido em um formulário com campo de e-mail, então o inscrito recebe um e-mail com as respostas (CPF e RG parcialmente ocultos, ex.: `***.***.***-25`) e o link de edição. A tela de sucesso mostra o mesmo link com o aviso "guarde este link". **Se o e-mail não puder ser enviado, a inscrição continua válida** e o link aparece na tela. A tela só afirma que enviou e-mail quando o envio foi bem-sucedido.

### RF-06 — Editar a inscrição pelo link
Como inscrito, quero mudar minha resposta (ex.: de 5 km para 10 km) sem falar com o organizador.
**Critério:** Dado o link de edição e o formulário aberto, quando troco "5 km" por "10 km" e salvo, então a tabela do administrador mostra "10 km", **nenhuma vaga extra é consumida**, o CPF aparece bloqueado (não editável) e um novo e-mail com o resumo é enviado. Dado o formulário encerrado ou com prazo vencido, então o link mostra "edição encerrada". Vagas esgotadas **não** impedem a edição. A tela só afirma que enviou e-mail quando o envio foi bem-sucedido. O e-mail após edição é enviado no máximo 1 vez a cada 10 minutos por inscrição; a edição é salva normalmente mesmo quando o e-mail não é enviado.

### RF-07 — Administrador copia o link de edição
Como administrador, quero copiar o link de edição de qualquer inscrito, para reenviar quando ele perder o e-mail.
**Critério:** Dado uma linha na tabela de respostas, quando clico em "Copiar link de edição", então o link é copiado.

### RF-08 — Consentimento de dados (LGPD)
Como administrador, quero exibir um texto de consentimento obrigatório, para coletar CPF/RG com base clara.
**Critério:** Dado um formulário com texto de consentimento, quando o inscrito não marca o aceite, então o envio é bloqueado; quando marca, então a inscrição registra a data e hora do aceite. Formulário sem texto de consentimento não mostra a caixa.

### RF-09 — Proteção contra robôs e resiliência a autofill
**Critério:** Dado um envio em que o campo invisível ao humano veio preenchido, então nada é gravado no banco; para que participantes legítimos cujo navegador ou gerenciador de senhas preencheu o campo via autofill não percam a inscrição em silêncio, o servidor devolve um erro amigável e recuperável ("Não foi possível enviar. Recarregue a página e tente novamente."), e registra log com o código "HONEYPOT" e o slug do formulário (sem CPF, respostas ou dados pessoais). No cliente, o input recebe atributos anti-autofill (`name="zq_trap_7f3"`, `id="zq_trap_7f3"`, `data-lpignore="true"`, `data-1p-ignore="true"`, `data-form-type="other"`, etc., sem `<label>`), e ao receber o erro do servidor, a tela limpa o campo `hp` preservando todas as respostas preenchidas pelo usuário para permitir reenvio imediato.

### RF-10 — Dados protegidos
**Critério:** Dado alguém sem login, quando tenta ler formulários, perguntas ou respostas diretamente no banco, então não recebe nada; as respostas só são visíveis ao administrador.

### RF-11 — Endereço personalizado por formulário
Como administrador, quero escolher o endereço de cada formulário, para divulgar algo legível como `inscricoes.<domínio>/skf-corrida-track-field`.
**Critério:**
- O endereço vem logo depois da barra, sem prefixo.
- Regras: 3 a 60 caracteres; só letras minúsculas sem acento, números e hífens; sem hífen no início, no fim ou repetido.
- **O campo converte enquanto se digita:** maiúsculas viram minúsculas, acentos somem, espaços e símbolos viram hífen (ex.: "SKF Corrida Track&Field" → `skf-corrida-track-field`). O hífen digitado no fim é mantido enquanto a pessoa escreve e removido ao sair do campo.
- Ao criar um formulário, o sistema sugere o endereço a partir do título (ex.: "SKF Corrida Track & Field" → `skf-corrida-track-field`); o administrador pode editar.
- Endereço já usado por outro formulário é recusado com "Esse endereço já está em uso".
- Nomes reservados pelo sistema (`auth`, `painel`, `formularios`, `api`, `saude`, `admin`, `assets`, `login`, `editar`) são recusados com "Esse nome é reservado pelo sistema".
- O administrador pode trocar o endereço a qualquer momento; se o formulário já está publicado, aparece o aviso "links já compartilhados deixarão de funcionar".
- **O link de edição do inscrito não depende do endereço do formulário**, então trocar o endereço não o quebra.

### RF-12 — Mensagem de sucesso personalizada
Como administrador, quero que a mensagem de sucesso que escrevi apareça ao final da inscrição.
**Critério:** Dado a mensagem "Inscrição confirmada! Nos vemos na largada.", quando uma inscrição é concluída, então essa mensagem aparece (hoje aparece sempre a mensagem padrão).

### RF-13 — Legibilidade dos botões com qualquer cor de tema
Como inscrito ou participante, quero conseguir ler com clareza o texto dos botões de ação independentemente da cor definida pelo organizador.
**Critério:** Dado o tema com cor `#ffff00` ou `#22c55e`, o texto do botão fica preto (`#000000`); com `#4f46e5` ou `#000000`, fica branco (`#ffffff`); com `#ffffff`, fica preto (`#000000`). Com qualquer cor de tema, o contraste entre o texto e o fundo do botão é de pelo menos 4,5:1. A cor escolhida pelo organizador não é alterada.

### RF-14 — Validação estrita de telefone (celular e fixo)
Como administrador e inscrito, quero que números de telefone inválidos ou com dígitos faltando sejam recusados com orientação clara.
**Critério:** Dado um telefone informado:
- Celular com DDD (11 dígitos): DDD 11–99 e 3º dígito obrigatoriamente 9.
- Telefone fixo com DDD (10 dígitos): DDD 11–99 e 3º dígito obrigatoriamente entre 2 e 5. Números de 10 dígitos iniciados em 9 (ex.: celular com 8 dígitos sem o nono dígito) ou outros dígitos são recusados com a mensagem: `"Telefone inválido — celular com DDD tem 11 dígitos (ex.: (11) 98765-4321) e fixo tem 10 dígitos."`.

### RF-15 — Validação em tempo real da data de nascimento e linha de evento no e-mail
Como inscrito, quero saber imediatamente se a data de nascimento digitada cumpre os requisitos do evento e ter os detalhes do evento no e-mail de confirmação.
**Critério:**
- Os formulários públicos utilizam `noValidate` para impedir os balões nativos do navegador. Ao completar uma data no formato AAAA-MM-DD ou ao sair do campo (`onBlur`), se a data estiver fora da faixa etária permitida, a mensagem em linguagem natural (`Este evento só aceita participantes com {min} anos ou mais.`, `Este evento só aceita participantes de até {max} anos.` ou `Este evento aceita participantes de {min} a {max} anos.`) aparece imediatamente abaixo do campo.
- Na edição da inscrição, a restrição de idade só é reaplicada se a data de nascimento for alterada.
- Quando o formulário tem data de evento (`event_date`), o e-mail de confirmação (inscrição, edição e reenvio admin) exibe a linha `Evento: dd/mm/aaaa` (com horário e local, se preenchidos) logo abaixo do título.

## Fora de escopo (produto)

Data/hora de **abertura**, excluir resposta pela tela, upload de logotipo, duplicar formulário, busca na tabela, captcha, reenvio do link pelo próprio inscrito, pré-visualização no editor, quiz com nota, mais de um administrador, confirmar que o CPF existe na Receita, lógica condicional, upload de arquivos pelo inscrito, redirecionamento de endereços antigos (nada está em produção ainda).

## Premissas

- O inscrito pode editar até o encerramento ou prazo do formulário.
- O campo CPF do formulário é a identidade única; o campo e-mail do formulário recebe a confirmação. Não há configuração extra: o sistema usa o primeiro campo do tipo CPF e o primeiro do tipo e-mail.
- Prazos valem no horário de Brasília.

## Cenários-chave de validação (roteiro final ponta a ponta)

1. **Inscrição e correção:** publico um formulário com nome, e-mail, CPF e "distância"; uma pessoa se inscreve em "5 km", recebe o e-mail, abre o link, troca para "10 km"; na tabela do administrador aparece "10 km" e continua sendo 1 inscrição.
2. **CPF repetido:** a mesma pessoa tenta se inscrever de novo (com e sem máscara) e é recusada com a orientação de usar o link de edição.
3. **Vagas:** formulário com 3 vagas recebe 10 envios ao mesmo tempo; entram exatamente 3.
4. **Endereço legível no subdomínio:** `inscricoes.<domínio>/skf-corrida-track-field` abre o formulário no celular; trocar o endereço no painel faz o antigo deixar de funcionar e o novo funcionar; o link de edição enviado antes continua funcionando.
5. **Só eu entro:** tentar criar uma conta é recusado; sem login, não se lê nenhuma inscrição.
