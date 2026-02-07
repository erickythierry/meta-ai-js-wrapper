import * as readline from "readline";
import { OrchestratorAgent } from "../agents/orchestrator";
import { PlannerAgent } from "../agents/planner";
import { AgentRegistry } from "../agents/registry";
import { ActionParser } from "./parser";
import { FileExecutor } from "../executors/file.executor";
import { FileReadExecutor } from "../executors/file-read.executor";
import { CommandExecutor } from "../executors/command.executor";
import { ActionType, ActionRequest, AgentResult, Plan, PlanStep } from "../types/agent.types";
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
    rl: readline.Interface,
    planner?: PlannerAgent
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

        // Fallback: se o arquivo criado precisa de indentação mas não tem,
        // tenta regenerar o conteúdo com uma chamada dedicada ao AI
        if (
            action.type === ActionType.CREATE_FILE &&
            result.data?.needsRegeneration &&
            planner
        ) {
            log(colors.yellow, "FileExecutor", "Conteúdo sem indentação detectado. Regenerando...");
            try {
                const ext = result.data.ext || action.params.ext || "";
                const filename = action.params.name || action.params.filename || "arquivo";
                const originalContent = action.params.content || "";

                const fixedContent = await planner.generateFileContent(filename, ext, originalContent);

                if (fixedContent && fixedContent !== originalContent) {
                    const fs = await import("fs");
                    fs.writeFileSync(result.data.filePath, fixedContent, "utf-8");
                    log(colors.green, "FileExecutor", "Conteúdo corrigido com indentação.");
                }
            } catch {
                log(colors.yellow, "FileExecutor", "Não foi possível corrigir a indentação automaticamente.");
            }
        }
    } else {
        log(colors.red, "Erro", result.message);
        if (action.type !== ActionType.RUN_COMMAND && result.data?.stderr) {
            console.log(`${colors.red}${colors.dim}${result.data.stderr}${colors.reset}`);
        }
    }

    return { result, action };
}

// ─── Limite de retries por passo do plano ────────────────────────────────────
const MAX_PLAN_STEP_RETRIES = 2;

// ─── Execução de um plano multi-step ────────────────────────────────────────

async function handlePlan(
    userMessage: string,
    planDescription: string,
    planner: PlannerAgent,
    registry: AgentRegistry,
    rl: readline.Interface
): Promise<void> {
    // 1. Gera o plano
    log(colors.cyan, "Planner", "Gerando plano de execução...");

    let plan: Plan;
    try {
        plan = await planner.createPlan(userMessage);
    } catch (error: any) {
        log(colors.red, "Erro", `Falha ao gerar plano: ${error.message}`);
        return;
    }

    if (plan.steps.length === 0) {
        log(colors.yellow, "Planner", "O plano gerado não contém passos válidos.");
        return;
    }

    // 2. Exibe o plano
    console.log(`\n${colors.cyan}${colors.bold}╔══ Plano: ${plan.description} ══╗${colors.reset}\n`);
    for (const step of plan.steps) {
        const typeColor = step.action.type === ActionType.RUN_COMMAND ? colors.yellow : colors.green;
        console.log(`  ${colors.bold}${step.index}.${colors.reset} ${step.description}`);
        console.log(`     ${typeColor}${colors.dim}${step.action.type}${colors.reset} ${colors.dim}→ ${step.action.raw.substring(0, 80)}${step.action.raw.length > 80 ? "..." : ""}${colors.reset}`);
    }
    console.log();

    // 3. Pede confirmação
    const confirmed = await askConfirmation(
        rl,
        `Executar plano com ${plan.steps.length} passos?`
    );
    if (!confirmed) {
        log(colors.yellow, "Cancelado", "Plano cancelado pelo usuário.");
        return;
    }

    // 4. Executa cada passo
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const stepResults: { step: PlanStep; result: AgentResult | null }[] = [];

    for (const step of plan.steps) {
        console.log(`\n${colors.cyan}${colors.bold}── Passo ${step.index}/${plan.steps.length}: ${step.description} ──${colors.reset}`);
        step.status = "running";

        let currentAction = step.action;
        let attempts = 0;
        let stepSuccess = false;
        let lastResult: AgentResult | null = null;

        while (attempts <= MAX_PLAN_STEP_RETRIES) {
            const execResult = await executeAction(currentAction, null as any, registry, rl, planner);
            lastResult = execResult?.result ?? null;

            if (execResult && execResult.result.success) {
                step.status = "success";
                stepSuccess = true;
                successCount++;
                break;
            }

            // Falhou
            attempts++;
            if (attempts > MAX_PLAN_STEP_RETRIES) break;

            // Tenta retry via AI
            log(colors.yellow, "Retry", `Passo falhou. Pedindo alternativa à AI (tentativa ${attempts}/${MAX_PLAN_STEP_RETRIES})...`);

            try {
                const errorMsg = execResult?.result.message || "Ação não executada";
                const retryAction = await planner.retryStep(step, errorMsg);

                if (retryAction.type === ActionType.UNKNOWN) {
                    log(colors.yellow, "Retry", "A AI não sugeriu uma alternativa válida.");
                    break;
                }

                currentAction = retryAction;
            } catch (retryError: any) {
                log(colors.red, "Retry", `Falha ao obter alternativa: ${retryError.message}`);
                break;
            }
        }

        if (!stepSuccess) {
            step.status = "failed";
            failedCount++;

            // Verifica se existem passos restantes
            const remainingSteps = plan.steps.filter((s) => s.status === "pending");

            if (remainingSteps.length > 0) {
                // Pergunta se quer pular ou abortar (só se há próximos passos)
                const skipOrAbort = await askConfirmation(
                    rl,
                    `Passo ${step.index} falhou. Continuar com os ${remainingSteps.length} passos restantes? (n = abortar plano)`
                );
                if (!skipOrAbort) {
                    for (const remaining of remainingSteps) {
                        remaining.status = "skipped";
                        skippedCount++;
                    }
                    log(colors.yellow, "Plano", "Plano abortado pelo usuário.");
                    break;
                }
            } else {
                log(colors.yellow, "Plano", `Último passo (${step.index}) falhou.`);
            }
        }

        stepResults.push({ step, result: lastResult });
    }

    // 5. Resumo final
    console.log(`\n${colors.cyan}${colors.bold}╔══ Resumo do Plano ══╗${colors.reset}`);
    console.log(`  ${colors.green}✓ Sucesso:${colors.reset}  ${successCount}`);
    console.log(`  ${colors.red}✗ Falhou:${colors.reset}   ${failedCount}`);
    if (skippedCount > 0) {
        console.log(`  ${colors.yellow}⊘ Pulados:${colors.reset}  ${skippedCount}`);
    }
    console.log(`  ${colors.dim}Total:      ${plan.steps.length}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}╚═════════════════════╝${colors.reset}`);

    // 6. Interpretação final da AI
    try {
        log(colors.cyan, "AI", "Analisando resultado do plano...");

        const stepsSummary = stepResults
            .map((sr) => {
                const status = sr.step.status === "success" ? "OK" : sr.step.status === "failed" ? "FALHOU" : "PULADO";
                const output = sr.result?.data?.output
                    ? sr.result.data.output.substring(0, 500)
                    : sr.result?.message || "(sem saída)";
                return `Passo ${sr.step.index} (${sr.step.description}): ${status}\nSaída: ${output}`;
            })
            .join("\n\n");

        const interpretPrompt = `O plano "${plan.description}" foi executado.
O usuario pediu: "${userMessage}"

Resultado dos passos:
${stepsSummary}

Resumo: ${successCount} sucesso, ${failedCount} falhas, ${skippedCount} pulados de ${plan.steps.length} total.

Agora responda ao usuario em linguagem natural e concisa, explicando o que foi feito e o resultado geral. Seja direto e útil. NÃO use tags XML nesta resposta.`;

        const interpretation = await planner.ask(interpretPrompt);
        console.log(`\n${colors.cyan}${colors.bold}[AI]${colors.reset} ${interpretation}\n`);
    } catch {
        // Se falhar a interpretação, não bloqueia — o resumo numérico já foi exibido
    }
}

// ─── Loop principal ──────────────────────────────────────────────────────────

async function handleInput(
    input: string,
    orchestrator: OrchestratorAgent,
    planner: PlannerAgent,
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

    // Se for um plano, delega para handlePlan
    if (action.type === ActionType.PLAN) {
        await handlePlan(input, action.params.description || action.raw, planner, registry, rl);
        return;
    }

    // Executa a ação
    const execResult = await executeAction(action, orchestrator, registry, rl, planner);
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

            const retryResult = await executeAction(followUp, orchestrator, registry, rl, planner);
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
    const planner = new PlannerAgent();
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
                    planner.resetConversation();
                    log(colors.cyan, "CLI", "Conversa resetada. Próxima mensagem inicia um novo contexto.");
                    prompt();
                    return;
            }

            try {
                await handleInput(trimmed, orchestrator, planner, registry, rl);
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
