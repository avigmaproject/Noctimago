// src/utils/gtranslate.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
 const API_KEY = ''; // put your key here for live results

const DEBUG_FAKE = !API_KEY || API_KEY === 'FAKE'; // FAKE mode if key is empty

const MEMO = new Map<string, string>();
const CACHE_PREFIX = 'gt-cache:';
const keyOf = (from: string, to: string, text: string) => `${from}->${to}:${text}`;

// decode HTML entities Google sometimes returns
function decodeHtmlEntities(s?: string) {
  return s
    ?.replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

async function getCache(k: string) {
  if (MEMO.has(k)) return MEMO.get(k)!;
  const v = await AsyncStorage.getItem(CACHE_PREFIX + k);
  if (v) MEMO.set(k, v);
  return v ?? null;
}
async function setCache(k: string, v: string) {
  MEMO.set(k, v);
  await AsyncStorage.setItem(CACHE_PREFIX + k, v);
}

// Promise timeout wrapper
function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('gTranslate timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

export async function gTranslate(text: string, to: string, from = 'en') {
  try {
    const toBase = (to || 'en').split('-')[0];
    if (!text || from === toBase) {
        __DEV__
    //   __DEV__ && console.log('[gTranslate] skip', { from, to: toBase, text });
      return text;
    }

    const cacheKey = keyOf(from, toBase, text);
    const cached = await getCache(cacheKey);
    if (cached) {
        __DEV__
    //   __DEV__ && console.log('[gTranslate] cache HIT', { from, to: toBase, text, out: cached });
      return cached;
    }
    __DEV__
    // __DEV__ && console.log('[gTranslate] CALL', { from, to: toBase, text, DEBUG_FAKE });

    // FAKE mode so you can see wiring without network/key
    if (DEBUG_FAKE) {
      const fake = `[${toBase}] ${text}`;
      __DEV__
    //   __DEV__ && console.log('[gTranslate] FAKE ->', fake);
      await setCache(cacheKey, fake);
      return fake;
    }

    const req = fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: from, target: toBase, format: 'text' }),
      }
    );

    const res = await withTimeout(req, 8000);
    const json = await res.json();

    if (!res.ok) {
        __DEV__
    //   __DEV__ && console.log('[gTranslate] ERROR', { status: res.status, body: json });
      return text;
    }

    const raw = json?.data?.translations?.[0]?.translatedText ?? text;
    const out = decodeHtmlEntities(raw) ?? text;
    __DEV__
    // __DEV__ && console.log('[gTranslate] OK', { from, to: toBase, text, out });
    await setCache(cacheKey, out);
    return out;
  } catch (e) {
    __DEV__
    // __DEV__ && console.log('[gTranslate] EXCEPTION', String(e));
    return text;
  }
}
