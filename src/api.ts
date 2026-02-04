import express, { Request, Response } from "express";
import { MetaAI } from "./metaAI";
import { MetaAIResponse } from "./types";
import { chatPageHtml } from "./chatPage";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Adiciona header CORS simples
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// Instância global do MetaAI (será reutilizada entre requisições)
let metaAI: MetaAI | null = null;

// Inicializa o MetaAI na primeira requisição
async function getMetaAIInstance(): Promise<MetaAI> {
    if (!metaAI) {
        // Você pode passar credenciais via variáveis de ambiente, se necessário
        // const fbEmail = process.env.META_FB_EMAIL;
        // const fbPassword = process.env.META_FB_PASSWORD;
        // metaAI = new MetaAI({ fbEmail, fbPassword });

        metaAI = new MetaAI();
        await metaAI.init();
    }
    return metaAI;
}

// Rota de saúde
app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok", message: "Meta AI API is running" });
});

// Rota do Chat UI
app.get("/chat", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(chatPageHtml);
});

// Rota principal para enviar prompt
app.post("/api/prompt", async (req: Request, res: Response) => {
    try {
        const { message, newConversation = false } = req.body;

        if (!message || typeof message !== "string") {
            return res.status(400).json({
                error: 'Campo "message" é obrigatório e deve ser uma string',
            });
        }

        if (message.trim().length === 0) {
            return res.status(400).json({
                error: "A mensagem não pode estar vazia",
            });
        }

        const ai = await getMetaAIInstance();
        const response: MetaAIResponse = await ai.prompt(message, {
            newConversation,
        });

        res.json({
            success: true,
            data: response,
        });
    } catch (error: any) {
        console.error("Erro ao processar prompt:", error);
        res.status(500).json({
            error: "Erro ao processar sua mensagem",
            details: error?.message || "Erro desconhecido",
        });
    }
});

// Rota para iniciar nova conversa
app.post("/api/new-conversation", async (req: Request, res: Response) => {
    try {
        const ai = await getMetaAIInstance();

        // Cria uma nova instância para nova conversa
        metaAI = null;
        const newAI = await getMetaAIInstance();

        res.json({
            success: true,
            message: "Nova conversa iniciada",
        });
    } catch (error: any) {
        console.error("Erro ao iniciar nova conversa:", error);
        res.status(500).json({
            error: "Erro ao iniciar nova conversa",
            details: error?.message || "Erro desconhecido",
        });
    }
});

// Rota para resetar a instância (útil para limpar cookies/sessão)
app.post("/api/reset", (req: Request, res: Response) => {
    try {
        metaAI = null;
        res.json({
            success: true,
            message: "Instância resetada com sucesso",
        });
    } catch (error: any) {
        res.status(500).json({
            error: "Erro ao resetar instância",
            details: error?.message,
        });
    }
});

// Rota 404
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: "Rota não encontrada",
        path: req.path,
    });
});

// Tratamento de erros global
app.use((err: any, req: Request, res: Response) => {
    console.error("Erro não tratado:", err);
    res.status(500).json({
        error: "Erro interno do servidor",
        message: err?.message,
    });
});

export default app;
