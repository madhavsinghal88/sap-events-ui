const fetch = globalThis.fetch || require('node-fetch');
const { cleanHtml, normalizeEventTitle, formatEventDate, normalizeEvents } = require('./eventFormatters');

async function fetchOracleEvents() {
  const url = 'https://search-api.oracle.com/api/latest/qsearch';
  const payload = {
    experience: "events",
    q: "",
    size: 200,
    offset: 0,
    app: "eventsui",
    facets: [],
    get_aggs: true,
    detailed: false,
    show_all_facets_for: ["language_name", "industry", "event_type", "location"]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': 'https://search.oracle.com',
      'Referer': 'https://search.oracle.com/events?q='
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Oracle events: ${res.statusText}`);
  }

  const json = await res.json();
  const results = json.results || [];
  
  return normalizeEvents(results.map((result, idx) => {
    const item = result._source;
    const id = `oracle-${item.document_id || idx}`;
    
    // Determine event type
    let type = 'In-person';
    if (item.event_type && item.event_type.length > 0) {
      const typeName = item.event_type[0].name.toLowerCase();
      if (typeName.includes('virtual') || typeName.includes('webinar') || typeName.includes('webcast') || typeName.includes('online')) {
        type = 'Virtual - Live';
      } else if (typeName.includes('on-demand') || typeName.includes('ondemand')) {
        type = 'Virtual - On-demand';
      }
    }
    
    // Location mapping
    let location = 'Online';
    if (item.event_city && item.event_city.toLowerCase() !== 'webcast') {
      location = item.event_city;
      if (item.location && item.location.name && item.location.name.length > 0) {
        const parts = item.location.name[0].split('>');
        const country = parts[parts.length - 1].trim();
        location = `${location}, ${country}`;
      }
    } else if (item.location && item.location.name && item.location.name.length > 0) {
      const parts = item.location.name[0].split('>');
      const country = parts[parts.length - 1].trim();
      location = `Online - ${country}`;
    } else {
      location = 'Online';
    }

    let date = item.start_date || item.display_date || 'TBC';

    return {
      id,
      title: normalizeEventTitle(cleanHtml(item.title)),
      date: formatEventDate(date, item.display_url || ''),
      location,
      type,
      inPerson: type === 'In-person',
      virtualLive: type === 'Virtual - Live',
      virtualOnDemand: type === 'Virtual - On-demand',
      link: item.display_url || 'https://www.oracle.com/events/',
      status: 'not_applied',
      company: 'Oracle'
    };
  }));
}

module.exports = { fetchOracleEvents };
