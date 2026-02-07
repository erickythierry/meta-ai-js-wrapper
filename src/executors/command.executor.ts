import { spawn } from "child_process";
import { BaseExecutor } from "./base";
import { ActionType, ActionRequest, AgentResult } from "../types/agent.types";

/** Timeout padrão: 5 minutos (suficiente para apt update, builds, etc.) */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

interface CommandOutput {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Executor responsável por rodar comandos no terminal.
 * Requer confirmação do usuário antes de executar.
 * Usa spawn com stdin herdado para suportar comandos interativos (ex: sudo).
 * Exibe output em tempo real no console enquanto captura para interpretação.
 */
export class CommandExecutor extends BaseExecutor {
    readonly actionTypes: ActionType[] = [ActionType.RUN_COMMAND];
    readonly requiresConfirmation = true;

    constructor() {
        super("CommandExecutor", "Executa comandos no terminal do sistema");
    }

    async execute(action: ActionRequest): Promise<AgentResult> {
        const { cmd } = action.params;

        if (!cmd) {
            return {
                success: false,
                message: "Parâmetro 'cmd' não encontrado na ação.",
            };
        }

        try {
            const { stdout, stderr, exitCode } = await this.runCommand(cmd);
            const output = stdout.trim() || stderr.trim();

            // Se tem saída, considera como resultado útil mesmo com exit code != 0
            // Muitos comandos retornam código != 0 mas produzem saída válida
            // (ex: grep sem match = 1, netstat sem root = 1, diff = 1)
            if (output) {
                return {
                    success: true,
                    message: exitCode === 0
                        ? "Comando executado com sucesso."
                        : `Comando retornou código ${exitCode}, mas produziu saída.`,
                    data: { cmd, output, exitCode },
                };
            }

            // Sem saída e com erro — falha real
            if (exitCode !== 0) {
                return {
                    success: false,
                    message: `Comando falhou (código ${exitCode}) sem produzir saída.`,
                    data: { cmd, exitCode },
                };
            }

            // Sem saída e sem erro — comando rodou mas não teve output
            return {
                success: true,
                message: "Comando executado com sucesso.",
                data: { cmd, output: "" },
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Erro ao executar comando: ${error.message}`,
                data: { cmd, stderr: error.stderr },
            };
        }
    }

    /**
     * Limpa caracteres de controle para exibição no terminal.
     * - \r sem \n (overwrite de linha, ex: barras de progresso) → quebra de linha
     * - Sequências ANSI escape → removidas
     */
    private cleanForDisplay(chunk: string): string {
        return chunk
            .replace(/\r(?!\n)/g, "\n")
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
    }

    /**
     * Limpa o output capturado para remover linhas duplicadas causadas por \r.
     * Para cada linha com \r, mantém apenas o último segmento (a versão final).
     */
    private cleanCaptured(raw: string): string {
        return raw
            .split("\n")
            .map((line) => {
                const parts = line.split("\r");
                return parts[parts.length - 1];
            })
            .filter((line) => line.trim() !== "")
            .join("\n");
    }

    private runCommand(cmd: string): Promise<CommandOutput> {
        return new Promise((resolve, reject) => {
            const proc = spawn("bash", ["-c", cmd], {
                // stdin herdado do terminal (permite interação com sudo, etc.)
                // stdout e stderr capturados via pipe para exibir e interpretar
                stdio: ["inherit", "pipe", "pipe"],
                // Herda o ambiente completo do usuário (HOME, PATH, etc.)
                env: process.env,
            });

            let stdout = "";
            let stderr = "";

            // Exibe stdout em tempo real (limpo) E captura para interpretação
            proc.stdout.on("data", (data: Buffer) => {
                const chunk = data.toString();
                stdout += chunk;
                process.stdout.write(this.cleanForDisplay(chunk));
            });

            // Exibe stderr em tempo real (limpo) E captura para interpretação
            proc.stderr.on("data", (data: Buffer) => {
                const chunk = data.toString();
                stderr += chunk;
                process.stderr.write(this.cleanForDisplay(chunk));
            });

            const timer = setTimeout(() => {
                proc.kill("SIGTERM");
                reject({ message: `Comando excedeu o tempo limite (${DEFAULT_TIMEOUT_MS / 1000}s)`, stderr });
            }, DEFAULT_TIMEOUT_MS);

            proc.on("close", (code: number | null) => {
                clearTimeout(timer);
                // Limpa o output capturado para interpretação
                resolve({
                    stdout: this.cleanCaptured(stdout),
                    stderr: this.cleanCaptured(stderr),
                    exitCode: code ?? 1,
                });
            });

            proc.on("error", (err: Error) => {
                clearTimeout(timer);
                reject({ message: err.message, stderr });
            });
        });
    }
}
