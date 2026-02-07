import * as fs from "fs";
import * as path from "path";
import { BaseExecutor } from "./base";
import { ActionType, ActionRequest, AgentResult } from "../types/agent.types";

/**
 * Extensões de arquivo que requerem indentação para funcionar corretamente.
 */
const INDENT_SENSITIVE_EXTENSIONS = new Set([
    "yml", "yaml", "py", "pyw", "jade", "pug", "sass", "styl",
    "haml", "slim", "coffee", "mk", "makefile",
]);

/**
 * Executor responsável por criar arquivos no sistema de arquivos.
 * Não requer confirmação do usuário.
 */
export class FileExecutor extends BaseExecutor {
    readonly actionTypes: ActionType[] = [ActionType.CREATE_FILE];
    readonly requiresConfirmation = false;

    constructor() {
        super("FileExecutor", "Cria arquivos com o conteúdo especificado");
    }

    /**
     * Reconstrói o filename a partir dos parâmetros.
     * Suporta tanto o formato novo [name=hello][ext=py] quanto o legado [filename=hello.py].
     */
    private resolveFilename(params: Record<string, string>): string | null {
        if (params.name) {
            const ext = params.ext ? `.${params.ext}` : "";
            return `${params.name}${ext}`;
        }
        return params.filename || null;
    }

    /**
     * Converte escape sequences literais (\n, \t, \\) em caracteres reais.
     * A AI costuma gerar \n como texto no parâmetro content.
     */
    private unescapeContent(raw: string): string {
        return raw
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\\\/g, "\\");
    }

    /**
     * Verifica se o conteúdo de um arquivo indent-sensitive está sem indentação.
     * Retorna true se o arquivo PRECISA de indentação mas NÃO tem.
     */
    private needsIndentation(content: string, ext: string): boolean {
        if (!INDENT_SENSITIVE_EXTENSIONS.has(ext.toLowerCase())) {
            return false;
        }

        const lines = content.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length <= 1) return false;

        // Se nenhuma linha (exceto a primeira) começa com espaço/tab, está sem indentação
        const hasIndentation = lines.slice(1).some((line) => /^[\s\t]+\S/.test(line));
        return !hasIndentation;
    }

    async execute(action: ActionRequest): Promise<AgentResult> {
        const filename = this.resolveFilename(action.params);
        let content = action.params.content
            ? this.unescapeContent(action.params.content)
            : "";

        if (!filename) {
            return {
                success: false,
                message: "Parâmetros 'name'/'ext' ou 'filename' não encontrados na ação.",
            };
        }

        const ext = action.params.ext || filename.split(".").pop() || "";
        const missingIndent = content && this.needsIndentation(content, ext);

        try {
            const filePath = path.resolve(process.cwd(), filename);
            const dir = path.dirname(filePath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, content, "utf-8");

            return {
                success: true,
                message: `Arquivo criado: ${filePath}`,
                data: {
                    filePath,
                    needsRegeneration: missingIndent,
                    ext,
                },
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Erro ao criar arquivo: ${error.message}`,
            };
        }
    }
}
