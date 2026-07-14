const fetch = globalThis.fetch || require('node-fetch');

function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#xD7;/gi, '×')
    .replace(/&#x2014;/gi, '—')
    .replace(/&#x126;/gi, 'Ħ')
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchGlobalAIEvents() {
  const res = await fetch('https://globalai.community/events/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Global AI events: ${res.statusText}`);
  }
  const html = await res.text();

  const events = [];
  const cardRegex = /<a\s+class="card card-link[^"]*"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const href = match[1];
    const cardHtml = match[2];

    const isExternal = cardHtml.includes('is-external') || match[0].includes('data-external-event="http');
    const link = isExternal
      ? (cardHtml.match(/data-external-event="([^"]+)"/)?.[1] || `https://globalai.community${href}`)
      : `https://globalai.community${href}`;

    const dateMatch = cardHtml.match(/<span class="card-date">([\s\S]*?)<\/span>/);
    const dateStr = dateMatch ? cleanHtml(dateMatch[1]) : '';

    const titleMatch = cardHtml.match(/<h3>([\s\S]*?)<\/h3>/);
    const title = titleMatch ? cleanHtml(titleMatch[1]) : '';

    const cmetaMatch = cardHtml.match(/<p class="cmeta">([\s\S]*?)<\/p>/);
    const cmeta = cmetaMatch ? cleanHtml(cmetaMatch[1]) : '';
    const locationParts = cmeta.split('·').map(s => s.trim());
    const location = locationParts.length > 1 ? locationParts[locationParts.length - 1] : (locationParts[0] || 'Online');

    let type = 'In-person';
    if (cardHtml.includes('chip-blue') && cardHtml.includes('Online')) {
      type = 'Virtual - Live';
    } else if (cardHtml.includes('Hybrid')) {
      type = 'Hybrid';
    }

    const idMatch = href.match(/\/e\/(.+)/);
    const id = idMatch ? idMatch[1] : href.replace(/[^a-z0-9]/gi, '-');

    if (!title) continue;

    events.push({
      id: `globalai-${id}`,
      title,
      date: dateStr,
      location,
      type,
      inPerson: type === 'In-person',
      virtualLive: type === 'Virtual - Live',
      virtualOnDemand: false,
      link,
      status: 'not_applied',
      company: 'Global AI'
    });
  }

  return events;
}

module.exports = { fetchGlobalAIEvents };
