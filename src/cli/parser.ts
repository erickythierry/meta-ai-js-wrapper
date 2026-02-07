import { ActionType, ActionRequest } from "../types/agent.types";

/**
 * Parseia respostas XML do OrchestratorAgent em ActionRequest estruturado.
 *
 * Formatos suportados:
 *   <createFile>[name=nome][ext=ext]
 *   conteudo multiline preservando indentação
 *   </createFile>
 *   <createFile>[name=nome][ext=ext][content=conteudo simples]</createFile>  (legado)
 *   <runCommand>[cmd=comando]</runCommand>
 *   <readFile>[path=caminho/do/arquivo]</readFile>
 *   <plan>descricao do plano</plan>
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
     * Parseia uma tag <createFile> suportando três formatos (em ordem de prioridade):
     * 1. Code block: [name=...][ext=...] seguido por ```lang\n...\n``` (preserva indentação)
     * 2. Body content: [name=...][ext=...] seguido por texto livre
     * 3. Legado inline: [name=...][ext=...][content=...] tudo inline
     */
    private static parseCreateFile(inner: string): Record<string, string> {
        const params = this.extractParams(inner);

        // 1. Tenta extrair conteúdo de um code block (```lang\n...\n```)
        //    Prioridade máxima — code blocks preservam indentação
        const codeBlockMatch = inner.match(/```\w*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            params.content = codeBlockMatch[1].trimEnd();
            return params;
        }

        // 2. Se já encontrou content nos [params], usa o formato legado
        if (params.content) {
            return params;
        }

        // 3. Body content: remove todos os [key=value] e usa o restante como content
        const body = inner.replace(/\[\w+=[^\]]*\]/g, "");
        const content = body.replace(/^\n/, "").trimEnd();

        if (content) {
            params.content = content;
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
                params: this.parseCreateFile(createFileMatch[1]),
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

        // Tenta parsear <plan>...</plan>
        const planMatch = trimmed.match(
            /<plan>([\s\S]*?)<\/plan>/i
        );
        if (planMatch) {
            return {
                type: ActionType.PLAN,
                params: { description: planMatch[1].trim() },
                raw: planMatch[1],
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
