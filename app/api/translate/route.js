import { NextResponse } from 'next/server';

const TARGET_LANGUAGES = {
  en: 'en',
  ja: 'ja',
  de: 'de',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  zh: 'zh-CN',
  ko: 'ko',
  ar: 'ar',
  hi: 'hi',
  ru: 'ru',
};

function resolveTarget(targetLang) {
  const raw = String(targetLang || 'en').trim();
  const lower = raw.toLowerCase();
  if (TARGET_LANGUAGES[lower]) return TARGET_LANGUAGES[lower];

  const byName = Object.entries(TARGET_LANGUAGES).find(
    ([code, mapped]) =>
      code === lower ||
      mapped.toLowerCase() === lower ||
      mapped.toLowerCase() === lower.replace('_', '-')
  );
  return byName ? byName[1] : raw;
}

async function translateViaGoogle(text, target) {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t` +
    `&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google translate unavailable (${res.status})`);
  }

  const data = await res.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map((part) => part?.[0] || '').join('')
    : '';

  if (!translated) {
    throw new Error('Empty Google translation');
  }

  return {
    translated,
    detected: data?.[2] || null,
    target,
  };
}

function pickTranslation(data, originalText) {
  const primary = data.responseData?.translatedText;
  const matches = Array.isArray(data.matches) ? data.matches : [];

  const neural = matches.find((m) =>
    m?.model === 'neural' ||
    String(m?.created_by || m?.['created-by'] || '').includes('MT')
  );

  const quality = Number(matches[0]?.quality);
  const topLooksBad =
    matches[0] &&
    (
      (Number.isFinite(quality) && quality < 50) ||
      (primary && primary.length > originalText.length * 3)
    );

  if (neural?.translation && topLooksBad) {
    return neural.translation;
  }

  if (primary) return primary;
  if (matches[0]?.translation) return matches[0].translation;
  return null;
}

async function translateViaMyMemory(text, target) {
  const url =
    `https://api.mymemory.translated.net/get` +
    `?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(`Autodetect|${target}`)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MyMemory unavailable (${res.status})`);
  }

  const data = await res.json();
  const translated = pickTranslation(data, text);
  if (data.responseStatus === 200 && translated) {
    return {
      translated,
      detected: data.responseData?.detectedLanguage || null,
      target,
    };
  }

  throw new Error(data.responseDetails || 'MyMemory translation failed');
}

async function translateText(text, targetLang) {
  const target = resolveTarget(targetLang);
  const original = String(text || '').trim();
  if (!original) {
    return { translated: original, detected: null, target };
  }

  try {
    return await translateViaGoogle(original, target);
  } catch {
    return translateViaMyMemory(original, target);
  }
}

async function translateMany(texts, targetLang) {
  const target = resolveTarget(targetLang);
  const settled = await Promise.all(
    texts.map(async (text) => {
      try {
        const result = await translateText(text, target);
        return { text, ...result, error: null };
      } catch (err) {
        return {
          text,
          translated: null,
          detected: null,
          target,
          error: err.message || 'Translation failed',
        };
      }
    })
  );

  return { target, results: settled };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text');
  const target = searchParams.get('target') || 'en';

  if (!text) {
    return NextResponse.json({ error: 'Missing "text" parameter' }, { status: 400 });
  }

  try {
    const result = await translateText(text, target);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const target = body.target || 'en';
    const texts = Array.isArray(body.texts)
      ? body.texts.map((t) => String(t || '').trim()).filter(Boolean)
      : body.text
        ? [String(body.text)]
        : [];

    if (texts.length === 0) {
      return NextResponse.json({ error: 'Missing "texts" or "text"' }, { status: 400 });
    }

    if (texts.length > 40) {
      return NextResponse.json({ error: 'Maximum 40 texts per request' }, { status: 400 });
    }

    const result = await translateMany(texts, target);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
