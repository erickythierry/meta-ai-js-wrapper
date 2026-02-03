import { MetaAI } from "./metaAI";
t();
async function t() {
    const ai = new MetaAI();
    const response = await ai.prompt("oque eu disse antes?", {
        newConversation: true,
    });
    console.log(response);
}
