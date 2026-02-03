# Changelog - Correção do Bloqueio Anti-Bot da Meta AI

## Data: 03/02/2026

### 🔒 Problema Identificado

O projeto estava recebendo erro **403 Forbidden** ao tentar acessar a Meta AI devido a:

1. **Client Challenge**: A Meta implementou um sistema anti-bot que exige resolver um "challenge" JavaScript
2. **Compressão Zstd**: A Meta começou a usar compressão Zstandard (zstd) nas respostas HTTP, que não é suportada nativamente pelo Node.js

### ✅ Soluções Implementadas

#### 1. Sistema de Resolução de Client Challenge

**Localização**: `src/utils.ts` - função `getCookies()`

- Detecta automaticamente quando a Meta retorna um challenge (HTTP 403 com script de verificação)
- Extrai a URL do challenge do HTML retornado
- Executa o POST para a URL do challenge
- Aguarda e tenta novamente o acesso original
- Suporta múltiplas tentativas se necessário

**Logs informativos**:
- 🔒 Detectado Client Challenge da Meta AI
- 🔑 Executando challenge
- ✅ Challenge POST retornou status
- 🔄 Tentando acessar a página novamente após o challenge
- ✅ Acesso obtido após challenge

#### 2. Suporte à Compressão Zstd

**Nova dependência**: `@mongodb-js/zstd`

**Localização**: `src/utils.ts` - função `requestWithDecompress()`

Implementação de descompressão manual para todos os formatos:
- **gzip** (padrão HTTP)
- **brotli** (br)
- **deflate**
- **zstd** (Zstandard - usado pela Meta AI) ⭐ NOVO

A função detecta automaticamente o tipo de compressão através de:
- Header `Content-Encoding`
- Magic bytes do arquivo (primeiros bytes que identificam o formato)

#### 3. Headers Atualizados

**Localização**: `src/utils.ts` e `src/metaAI.ts`

Atualizados para simular melhor um navegador real:
```typescript
{
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
  "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  // ... outros headers
}
```

#### 4. Delays Humanizados

Adicionados delays aleatórios entre requisições para parecer mais humano:
- 1-2 segundos após detectar o challenge
- 2-3 segundos antes de tentar novamente
- 3 segundos se precisar de segunda tentativa

### 📦 Nova Dependência

Adicione ao seu `package.json`:
```json
{
  "dependencies": {
    "@mongodb-js/zstd": "^latest"
  }
}
```

Ou instale via npm:
```bash
npm install @mongodb-js/zstd
```

### 🧪 Testes Realizados

Todos os testes passaram com sucesso:
- ✅ Resolução automática do Client Challenge
- ✅ Descompressão de respostas Zstd
- ✅ Extração de cookies necessários (abra_csrf, lsd)
- ✅ Obtenção de Access Token
- ✅ Envio de prompts e recebimento de respostas
- ✅ Múltiplas conversas
- ✅ Continuação de conversas

### 🎯 Resultado

O wrapper agora funciona normalmente, contornando automaticamente as proteções anti-bot da Meta AI sem necessidade de intervenção manual.

### ⚠️ Notas Importantes

1. O processo de resolução do challenge adiciona 3-6 segundos ao tempo da primeira requisição
2. Após resolver o challenge uma vez, as próximas requisições são mais rápidas
3. Se a Meta mudar o formato do challenge ou adicionar novas proteções, pode ser necessário atualizar novamente
4. Recomenda-se adicionar retry logic nas aplicações que usam este wrapper

### 🔮 Possíveis Melhorias Futuras

- [ ] Cache de cookies válidos para evitar resolver o challenge toda vez
- [ ] Suporte a proxy rotativo para evitar bloqueios por IP
- [ ] Implementação de rate limiting automático
- [ ] Detecção de bloqueio permanente e notificação
