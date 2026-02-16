# Como Usar o Nó Meta AI no n8n

## 📋 Pré-requisitos

1. **Servidor Meta AI rodando**: Execute `npm run server` neste projeto
2. **n8n instalado e rodando**: Tenha o n8n configurado

## 🚀 Importar no n8n

1. Abra o n8n
2. Clique em **"+"** para criar um novo workflow
3. Clique nos **3 pontos** (menu) → **Import from File**
4. Selecione o arquivo `n8n-meta-ai-node.json`

## 💡 Como Funciona

Este workflow contém 2 nós:

### 1. **Meta AI Request** (HTTP Request)
- Faz requisição POST para `http://localhost:3000/api/prompt`
- Aceita entrada genérica de diferentes campos:
  - `text` (recomendado)
  - `message`
  - `input`
- Parâmetro `newConversation`: 
  - `false` (padrão) = mantém contexto da conversa
  - `true` = inicia nova conversa
- Parâmetro `conversationId`:
  - **Obrigatório para manter contexto**: Se não fornecido, uma NOVA conversa será iniciada automaticamente
  - UUID de uma conversa anterior para retomar o contexto

### 2. **Extrair Resposta** (Set)
- Extrai os dados da resposta:
  - `response`: Texto da resposta da IA
  - `conversationId`: ID da conversa atual (útil para salvar e retomar depois)
  - `sources`: Array com fontes/links usados
  - `media`: Array com mídias geradas
  - `original_input`: Seu texto original

## 📝 Exemplos de Uso

### Exemplo 1: Processar Texto Simples

**Entrada:**
```json
{
  "text": "Qual é a capital do Brasil?"
}
```

**Saída:**
```json
{
  "response": "A capital do Brasil é Brasília...",
  "sources": [...],
  "media": [],
  "original_input": "Qual é a capital do Brasil?"
}
```

### Exemplo 2: Continuar Conversa

**Primeira mensagem:**
```json
{
  "text": "Quanto é 2 + 2?",
  "newConversation": true
}
```

**Segunda mensagem (mantém contexto):**
```json
{
  "text": "E se eu multiplicar esse resultado por 3?"
}
```

### Exemplo 3: Integração com Outros Nós

```
[Webhook] → [Meta AI Request] → [Extrair Resposta] → [Enviar Email]
```

Você pode usar `{{ $json.response }}` em nós subsequentes para acessar a resposta da IA.

## ⚙️ Configurações Personalizáveis

### Alterar URL do Servidor
Se seu servidor estiver em outra porta ou host:

1. Clique no nó **Meta AI Request**
2. Altere a URL de `http://localhost:3000/api/prompt` para sua URL

### Timeout
O timeout padrão é 60 segundos. Para alterar:

1. Clique no nó **Meta AI Request**
2. Vá em **Options** → **Timeout**
3. Ajuste o valor em milissegundos

## 🔄 Endpoints Adicionais

Você pode criar nós para outros endpoints:

### Iniciar Nova Conversa
```
POST http://localhost:3000/api/new-conversation
```

### Resetar Instância
```
POST http://localhost:3000/api/reset
```

### Health Check
```
GET http://localhost:3000/health
```

## 🎯 Casos de Uso

1. **Chatbot**: Integre com Telegram/WhatsApp para responder mensagens
2. **Análise de Texto**: Processe documentos e extraia informações
3. **Geração de Conteúdo**: Crie descrições, resumos, etc.
4. **Pesquisa em Tempo Real**: Use a conexão com internet da Meta AI
5. **Automação**: Combine com outros nós do n8n para workflows complexos

## 🐛 Troubleshooting

### Erro de Conexão
- Verifique se o servidor está rodando: `npm run server`
- Teste manualmente: `curl http://localhost:3000/health`

### Timeout
- Aumente o timeout nas configurações do nó
- Verifique a conexão com a internet (Meta AI usa Bing)

### Resposta Vazia
- Verifique se o campo de entrada está correto (`text`, `message` ou `input`)
- Veja os logs do servidor Meta AI

## 📚 Referências

- [Documentação Meta AI API](../README.md)
- [Documentação n8n](https://docs.n8n.io/)
