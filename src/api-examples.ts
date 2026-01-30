/**
 * Exemplos de uso da API Meta AI com Node.js
 *
 * Execute o servidor primeiro: npm run server
 * Depois execute este arquivo: ts-node src/api-examples.ts
 */

import axios from "axios";

const API_URL = "http://localhost:3000";

// Exemplo 1: Verificar saúde da API
async function checkHealth() {
    console.log("\n📍 Verificando saúde da API...");
    try {
        const response = await axios.get(`${API_URL}/health`);
        console.log("✅ Status:", response.data);
    } catch (error: any) {
        console.error("❌ Erro:", error.message);
    }
}

// Exemplo 2: Enviar um prompt simples
async function simplePrompt() {
    console.log("\n💬 Enviando prompt simples...");
    try {
        const response = await axios.post(`${API_URL}/api/prompt`, {
            message: "O que é inteligência artificial?",
        });
        console.log("✅ Resposta:", response.data.data.message);
        console.log("📚 Fontes:", response.data.data.sources);
    } catch (error: any) {
        console.error("❌ Erro:", error.response?.data || error.message);
    }
}

// Exemplo 3: Conversa com contexto
async function conversationExample() {
    console.log("\n🗣️  Exemplo de conversa com contexto...");
    try {
        // Primeira pergunta
        const resp1 = await axios.post(`${API_URL}/api/prompt`, {
            message: "Qual é a capital do Brasil?",
        });
        console.log("Pergunta 1: Qual é a capital do Brasil?");
        console.log("Resposta:", resp1.data.data.message);

        // Segunda pergunta relacionada (sem newConversation = true, mantém contexto)
        const resp2 = await axios.post(`${API_URL}/api/prompt`, {
            message: "E qual é a população desta cidade?",
        });
        console.log("\nPergunta 2: E qual é a população desta cidade?");
        console.log("Resposta:", resp2.data.data.message);
    } catch (error: any) {
        console.error("❌ Erro:", error.response?.data || error.message);
    }
}

// Exemplo 4: Nova conversa
async function newConversationExample() {
    console.log("\n🔄 Iniciando nova conversa...");
    try {
        const response = await axios.post(`${API_URL}/api/new-conversation`);
        console.log("✅ Resultado:", response.data);
    } catch (error: any) {
        console.error("❌ Erro:", error.response?.data || error.message);
    }
}

// Exemplo 5: Fazer múltiplas perguntas
async function multipleQuestions() {
    console.log("\n❓ Fazendo múltiplas perguntas...");
    const questions = [
        "Quem é Elon Musk?",
        "O que a Tesla faz?",
        "Qual é o carro elétrico mais vendido do mundo?",
    ];

    for (const question of questions) {
        try {
            const response = await axios.post(`${API_URL}/api/prompt`, {
                message: question,
            });
            console.log(`\nPergunta: ${question}`);
            console.log(
                `Resposta: ${response.data.data.message.substring(0, 200)}...`,
            );
        } catch (error: any) {
            console.error(`❌ Erro ao perguntar "${question}":`, error.message);
        }
    }
}

// Função principal
async function main() {
    console.log("🚀 Exemplos de uso da API Meta AI");
    console.log("=".repeat(50));

    await checkHealth();
    await simplePrompt();
    await newConversationExample();
    await conversationExample();
    await multipleQuestions();

    console.log("\n" + "=".repeat(50));
    console.log("✨ Exemplos concluídos!");
}

// Executar se for o arquivo principal
if (require.main === module) {
    main().catch(console.error);
}

export {
    checkHealth,
    simplePrompt,
    conversationExample,
    newConversationExample,
    multipleQuestions,
};
