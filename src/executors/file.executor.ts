import * as fs from "fs";
import * as path from "path";
import { BaseExecutor } from "./base";
import { ActionType, ActionRequest, AgentResult } from "../types/agent.types";

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
        // Formato novo: name + ext (evita que Meta AI interprete como URL)
        if (params.name) {
            const ext = params.ext ? `.${params.ext}` : "";
            return `${params.name}${ext}`;
        }
        // Formato legado: filename direto
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

    async execute(action: ActionRequest): Promise<AgentResult> {
        const filename = this.resolveFilename(action.params);
        const content = action.params.content
            ? this.unescapeContent(action.params.content)
            : "";

        if (!filename) {
            return {
                success: false,
                message: "Parâmetros 'name'/'ext' ou 'filename' não encontrados na ação.",
            };
        }

        try {
            const filePath = path.resolve(process.cwd(), filename);
            const dir = path.dirname(filePath);

            // Cria diretórios intermediários se necessário
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, content, "utf-8");

            return {
                success: true,
                message: `Arquivo criado: ${filePath}`,
                data: { filePath },
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Erro ao criar arquivo: ${error.message}`,
            };
        }
    }
}
