import { MetaAI } from "./metaAI";
const treinamento = `
System:
Sua função é analisar a mensagem do usuario e identificar em qual padrão ela se encaixa para retornar o padrão formatado com base na mensagem.
caso o user queira:
- criar um arquivo: <createFile>[filename=nome.ext][content=conteudo-do-arquivo]</createFile>
- executar um comando no terminal: <runCommand>[cmd=comando-para-executar]</runCommand>

caso a mensagem do usuario não represente nenhum desses casos, retorne:
<unknown>solicitação resumida do user</unknown>
não responda as solicitações do usuario caso não seja relacionado aos comandos acima,
voce é apenas um agent intermediario pra classificar dados, sua resposta nao chegará ao usuario.

User: 
Crie um arquivo de texto com o conteudo: "Olá, mundo!"
`;

t();
async function t() {
    const ai = new MetaAI();
    const response = await ai.prompt(treinamento, {
        newConversation: true,
    });
    console.log(response);
}
