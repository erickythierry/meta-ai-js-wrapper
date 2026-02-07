import * as fs from "fs";
import * as path from "path";
import { BaseExecutor } from "./base";
import { ActionType, ActionRequest, AgentResult } from "../types/agent.types";

/** Limite de caracteres para leitura (evita enviar arquivos gigantes para a AI) */
const MAX_CHARS = 10000;

/**
 * Executor responsável por ler arquivos e retornar o conteúdo.
 * O conteúdo é passado para a AI interpretar/explicar.
 * Não requer confirmação do usuário.
 */
export class FileReadExecutor extends BaseExecutor {
    readonly actionTypes: ActionType[] = [ActionType.READ_FILE];
    readonly requiresConfirmation = false;

    constructor() {
        super("FileReadExecutor", "Lê e analisa o conteúdo de arquivos");
    }

    async execute(action: ActionRequest): Promise<AgentResult> {
        const filePath = action.params.path;

        if (!filePath) {
            return {
                success: false,
                message: "Parâmetro 'path' não encontrado na ação.",
            };
        }

        try {
            const resolvedPath = path.resolve(process.cwd(), filePath);

            if (!fs.existsSync(resolvedPath)) {
                return {
                    success: false,
                    message: `Arquivo não encontrado: ${resolvedPath}`,
                };
            }

            const stats = fs.statSync(resolvedPath);

            if (stats.isDirectory()) {
                // Se for diretório, lista o conteúdo
                const entries = fs.readdirSync(resolvedPath);
                const listing = entries.join("\n");
                return {
                    success: true,
                    message: `Diretório listado: ${resolvedPath} (${entries.length} itens)`,
                    data: {
                        path: resolvedPath,
                        output: listing,
                        isDirectory: true,
                    },
                };
            }

            const content = fs.readFileSync(resolvedPath, "utf-8");
            const truncated = content.length > MAX_CHARS;
            const displayContent = truncated
                ? content.substring(0, MAX_CHARS) + `\n... (truncado, ${content.length} caracteres total)`
                : content;

            const ext = path.extname(resolvedPath).toLowerCase();
            const sizeKb = (stats.size / 1024).toFixed(1);

            return {
                success: true,
                message: `Arquivo lido: ${resolvedPath} (${sizeKb}KB, ${content.split("\n").length} linhas)`,
                data: {
                    path: resolvedPath,
                    output: displayContent,
                    extension: ext,
                    sizeBytes: stats.size,
                    lines: content.split("\n").length,
                    truncated,
                },
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Erro ao ler arquivo: ${error.message}`,
            };
        }
    }
}
