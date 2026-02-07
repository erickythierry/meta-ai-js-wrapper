import { MetaAI } from "../metaAI";
import { ActionRequest, AgentResult } from "../types/agent.types";

/**
 * Classe base abstrata para todos os agentes.
 * Define a interface mínima que qualquer agente deve implementar.
 */
export abstract class BaseAgent {
    public readonly name: string;
    public readonly description: string;

    constructor(name: string, description: string) {
        this.name = name;
        this.description = description;
    }

    abstract execute(action: ActionRequest): Promise<AgentResult>;
}

/**
 * Classe para agentes que utilizam MetaAI para processar/gerar conteúdo.
 * Cada AIAgent possui sua própria instância do MetaAI e um system prompt.
 * Mantém contexto de conversa entre chamadas.
 */
export abstract class AIAgent extends BaseAgent {
    protected ai: MetaAI;
    protected systemPrompt: string;
    private initialized: boolean = false;

    constructor(name: string, description: string, systemPrompt: string) {
        super(name, description);
        this.ai = new MetaAI();
        this.systemPrompt = systemPrompt;
    }

    /**
     * Envia uma mensagem ao MetaAI.
     * Na primeira chamada, envia o system prompt junto e inicia a conversa.
     * Nas chamadas seguintes, mantém o contexto da conversa.
     */
    async ask(userMessage: string): Promise<string> {
        const isFirstMessage = !this.initialized;

        let prompt: string;
        if (isFirstMessage) {
            prompt = `${this.systemPrompt}\n\nUser:\n${userMessage}`;
        } else {
            prompt = userMessage;
        }

        const response = await this.ai.prompt(prompt, {
            newConversation: isFirstMessage,
        });

        this.initialized = true;
        return response.message;
    }

    /**
     * Envia uma mensagem de contexto ao MetaAI sem esperar classificação.
     * Útil para dar feedback sobre resultados de execuções anteriores.
     */
    async sendContext(contextMessage: string): Promise<void> {
        if (!this.initialized) return;
        await this.ai.prompt(contextMessage, { newConversation: false });
    }

    /**
     * Reseta a conversa, forçando o system prompt a ser reenviado na próxima chamada.
     */
    resetConversation(): void {
        this.initialized = false;
    }
}
