// 100% dynamic runtime translation with retries + mirrors (no static dictionary).
// You can swap to Google/Azure later without touching the rest of the app.

type Endpoint = { url: string };

const ENDPOINTS: Endpoint[] = [
  { url: 'https://libretranslate.com/translate' },     // public demo (can be rate-limited)
  { url: 'https://translate.astian.org/translate' },   // mirror
  { url: 'https://libretranslate.de/translate' },      // mirror
];

function withTimeout<T>(p: Promise<T>, ms = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

async function tryOne(ep: Endpoint, q: string, target: string, source = 'auto'): Promise<string | null> {
  const tgt = target.split('-')[0];
  const src = source.split('-')[0];

  if (!q || !q.trim()) return q;
  if (tgt === src) return q;

  try {
    const res = await withTimeout(fetch(ep.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, source: src, target: tgt, format: 'text' }),
    }), 4000);

    if (!res.ok) return null;

    // Most LT servers return { translatedText }, some return { translation }
    const data = await res.json();
    const out: string | undefined = data?.translatedText ?? data?.translation;
    if (typeof out === 'string' && out.trim()) return out;
    return null;
  } catch (e) {
    return null;
  }
}

/** Translate text using multiple mirrors with short timeouts (no static fallback). */
export async function translateText(text: string, targetLang: string, sourceLang?: string): Promise<string> {
  for (const ep of ENDPOINTS) {
    const out = await tryOne(ep, text, targetLang, sourceLang ?? 'auto');
    if (out !== null) return out;
  }
  // If all fail, return original text (don’t freeze UI).
  return text;
}
