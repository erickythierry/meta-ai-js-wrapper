# MetaAI API Wrapper (Node.js)

> 🔗 **Note:** This project is a conversion/port of the original Python project. [Strvm/meta-ai-api](https://github.com/Strvm/meta-ai-api)

MetaAI Node.js is a library designed to interact with Meta's AI APIs that run in the backend of https://www.meta.ai/. It encapsulates the complexities of authentication and communication with the APIs, providing a straightforward interface for sending queries and receiving responses.

With this you can easily prompt the AI with a message and get a response, directly from your Node.js code. **NO API KEY REQUIRED**

**Meta AI is connected to the internet, so you will be able to get the latest real-time responses from the AI.** (powered by Bing)

## Features

- **Prompt AI**: Send a message to the AI and get a response from Llama 3.
- **Image Generation**: Generate images using the AI. (Only for FB authenticated users)
- **Get Up To Date Information**: Get the latest information from the AI thanks to its connection to the internet.
- **Get Sources**: Get the sources of the information provided by the AI.
- **Follow Conversations**: Keep conversation context with `newConversation: false`.
- **🚀 Cookies Cache System**: Automatic caching of cookies to avoid resolving challenges every time (5x faster!)
- **🔒 Anti-Bot Bypass**: Automatically handles Meta AI's Client Challenge protection.

## Installation

```bash
npm install
```

(Or in your own project, install the dependencies listed in `package.json`)

## Quick Start

### Running the API Server

```bash
# Start the server
npm run server

# In another terminal, test with:
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

### Running Examples

```bash
# In one terminal, start the server
npm run server

# In another terminal, run the examples
npm run examples
```

## Usage

### Option 1: Direct Usage (TypeScript/Node.js)

#### Initialization

```typescript
import { MetaAI } from "./src/metaAI";

const ai = new MetaAI();
const response = await ai.prompt({
    message: "Whats the weather in San Francisco today?",
});
console.log(response);
```

### Output Example

```json
{
    "message": "The weather in San Francisco today is mostly clear...",
    "sources": [
        {
            "link": "https://www.wolframalpha.com/...",
            "title": "WolframAlpha"
        }
    ],
    "media": []
}
```

### Follow conversations

```typescript
const meta = new MetaAI();

let resp = await meta.prompt("what is 2 + 2?");
console.log(resp.message); // 2 + 2 = 4

resp = await meta.prompt("what was my previous question?");
console.log(resp.message); // Your previous question was "what is 2 + 2?"
```

To start a new conversation:

```typescript
resp = await meta.prompt("New topic", { newConversation: true });
```

### Authentication (Optional) (not tested!)

To generate images or avoid some rate limits, you can authenticate with Facebook.

```typescript
const ai = new MetaAI({ fbEmail: "your_email", fbPassword: "your_password" });
const resp = await ai.prompt("Generate an image of a tech CEO");
```

### Using Proxy

```typescript
const proxy = {
    protocol: "http",
    host: "proxy_address",
    port: 8080,
    auth: { username: "user", password: "pwd" }, // if needed
};

const ai = new MetaAI({ proxy });
```

### Option 2: REST API (Express Server)

A more flexible way to use Meta AI! Start the Express server and interact via HTTP:

#### Starting the Server

```bash
npm run server
```

The server will start on `http://localhost:3000`

#### Endpoints

**Health Check**

```bash
GET http://localhost:3000/health
```

Response:

```json
{
    "status": "ok",
    "message": "Meta AI API is running"
}
```

**Send a Prompt**

```bash
POST http://localhost:3000/api/prompt
Content-Type: application/json

{
  "message": "What is the weather in San Francisco today?",
  "newConversation": false
}
```

Response:

```json
{
    "success": true,
    "data": {
        "message": "The weather in San Francisco today is mostly clear...",
        "sources": [
            {
                "link": "https://www.wolframalpha.com/...",
                "title": "WolframAlpha"
            }
        ],
        "media": []
    }
}
```

**Start New Conversation**

```bash
POST http://localhost:3000/api/new-conversation
```

Response:

```json
{
    "success": true,
    "message": "Nova conversa iniciada"
}
```

**Reset Instance**

```bash
POST http://localhost:3000/api/reset
```

Response:

```json
{
    "success": true,
    "message": "Instância resetada com sucesso"
}
```

#### Example with cURL

```bash
# Test health
curl http://localhost:3000/health

# Send prompt
curl -X POST http://localhost:3000/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2 + 2?"}'

# Continue conversation
curl -X POST http://localhost:3000/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"message": "What was my previous question?"}'

# Start new conversation
curl -X POST http://localhost:3000/api/new-conversation
```

#### Example with JavaScript/Fetch

```javascript
async function askAI(message) {
    const response = await fetch("http://localhost:3000/api/prompt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
    });

    const data = await response.json();
    console.log(data.data.message);
    console.log("Sources:", data.data.sources);
}

askAI("What is the capital of France?");
```

## 💾 Cookies Cache System

The wrapper now includes an automatic cookies cache system that dramatically improves performance!

### How It Works

**First Request** (~5 seconds):
- Resolves Meta AI's Client Challenge
- Fetches fresh cookies
- **Saves to cache** (`.meta-ai-cookies.json`)
- Valid for 24 hours

**Subsequent Requests** (<1 second ⚡):
- Uses cached cookies
- No challenge resolution needed
- 5x faster!

### Usage

**Automatic (Default)**:
```typescript
const ai = new MetaAI();

// First call: ~5 seconds (saves cache)
await ai.prompt("Hello!");

// Second call: <1 second (uses cache) ⚡
await ai.prompt("How are you?");
```

**Clear Cache Manually**:
```typescript
import { clearCookiesCache } from "meta-ai-api";

clearCookiesCache(); // Forces fresh cookies next time
```

### Cache Details

- **Duration**: 24 hours
- **File**: `.meta-ai-cookies.json` (already in `.gitignore`)
- **Auto-validation**: Expired/invalid caches are automatically renewed
- **Secure**: Cache file is local only (never commit it!)

📖 **[Read Full Cache Documentation](./CACHE.md)**

## Educational Purpose

This repository is intended for educational purposes only. Users should adhere to Meta's terms of service.

## License

ISC

---

<br>
<br>
<br>

# MetaAI API Wrapper (Node.js) - Português

> 🔗 **Nota:** Este projeto é uma conversão/adaptação do projeto original em Python. [Strvm/meta-ai-api](https://github.com/Strvm/meta-ai-api)

MetaAI Node.js é uma biblioteca projetada para interagir com as APIs de IA da Meta que rodam no backend de https://www.meta.ai/. Ela encapsula as complexidades de autenticação e comunicação com as APIs, fornecendo uma interface direta para enviar consultas e receber respostas.

Com isso você pode facilmente fazer perguntas à IA com uma mensagem e obter uma resposta, diretamente do seu código Node.js. **NENHUMA CHAVE DE API NECESSÁRIA**

**Meta AI está conectado à internet, então você será capaz de obter as respostas mais recentes em tempo real da IA.** (alimentado por Bing)

## Funcionalidades

- **Fazer Perguntas à IA**: Envie uma mensagem para a IA e obtenha uma resposta do Llama 3.
- **Geração de Imagens**: Gere imagens usando a IA. (Apenas para usuários autenticados com Facebook)
- **Obter Informações Atualizadas**: Obtenha as informações mais recentes da IA graças à sua conexão com a internet.
- **Obter Fontes**: Obtenha as fontes das informações fornecidas pela IA.
- **Acompanhar Conversas**: Mantenha o contexto da conversa com `newConversation: false`.
- **🚀 Sistema de Cache de Cookies**: Cache automático de cookies para evitar resolver challenges toda vez (5x mais rápido!)
- **🔒 Bypass Anti-Bot**: Resolve automaticamente a proteção Client Challenge da Meta AI.

## Instalação

```bash
npm install
```

(Ou em seu próprio projeto, instale as dependências listadas em `package.json`)

## Início Rápido

### Executar o Servidor de API

```bash
# Inicie o servidor
npm run server

# Em outro terminal, teste com:
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá!"}'
```

### Executar Exemplos

```bash
# Em um terminal, inicie o servidor
npm run server

# Em outro terminal, execute os exemplos
npm run examples
```

## Uso

### Opção 1: Uso Direto (TypeScript/Node.js)

#### Inicialização

```typescript
import { MetaAI } from "./src/metaAI";

const ai = new MetaAI();
const response = await ai.prompt({
    message: "Qual é o clima em São Francisco hoje?",
});
console.log(response);
```

### Exemplo de Saída

```json
{
    "message": "O clima em São Francisco hoje é principalmente claro...",
    "sources": [
        {
            "link": "https://www.wolframalpha.com/...",
            "title": "WolframAlpha"
        }
    ],
    "media": []
}
```

### Acompanhar conversas

```typescript
const meta = new MetaAI();

let resp = await meta.prompt("quanto é 2 + 2?");
console.log(resp.message); // 2 + 2 = 4

resp = await meta.prompt("qual era minha pergunta anterior?");
console.log(resp.message); // Sua pergunta anterior foi "quanto é 2 + 2?"
```

Para iniciar uma nova conversa:

```typescript
resp = await meta.prompt("Novo tópico", { newConversation: true });
```

### Autenticação (Opcional) (não testado!)

Para gerar imagens ou evitar alguns limites de taxa, você pode autenticar com Facebook.

```typescript
const ai = new MetaAI({ fbEmail: "seu_email", fbPassword: "sua_senha" });
const resp = await ai.prompt("Gere uma imagem de um CEO de tecnologia");
```

### Usando Proxy

```typescript
const proxy = {
    protocol: "http",
    host: "endereco_proxy",
    port: 8080,
    auth: { username: "usuario", password: "senha" }, // se necessário
};

const ai = new MetaAI({ proxy });
```

### Opção 2: API REST (Servidor Express)

Uma forma mais flexível de usar Meta AI! Inicie o servidor Express e interaja via HTTP:

#### Iniciando o Servidor

```bash
npm run server
```

O servidor será iniciado em `http://localhost:3000`

#### Endpoints

**Verificação de Saúde**

```bash
GET http://localhost:3000/health
```

Resposta:

```json
{
    "status": "ok",
    "message": "Meta AI API is running"
}
```

**Enviar um Prompt**

```bash
POST http://localhost:3000/api/prompt
Content-Type: application/json

{
  "message": "Qual é o clima em São Francisco hoje?",
  "newConversation": false
}
```

Resposta:

```json
{
    "success": true,
    "data": {
        "message": "O clima em São Francisco hoje é principalmente claro...",
        "sources": [
            {
                "link": "https://www.wolframalpha.com/...",
                "title": "WolframAlpha"
            }
        ],
        "media": []
    }
}
```

**Iniciar Nova Conversa**

```bash
POST http://localhost:3000/api/new-conversation
```

Resposta:

```json
{
    "success": true,
    "message": "Nova conversa iniciada"
}
```

**Resetar Instância**

```bash
POST http://localhost:3000/api/reset
```

Resposta:

```json
{
    "success": true,
    "message": "Instância resetada com sucesso"
}
```

#### Exemplos com cURL

```bash
# Verificar saúde
curl http://localhost:3000/health

# Enviar prompt
curl -X POST http://localhost:3000/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"message": "Quanto é 2 + 2?"}'

# Continuar conversa
curl -X POST http://localhost:3000/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"message": "Qual era minha pergunta anterior?"}'

# Iniciar nova conversa
curl -X POST http://localhost:3000/api/new-conversation
```

#### Exemplos com JavaScript/Fetch

```javascript
async function perguntarIA(mensagem) {
    const resposta = await fetch("http://localhost:3000/api/prompt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: mensagem }),
    });

    const dados = await resposta.json();
    console.log(dados.data.message);
    console.log("Fontes:", dados.data.sources);
}

perguntarIA("Qual é a capital da França?");
```

## 💾 Sistema de Cache de Cookies

O wrapper agora inclui um sistema automático de cache de cookies que melhora drasticamente a performance!

### Como Funciona

**Primeira Requisição** (~5 segundos):
- Resolve o Client Challenge da Meta AI
- Busca cookies frescos
- **Salva no cache** (`.meta-ai-cookies.json`)
- Válido por 24 horas

**Requisições Seguintes** (<1 segundo ⚡):
- Usa cookies em cache
- Não precisa resolver o challenge
- 5x mais rápido!

### Uso

**Automático (Padrão)**:
```typescript
const ai = new MetaAI();

// Primeira chamada: ~5 segundos (salva cache)
await ai.prompt("Olá!");

// Segunda chamada: <1 segundo (usa cache) ⚡
await ai.prompt("Como você está?");
```

**Limpar Cache Manualmente**:
```typescript
import { clearCookiesCache } from "meta-ai-api";

clearCookiesCache(); // Força buscar cookies novos na próxima vez
```

### Detalhes do Cache

- **Duração**: 24 horas
- **Arquivo**: `.meta-ai-cookies.json` (já está no `.gitignore`)
- **Auto-validação**: Caches expirados/inválidos são renovados automaticamente
- **Seguro**: Arquivo de cache é apenas local (nunca faça commit dele!)

📖 **[Leia a Documentação Completa do Cache](./CACHE.md)**

## Propósito Educacional

Este repositório é destinado apenas para fins educacionais. Os usuários devem aderir aos termos de serviço da Meta.

## Licença

ISC
