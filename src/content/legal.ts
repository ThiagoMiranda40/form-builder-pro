export interface LegalDocument {
  title: string;
  updatedAt: string;
  paragraphs: string[];
}

export const termosDeUso: LegalDocument = {
  title: "Termos de Uso",
  updatedAt: "01/10/2026",
  paragraphs: [
    "**1. O que é este sistema.** Este site permite que você se inscreva em programas e eventos (por exemplo, corridas) por meio de formulários. O sistema é operado pela Tríade Tecnologia e Soluções (CNPJ 43.425.201/0001-43), em nome da organização responsável por cada formulário, indicada no texto de consentimento dele.",
    "**2. Quem pode usar.** Qualquer pessoa que queira se inscrever em um programa que usa o sistema. Ao enviar um formulário, você declara que as informações são verdadeiras e são suas, ou que você tem autorização da pessoa inscrita para informá-las.",
    "**3. Seus compromissos.** Informar dados corretos e um e-mail que você consulta; não tentar acessar dados de outras pessoas, não sobrecarregar o sistema e não usá-lo de forma ilegal.",
    "**4. O link de edição.** Depois da inscrição você recebe um link exclusivo para corrigir seus dados. **Quem tem o link consegue alterar a inscrição**, então guarde-o e não o compartilhe. Se perder o link, peça outro à organização do programa.",
    "**5. Alterações e prazos.** As alterações só são aceitas enquanto o formulário estiver aberto e dentro dos prazos definidos pela organização. A organização decide se uma alteração, como troca de tamanho de camiseta ou de distância, é possível naquele momento, e pode entrar em contato com você sobre isso.",
    "**6. Disponibilidade.** Trabalhamos para manter o sistema no ar, mas ele é oferecido no estado em que está, sem garantia de funcionamento ininterrupto. Pode haver manutenção ou falhas fora do nosso controle.",
    "**7. Responsabilidade.** A organização do programa é responsável por regras, vagas, valores e pela participação no evento. A Tríade responde apenas pelo funcionamento do sistema de inscrição.",
    "**8. Privacidade.** O tratamento dos seus dados pessoais está descrito na Política de Privacidade.",
    "**9. Mudanças nestes termos.** Podemos atualizar estes termos. A versão em vigor é sempre a publicada nesta página, com a data de atualização acima.",
    "**10. Contato e foro.** Dúvidas e pedidos: contato@triadetecnologiaesolucoes.com.br. Estes termos seguem a lei brasileira; fica eleito o foro da comarca de Cajamar/SP, salvo disposição legal em contrário.",
  ],
};

export const politicaDePrivacidade: LegalDocument = {
  title: "Política de Privacidade",
  updatedAt: "01/10/2026",
  paragraphs: [
    "**1. Quem é o responsável pelos seus dados.** Cada formulário informa, no texto de consentimento, a organização responsável pelo programa e pelo evento (a \"controladora\"). A Tríade Tecnologia e Soluções (CNPJ 43.425.201/0001-43) opera o sistema de inscrição em nome dela (a \"operadora\").",
    "**2. Quais dados coletamos.** Os que o formulário pede, como nome, CPF, e-mail, telefone e escolhas do evento (por exemplo, distância e tamanho de camiseta). Também guardamos a data e a hora da inscrição e das alterações. Não pedimos dados além dos necessários para a inscrição.",
    "**3. Para que usamos.** Para realizar a sua inscrição, comunicar-nos com você sobre o programa e permitir que você corrija seus dados. Não usamos seus dados para publicidade nem os vendemos.",
    "**4. Base legal.** O seu **consentimento**, dado ao marcar a caixa de aceite do formulário. Você pode retirá-lo a qualquer momento.",
    "**5. Com quem compartilhamos.** Com o **organizador do evento** em que você se inscreve (a organização responsável pelo programa) e com os serviços técnicos que fazem o sistema funcionar, que tratam os dados apenas para isso: hospedagem e rede (Cloudflare), banco de dados (Supabase, região São Paulo, Brasil) e envio de e-mails (Resend, região São Paulo). Alguns deles, como a rede da Cloudflare, podem processar dados fora do Brasil.",
    "**6. Por quanto tempo guardamos.** Enquanto o programa existir e, depois, por até **30 dias após o seu encerramento**, quando os dados são eliminados. Cópias exportadas para planilha seguem o mesmo prazo.",
    "**7. Seus direitos.** Você pode, a qualquer momento, confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a eliminação dos dados tratados com o seu consentimento, saber com quem os compartilhamos e retirar o consentimento (art. 18 da LGPD). A correção pode ser feita por você mesmo pelo link de edição que recebe por e-mail.",
    "**8. Como exercer seus direitos.** Escreva para **contato@triadetecnologiaesolucoes.com.br** informando o nome e o programa em que se inscreveu. Respondemos em até 15 dias. Se não estiver satisfeito, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
    "**9. Como protegemos.** Conexão segura (HTTPS), acesso aos dados restrito à organização responsável, link de edição único e secreto, e CPF parcialmente ocultado nos e-mails que enviamos a você. Nenhum sistema é totalmente imune a incidentes; se houver um que afete seus dados, avisaremos conforme a lei.",
    "**10. Cookies e rastreamento.** Não usamos cookies de publicidade nem de rastreamento. Este site carrega fontes do Google, que recebem o seu endereço IP para entregar os arquivos de fonte.",
    "**11. Mudanças.** Podemos atualizar esta política; a versão em vigor é a publicada nesta página, com a data acima.",
  ],
};
