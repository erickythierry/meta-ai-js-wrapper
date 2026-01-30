import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { Cookies } from './types';

// Setup axios with cookie jar support
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

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

export async function getCookies(proxy?: any): Promise<Cookies> {
  const headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
  };

  const response = await client.get("https://www.meta.ai/", {
    headers,
    proxy
  });

  const text = response.data;

  return {
    _js_datr: extractValue(text, '_js_datr":{"value":"', '",'),
    abra_csrf: extractValue(text, 'abra_csrf":{"value":"', '",'),
    datr: extractValue(text, 'datr":{"value":"', '",'),
    lsd: extractValue(text, '"LSD",[],{"token":"', '"}'),
    fb_dtsg: extractValue(text, 'DTSGInitData",[],{"token":"', '"'),
  };
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
    authPayload.append('lsd', metaAiCookies.lsd);

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
