# ADR-004 — Ações de escrita pelo link do cliente só com link protegido e sessão válida

Status: Proposto (12/11/2026). Origem: CA-05 do PRD M-46 (emendada: restringe o PRD).

## Contexto
O link do cliente (`/c/<token>`) é hoje só de leitura (T-25, T-44). A M-46 exige que o cliente salve o link do grupo, dispare e-mails e marque convites. Links criados antes da T-44 não têm código de acesso e continuam abertos (decisão do dono). Se um link legado pudesse disparar e-mails, qualquer pessoa com o endereço poderia mandar e-mail para todos os inscritos com um link arbitrário. Também o link do grupo informado pelo cliente vai dentro de e-mails enviados a dezenas de pessoas.

## Opções consideradas
1. Permitir escrita em qualquer link do cliente.
2. Permitir escrita só quando o link tem código de acesso e a sessão assinada é válida (a mesma da T-44); links legados ficam só de leitura e mostram o convite para protegê-los.
3. Cliente só lê; apenas o administrador escreve (descarta o pedido do dono).

## Decisão
Opção 2. Há duas funções de entrada separadas: administrador (autenticação existente, dono do formulário) e cliente (token mais cookie de sessão). As duas chamam o mesmo núcleo em `src/lib/invite.ts`, que não lê cookie nem decide autorização. O cliente pode: salvar o link do grupo, iniciar e continuar um lote, marcar convite pelo WhatsApp. Não pode: nada além disso. O link do grupo aceito é só `https://chat.whatsapp.com/<código>` (host fixo), para que ninguém use o envio para divulgar outro endereço.

## Consequências
Para usar convites, o dono precisa clicar "Proteger com código" nos links legados. A escrita do cliente depende do segredo `SHARE_SESSION_SECRET` (já configurado). Nova superfície de ataque, revisada pela etapa de cibersegurança.

## Em linguagem simples
O cliente só pode disparar convites se o link dele tem o código. Sem o código, qualquer pessoa que ache o endereço poderia mandar e-mail para todos os inscritos. E o sistema só aceita como convite um link verdadeiro de grupo do WhatsApp.

## Revisitar quando
O dono decidir proteger todos os links antigos de uma vez, ou houver mais de um perfil de cliente com permissões diferentes.
