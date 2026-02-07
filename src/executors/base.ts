import { BaseAgent } from "../agents/base";
import { ActionType } from "../types/agent.types";

/**
 * Classe base para executores de ações.
 * Executores não usam MetaAI — apenas recebem dados parseados e executam a ação.
 */
export abstract class BaseExecutor extends BaseAgent {
    /**
     * Tipos de ação que este executor suporta.
     */
    abstract readonly actionTypes: ActionType[];

    /**
     * Se true, o CLI deve pedir confirmação ao usuário antes de executar.
     */
    readonly requiresConfirmation: boolean = false;

    constructor(name: string, description: string) {
        super(name, description);
    }
}
