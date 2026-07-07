const fetch = globalThis.fetch || require('node-fetch');

const FINDER_URL = 'https://www.sap.com/india/events/finder.html?sort=events_upcoming&tab=explore-all-events';
const SOLR_URL = 'https://www.sap.com/bin/sapdx/solrsearch';
const COMPONENT_PATH =
  '/content/sapdx/languages/en_gb/events/finder/jcr:content/par/section_copy/section-par/resourcecenterdynamic/items/item_1673474660774';
const PAGE_PATH = '/content/sapdx/languages/en_gb/events/finder';
const ORIGINAL_PATH = '/content/sapdx/countries/en_in/events/finder';
const TARGET_PATH = '/content/sapdx/languages/en_gb/events/finder';
const PAGE_LOCALE = 'en_in';
const PAGE_SIZE = 60;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json;charset=utf-8',
  Referer: FINDER_URL,
  Origin: 'https://www.sap.com',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function normalizeLink(publicUrl) {
  if (!publicUrl) return 'https://www.sap.com/india/events/finder.html';
  if (publicUrl.startsWith('//')) return `https:${publicUrl}.html`;
  if (publicUrl.startsWith('http')) return publicUrl.endsWith('.html') ? publicUrl : `${publicUrl}.html`;
  return `https://www.sap.com${publicUrl}.html`;
}

function slugToTitle(publicUrl) {
  const slug = publicUrl
    .replace(/^\/\/www\.sap\.com/, '')
    .replace(/^\/[^/]+/, '')
    .replace(/^\/events\//, '')
    .replace(/\.html$/, '');

  const parts = slug.split('-');
  const content = parts.slice(4).join('-') || parts.join('-');
  return content
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractDateFromUrl(publicUrl) {
  const match = publicUrl.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

function regionFromUrl(publicUrl) {
  const match = publicUrl.match(/^\/([^/]+)\/events\//);
  if (!match) return 'Global';
  const region = match[1].replace(/-/g, ' ');
  return region.charAt(0).toUpperCase() + region.slice(1);
}

function mapType(item) {
  const tagsStr = JSON.stringify(item.tags || []).toLowerCase();
  const hasInPersonTag = tagsStr.includes('86d47623-3620-4616-9f58-41d4144a8ea4');
  const hasVirtualLiveTag = tagsStr.includes('a423521a-6e0f-499e-b2aa-b04da9b58675');
  const hasOnDemandTag = tagsStr.includes('3222fa4c-d612-4c62-b047-b00f89ca5a8d');

  // 1. If it has BOTH In-Person and Virtual-Live tags, it is a Hybrid event!
  if (hasInPersonTag && hasVirtualLiveTag) return 'Hybrid';

  const eventTypeInfo = String(item.eventTypeInfo || '').toLowerCase();
  // 2. Check eventTypeInfo for explicit hybrid keyword
  if (eventTypeInfo.includes('hybrid')) return 'Hybrid';

  // 3. Check for Virtual - On-demand
  if (hasOnDemandTag || eventTypeInfo.includes('on demand') || eventTypeInfo.includes('on-demand')) {
    return 'Virtual - On-demand';
  }

  // 4. Check for Virtual - Live
  if (hasVirtualLiveTag || eventTypeInfo.includes('online') || eventTypeInfo.includes('virtual') || eventTypeInfo.includes('webinar')) {
    return 'Virtual - Live';
  }
  
  // 5. Check for In-person
  if (hasInPersonTag || (eventTypeInfo.trim() && eventTypeInfo.replace(/[^a-zA-Z]/g, '').length > 2)) {
    return 'In-person';
  }

  // 6. Fallbacks based on URL pattern
  const format = String(item.format || item.docType || '').toLowerCase();
  const url = String(item.publicUrl || '').toLowerCase();

  if (format.includes('on-demand') || url.includes('on-demand')) return 'Virtual - On-demand';
  if (format.includes('virtual') || format.includes('online') || url.includes('-online-')) {
    return 'Virtual - Live';
  }
  if (format.includes('hybrid') || url.includes('-hybrid-')) return 'Hybrid';
  if (format.includes('in-person') || url.includes('-in-person-')) return 'In-person';

  return 'Virtual - Live';
}

function mapLocation(item) {
  if (item.location) return item.location;

  const eventTypeInfo = String(item.eventTypeInfo || '').trim();
  const url = String(item.publicUrl || '').toLowerCase();
  const type = mapType(item);

  // If it's a hybrid event, extract the physical location details if possible
  if (type === 'Hybrid' && eventTypeInfo) {
    const parts = eventTypeInfo.split(/\s+and\s+/i);
    const physicalPart = parts.find(p => !p.toLowerCase().includes('online') && !p.toLowerCase().includes('live') && !p.toLowerCase().includes('virtual'));
    if (physicalPart) {
      const cleanPhys = physicalPart.replace(/\s*\|\s*$/, '').trim();
      if (cleanPhys.length > 2) {
        return `${cleanPhys} (Hybrid)`;
      }
    }
    const region = regionFromUrl(item.publicUrl || '');
    return region === 'Global' ? 'Hybrid' : `${region} (Hybrid)`;
  }

  // If it's a virtual event
  if (url.includes('-online-') || url.includes('-virtual-') || url.includes('-webinar-') || eventTypeInfo.toLowerCase().includes('online')) {
    const region = regionFromUrl(item.publicUrl || '');
    return region === 'Global' ? 'Online' : `Online - ${region}`;
  }

  // If it's in-person and eventTypeInfo has city/country details (e.g. "Zürich, Switzerland | ")
  if (eventTypeInfo) {
    const cleanLocation = eventTypeInfo.replace(/\s*\|\s*$/, '').trim();
    if (cleanLocation.length > 2) {
      return cleanLocation;
    }
  }

  const region = regionFromUrl(item.publicUrl || '');
  if (region !== 'Global') return region;

  if (item.description && !item.description.includes('http') && item.description.length < 80) {
    return item.description;
  }

  return 'Online';
}

function formatPubDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function mapSapResult(item, index) {
  const publicUrl = item.publicUrl || item.url || '';
  return {
    id: String(index + 1),
    title: item.title || slugToTitle(publicUrl),
    date: formatPubDate(item.eventDates || item.startDate || item.pubDate || item.publishDate) || extractDateFromUrl(publicUrl),
    location: mapLocation(item),
    type: mapType(item),
    link: normalizeLink(publicUrl),
    status: 'not_applied',
    sapId: item.crxPath || publicUrl,
  };
}

async function getFinderCookie() {
  const response = await fetch(FINDER_URL, {
    headers: {
      'User-Agent': BROWSER_HEADERS['User-Agent'],
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (response.headers.raw?.()['set-cookie'] || []);

  const cookies = setCookies
    .map((entry) => entry.split(';')[0])
    .join('; ');

  return cookies;
}

async function fetchSolrPage(page, cookie, componentPath = COMPONENT_PATH) {
  const params = new URLSearchParams({
    showEmptyTags: 'false',
    isResourceCenter: 'true',
    highlighting: 'false',
    hideFacets: 'false',
    additionalProcess: 'false',
    showEventInfo: 'true',
    isDateRange: 'true',
    isEventPeriod: 'false',
    fuzzySearch: 'false',
    isFullTextSearch: 'false',
    originalPath: ORIGINAL_PATH,
    targetPath: TARGET_PATH,
    pageLocale: PAGE_LOCALE,
    json: JSON.stringify({
      componentPath: componentPath,
      search: [],
      pagePath: PAGE_PATH,
      page,
      pageCount: PAGE_SIZE,
      sortName: 'startDate',
      sortType: 'asc',
      isMultiselectSearch: false,
    }),
  });

  const url = `${SOLR_URL}?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...BROWSER_HEADERS,
      Cookie: cookie,
      Accept: '*/*',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SAP search failed (${response.status}): ${text.slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`SAP search returned non-JSON: ${text.slice(0, 200)}`);
  }

  return data;
}

async function fetchComponentEvents(componentPath, cookie) {
  const firstPage = await fetchSolrPage(1, cookie, componentPath);
  const total = firstPage.count || firstPage.results?.length || 0;
  const allResults = [...(firstPage.results || [])];

  const totalPages = Math.ceil(total / PAGE_SIZE);
  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchSolrPage(page, cookie, componentPath);
    allResults.push(...(nextPage.results || []));
  }
  return allResults;
}

async function fetchAllSapEvents() {
  const cookie = await getFinderCookie();
  
  const EXPLORE_PATH = '/content/sapdx/languages/en_gb/events/finder/jcr:content/par/section_copy/section-par/resourcecenterdynamic/items/item_1673474660774';
  const IN_PERSON_PATH = '/content/sapdx/languages/en_gb/events/finder/jcr:content/par/section_copy/section-par/resourcecenterdynamic/items/item_1585212917036';
  const VIRTUAL_LIVE_PATH = '/content/sapdx/languages/en_gb/events/finder/jcr:content/par/section_copy/section-par/resourcecenterdynamic/items/item_1672859668861';
  const ON_DEMAND_PATH = '/content/sapdx/languages/en_gb/events/finder/jcr:content/par/section_copy/section-par/resourcecenterdynamic/items/item_1672859692626';

  console.log('Fetching Explore events...');
  const exploreEvents = await fetchComponentEvents(EXPLORE_PATH, cookie);
  
  console.log('Fetching In-Person events...');
  const inPersonEvents = await fetchComponentEvents(IN_PERSON_PATH, cookie);

  console.log('Fetching Virtual Live events...');
  const virtualLiveEvents = await fetchComponentEvents(VIRTUAL_LIVE_PATH, cookie);

  console.log('Fetching On-Demand events...');
  const onDemandEvents = await fetchComponentEvents(ON_DEMAND_PATH, cookie);

  // Merge by unique publicUrl/crxPath
  const uniqueMap = new Map();
  
  const getEventEntry = (item) => {
    const key = item.publicUrl || item.url || item.crxPath;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        item,
        inPerson: false,
        virtualLive: false,
        virtualOnDemand: false
      });
    }
    return uniqueMap.get(key);
  };

  inPersonEvents.forEach(item => {
    getEventEntry(item).inPerson = true;
  });

  virtualLiveEvents.forEach(item => {
    getEventEntry(item).virtualLive = true;
  });

  onDemandEvents.forEach(item => {
    getEventEntry(item).virtualOnDemand = true;
  });

  exploreEvents.forEach(item => {
    getEventEntry(item);
  });

  const mergedResults = Array.from(uniqueMap.values()).map((entry, index) => {
    const mapped = mapSapResult(entry.item, index);
    mapped.inPerson = entry.inPerson;
    mapped.virtualLive = entry.virtualLive;
    mapped.virtualOnDemand = entry.virtualOnDemand;

    if (entry.inPerson && entry.virtualLive) {
      mapped.type = 'Hybrid';
    } else if (entry.inPerson) {
      mapped.type = 'In-person';
    } else if (entry.virtualLive) {
      mapped.type = 'Virtual - Live';
    } else if (entry.virtualOnDemand) {
      mapped.type = 'Virtual - On-demand';
    } else {
      mapped.type = mapType(entry.item);
    }
    return mapped;
  });

  return mergedResults;
}

function mapImportedPayload(payload) {
  const results = Array.isArray(payload)
    ? payload
    : payload?.results || payload?.data?.results || [];

  if (!results.length) {
    throw new Error('No SAP results found in import payload');
  }

  return results.map(mapSapResult);
}

function mergeWithExistingStatuses(fetchedEvents, existingEvents = []) {
  const statusByKey = new Map(
    existingEvents.map((event) => [
      event.sapId || event.link || event.title,
      event.status || 'not_applied',
    ])
  );

  return fetchedEvents.map((event, index) => ({
    ...event,
    id: String(index + 1),
    status: statusByKey.get(event.sapId || event.link || event.title) || 'not_applied',
  }));
}

module.exports = {
  fetchAllSapEvents,
  mapImportedPayload,
  mergeWithExistingStatuses,
  mapSapResult,
  BROWSER_IMPORT_SCRIPT: `(async () => {
  const PAGE_SIZE = 60;
  const COMPONENT_PATH = '${COMPONENT_PATH}';
  const PAGE_PATH = '${PAGE_PATH}';
  const ORIGINAL_PATH = '${ORIGINAL_PATH}';
  const TARGET_PATH = '${TARGET_PATH}';
  const PAGE_LOCALE = '${PAGE_LOCALE}';

  const bodyFor = (page) => ({
    componentPath: COMPONENT_PATH,
    search: [],
    pagePath: PAGE_PATH,
    page,
    pageCount: PAGE_SIZE,
    sortName: 'startDate',
    sortType: 'asc',
    isMultiselectSearch: false
  });

  const fetchPage = async (page) => {
    const params = new URLSearchParams({
      showEmptyTags: 'false',
      isResourceCenter: 'true',
      highlighting: 'false',
      hideFacets: 'false',
      additionalProcess: 'false',
      showEventInfo: 'true',
      isDateRange: 'true',
      isEventPeriod: 'false',
      fuzzySearch: 'false',
      isFullTextSearch: 'false',
      originalPath: ORIGINAL_PATH,
      targetPath: TARGET_PATH,
      pageLocale: PAGE_LOCALE,
      json: JSON.stringify(bodyFor(page))
    });
    return fetch('/bin/sapdx/solrsearch?' + params.toString()).then(r => r.json());
  };

  const first = await fetchPage(1);
  const results = [...(first.results || [])];
  const pages = Math.ceil((first.count || 0) / PAGE_SIZE);
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchPage(page);
    results.push(...(next.results || []));
  }

  const payload = { count: first.count, results };
  const importUrl = 'http://localhost:8881/api/events/import';
  const response = await fetch(importUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  console.log('Imported', data.count, 'events into SAP Events UI');
  return data;
})();`,
};
