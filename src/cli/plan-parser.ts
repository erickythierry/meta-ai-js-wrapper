import { ActionParser } from "./parser";
import { Plan, PlanStep, ActionType } from "../types/agent.types";

/**
 * Parseia a resposta do PlannerAgent em um Plan estruturado.
 *
 * Formato esperado:
 *   PLAN: Descrição do plano
 *   1. <runCommand>[cmd=...]</runCommand>
 *   2. <createFile>[name=...][ext=...]
 *   conteudo multiline
 *   </createFile>
 *   3. <readFile>[path=...]</readFile>
 */
export class PlanParser {
    /**
     * Parseia a resposta bruta do PlannerAgent e retorna um Plan.
     * Usa regex para encontrar tags completas (suporta multiline).
     */
    static parse(response: string): Plan {
        const text = response.trim();

        // Extrai a descrição (primeira linha que começa com "PLAN:")
        let description = "Plano de execução";
        const planLineMatch = text.match(/^PLAN:\s*(.+)$/mi);
        if (planLineMatch) {
            description = planLineMatch[1].trim();
        }

        // Encontra todas as tags de ação completas (podem ser multiline)
        const tagPattern = /<(createFile|runCommand|readFile)>([\s\S]*?)<\/\1>/gi;
        const steps: PlanStep[] = [];
        let stepIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = tagPattern.exec(text)) !== null) {
            // Reconstrói a tag completa para o ActionParser
            const fullTag = match[0];
            const action = ActionParser.parse(fullTag);

            if (action.type !== ActionType.UNKNOWN) {
                stepIndex++;
                const desc = this.describeAction(action.type, action.params);

                steps.push({
                    index: stepIndex,
                    description: desc,
                    action,
                    status: "pending",
                });
            }
        }

        return { description, steps };
    }

    /**
     * Gera uma descrição legível para uma ação.
     */
    private static describeAction(
        type: ActionType,
        params: Record<string, string>
    ): string {
        switch (type) {
            case ActionType.RUN_COMMAND:
                return `Executar: ${params.cmd || "comando"}`;
            case ActionType.CREATE_FILE: {
                const name = params.name
                    ? `${params.name}${params.ext ? "." + params.ext : ""}`
                    : params.filename || "arquivo";
                return `Criar arquivo: ${name}`;
            }
            case ActionType.READ_FILE:
                return `Ler arquivo: ${params.path || "arquivo"}`;
            default:
                return "Ação desconhecida";
        }
    }
}
