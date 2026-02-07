import { AIAgent } from "./base";
import { ActionParser } from "../cli/parser";
import { ActionRequest, ActionType, AgentResult } from "../types/agent.types";

const ORCHESTRATOR_SYSTEM_PROMPT = `System:
Você é um agente classificador inteligente. Sua função é analisar a mensagem do usuario, entender a INTENÇÃO por trás dela, e mapear para a ação correta.

Ações disponíveis:
- Criar um arquivo: <createFile>[name=nome-do-arquivo][ext=extensao][content=conteudo-do-arquivo]</createFile>
- Executar um comando no terminal: <runCommand>[cmd=comando-para-executar]</runCommand>
- Ler/analisar um arquivo: <readFile>[path=caminho/do/arquivo]</readFile>

Regras de classificação:
1. Se o usuario pedir para CRIAR, ESCREVER ou SALVAR um arquivo, use <createFile>. Separe SEMPRE o nome e a extensão em parâmetros distintos.
   - Exemplos: "crie um script python hello" → <createFile>[name=hello][ext=py][content=print("Hello")]</createFile>
   - "crie um arquivo de texto notas" → <createFile>[name=notas][ext=txt][content=minhas notas]</createFile>
   - "crie um html simples" → <createFile>[name=index][ext=html][content=<html>...</html>]</createFile>
2. Se o usuario quiser ENTENDER, ANALISAR ou OBTER INFORMAÇÕES SOBRE O PROJETO ou sobre arquivos específicos, use <readFile>.
   Prefira <readFile> sobre <runCommand> quando a informação pode ser obtida lendo um arquivo.
   - Exemplos: "qual linguagem do projeto?" → <readFile>[path=package.json]</readFile>
   - "me mostra o package.json" → <readFile>[path=package.json]</readFile>
   - "explica o arquivo src/index.ts" → <readFile>[path=src/index.ts]</readFile>
   - "o que tem no .env?" → <readFile>[path=.env]</readFile>
   - "qual a config do typescript?" → <readFile>[path=tsconfig.json]</readFile>
   - "me mostra o readme" → <readFile>[path=README.md]</readFile>
3. Se o usuario pedir para EXECUTAR um comando, ou se a solicitação envolve informações do SISTEMA (não de arquivos do projeto), use <runCommand>.
   - Exemplos: "quanto de disco eu tenho" → <runCommand>[cmd=df -h]</runCommand>
   - "liste os arquivos" → <runCommand>[cmd=ls -la]</runCommand>
   - "qual meu IP" → <runCommand>[cmd=hostname -I]</runCommand>
   - "qual versão do node" → <runCommand>[cmd=node --version]</runCommand>
   - "me mostre os processos rodando" → <runCommand>[cmd=ps aux]</runCommand>
   - "instala as dependencias" → <runCommand>[cmd=npm install]</runCommand>
4. Use <unknown> APENAS quando a solicitação realmente não pode ser atendida por nenhuma das ações acima (ex: perguntas filosóficas, conversas casuais).

Regra de prioridade: se a pergunta do usuario pode ser respondida LENDO um arquivo do projeto, use <readFile>. NÃO use <runCommand> com cat/grep para ler arquivos — use <readFile>.

caso não se encaixe em nenhuma ação:
<unknown>solicitação resumida do user</unknown>

Importante:
- Você é um agente intermediário, sua resposta não chegará ao usuario.
- Retorne APENAS a tag correspondente, sem texto adicional.
- Para conteúdo de arquivos, preserve a formatação original.
- Seja proativo: se o usuario quer uma informação do sistema, deduza o comando correto.`;

/**
 * Agente orquestrador que classifica a intenção do usuário
 * e retorna uma ActionRequest estruturada para ser executada.
 */
export class OrchestratorAgent extends AIAgent {
    constructor() {
        super(
            "Orchestrator",
            "Classifica a intenção do usuário e roteia para o executor correto",
            ORCHESTRATOR_SYSTEM_PROMPT
        );
    }

    /**
     * Classifica a mensagem do usuário e retorna uma ação estruturada.
     */
    async classify(userMessage: string): Promise<ActionRequest> {
        const aiResponse = await this.ask(userMessage);
        return ActionParser.parse(aiResponse);
    }

    /**
     * Interpreta o resultado de uma execução e retorna uma explicação em linguagem natural.
     * Envia o output ao MetaAI pedindo que explique no contexto da solicitação original.
     */
    async interpret(userMessage: string, result: AgentResult, action: ActionRequest): Promise<string> {
        const status = result.success ? "SUCESSO" : "ERRO";
        const output = result.data?.output || result.data?.stderr || "(sem saída)";

        const filename = action.params.name ? `${action.params.name}.${action.params.ext || ""}` : action.params.filename;
        const actionDetail = action.params.cmd || action.params.path || filename || "";
        const interpretPrompt = `[Modo interpretação] O usuario pediu: "${userMessage}"
Foi executado: ${action.type} ${actionDetail}
Status: ${status}
Saída/conteúdo:
${output}

Agora responda ao usuario em linguagem natural e concisa, explicando o resultado com base no que ele perguntou. Seja direto e útil. NÃO use tags XML nesta resposta.`;

        const response = await this.ai.prompt(interpretPrompt, {
            newConversation: false,
        });
        return response.message;
    }

    /**
     * O orchestrator não executa ações diretamente.
     * Use classify() para obter a ActionRequest.
     */
    async execute(action: ActionRequest): Promise<AgentResult> {
        return {
            success: false,
            message: "O OrchestratorAgent não executa ações diretamente. Use classify().",
        };
    }
}
