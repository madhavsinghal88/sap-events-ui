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
  
  // 1. Parse side events
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
      date: timing || 'April 2026',
      location: location || 'Singapore',
      link: link || 'https://gitexasia.com/side-events',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    });
  }

  // 2. Append co-located key flagship summits from the main homepage
  const coLocatedSummits = [
    {
      id: 'gitex-summit-main',
      title: 'GITEX AI ASIA 2027 (Flagship Summit)',
      date: '29–30 April 2027',
      location: 'Marina Bay Sands, Singapore',
      link: 'https://gitexasia.com/',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    },
    {
      id: 'gitex-summit-ai',
      title: 'AI Everything Singapore 2027',
      date: '29–30 April 2027',
      location: 'Marina Bay Sands, Singapore',
      link: 'https://gitexasia.com/aieverythingsingapore',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    },
    {
      id: 'gitex-summit-cyber',
      title: 'GISEC Asia 2027 (Cybersecurity CISO & CIO)',
      date: '29–30 April 2027',
      location: 'Marina Bay Sands, Singapore',
      link: 'https://gitexasia.com/gisec-asia',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    },
    {
      id: 'gitex-summit-datacenter',
      title: 'GITEX Global Data Centres Asia 2027',
      date: '29–30 April 2027',
      location: 'Marina Bay Sands, Singapore',
      link: 'https://gitexasia.com/global-data-centres-asia',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    },
    {
      id: 'gitex-summit-health',
      title: 'GITEX Digi Health & Biotech Singapore 2027',
      date: '29–30 April 2027',
      location: 'Marina Bay Sands, Singapore',
      link: 'https://gitexasia.com/gitexdigihealthsingapore',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    },
    {
      id: 'gitex-summit-quantum',
      title: 'GITEX Quantum Asia 2027',
      date: '29–30 April 2027',
      location: 'Marina Bay Sands, Singapore',
      link: 'https://gitexasia.com/quantum',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    },
    {
      id: 'gitex-summit-startups',
      title: 'North Star Asia 2027 (Startups & Supernova Challenge)',
      date: '29–30 April 2027',
      location: 'Marina Bay Sands, Singapore',
      link: 'https://gitexasia.com/startups',
      company: 'GITEX',
      type: 'In-person',
      status: 'not_applied'
    }
  ];

  events.push(...coLocatedSummits);
  return events;
}

module.exports = { fetchGitexEvents };
