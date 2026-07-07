require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const {
  fetchAllSapEvents,
  mergeWithExistingStatuses,
} = require('../lib/sapFetcher');
const {
  hasGoogleCredentials,
  readEventsFromSheet,
  writeEventsToSheet,
  getCredentialHelp,
} = require('../lib/googleSheets');

const DATA_PATH = path.join(process.cwd(), 'data/events.json');

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

  let finalEvents = [];
  if (source === 'sap_api') {
    finalEvents = mergeWithExistingStatuses(fetchedEvents, existingEvents);
  } else {
    finalEvents = existingEvents;
  }

  if (useGoogle) {
    try {
      await writeEventsToSheet(finalEvents);
    } catch (error) {
      console.error(`Google Sheets upload failed: ${error.message}`);
    }
  } else {
    writeLocalEvents(finalEvents);
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
