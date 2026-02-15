import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { Cookies } from './types';
import { gunzipSync, brotliDecompressSync, inflateSync } from 'zlib';
import { decompress as zstdDecompress } from '@mongodb-js/zstd';
import * as fs from 'fs';
import * as path from 'path';

// Setup axios with cookie jar support
const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  decompress: false, // Vamos descomprimir manualmente
}));

// ============================================
// Sistema de Cache de Cookies
// ============================================

interface CachedCookies {
  cookies: Cookies;
  timestamp: number;
  expiresAt: number;
}

const CACHE_FILE = path.join(process.cwd(), '.meta-ai-cookies.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas em millisegundos

/**
 * Salva os cookies em cache
 */
function saveCookiesCache(cookies: Cookies): void {
  try {
    const now = Date.now();
    const cache: CachedCookies = {
      cookies,
      timestamp: now,
      expiresAt: now + CACHE_DURATION
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    console.log('💾 Cookies salvos em cache (válidos por 24h)');
  } catch (error) {
    console.warn('⚠️  Não foi possível salvar cookies em cache:', error);
  }
}

/**
 * Carrega os cookies do cache se ainda forem válidos
 */
function loadCookiesCache(): Cookies | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }

    const content = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache: CachedCookies = JSON.parse(content);

    const now = Date.now();

    // Verifica se o cache expirou
    if (now > cache.expiresAt) {
      console.log('⏰ Cache de cookies expirado, buscando novos...');
      fs.unlinkSync(CACHE_FILE); // Remove o cache expirado
      return null;
    }

    // Verifica se os cookies essenciais existem
    const { cookies } = cache;
    if (!cookies.abra_csrf || !cookies.lsd) {
      console.log('⚠️  Cache de cookies inválido, buscando novos...');
      fs.unlinkSync(CACHE_FILE);
      return null;
    }

    const hoursLeft = Math.round((cache.expiresAt - now) / (60 * 60 * 1000));
    // console.log(`✅ Usando cookies em cache (válidos por mais ${hoursLeft}h)`);
    return cookies;

  } catch (error) {
    console.warn('⚠️  Erro ao carregar cache, buscando cookies novos:', error);
    // Se houver erro, remove o arquivo corrompido
    try {
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
      }
    } catch { }
    return null;
  }
}

/**
 * Limpa o cache de cookies (útil para forçar nova autenticação)
 */
export function clearCookiesCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('🗑️  Cache de cookies limpo');
    }
  } catch (error) {
    console.warn('⚠️  Erro ao limpar cache:', error);
  }
}

// Função auxiliar para fazer requisição e descomprimir
async function requestWithDecompress(url: string, options: any = {}) {
  const response = await client.get(url, {
    ...options,
    responseType: 'arraybuffer',
  });

  let data = response.data;

  // Descomprime se necessário
  if (data instanceof Buffer || data instanceof ArrayBuffer) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data));
    const encoding = response.headers['content-encoding'];

    try {
      if (encoding === 'gzip' || buffer[0] === 0x1f && buffer[1] === 0x8b) {
        data = gunzipSync(buffer).toString('utf-8');
      } else if (encoding === 'br') {
        data = brotliDecompressSync(buffer).toString('utf-8');
      } else if (encoding === 'deflate') {
        data = inflateSync(buffer).toString('utf-8');
      } else if (encoding === 'zstd' || buffer[0] === 0x28 && buffer[1] === 0xb5 && buffer[2] === 0x2f && buffer[3] === 0xfd) {
        // Descomprime zstd (Zstandard) - usado pela Meta AI
        const decompressed = await zstdDecompress(buffer);
        data = Buffer.from(decompressed).toString('utf-8');
      } else {
        // Sem compressão, converte diretamente
        data = buffer.toString('utf-8');
      }
    } catch (e) {
      console.error('❌ Erro ao descomprimir:', e);
      data = buffer.toString('utf-8');
    }
  }

  response.data = data;
  return response;
}

/**
 * Tenta extrair cookies do HTML usando múltiplos padrões (a Meta muda com frequência)
 */
function extractCookiesFromHtml(html: string): Cookies {
  // Padrão 1: formato JSON {"value":"..."}
  let _js_datr = extractValue(html, '_js_datr":{"value":"', '",');
  let abra_csrf = extractValue(html, 'abra_csrf":{"value":"', '",');
  let datr = extractValue(html, 'datr":{"value":"', '",');
  let lsd = extractValue(html, '"LSD",[],{"token":"', '"}');
  let fb_dtsg = extractValue(html, 'DTSGInitData",[],{"token":"', '"');

  // Padrão 2: formato simples "key","value"
  if (!_js_datr) _js_datr = extractValue(html, '"_js_datr","', '"');
  if (!abra_csrf) abra_csrf = extractValue(html, '"abra_csrf","', '"');
  if (!datr) datr = extractValue(html, '"datr","', '"');
  if (!lsd) lsd = extractValue(html, '"LSD","', '"');
  if (!fb_dtsg) fb_dtsg = extractValue(html, '"DTSGInitialData","', '"');

  // Padrão 3: formato com require("DTSGInitData") ou define
  if (!lsd) lsd = extractValue(html, '"token":"', '"');
  if (!fb_dtsg) fb_dtsg = extractValue(html, '"DTSGInitData",{"token":"', '"');

  // Padrão 4: regex mais flexível
  if (!_js_datr) {
    const m = html.match(/_js_datr['"]\s*[:=,]\s*[{]?\s*["']?(?:value["']?\s*[:=]\s*)?["']([^"']+)["']/);
    if (m) _js_datr = m[1];
  }
  if (!abra_csrf) {
    const m = html.match(/abra_csrf['"]\s*[:=,]\s*[{]?\s*["']?(?:value["']?\s*[:=]\s*)?["']([^"']+)["']/);
    if (m) abra_csrf = m[1];
  }
  if (!datr) {
    const m = html.match(/["']datr["']\s*[:=,]\s*[{]?\s*["']?(?:value["']?\s*[:=]\s*)?["']([^"']+)["']/);
    if (m) datr = m[1];
  }
  if (!lsd) {
    const m = html.match(/["']LSD["'][^}]*["']token["']\s*:\s*["']([^"']+)["']/);
    if (m) lsd = m[1];
  }

  console.log('🔍 Cookies extraídos do HTML:', {
    _js_datr: _js_datr ? `${_js_datr.substring(0, 10)}...` : '(vazio)',
    abra_csrf: abra_csrf ? `${abra_csrf.substring(0, 10)}...` : '(vazio)',
    datr: datr ? `${datr.substring(0, 10)}...` : '(vazio)',
    lsd: lsd ? `${lsd.substring(0, 10)}...` : '(vazio)',
    fb_dtsg: fb_dtsg ? `${fb_dtsg.substring(0, 10)}...` : '(vazio)',
  });

  return { _js_datr, abra_csrf, datr, lsd, fb_dtsg };
}

/**
 * Fallback: tenta extrair cookies do cookie jar (Set-Cookie headers)
 */
async function extractCookiesFromJar(cookieJar: CookieJar, html: string, partial: Cookies): Promise<Cookies> {
  try {
    const jarCookies = await cookieJar.getCookies('https://www.meta.ai');
    const cookieMap: Record<string, string> = {};
    jarCookies.forEach((c: any) => { cookieMap[c.key] = c.value; });

    console.log('🍪 Cookies no jar:', Object.keys(cookieMap));

    return {
      _js_datr: partial._js_datr || cookieMap['_js_datr'] || cookieMap['datr'] || '',
      abra_csrf: partial.abra_csrf || cookieMap['abra_csrf'] || '',
      datr: partial.datr || cookieMap['datr'] || '',
      lsd: partial.lsd || extractLsdFromHtml(html) || '',
      fb_dtsg: partial.fb_dtsg || '',
    };
  } catch (e) {
    console.error('❌ Erro ao extrair cookies do jar:', e);
    return partial;
  }
}

/**
 * Tenta encontrar o LSD token com regex mais agressivo
 */
function extractLsdFromHtml(html: string): string {
  // Tenta vários padrões para LSD
  const patterns = [
    /"LSD"[^"]*"token"\s*:\s*"([^"]+)"/,
    /\["LSD",[^"]*"([^"]+)"\]/,
    /name="lsd"\s+value="([^"]+)"/,
    /"lsd":\s*"([^"]+)"/,
    /lsd['"]\s*[:=]\s*['"]([^'"]+)['"]/,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1]) return m[1];
  }
  return '';
}

/**
 * Debug: salva trechos do HTML para diagnóstico
 */
function debugExtraction(html: string, label: string): void {
  const debugFile = path.join(process.cwd(), `.meta-ai-debug-${label}.html`);
  try {
    // Salva apenas os primeiros 50KB para diagnóstico
    fs.writeFileSync(debugFile, html.substring(0, 50000), 'utf-8');
    console.log(`🐛 HTML de debug salvo em: ${debugFile}`);

    // Procura por padrões conhecidos no HTML
    const hasJsDatr = html.includes('_js_datr');
    const hasAbraCsrf = html.includes('abra_csrf');
    const hasDatr = html.includes('"datr"');
    const hasLsd = html.includes('LSD');
    const hasDtsg = html.includes('DTSGInitData');

    console.log('🔎 Padrões encontrados no HTML:', {
      _js_datr: hasJsDatr,
      abra_csrf: hasAbraCsrf,
      datr: hasDatr,
      LSD: hasLsd,
      DTSGInitData: hasDtsg,
    });
  } catch (e) {
    console.warn('⚠️  Não foi possível salvar debug HTML:', e);
  }
}

export function generateOfflineThreadingId(): string {
  const maxInt = BigInt('18446744073709551615'); // 2^64 - 1
  const mask22Bits = BigInt((1 << 22) - 1);

  const timestamp = BigInt(Date.now());

  // Generate random 64-bit integer
  const randomValue = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  // Note: JS random isn't 64-bit, but this is an approximation for the logic. 
  // For better 64-bit random, we'd need crypto.webcrypto or similar, but this matches the intent.

  const shiftedTimestamp = timestamp << BigInt(22);
  const maskedRandom = randomValue & mask22Bits;
  const threadingId = (shiftedTimestamp | maskedRandom) & maxInt;

  return threadingId.toString();
}

export function extractValue(text: string, startStr: string, endStr: string): string {
  const start = text.indexOf(startStr);
  if (start === -1) return '';
  const actualStart = start + startStr.length;
  const end = text.indexOf(endStr, actualStart);
  if (end === -1) return '';
  return text.substring(actualStart, end);
}

export function formatResponse(response: any): string {
  let text = "";
  const contentList = response?.data?.node?.bot_response_message?.composed_text?.content || [];

  for (const content of contentList) {
    if (content.text) {
      text += content.text + "\n";
    }
  }
  return text;
}

export async function getCookies(proxy?: any, forceRefresh: boolean = false): Promise<Cookies> {
  // Tenta carregar do cache primeiro (se não for forceRefresh)
  if (!forceRefresh) {
    const cachedCookies = loadCookiesCache();
    if (cachedCookies) {
      return cachedCookies;
    }
  }

  console.log('🌐 Buscando cookies frescos da Meta AI...');

  // Headers mais completos para simular um navegador real
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
    "Upgrade-Insecure-Requests": "1",
    "DNT": "1",
  };

  try {
    const response = await requestWithDecompress("https://www.meta.ai/", {
      headers,
      proxy,
      validateStatus: (status: number) => status < 500, // Aceita 403 também
    });

    const text = response.data;

    // Verifica se recebeu um challenge (erro 403 com verificação)
    if (response.status === 403 && text.includes('__rd_verify')) {
      console.log('🔒 Detectado Client Challenge da Meta AI. Resolvendo...');

      // Extrai a URL do challenge
      const challengeUrlMatch = text.match(/fetch\('([^']+)',/);
      if (challengeUrlMatch && challengeUrlMatch[1]) {
        const challengeUrl = `https://www.meta.ai${challengeUrlMatch[1]}`;
        console.log(`🔑 Executando challenge: ${challengeUrl}`);

        // Adiciona um pequeno delay para parecer mais humano
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

        // Executa o POST do challenge
        try {
          const challengeResponse = await client.post(challengeUrl, null, {
            headers: {
              ...headers,
              "Referer": "https://www.meta.ai/",
              "Origin": "https://www.meta.ai",
              "Sec-Fetch-Site": "same-origin",
              "Content-Length": "0",
            },
            proxy,
            validateStatus: (status) => status < 500,
            maxRedirects: 5,
          });
          console.log(`✅ Challenge POST retornou status: ${challengeResponse.status}`);
        } catch (e: any) {
          console.log(`⚠️  Challenge POST falhou: ${e.message}`);
        }

        // Aguarda um pouco antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

        // Tenta acessar a página novamente
        console.log('🔄 Tentando acessar a página novamente após o challenge...');
        const retryResponse = await requestWithDecompress("https://www.meta.ai/", {
          headers: {
            ...headers,
            "Sec-Fetch-Site": "same-origin",
            "Referer": "https://www.meta.ai/",
          },
          proxy,
          validateStatus: (status: number) => status < 500,
        });

        console.log(`📡 Retry response status: ${retryResponse.status}`);

        // Se ainda for 403, tenta mais uma vez
        if (retryResponse.status === 403 && retryResponse.data.includes('__rd_verify')) {
          console.log('⚠️  Ainda com challenge, tentando mais uma vez...');

          const secondChallengeMatch = retryResponse.data.match(/fetch\('([^']+)',/);
          if (secondChallengeMatch && secondChallengeMatch[1]) {
            const secondChallengeUrl = `https://www.meta.ai${secondChallengeMatch[1]}`;

            await new Promise(resolve => setTimeout(resolve, 2000));

            await client.post(secondChallengeUrl, null, {
              headers: {
                ...headers,
                "Referer": "https://www.meta.ai/",
                "Origin": "https://www.meta.ai",
                "Sec-Fetch-Site": "same-origin",
                "Content-Length": "0",
              },
              proxy,
              validateStatus: (status) => status < 500,
            });

            await new Promise(resolve => setTimeout(resolve, 3000));

            const finalResponse = await requestWithDecompress("https://www.meta.ai/", {
              headers: {
                ...headers,
                "Sec-Fetch-Site": "same-origin",
                "Referer": "https://www.meta.ai/",
              },
              proxy,
            });

            const finalText = finalResponse.data;
            console.log('✅ Acesso obtido após segundo challenge!');
            debugExtraction(finalText, 'after-second-challenge');

            let finalCookies = extractCookiesFromHtml(finalText);
            if (!finalCookies._js_datr && !finalCookies.lsd) {
              finalCookies = await extractCookiesFromJar(jar, finalText, finalCookies);
            }
            if (finalCookies.lsd) saveCookiesCache(finalCookies);
            return finalCookies;
          }
        }

        const retryText = retryResponse.data;
        console.log('✅ Acesso obtido após challenge!');
        console.log(`📏 Tamanho da resposta: ${retryText.length} chars`);

        // Debug: salvar trecho do HTML para diagnóstico
        debugExtraction(retryText, 'after-challenge');

        // Tentar diferentes padrões de extração
        let cookies = extractCookiesFromHtml(retryText);

        // Se os cookies do HTML estão vazios, tentar extrair do cookie jar
        if (!cookies._js_datr && !cookies.abra_csrf && !cookies.lsd) {
          console.log('⚠️  Extração do HTML falhou, tentando extrair do cookie jar...');
          cookies = await extractCookiesFromJar(jar, retryText, cookies);
        }

        // Validação antes de salvar
        if (!cookies.lsd) {
          console.error('❌ Cookie "lsd" não encontrado - cookies inválidos, não salvando cache');
          console.error('   Cookies extraídos:', JSON.stringify(cookies));
          throw new Error('Não foi possível extrair cookies válidos da Meta AI após challenge');
        }

        // Salva os cookies no cache
        saveCookiesCache(cookies);

        return cookies;
      }

      throw new Error('Não foi possível resolver o Client Challenge da Meta AI');
    }

    debugExtraction(text, 'no-challenge');

    let cookies = extractCookiesFromHtml(text);
    if (!cookies._js_datr && !cookies.lsd) {
      cookies = await extractCookiesFromJar(jar, text, cookies);
    }

    if (cookies.lsd) {
      saveCookiesCache(cookies);
    } else {
      console.error('❌ Cookies inválidos (lsd vazio), não salvando cache');
    }

    return cookies;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('Meta AI bloqueou o acesso. Possível bloqueio por região, IP ou medidas anti-bot mais agressivas. Considere usar um proxy ou aguardar antes de tentar novamente.');
    }
    throw error;
  }
}

export async function getFbSession(email: string, password: string, proxy?: any): Promise<any> {
  const loginUrl = "https://www.facebook.com/login/?next";
  const headers: any = {
    "authority": "mbasic.facebook.com",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-US,en;q=0.9",
    "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  };

  const response = await client.get(loginUrl, { headers, proxy });
  const $ = cheerio.load(response.data);

  const lsd = $('input[name="lsd"]').val() as string;
  const jazoest = $('input[name="jazoest"]').val() as string;

  const postUrl = "https://www.facebook.com/login/?next";
  const data = new URLSearchParams({
    lsd,
    jazoest,
    login_source: "comet_headerless_login",
    email,
    pass: password,
    login: "1",
    next: ""
  });

  const postHeaders: any = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.facebook.com/",
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://www.facebook.com",
    "DNT": "1",
    "Sec-GPC": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Priority": "u=0, i",
  };

  // In nodejs with axios-cookie-jar-support, cookies are handled automatically in the jar.
  // We just need to make sure we share the jar or client.

  const loginResponse = await client.post(postUrl, data, {
    headers: postHeaders,
    proxy,
    maxRedirects: 0,
    validateStatus: (status: number) => status >= 200 && status < 400
  });

  // Check for cookies in the jar
  const cookies = await jar.getCookies("https://www.facebook.com");
  const cookieDict: any = {};
  cookies.forEach((c: any) => cookieDict[c.key] = c.value);

  if (!cookieDict['sb'] || !cookieDict['xs']) {
    throw new Error("Was not able to login to Facebook. Please check your credentials.");
  }

  // Next steps from Python code:
  // 1. Get meta AI cookies
  const metaAiCookies = await getCookies(proxy);

  // 2. Auth with Meta AI
  const authUrl = "https://www.meta.ai/state/";
  const authPayload = new URLSearchParams();
  authPayload.append('__a', '1');
  authPayload.append('lsd', metaAiCookies.lsd || '');

  const authHeaders: any = {
    "authority": "www.meta.ai",
    "accept": "*/*",
    "content-type": "application/x-www-form-urlencoded",
    "origin": "https://www.meta.ai",
    "referer": "https://www.meta.ai/",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "cookie": `ps_n=1; ps_l=1; dpr=2; _js_datr=${metaAiCookies._js_datr}; abra_csrf=${metaAiCookies.abra_csrf}; datr=${metaAiCookies.datr}`
  };

  const authResponse = await client.post(authUrl, authPayload, { headers: authHeaders, proxy });
  const state = extractValue(authResponse.data, '"state":"', '"');

  const oidcUrl = `https://www.facebook.com/oidc/?app_id=1358015658191005&scope=openid%20linking&response_type=code&redirect_uri=https%3A%2F%2Fwww.meta.ai%2Fauth%2F&no_universal_links=1&deoia=1&state=${state}`;

  // Request to OIDC
  const oidcResponse = await client.get(oidcUrl, {
    headers: {
      ...postHeaders,
      "sec-fetch-site": "cross-site",
      "cookie": `datr=${cookieDict['datr']}; sb=${cookieDict['sb']}; c_user=${cookieDict['c_user']}; xs=${cookieDict['xs']}; fr=${cookieDict['fr']}; abra_csrf=${metaAiCookies.abra_csrf};`
    },
    proxy,
    maxRedirects: 0,
    validateStatus: (status: number) => status >= 200 && status < 400
  });

  const nextUrl = oidcResponse.headers['location'];
  if (!nextUrl) throw new Error("Failed to get redirect URL from OIDC");

  // Final request to Next URL
  await client.get(nextUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
      "Cookie": `dpr=2; abra_csrf=${metaAiCookies.abra_csrf}; datr=${metaAiCookies._js_datr}`
    },
    proxy
  });

  // Get final cookies
  const finalCookies = await jar.getCookies("https://www.meta.ai");
  const finalCookieDict: any = {};
  finalCookies.forEach((c: any) => finalCookieDict[c.key] = c.value);

  // Python code returns a mix of cookies.
  return {
    cookies: finalCookieDict,
    abra_sess: finalCookieDict['abra_sess']
  };
}
