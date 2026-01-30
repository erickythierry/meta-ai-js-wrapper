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

## Installation

```bash
npm install
```

(Or in your own project, install the dependencies listed in `package.json`)

## Usage

### Initialization

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

## Instalação

```bash
npm install
```

(Ou em seu próprio projeto, instale as dependências listadas em `package.json`)

## Uso

### Inicialização

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

### Autenticação (Opcional)

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

## Propósito Educacional

Este repositório é destinado apenas para fins educacionais. Os usuários devem aderir aos termos de serviço da Meta.

## Licença

ISC
