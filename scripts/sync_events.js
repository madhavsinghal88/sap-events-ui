require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const {
  fetchAllSapEvents,
  mergeWithExistingStatuses,
} = require('../lib/sapFetcher');
const { fetchGitexEvents } = require('../lib/gitexFetcher');
const { fetchOracleEvents } = require('../lib/oracleFetcher');
const { fetchGlobalAIEvents } = require('../lib/globalaiFetcher');
const { normalizeEvents } = require('../lib/eventFormatters');
const {
  hasGoogleCredentials,
  readEventsFromSheet,
  writeEventsToSheet,
  writeLastSyncToSheet,
  getCredentialHelp,
} = require('../lib/googleSheets');

const DATA_PATH = path.join(process.cwd(), 'data/events.json');
const LAST_SYNC_PATH = path.join(process.cwd(), 'data/last_sync.json');

function writeLocalLastSync(timestamp) {
  try {
    fs.writeFileSync(LAST_SYNC_PATH, JSON.stringify({ lastSynced: timestamp }, null, 2));
  } catch (e) {
    console.warn(`Could not write last sync locally: ${e.message}`);
  }
}

function readLocalEvents() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function writeLocalEvents(events) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(events, null, 2));
}

function mergeEvents(localEvents, remoteEvents) {
  const statusById = new Map(
    [...localEvents, ...remoteEvents].map((event) => [String(event.id), event.status || 'not_applied'])
  );

  const byId = new Map();
  [...remoteEvents, ...localEvents].forEach((event) => {
    byId.set(String(event.id), {
      ...event,
      id: String(event.id),
      status: statusById.get(String(event.id)) || 'not_applied',
    });
  });

  return Array.from(byId.values()).sort((a, b) => Number(a.id) - Number(b.id));
}

async function syncEvents() {
  const useGoogle = hasGoogleCredentials();
  
  let existingEvents = [];
  if (useGoogle) {
    try {
      existingEvents = await readEventsFromSheet();
    } catch (error) {
      console.warn(`Could not read Google Sheet: ${error.message}`);
      existingEvents = readLocalEvents();
    }
  } else {
    existingEvents = readLocalEvents();
  }

  let fetchedEvents = [];
  let source = 'local';
  try {
    fetchedEvents = await fetchAllSapEvents();
    source = 'sap_api';
  } catch (error) {
    console.warn(`SAP API fetch failed: ${error.message}`);
    fetchedEvents = [];
  }

  // Fetch GITEX side events
  let gitexEvents = [];
  try {
    gitexEvents = await fetchGitexEvents();
    console.log(`Successfully fetched ${gitexEvents.length} GITEX events.`);
  } catch (error) {
    console.warn(`GITEX fetch failed: ${error.message}`);
    gitexEvents = existingEvents.filter(e => e.company === 'GITEX');
  }

  // Fetch Oracle events
  let oracleEvents = [];
  try {
    const fetchedOracle = await fetchOracleEvents();
    const existingOracle = existingEvents.filter(e => e.company === 'Oracle');
    const statusMap = new Map(existingOracle.map(e => [e.link || e.title, e.status || 'not_applied']));
    oracleEvents = fetchedOracle.map(event => ({
      ...event,
      status: statusMap.get(event.link || event.title) || 'not_applied'
    }));
    console.log(`Successfully fetched ${oracleEvents.length} Oracle events.`);
  } catch (error) {
    console.warn(`Oracle fetch failed: ${error.message}`);
    oracleEvents = existingEvents.filter(e => e.company === 'Oracle');
  }

  // Fetch Global AI events
  let globalaiEvents = [];
  try {
    const fetchedGlobalAI = await fetchGlobalAIEvents();
    const existingGlobalAI = existingEvents.filter(e => e.company === 'Global AI');
    const statusMap = new Map(existingGlobalAI.map(e => [e.link || e.title, e.status || 'not_applied']));
    globalaiEvents = fetchedGlobalAI.map(event => ({
      ...event,
      status: statusMap.get(event.link || event.title) || 'not_applied'
    }));
    console.log(`Successfully fetched ${globalaiEvents.length} Global AI events.`);
  } catch (error) {
    console.warn(`Global AI fetch failed: ${error.message}`);
    globalaiEvents = existingEvents.filter(e => e.company === 'Global AI');
  }

  let finalEvents = [];
  let sapEvents = [];
  if (source === 'sap_api') {
    sapEvents = mergeWithExistingStatuses(fetchedEvents, existingEvents.filter(e => !e.company || e.company === 'SAP'));
  } else {
    sapEvents = existingEvents.filter(e => !e.company || e.company === 'SAP');
  }

  const otherNonSapEvents = existingEvents.filter(e => e.company && e.company !== 'SAP' && e.company !== 'GITEX' && e.company !== 'Oracle' && e.company !== 'Global AI');
  finalEvents = normalizeEvents([...sapEvents, ...gitexEvents, ...oracleEvents, ...globalaiEvents, ...otherNonSapEvents]);

  const timestamp = new Date().toISOString();
  if (useGoogle) {
    try {
      await writeEventsToSheet(finalEvents);
      await writeLastSyncToSheet(timestamp);
    } catch (error) {
      console.error(`Google Sheets upload failed: ${error.message}`);
    }
  } else {
    writeLocalEvents(finalEvents);
    writeLocalLastSync(timestamp);
  }

  return { source, count: finalEvents.length };
}

if (require.main === module) {
  syncEvents()
    .then((result) => {
      console.log(`Sync complete (${result.source}): ${result.count} events`);
      if (result.source === 'local') {
        console.log('\nTo import live SAP data:');
        console.log('1. Open https://www.sap.com/india/events/finder.html');
        console.log('2. Open DevTools Console');
        console.log('3. Run: npm run print-import-script');
        console.log('4. Paste the printed script into the console');
      }
    })
    .catch((error) => {
      console.error('Sync failed:', error.message);
      process.exit(1);
    });
}

module.exports = { syncEvents };
