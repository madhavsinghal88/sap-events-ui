const fs = require('fs');
const path = require('path');
const { mapImportedPayload, mergeWithExistingStatuses } = require('../lib/sapFetcher');

const DATA_PATH = path.join(process.cwd(), 'data/events.json');
const payloadPath = process.argv[2] || path.join(process.cwd(), 'sap_payload.json');

function readExistingEvents() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function main() {
  if (!fs.existsSync(payloadPath)) {
    console.error(`Payload file not found: ${payloadPath}`);
    console.error('Copy the successful SAP Network response JSON into sap_payload.json, then rerun this command.');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const existingEvents = readExistingEvents();
  const fetchedEvents = mapImportedPayload(payload);
  const mergedEvents = mergeWithExistingStatuses(fetchedEvents, existingEvents);

  fs.writeFileSync(DATA_PATH, JSON.stringify(mergedEvents, null, 2));

  console.log(`Imported ${mergedEvents.length} SAP events into ${DATA_PATH}`);
}

main();
