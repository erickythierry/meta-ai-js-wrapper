import { MetaAI } from "./metaAI";

t();
async function t() {
    const ai = new MetaAI();
    const response = await ai.prompt('como eu posso criar um container do clickhouse com o postgres protocol habilitado por padrao?', {
        newConversation: true,
        thinking: false,
    });
    console.log(response);
}
