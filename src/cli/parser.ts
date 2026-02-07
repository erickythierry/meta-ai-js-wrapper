import { ActionType, ActionRequest } from "../types/agent.types";

/**
 * Parseia respostas XML do OrchestratorAgent em ActionRequest estruturado.
 *
 * Formatos suportados:
 *   <createFile>[filename=nome.ext][content=conteudo]</createFile>
 *   <runCommand>[cmd=comando]</runCommand>
 *   <readFile>[path=caminho/do/arquivo]</readFile>
 *   <unknown>descricao</unknown>
 */
export class ActionParser {
    /**
     * Extrai parâmetros no formato [key=value] de uma string.
     */
    private static extractParams(raw: string): Record<string, string> {
        const params: Record<string, string> = {};
        const paramRegex = /\[(\w+)=([^\]]*)\]/g;
        let match: RegExpExecArray | null;

        while ((match = paramRegex.exec(raw)) !== null) {
            params[match[1]] = match[2];
        }

        return params;
    }

    /**
     * Parseia a resposta do orchestrator e retorna uma ActionRequest.
     */
    static parse(response: string): ActionRequest {
        const trimmed = response.trim();

        // Tenta parsear <createFile>...</createFile>
        const createFileMatch = trimmed.match(
            /<createFile>([\s\S]*?)<\/createFile>/i
        );
        if (createFileMatch) {
            return {
                type: ActionType.CREATE_FILE,
                params: this.extractParams(createFileMatch[1]),
                raw: createFileMatch[1],
            };
        }

        // Tenta parsear <runCommand>...</runCommand>
        const runCommandMatch = trimmed.match(
            /<runCommand>([\s\S]*?)<\/runCommand>/i
        );
        if (runCommandMatch) {
            return {
                type: ActionType.RUN_COMMAND,
                params: this.extractParams(runCommandMatch[1]),
                raw: runCommandMatch[1],
            };
        }

        // Tenta parsear <readFile>...</readFile>
        const readFileMatch = trimmed.match(
            /<readFile>([\s\S]*?)<\/readFile>/i
        );
        if (readFileMatch) {
            return {
                type: ActionType.READ_FILE,
                params: this.extractParams(readFileMatch[1]),
                raw: readFileMatch[1],
            };
        }

        // Tenta parsear <unknown>...</unknown>
        const unknownMatch = trimmed.match(
            /<unknown>([\s\S]*?)<\/unknown>/i
        );
        if (unknownMatch) {
            return {
                type: ActionType.UNKNOWN,
                params: {},
                raw: unknownMatch[1],
            };
        }

        // Fallback: não reconheceu nenhum padrão
        return {
            type: ActionType.UNKNOWN,
            params: {},
            raw: trimmed,
        };
    }
}
