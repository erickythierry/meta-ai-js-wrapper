import { AIAgent } from "./base";
import { PlanParser } from "../cli/plan-parser";
import {
    ActionRequest,
    AgentResult,
    Plan,
    PlanStep,
} from "../types/agent.types";

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || "~";
const CURRENT_USER = process.env.USER || process.env.USERNAME || "usuario";
const CWD = process.cwd();

const PLANNER_SYSTEM_PROMPT = `System:
Você é um agente planejador. Sua função é receber uma solicitação complexa do usuario e quebrá-la em passos sequenciais e executáveis.

Contexto do ambiente:
- Usuário: ${CURRENT_USER}
- Home: ${HOME_DIR}
- Diretório atual do projeto: ${CWD}

Cada passo DEVE usar uma das tags de ação:
- <runCommand>[cmd=comando]</runCommand>
- <createFile>[name=nome][ext=extensao]
\`\`\`linguagem
conteudo com indentação preservada
\`\`\`
</createFile>
- <readFile>[path=caminho]</readFile>

IMPORTANTE: Para <createFile>, o conteúdo DEVE estar dentro de um code block (triple backticks) para preservar a indentação e formatação.

Formato de resposta OBRIGATÓRIO:
PLAN: Descrição resumida do plano
1. <tag>[params]</tag>
2. <tag>[params]</tag>
3. <tag>[params]</tag>
...

Regras:
- Cada passo deve ser uma ÚNICA ação atômica (um comando ou um arquivo).
- Use numeração sequencial: 1., 2., 3., etc.
- Não inclua texto explicativo fora do formato acima.
- Para <createFile>, separe nome e extensão: [name=arquivo][ext=js]. O conteúdo vai como CORPO da tag, NÃO em [content=...].
- PRESERVE a indentação e formatação correta nos arquivos criados.
- Use caminhos ABSOLUTOS quando necessário (use ${HOME_DIR} para o home).
- Evite sudo quando possível.
- Gere conteúdo completo e funcional para os arquivos criados.
- Os comandos devem ser independentes (não depender de cd anterior, use && se necessário).

Exemplo de resposta:
PLAN: Criar projeto Node.js com Express
1. <runCommand>[cmd=mkdir -p ${HOME_DIR}/meu-projeto && cd ${HOME_DIR}/meu-projeto && git init]</runCommand>
2. <runCommand>[cmd=cd ${HOME_DIR}/meu-projeto && npm init -y]</runCommand>
3. <runCommand>[cmd=cd ${HOME_DIR}/meu-projeto && npm install express]</runCommand>
4. <createFile>[name=${HOME_DIR}/meu-projeto/index][ext=js]
\`\`\`javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
\`\`\`
</createFile>`;

/**
 * Agente planejador que gera planos multi-step para tarefas complexas.
 * Utiliza o MetaAI para decompor solicitações em ações sequenciais.
 */
export class PlannerAgent extends AIAgent {
    constructor() {
        super(
            "Planner",
            "Gera planos de execução multi-step para tarefas complexas",
            PLANNER_SYSTEM_PROMPT
        );
    }

    /**
     * Gera um plano de execução a partir da solicitação do usuário.
     */
    async createPlan(userMessage: string): Promise<Plan> {
        const response = await this.ask(userMessage);
        return PlanParser.parse(response);
    }

    /**
     * Solicita à AI uma ação alternativa para um passo que falhou.
     */
    async retryStep(step: PlanStep, error: string): Promise<ActionRequest> {
        const retryPrompt = `O passo ${step.index} do plano falhou.
Ação original: ${step.action.type} — ${step.action.raw}
Erro: ${error}

Sugira UMA ação alternativa usando o mesmo formato de tag (<runCommand>, <createFile> ou <readFile>).
Retorne APENAS a tag com a ação corrigida, sem texto adicional.`;

        const response = await this.ai.prompt(retryPrompt, {
            newConversation: false,
        });

        // Usa o ActionParser para parsear a resposta de retry
        const { ActionParser } = await import("../cli/parser");
        return ActionParser.parse(response.message);
    }

    /**
     * Gera conteúdo formatado para um arquivo usando uma chamada dedicada ao MetaAI.
     * Usado como fallback quando o conteúdo original perdeu a indentação.
     */
    async generateFileContent(
        filename: string,
        ext: string,
        originalContent: string
    ): Promise<string> {
        const contentPrompt = `Preciso do conteúdo corretamente formatado para o arquivo "${filename}.${ext}".

O conteúdo original está sem indentação correta:
${originalContent}

Gere o conteúdo CORRIGIDO com a indentação e formatação correta para um arquivo .${ext}.
Retorne APENAS o conteúdo do arquivo dentro de um code block (triple backticks), sem explicações.`;

        const response = await this.ai.prompt(contentPrompt, {
            newConversation: false,
        });

        // Tenta extrair do code block
        const codeBlockMatch = response.message.match(/```\w*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trimEnd();
        }

        // Fallback: usa a resposta bruta (melhor que nada)
        return response.message.trim();
    }

    /**
     * O PlannerAgent não executa ações diretamente.
     * Use createPlan() para obter o plano.
     */
    async execute(_action: ActionRequest): Promise<AgentResult> {
        return {
            success: false,
            message: "O PlannerAgent não executa ações diretamente. Use createPlan().",
        };
    }
}
