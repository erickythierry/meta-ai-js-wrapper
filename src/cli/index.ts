import * as readline from "readline";
import { OrchestratorAgent } from "../agents/orchestrator";
import { AgentRegistry } from "../agents/registry";
import { ActionParser } from "./parser";
import { FileExecutor } from "../executors/file.executor";
import { FileReadExecutor } from "../executors/file-read.executor";
import { CommandExecutor } from "../executors/command.executor";
import { ActionType, ActionRequest, AgentResult } from "../types/agent.types";
import { BaseExecutor } from "../executors/base";

// ─── Estado global do CLI ────────────────────────────────────────────────────
let autoConfirm = false;

// ─── Cores para o terminal ───────────────────────────────────────────────────
const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
};

function log(color: string, prefix: string, message: string) {
    console.log(`${color}${colors.bold}[${prefix}]${colors.reset} ${message}`);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

function createRegistry(): AgentRegistry {
    const registry = new AgentRegistry();

    // Registra os executores disponíveis
    registry.register(new FileExecutor());
    registry.register(new FileReadExecutor());
    registry.register(new CommandExecutor());

    return registry;
}

function printBanner() {
    console.log(`
${colors.cyan}${colors.bold}╔══════════════════════════════════════════╗
║          Meta AI Agent CLI               ║
╚══════════════════════════════════════════╝${colors.reset}

${colors.dim}Digite uma mensagem para o agente processar.
Comandos especiais: /help, /agents, /autorun, /new, /exit${colors.reset}
`);
}

function printHelp() {
    console.log(`
${colors.cyan}${colors.bold}Comandos disponíveis:${colors.reset}
  ${colors.yellow}/help${colors.reset}     - Mostra esta ajuda
  ${colors.yellow}/agents${colors.reset}   - Lista os agentes/executores registrados
  ${colors.yellow}/autorun${colors.reset}  - Liga/desliga execução automática (sem confirmação)
  ${colors.yellow}/new${colors.reset}      - Inicia uma nova conversa (reseta contexto)
  ${colors.yellow}/exit${colors.reset}     - Encerra o CLI

${colors.cyan}${colors.bold}Exemplos de uso:${colors.reset}
  ${colors.dim}> Crie um arquivo hello.txt com o conteúdo "Olá, mundo!"${colors.reset}
  ${colors.dim}> Execute o comando ls -la${colors.reset}
  ${colors.dim}> Me explica o arquivo package.json${colors.reset}
  ${colors.dim}> O que tem no arquivo src/index.ts?${colors.reset}
`);
}

function printAgents(registry: AgentRegistry) {
    const agents = registry.listAgents();
    console.log(`\n${colors.cyan}${colors.bold}Agentes registrados:${colors.reset}\n`);

    for (const agent of agents) {
        const types = agent.actionTypes.join(", ");
        console.log(`  ${colors.green}${agent.name}${colors.reset} - ${agent.description}`);
        console.log(`    ${colors.dim}Ações: ${types}${colors.reset}`);
    }
    console.log();
}

// ─── Confirmação interativa ──────────────────────────────────────────────────

function askConfirmation(rl: readline.Interface, message: string): Promise<boolean> {
    return new Promise((resolve) => {
        rl.question(
            `${colors.yellow}${colors.bold}[Confirmação]${colors.reset} ${message} ${colors.dim}(s/n)${colors.reset} `,
            (answer) => {
                const normalized = answer.trim().toLowerCase();
                resolve(normalized === "s" || normalized === "sim" || normalized === "y" || normalized === "yes");
            }
        );
    });
}

// ─── Limite de auto-retries ──────────────────────────────────────────────────
const MAX_AUTO_RETRIES = 3;

// ─── Execução de uma ação ────────────────────────────────────────────────────

async function executeAction(
    action: ActionRequest,
    orchestrator: OrchestratorAgent,
    registry: AgentRegistry,
    rl: readline.Interface
): Promise<{ result: AgentResult; action: ActionRequest } | null> {
    // Encontra o executor adequado
    const executor = registry.resolve(action.type);
    if (!executor) {
        log(colors.red, "Erro", `Nenhum executor registrado para a ação: ${action.type}`);
        return null;
    }

    log(colors.magenta, executor.name, `Ação detectada: ${action.type}`);

    // Mostra detalhes da ação
    // Para CREATE_FILE com name+ext, mostra o filename reconstruído
    if (action.type === ActionType.CREATE_FILE && action.params.name) {
        const fullName = `${action.params.name}${action.params.ext ? "." + action.params.ext : ""}`;
        console.log(`  ${colors.dim}filename: ${fullName}${colors.reset}`);
        if (action.params.content) {
            const displayContent = action.params.content.length > 80 ? action.params.content.substring(0, 80) + "..." : action.params.content;
            console.log(`  ${colors.dim}content: ${displayContent}${colors.reset}`);
        }
    } else {
        for (const [key, value] of Object.entries(action.params)) {
            const displayValue = value.length > 80 ? value.substring(0, 80) + "..." : value;
            console.log(`  ${colors.dim}${key}: ${displayValue}${colors.reset}`);
        }
    }

    // Pede confirmação se necessário (a menos que autoConfirm esteja ativo)
    if (executor.requiresConfirmation && !autoConfirm) {
        const confirmed = await askConfirmation(
            rl,
            `Deseja executar esta ação? (${action.type}: ${action.params.cmd ?? action.raw})`
        );
        if (!confirmed) {
            log(colors.yellow, "Cancelado", "Ação cancelada pelo usuário.");
            return null;
        }
    }

    // Pausa readline durante execução para liberar stdin ao processo filho
    rl.pause();

    // Executa a ação
    log(colors.cyan, executor.name, "Executando...");
    const result = await executor.execute(action);

    // Retoma readline após execução
    rl.resume();

    // Exibe resultado
    if (result.success) {
        if (action.type === ActionType.RUN_COMMAND) {
            const hasOutput = typeof result.data?.output === "string" && result.data.output.trim();
            if (hasOutput) {
                log(colors.green, "Concluído", result.message);
            } else {
                log(colors.dim, "Info", "Comando não produziu saída.");
            }
        } else if (action.type === ActionType.READ_FILE) {
            log(colors.green, "Lido", result.message);
            if (result.data?.output) {
                console.log(`${colors.dim}${"─".repeat(50)}${colors.reset}`);
                console.log(result.data.output);
                console.log(`${colors.dim}${"─".repeat(50)}${colors.reset}`);
            }
        } else {
            log(colors.green, "Sucesso", result.message);
        }
    } else {
        log(colors.red, "Erro", result.message);
        if (action.type !== ActionType.RUN_COMMAND && result.data?.stderr) {
            console.log(`${colors.red}${colors.dim}${result.data.stderr}${colors.reset}`);
        }
    }

    return { result, action };
}

// ─── Loop principal ──────────────────────────────────────────────────────────

async function handleInput(
    input: string,
    orchestrator: OrchestratorAgent,
    registry: AgentRegistry,
    rl: readline.Interface
): Promise<void> {
    // Classifica a intenção do usuário via MetaAI
    log(colors.cyan, "Orchestrator", "Classificando sua solicitação...");

    let action: ActionRequest;
    try {
        action = await orchestrator.classify(input);
    } catch (error: any) {
        log(colors.red, "Erro", `Falha ao classificar: ${error.message}`);
        return;
    }

    // Ação desconhecida
    if (action.type === ActionType.UNKNOWN) {
        log(colors.yellow, "Info", `Solicitação não reconhecida: ${action.raw}`);
        log(colors.dim, "Dica", "Tente pedir para criar um arquivo ou executar um comando.");
        return;
    }

    // Executa a ação
    const execResult = await executeAction(action, orchestrator, registry, rl);
    if (!execResult) return;

    // Loop de interpretação + auto-retry
    let currentResult = execResult.result;
    let currentAction = execResult.action;
    let retries = 0;

    while (retries <= MAX_AUTO_RETRIES) {
        // Interpreta o resultado
        let interpretation: string;
        try {
            log(colors.cyan, "Interpretando", "Analisando resultado...");
            interpretation = await orchestrator.interpret(input, currentResult, currentAction);
        } catch {
            break;
        }

        if (!interpretation) break;

        // Verifica se a AI sugeriu uma nova ação na interpretação
        const followUp = ActionParser.parse(interpretation);

        if (followUp.type !== ActionType.UNKNOWN) {
            // A AI sugeriu uma nova ação — executa automaticamente
            retries++;
            log(colors.cyan, "Auto-retry", `A AI sugeriu uma nova ação (tentativa ${retries}/${MAX_AUTO_RETRIES})...`);

            const retryResult = await executeAction(followUp, orchestrator, registry, rl);
            if (!retryResult) break;

            currentResult = retryResult.result;
            currentAction = retryResult.action;
            continue;
        }

        // Interpretação normal — exibe e encerra o loop
        console.log(`\n${colors.cyan}${colors.bold}[AI]${colors.reset} ${interpretation}\n`);
        break;
    }

    if (retries > MAX_AUTO_RETRIES) {
        log(colors.yellow, "Auto-retry", `Limite de ${MAX_AUTO_RETRIES} tentativas atingido.`);
    }
}

async function main() {
    printBanner();

    const orchestrator = new OrchestratorAgent();
    const registry = createRegistry();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const prompt = () => {
        rl.question(`${colors.green}${colors.bold}> ${colors.reset}`, async (input) => {
            const trimmed = input.trim();

            if (!trimmed) {
                prompt();
                return;
            }

            // Comandos especiais
            switch (trimmed.toLowerCase()) {
                case "/exit":
                    log(colors.cyan, "CLI", "Até mais!");
                    rl.close();
                    process.exit(0);
                    return;

                case "/help":
                    printHelp();
                    prompt();
                    return;

                case "/agents":
                    printAgents(registry);
                    prompt();
                    return;

                case "/autorun":
                    autoConfirm = !autoConfirm;
                    log(
                        autoConfirm ? colors.green : colors.yellow,
                        "AutoRun",
                        autoConfirm
                            ? "ATIVADO - Comandos serão executados sem confirmação."
                            : "DESATIVADO - Comandos pedirão confirmação antes de executar."
                    );
                    prompt();
                    return;

                case "/new":
                    orchestrator.resetConversation();
                    log(colors.cyan, "CLI", "Conversa resetada. Próxima mensagem inicia um novo contexto.");
                    prompt();
                    return;
            }

            try {
                await handleInput(trimmed, orchestrator, registry, rl);
            } catch (error: any) {
                log(colors.red, "Erro", `Erro inesperado: ${error.message}`);
            }

            prompt();
        });
    };

    prompt();
}

main().catch((err) => {
    console.error("Erro fatal:", err);
    process.exit(1);
});
