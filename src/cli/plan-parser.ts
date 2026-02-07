import { ActionParser } from "./parser";
import { Plan, PlanStep, ActionType } from "../types/agent.types";

/**
 * Parseia a resposta do PlannerAgent em um Plan estruturado.
 *
 * Formato esperado:
 *   PLAN: Descrição do plano
 *   1. <runCommand>[cmd=...]</runCommand>
 *   2. <createFile>[name=...][ext=...][content=...]</createFile>
 *   3. <readFile>[path=...]</readFile>
 */
export class PlanParser {
    /**
     * Parseia a resposta bruta do PlannerAgent e retorna um Plan.
     */
    static parse(response: string): Plan {
        const lines = response.trim().split("\n");

        // Extrai a descrição (primeira linha que começa com "PLAN:")
        let description = "Plano de execução";
        const planLine = lines.find((l) => /^PLAN:/i.test(l.trim()));
        if (planLine) {
            description = planLine.replace(/^PLAN:\s*/i, "").trim();
        }

        // Extrai cada passo numerado (linhas que começam com N. ou N-)
        const steps: PlanStep[] = [];
        let stepIndex = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            // Pula a linha PLAN:
            if (/^PLAN:/i.test(trimmed)) continue;

            // Procura linhas com tags de ação (com ou sem numeração)
            const hasTag =
                /<createFile>/i.test(trimmed) ||
                /<runCommand>/i.test(trimmed) ||
                /<readFile>/i.test(trimmed);

            if (!hasTag) continue;

            // Remove numeração se existir (ex: "1. ", "2- ", "3) ")
            const cleanedLine = trimmed.replace(/^\d+[\.\-\)]\s*/, "");

            // Parseia a tag usando o ActionParser existente
            const action = ActionParser.parse(cleanedLine);

            // Só adiciona se foi parseado corretamente (não é UNKNOWN)
            if (action.type !== ActionType.UNKNOWN) {
                stepIndex++;

                // Gera uma descrição legível do passo
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
