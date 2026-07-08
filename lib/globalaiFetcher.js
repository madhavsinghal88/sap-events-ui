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
  
  const days = html.split('<div class="gai-day">');
  const events = [];
  
  for (let i = 1; i < days.length; i++) {
    const dayBlock = days[i].split('<div class="gai-day">')[0];
    
    const dayNumMatch = dayBlock.match(/<div class="gai-day-num">(\d+)<\/div>/);
    const dayNum = dayNumMatch ? dayNumMatch[1] : '';
    
    const monthMatch = dayBlock.match(/<div class="gai-day-month[^"]*">([\s\S]*?)<\/div>/);
    const monthYear = monthMatch ? cleanHtml(monthMatch[1]) : '';
    
    const dateString = `${dayNum} ${monthYear}`;
    
    const eventCards = dayBlock.split('<a href="/e/');
    for (let j = 1; j < eventCards.length; j++) {
      const card = eventCards[j];
      
      const linkMatch = card.match(/^([^"]+)"/);
      const linkPath = linkMatch ? linkMatch[1] : '';
      const link = `https://globalai.community/e/${linkPath}`;
      
      const titleMatch = card.match(/<h3 class="gai-event-title">([\s\S]*?)<\/h3>/);
      const title = titleMatch ? cleanHtml(titleMatch[1]) : '';
      
      const timeMatch = card.match(/<div class="gai-event-time">([\s\S]*?)<\/div>/);
      const timeStr = timeMatch ? cleanHtml(timeMatch[1]) : '';
      
      const locMatch = card.match(/<span class="gai-event-location">([\s\S]*?)<\/span>/);
      const location = locMatch ? cleanHtml(locMatch[1]) : 'Online';
      
      let type = 'In-person';
      if (card.includes('gai-tag-online') || location.toLowerCase() === 'online') {
        type = 'Virtual - Live';
      }
      
      events.push({
        id: `globalai-${linkPath}`,
        title,
        date: `${dateString} | ${timeStr}`,
        location,
        type,
        inPerson: type === 'In-person',
        virtualLive: type === 'Virtual - Live',
        virtualOnDemand: type === 'Virtual - On-demand',
        link,
        status: 'not_applied',
        company: 'Global AI'
      });
    }
  }
  
  return events;
}

module.exports = { fetchGlobalAIEvents };
