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
**Critério:** Dado um envio em que o campo invisível ao humano veio preenchido, então nada é gravado no banco; para que participantes legítimos cujo navegador ou gerenciador de senhas preencheu o campo via autofill não percam a inscrição em silêncio nem apaguem o que digitaram recarregando a página, o servidor devolve um erro orientado ao usuário (`"Não foi possível enviar. O seu navegador pode ter preenchido um campo automaticamente. Confira os seus dados e clique em Enviar novamente. Se o erro continuar, apague os campos preenchidos automaticamente e digite as informações você mesmo."`), e registra log com o código "HONEYPOT" e o slug do formulário (sem CPF, respostas ou dados pessoais). No cliente, o input recebe atributos anti-autofill (`name="zq_trap_7f3"`, `id="zq_trap_7f3"`, `data-lpignore="true"`, `data-1p-ignore="true"`, `data-form-type="other"`, etc., sem `<label>`), e após o erro, as respostas permanecem e um novo envio sem recarregar é aceito (o estado `hp` é limpo automaticamente).

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

### RF-16 — Código de acesso no link do cliente
Como administrador, quero que o link privado de acompanhamento do cliente (`/c/{token}`) exija um código de acesso gerado pelo sistema e tenha identificação visual clara no painel em relação ao link público de inscrição, para evitar exposição acidental dos dados pessoais dos inscritos caso o endereço seja compartilhado por engano.
**Critério:**
- Todo link do cliente criado pela primeira vez ou regenerado nasce protegido por um código de acesso de 10 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem `I`, `O`, `0`, `1`), gerado criptograficamente sem viés de módulo.
- O código em texto puro nunca é gravado no banco nem em logs (apenas hash SHA-256 com sal aleatório) e é exibido ao administrador uma única vez no momento da criação, regeneração ou proteção.
- Links antigos já existentes antes desta funcionalidade (sem `share_code_hash`) permanecem funcionando sem código como links legado, exibindo no painel uma faixa de alerta âmbar (`"Este link não tem código de acesso. Quem tiver o endereço vê os dados."`) e o botão `"Proteger com código"` (que gera um código mantendo o mesmo endereço, mediante confirmação no diálogo interno).
- Em links protegidos, abrir `/c/{token}` sem sessão válida retorna estado `"locked"`, sem entregar título do formulário, perguntas ou respostas, e exibe a tela `"Link protegido"` solicitando o código de acesso.
- A entrada do código aceita letras minúsculas, espaços e hífens (normalizados para maiúsculas sem espaços/hífens).
- Cinco tentativas incorretas consecutivas bloqueiam novas verificações por 15 minutos com a mensagem neutra `"Muitas tentativas. Aguarde 15 minutos e tente de novo."` (mesmo que o código correto seja digitado durante o bloqueio).
- Ao acertar o código, o servidor zera as falhas e emite um cookie de sessão assinado com HMAC-SHA256 (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`), com validade de 30 dias após o fechamento do formulário (`max(closes_at, agora) + 30 dias`, ou `agora + 30 dias` se não houver `closes_at`).
- Regenerar o código (`Gerar novo código`), regenerar link e código (`Gerar novo link e código`) ou desativar o link incrementa `share_code_version` e invalida imediatamente todas as sessões anteriores.
- No painel do formulário, os cartões diferenciam claramente `"Link público de inscrição"` (visual neutro) e `"Link privado do cliente"` (visual de alerta âmbar, com aviso ao copiar: `"Atenção: este link mostra dados pessoais dos inscritos. Envie só ao responsável."`).
- O link público de inscrição (`/{slug}`) e o fluxo de inscrição não sofrem alterações. A visão do cliente após desbloqueio continua exibindo os dados completos (sem máscara de CPF/RG nesta etapa).

## O quê e por quê (M-46)

O cliente (assessoria de corrida) monta, a cada evento, um grupo de WhatsApp para passar as informações da semana. Com 57 inscritos, isso significa salvar 57 contatos e adicionar um a um. O WhatsApp não permite que um sistema crie o grupo e adicione pessoas sem arriscar o número do cliente; o que o sistema pode fazer com segurança é **entregar o convite**: o cliente cria o grupo uma vez, cola o link no sistema, e o sistema o distribui por e-mail em lote, na tela de confirmação, por um botão de WhatsApp por inscrito e por um arquivo de contatos. Administrador e cliente (pelo link protegido por código) têm as mesmas funções.


### RF-17 — Link do grupo do WhatsApp no formulário
Como administrador, quero informar o link do grupo do WhatsApp do evento, para que o sistema o distribua.
**Critério de aceite:** Dado um formulário, quando informo um endereço de convite de grupo do WhatsApp no formato `https://chat.whatsapp.com/<código>` (até 200 caracteres), então ele é salvo. Endereço de outro site, com `http`, com espaços, com `@` ou fora desse formato é recusado com a mensagem `Cole o endereço completo do convite do grupo, que começa com https://chat.whatsapp.com/`. Campo vazio é permitido e remove o link.

### RF-18 — Link do grupo na confirmação de inscrição
Como inscrito, quero receber o link do grupo ao me inscrever, para entrar se eu quiser.
**Critério de aceite:** Dado um formulário com link do grupo, quando uma inscrição é concluída, então a tela de confirmação e o e-mail de confirmação mostram o botão `Entrar no grupo de avisos do evento`. Sem link configurado, nada muda. O link do grupo não aparece em nenhuma tela antes da inscrição ser concluída.

### RF-19 — Convite por e-mail em lote
Como administrador ou cliente, quero enviar o convite do grupo por e-mail a todos os inscritos com um clique, para não chamar um por um.
**Critério de aceite:** Dado um formulário com link do grupo e N inscritos com e-mail válido, quando aciono `Enviar convite por e-mail` e confirmo o resumo com a quantidade de destinatários, então cada inscrito recebe um e-mail só dele (sem mostrar outros inscritos) com o link, e o envio é registrado (quem enviou, quando, quantos). Quem já recebeu não recebe de novo, salvo ação explícita `Reenviar`. O envio mostra progresso. Se o envio for interrompido, o painel mostra quantos ficaram pendentes e permite continuar sem repetir quem já recebeu.
**Limites visíveis:** no máximo um envio em lote por formulário a cada 10 minutos; o sistema respeita um teto diário de convites (80 por dia no total, valor inicial) e, quando só cabem alguns, envia o que couber e avisa quantos ficam para o dia seguinte (`Hoje cabem {n} envios. Os outros {m} ficam para continuar amanhã.`).

### RF-20 — Convidar pelo WhatsApp, inscrito por inscrito
Como cliente, quero um botão por inscrito que abre o WhatsApp dele com a mensagem pronta, para convidar quem não leu o e-mail, sem salvar o contato.
**Critério de aceite:** Dado um inscrito com celular válido, quando toco em `Convidar`, então abre o WhatsApp com a conversa daquele número e a mensagem pronta contendo o link do grupo. A mensagem vem em 5 variações de redação (todas com o nome e o link), sorteadas de forma estável por inscrito (o mesmo inscrito sempre recebe a mesma variação), para que as mensagens não sejam idênticas. A mensagem é editável antes (a edição vale só para esse uso no aparelho, substitui as variações por um texto único e nunca vai para o e-mail). Inscrito sem celular válido aparece sem botão.

### RF-21 — Quem já foi convidado
Como cliente, quero ver quem já foi convidado (por e-mail ou pelo botão do WhatsApp), para não repetir.
**Critério de aceite:** Dado que o e-mail foi enviado ou toquei em `Convidar`, então a linha mostra `Convidado em <data>`; o filtro `Ainda não convidados` lista só quem falta. Se o registro falhar, o WhatsApp abre do mesmo jeito e a linha apenas não muda.

### RF-22 — Baixar contatos (última prioridade da M-46, T-55)
Como cliente, quero baixar os contatos dos inscritos num arquivo, para importar na agenda de uma vez se eu preferir adicionar manualmente.
**Critério de aceite:** Dado N inscritos com celular válido, quando toco em `Baixar contatos (.vcf)`, então baixo um arquivo com N contatos (nome e telefone com +55) que abre no Android e no iPhone. Nomes com caracteres especiais não alteram nem criam campos no contato.

### RF-23 — Mesmas funções no link privado do cliente
Como cliente, quero usar RF-19 a RF-22 pelo meu link protegido por código.
**Critério de aceite:** Dado um link com código de acesso e sessão válida, as funções estão disponíveis. Sem sessão válida, nenhuma é acessível (continua a tela `Link protegido`). Em link antigo sem código, o painel mostra só a leitura e o texto `Para enviar convites por aqui, peça ao administrador para proteger este link com código.`

### RF-24 — Cliente informa o link do grupo
Como cliente, quero colar eu mesmo o link do grupo no meu painel, sem depender do administrador.
**Critério de aceite:** Dado sessão válida em link protegido, quando colo um link válido (regra do RF-17), então o campo do formulário é atualizado e a alteração fica registrada com data e autoria `cliente via link`. Os e-mails já enviados mantêm o link antigo.

### RF-25 — Aviso no formulário público
Como inscrito, quero saber que receberei o convite do grupo antes de me inscrever.
**Critério de aceite:** Dado um formulário com link do grupo, o formulário público mostra a frase `Você poderá receber por e-mail o convite para o grupo de avisos deste evento. Entrar é opcional.` Sem link, a frase não aparece.

## Ordem de entrega (decisão do dono, 12/11/2026)
1. **Administrador primeiro:** RF-17, RF-19, RF-20, RF-21 (e-mail em lote e botão por inscrito), RF-18 e RF-25. O administrador cria o grupo e dispara os convites, validando o fluxo.
2. **Cliente depois, antes da próxima corrida:** RF-23 e RF-24.
3. **Por último:** RF-22 (arquivo de contatos).

## Qualidade e privacidade (nível da spec, sem tecnologia)
- Nenhum envio mostra a lista de outros inscritos nem seus telefones (RNF-02 do PRD).
- Nenhuma automação do WhatsApp do cliente: o sistema só abre links (RNF-01).
- Convites usam só a cota gratuita de e-mail; ao esgotar, avisam e continuam depois (RNF-03).
- Cada envio registra autoria, data, quantidade e resultado (RNF-05).
- O e-mail informa por que a pessoa o recebeu e como pedir para não receber mais mensagens do evento (RNF-06; **texto final depende do advogado**, DP pendente).
- 57 inscritos: envio concluído em até 60 segundos, com progresso na tela (RNF-07).

## Fora de escopo (M-46)
Adicionar pessoas ao grupo automaticamente; criar o grupo pelo sistema; saber quem entrou no grupo; Canal do WhatsApp automatizado; descadastro automático (EV-04, só com gatilho); máscara de CPF/RG (M-45).

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
6. **Convite em lote:** formulário de teste com 57 inscritos de e-mails de teste; colo o link do grupo, confirmo o resumo e o envio conclui em até 60 s com progresso; cada caixa recebe 1 e-mail só com o próprio convite.
7. **Duplo toque e retomada:** dois toques seguidos em `Enviar convite` criam um só envio; derrubo a conexão no meio e `Continuar envio` termina sem repetir ninguém.
8. **Link antigo não dispara:** com o link do cliente sem código, o painel mostra só leitura; depois de `Proteger com código` e do desbloqueio, os botões aparecem.
9. **Convidar por WhatsApp:** toco em `Convidar` num inscrito e abre a conversa certa com a mensagem pronta; a linha vira `Convidado em <data>`.
10. **Confirmação:** nova inscrição no formulário de teste mostra `Entrar no grupo de avisos do evento` na tela e no e-mail.
