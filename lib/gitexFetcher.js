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
    .replace(/<[^>]*>/g, '')
    .trim();
}

async function fetchGitexEvents() {
  const res = await fetch('https://gitexasia.com/side-events', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Gitex page: ${res.statusText}`);
  }
  const html = await res.text();
  
  const chunks = html.split('<div class="workBxv3">');
  const events = [];
  
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Title
    const titleMatch = chunk.match(/<h2>(.*?)<\/h2>/s);
    if (!titleMatch) continue;
    const title = cleanHtml(titleMatch[1]);
    
    // Timing
    const timingMatch = chunk.match(/<p class="worktiming26\s*">(.*?)<\/p>/s);
    const timing = timingMatch ? cleanHtml(timingMatch[1]) : '';
    
    // Location
    const locMatch = chunk.match(/<strong>Location<\/strong>\s*-\s*(.*?)</si) || chunk.match(/<strong>Location<\/strong>\s*(.*?)</si);
    let location = locMatch ? cleanHtml(locMatch[1]) : 'TBC';
    if (location.startsWith('-')) {
      location = location.substring(1).trim();
    }
    
    // Link
    const linkMatch = chunk.match(/href="([^"]+)"[^>]*class="[^"]*themeBtn25/i) || chunk.match(/class="[^"]*themeBtn25[^"]*"[^>]*href="([^"]+)"/i) || chunk.match(/href="([^"]+)"/i);
    let link = linkMatch ? linkMatch[1] : '';
    if (link && !link.startsWith('http')) {
      link = `https://gitexasia.com/${link}`;
    }
    
    events.push({
      id: `gitex-${i}`,
      title,
      date: timing,
      location,
      link: link || 'https://gitexasia.com/side-events',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    });
  }
  
  return events;
}

module.exports = { fetchGitexEvents };
