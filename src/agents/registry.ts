import { BaseExecutor } from "../executors/base";
import { ActionType, AgentConfig } from "../types/agent.types";

/**
 * Registro central de executores.
 * Permite registrar novos executores e resolver qual executor
 * deve lidar com um determinado tipo de ação.
 */
export class AgentRegistry {
    private executors: Map<ActionType, BaseExecutor> = new Map();

    /**
     * Registra um executor para os tipos de ação que ele suporta.
     * Se um tipo já estiver registrado, será sobrescrito.
     */
    register(executor: BaseExecutor): void {
        for (const actionType of executor.actionTypes) {
            this.executors.set(actionType, executor);
        }
    }

    /**
     * Resolve qual executor deve lidar com um tipo de ação.
     * Retorna null se nenhum executor estiver registrado para o tipo.
     */
    resolve(actionType: ActionType): BaseExecutor | null {
        return this.executors.get(actionType) ?? null;
    }

    /**
     * Lista todos os agentes registrados com suas configurações.
     */
    listAgents(): AgentConfig[] {
        const seen = new Set<string>();
        const agents: AgentConfig[] = [];

        for (const executor of this.executors.values()) {
            if (seen.has(executor.name)) continue;
            seen.add(executor.name);

            agents.push({
                name: executor.name,
                description: executor.description,
                actionTypes: executor.actionTypes,
            });
        }

        return agents;
    }
}
