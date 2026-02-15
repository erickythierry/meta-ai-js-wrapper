import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { MetaAIConstructorArgs, MetaAIResponse, Cookies } from './types';
import { getFbSession } from './utils';

const MAX_RETRIES = 3;

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Linux"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
  "dnt": "1",
};

// ============================================================
// Protobuf Encoder (minimalista para o schema do Meta AI)
// ============================================================

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0; // unsigned
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function encodeTag(fieldNumber: number, wireType: number): Buffer {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeString(fieldNumber: number, value: string): Buffer {
  const strBuf = Buffer.from(value, 'utf-8');
  return Buffer.concat([encodeTag(fieldNumber, 2), encodeVarint(strBuf.length), strBuf]);
}

function encodeBytes(fieldNumber: number, data: Buffer): Buffer {
  return Buffer.concat([encodeTag(fieldNumber, 2), encodeVarint(data.length), data]);
}

function encodeVarintField(fieldNumber: number, value: number): Buffer {
  return Buffer.concat([encodeTag(fieldNumber, 0), encodeVarint(value)]);
}

function encodeFloat32(fieldNumber: number, value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeFloatLE(value, 0);
  return Buffer.concat([encodeTag(fieldNumber, 5), buf]);
}

function encodeMessage(fieldNumber: number, data: Buffer): Buffer {
  return Buffer.concat([encodeTag(fieldNumber, 2), encodeVarint(data.length), data]);
}

/**
 * Constrói o payload protobuf para envio de mensagem via WebSocket DGW.
 */
function buildMessageProtobuf(params: {
  conversationId: string;
  requestId: string;
  offlineThreadingId: string;
  abraUserId: string;
  messageText: string;
  userAgent: string;
  locale: string;
  timezone: string;
}): Buffer {
  const { conversationId, requestId, offlineThreadingId, abraUserId, messageText, userAgent, locale, timezone } = params;
  const epochSeconds = Math.floor(Date.now() / 1000);
  const messageId = uuidv4();

  // Capabilities
  const capabilities = ['stocks', 'weather', 'meta_knowledge_search_carousel', 'meta_catalog_search_carousel', 'media_gallery'];
  const capabilityBuffers = capabilities.map(cap => {
    const inner = Buffer.concat([
      encodeVarintField(1, 1),
    ]);
    return encodeMessage(18, Buffer.concat([
      encodeString(1, cap),
      encodeMessage(2, inner),
    ]));
  });

  // Field 1.1: Request context
  const field1_1_5_inner = encodeString(1, conversationId);
  const field1_1_5 = encodeMessage(5, field1_1_5_inner);

  const field1_1_8 = encodeMessage(8, Buffer.concat([
    encodeString(1, abraUserId),
    encodeString(2, abraUserId),
  ]));

  const field1_1_12 = encodeMessage(12, Buffer.concat([
    encodeMessage(3, encodeVarintField(1, 5)),
    encodeMessage(4, encodeVarintField(1, 1)),
  ]));

  // Hash (pode ser aleatório)
  const hashHex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const field1_1_19 = encodeMessage(19, Buffer.concat([
    encodeString(1, hashHex),
    encodeFloat32(2, 1.0),
  ]));

  const requestContext = Buffer.concat([
    encodeString(1, "KADABRA__HOME__UNIFIED_INPUT_BAR"),
    encodeString(2, "1522763855472543"),
    encodeString(4, offlineThreadingId),
    field1_1_5,
    encodeVarintField(6, 5),
    encodeString(7, "HUMAN_AGENT"),
    field1_1_8,
    encodeString(10, "ECTO1"),
    encodeString(11, "Abra Web Temp User Key"),
    field1_1_12,
    encodeString(13, "Linux"),
    encodeString(14, "user_input"),
    encodeString(15, userAgent),
    encodeString(16, "desktop_web"),
    field1_1_19,
  ]);

  // Field 1.2: Timestamp
  const field1_2 = encodeMessage(2, Buffer.concat([
    encodeVarintField(1, epochSeconds),
    encodeVarintField(2, epochSeconds),
    encodeVarintField(3, 6),
  ]));

  // Field 1.3: Flags
  const field1_3 = encodeMessage(3, encodeVarintField(4, 1));

  // Field 1.4: Empty
  const field1_4 = encodeBytes(4, Buffer.alloc(0));

  // Field 1.5: Another timestamp
  const field1_5 = encodeMessage(5, Buffer.concat([
    encodeVarintField(1, epochSeconds),
    encodeVarintField(3, Math.floor(Math.random() * 65535)),
  ]));

  // Field 1.6: Request ID
  const field1_6 = encodeString(6, requestId);

  // Field 1.7: Empty
  const field1_7 = encodeBytes(7, Buffer.alloc(0));

  // Field 1.9: Locale
  const field1_9 = encodeMessage(9, encodeString(2, locale));

  // Field 1.10: Message+Conversation UUIDs
  const field1_10_inner = Buffer.concat([
    encodeString(1, messageId),
    encodeString(2, conversationId),
  ]);
  const field1_10 = encodeBytes(10, field1_10_inner);

  // Field 1.15: Timezone
  const field1_15 = encodeBytes(15, Buffer.from(encodeString(1, timezone)));

  // Main container (field 1)
  const mainContainer = Buffer.concat([
    encodeMessage(1, requestContext),
    field1_2,
    field1_3,
    field1_4,
    field1_5,
    field1_6,
    field1_7,
    field1_9,
    field1_10,
    field1_15,
    ...capabilityBuffers,
  ]);

  // Field 2: User message
  const field2_1_2 = encodeMessage(2, Buffer.concat([
    encodeString(1, conversationId),
    encodeVarintField(2, epochSeconds),
    encodeVarintField(3, Math.floor(Math.random() * 0xFFFFFFFF)),
  ]));

  const messagePayload = Buffer.concat([
    encodeMessage(1, Buffer.concat([
      encodeString(1, messageId),
      field2_1_2,
    ])),
    encodeString(2, messageText),
    encodeBytes(4, Buffer.alloc(0)),
  ]);

  // Full protobuf
  return Buffer.concat([
    encodeMessage(1, mainContainer),
    encodeMessage(2, messagePayload),
  ]);
}

// ============================================================
// DGW Frame Encoding
// ============================================================

function buildDgwSetupFrame(conversationId: string): Buffer {
  const json = JSON.stringify({
    "x-dgw-app-x-ecto-conversation-id": conversationId,
    "x-dgw-app-client-payload-type": "PROTO_INSIDE_JSON",
  });
  const body = Buffer.from(json, 'utf-8');
  // Header: [0x0f, 0x00, 0x00, <length>, 0x00, 0x00]
  const header = Buffer.from([0x0f, 0x00, 0x00, body.length, 0x00, 0x00]);
  return Buffer.concat([header, body]);
}

function buildDgwMessageFrame(requestId: string, protobufPayload: Buffer): Buffer {
  const json = JSON.stringify({
    "req-id": requestId,
    "payload": protobufPayload.toString('base64'),
  });
  const body = Buffer.from(json, 'utf-8');

  // Header: [0x0d, 0x00, 0x00, len_lo, len_hi, 0x00, 0x00, 0x80]
  // Length field = body.length + 2 (includes 2 bytes overhead)
  const len = body.length + 2;
  const headerBytes = [0x0d, 0x00, 0x00, len & 0xff, (len >> 8) & 0xff, 0x00, 0x00, 0x80];
  return Buffer.concat([Buffer.from(headerBytes), body]);
}

// ============================================================
// MetaAI Class
// ============================================================

export class MetaAI {
  private session: AxiosInstance;
  public accessToken: string | null = null;
  public abraUserId: string | null = null;
  public fbEmail: string | null = null;
  public fbPassword: string | null = null;
  public proxy: any | null = null;
  public isAuthed: boolean = false;
  public cookies: Cookies | null = null;
  public externalConversationId: string | null = null;
  public offlineThreadingId: string | null = null;
  private jar: CookieJar;
  private currentMode: string | null = null;

  constructor(args?: MetaAIConstructorArgs) {
    this.fbEmail = args?.fbEmail ?? null;
    this.fbPassword = args?.fbPassword ?? null;
    this.proxy = args?.proxy ?? null;
    this.isAuthed = this.fbPassword !== null && this.fbEmail !== null;

    this.jar = new CookieJar();
    this.session = wrapper(axios.create({
      jar: this.jar,
      proxy: this.proxy,
      headers: BROWSER_HEADERS,
    }));
  }

  async init() {
    this.cookies = await this.getCookies();
  }

  /**
   * Obtém cookies via challenge flow (novo fluxo Next.js).
   */
  async getCookies(): Promise<Cookies> {
    if (this.fbEmail && this.fbPassword) {
      const sessionData = await getFbSession(this.fbEmail, this.fbPassword, this.proxy);
      return { ...sessionData.cookies, abra_sess: sessionData.abra_sess };
    }

    // GET inicial → pode ser 403 com challenge
    const initialResp = await this.session.get('https://www.meta.ai/', {
      headers: BROWSER_HEADERS,
      proxy: this.proxy,
      validateStatus: (s) => s < 500,
      maxRedirects: 0,
    });

    if (initialResp.status === 403) {
      const html = typeof initialResp.data === 'string' ? initialResp.data :
        Buffer.isBuffer(initialResp.data) ? initialResp.data.toString('utf-8') : String(initialResp.data);

      const challengeMatch = html.match(/fetch\('([^']+)',/);
      if (challengeMatch && challengeMatch[1]) {
        const challengeUrl = `https://www.meta.ai${challengeMatch[1]}`;

        // POST do challenge
        await this.session.post(challengeUrl, null, {
          headers: { ...BROWSER_HEADERS, "referer": "https://www.meta.ai/", "origin": "https://www.meta.ai", "content-length": "0",
            "sec-fetch-dest": "empty", "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin" },
          proxy: this.proxy,
          validateStatus: (s) => s < 500,
        });

        await new Promise(r => setTimeout(r, 1000));

        // GET de novo → segue redirect, obtém datr
        await this.session.get('https://www.meta.ai/', {
          headers: { ...BROWSER_HEADERS, "sec-fetch-site": "same-origin", "referer": "https://www.meta.ai/" },
          proxy: this.proxy,
          validateStatus: (s) => s < 500,
          maxRedirects: 5,
        });
      }
    }

    const jarCookies = await this.jar.getCookies('https://www.meta.ai');
    const cookieMap: Record<string, string> = {};
    jarCookies.forEach((c: any) => { cookieMap[c.key] = c.value; });

    if (!cookieMap['datr']) {
      throw new Error('Não foi possível obter o cookie datr da Meta AI');
    }

    return {
      datr: cookieMap['datr'],
      rd_challenge: cookieMap['rd_challenge'] || '',
    };
  }

  /**
   * Chamadas GraphQL iniciais necessárias antes de aceitar TOS.
   */
  private async initGraphQLCalls(): Promise<void> {
    const url = "https://www.meta.ai/api/graphql";
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "origin": "https://www.meta.ai",
      "referer": "https://www.meta.ai/",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };

    for (const docId of [
      "71a9538c7cb4b536f0b59bd14130535e",
      "9ddc0d27be6b8029c988ca2d4d1f2725",
      "c204727df77cb2e34332f8ac2b6832e7",
    ]) {
      try {
        await this.session.post(url, { doc_id: docId, variables: {} }, { headers });
      } catch {}
    }
    await new Promise(r => setTimeout(r, 300));
  }

  /**
   * Obtém access token via aceitar TOS (novo fluxo JSON).
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    if (!this.cookies) await this.init();

    await this.initGraphQLCalls();

    const url = "https://www.meta.ai/api/graphql";
    const payload = {
      doc_id: "ddce908d24ed917753b713f3b2e377c1",
      variables: { input: { dateOfBirth: "1999-01-01" } },
    };
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "origin": "https://www.meta.ai",
      "referer": "https://www.meta.ai/",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };

    try {
      const response = await this.session.post(url, payload, { headers });
      const data = response.data;
      const accessToken = data?.data?.acceptTOSForLoggedOut?.viewer?.accessToken;
      const abraUserId = data?.data?.acceptTOSForLoggedOut?.viewer?.abraUserId;

      if (!accessToken) {
        throw new Error("Could not retrieve access token");
      }

      this.accessToken = accessToken;
      this.abraUserId = abraUserId || null;
      await new Promise(resolve => setTimeout(resolve, 300));
      return accessToken;
    } catch (error: any) {
      throw new Error("Unable to receive a valid response from Meta AI. Check region blocking or network.");
    }
  }

  private conversationEstablished: boolean = false;
  private pendingMode: "think_hard" | "think_fast" | null = null;

  /**
   * Envia mensagem e recebe resposta via WebSocket DGW.
   */
  async prompt(
    message: string,
    options: { stream?: boolean, attempts?: number, newConversation?: boolean; thinking?: boolean; } = {}
  ): Promise<MetaAIResponse> {
    const { attempts = 0, newConversation = false } = options;

    if (!this.cookies) await this.init();
    if (!this.accessToken) this.accessToken = await this.getAccessToken();

    if (!this.externalConversationId || newConversation) {
      this.externalConversationId = uuidv4();
      this.currentMode = null;
      this.conversationEstablished = false;
    }

    const conversationId = this.externalConversationId;
    const requestId = uuidv4();
    const offlineThreadingId = `${uuidv4().replace(/-/g, '').substring(0, 8)}-${uuidv4().substring(0, 32)}`;

    try {
      const response = await this.sendViaWebSocket(conversationId, requestId, offlineThreadingId, message);
      this.conversationEstablished = true;
      return response;
    } catch (e: any) {
      return this.retry(message, options);
    }
  }

  /**
   * Estabelece conexão WebSocket, envia mensagem e coleta resposta.
   */
  private sendViaWebSocket(
    conversationId: string,
    requestId: string,
    offlineThreadingId: string,
    message: string
  ): Promise<MetaAIResponse> {
    return new Promise((resolve, reject) => {
      const encodedToken = encodeURIComponent(this.accessToken!);
      const clippyRequestId = uuidv4();

      const wsUrl = `wss://gateway.meta.ai/ws/clippy?` +
        `x-dgw-appid=1522763855472543&` +
        `x-dgw-appversion=1.0.0&` +
        `x-dgw-authtype=15%3A0&` +
        `x-dgw-version=5&` +
        `x-dgw-uuid=0&` +
        `x-dgw-tier=prod&` +
        `Authorization=${encodedToken}&` +
        `x-dgw-app-origin=meta.ai&` +
        `x-dgw-app-clippy-request-id=${clippyRequestId}`;

      const ws = new WebSocket(wsUrl, {
        headers: {
          "Origin": "https://www.meta.ai",
          "User-Agent": BROWSER_HEADERS["user-agent"],
        },
      });

      let setupAcked = false;
      let messageSent = false;
      let fullResponseText = '';
      let responseId = '';
      let lastResponseJson: any = null;
      let timeout: ReturnType<typeof setTimeout>;

      // Timeout de 30s
      timeout = setTimeout(() => {
        ws.close();
        if (fullResponseText) {
          resolve({
            message: fullResponseText,
            sources: [],
            media: [],
          });
        } else {
          reject(new Error('WebSocket timeout'));
        }
      }, 30000);

      ws.on('open', () => {
        // Enviar setup frame
        const setupFrame = buildDgwSetupFrame(conversationId);
        ws.send(setupFrame);
      });

      ws.on('message', (data: Buffer) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const str = buf.toString('utf-8');

        // Verificar ACK do setup
        if (!setupAcked && str.includes('"code":200')) {
          setupAcked = true;

          // Construir e enviar a mensagem
          const protobuf = buildMessageProtobuf({
            conversationId,
            requestId,
            offlineThreadingId,
            abraUserId: this.abraUserId || '',
            messageText: message,
            userAgent: BROWSER_HEADERS["user-agent"],
            locale: "pt-BR",
            timezone: "America/Sao_Paulo",
          });

          const messageFrame = buildDgwMessageFrame(requestId, protobuf);
          ws.send(messageFrame);
          messageSent = true;
          return;
        }

        if (!messageSent) return;

        // Extrair texto de resposta dos frames binários
        try {
          // Estratégia: encontrar o JSON completo da response que contém "sections"
          // O formato é: {"response_id":"...","sections":[{"view_model":{"__typename":"GenAISingleLayoutViewModel","primitive":{"__typename":"GenAIMarkdownTextUXPrimitive","text":"..."}}}],...}
          // Precisamos do texto na PRIMEIRA section, não do embedded_screens (que contém thinking)

          // Procurar o padrão: "GenAIMarkdownTextUXPrimitive","text":"..."
          // Que aparece ANTES de "embedded_screens"
          const marker = '"GenAIMarkdownTextUXPrimitive","text":"';
          const markerIdx = str.indexOf(marker);
          if (markerIdx !== -1) {
            const textStart = markerIdx + marker.length;
            // Encontrar o fim da string (aspas não escapadas)
            let textEnd = textStart;
            while (textEnd < str.length) {
              if (str[textEnd] === '"' && str[textEnd - 1] !== '\\') break;
              textEnd++;
            }
            const extractedText = str.substring(textStart, textEnd);

            // Verificar se é a resposta principal (não thinking)
            // O texto de thinking começa com "•" ou "**" e está dentro de embedded_screens
            const embeddedIdx = str.indexOf('"embedded_screens"');
            if (embeddedIdx === -1 || markerIdx < embeddedIdx) {
              // O texto está ANTES de embedded_screens → é a resposta principal
              const decoded = extractedText
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\t/g, '\t')
                .replace(/\\\\/g, '\\')
                .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
              fullResponseText = decoded;
            }
          }

          // Detectar fim: byte pattern 0x28 0x01 indica resposta finalizada
          if (fullResponseText && buf.includes(Buffer.from([0x28, 0x01]))) {
            clearTimeout(timeout);
            ws.close();
            resolve({
              message: fullResponseText,
              sources: [],
              media: [],
            });
            return;
          }
        } catch {}
      });

      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (fullResponseText) {
          resolve({
            message: fullResponseText,
            sources: [],
            media: [],
          });
        } else {
          reject(new Error('WebSocket closed without response'));
        }
      });
    });
  }

  async retry(
    message: string,
    options: { stream?: boolean, attempts?: number, newConversation?: boolean; thinking?: boolean; }
  ): Promise<MetaAIResponse> {
    const { attempts = 0 } = options;
    if (attempts < MAX_RETRIES) {
      console.warn(`Retrying... Attempt ${attempts + 1}/${MAX_RETRIES}`);
      if (attempts > 0) this.accessToken = null;
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.prompt(message, { ...options, attempts: attempts + 1 });
    }
    throw new Error("Unable to obtain a valid response from Meta AI.");
  }
}
