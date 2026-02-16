import { MetaAI } from "./metaAI";

t();
async function t() {
    const ai = new MetaAI();
    const response = await ai.prompt('oi?', {
        newConversation: true,
        thinking: false,
    });
    console.log(response);
}
