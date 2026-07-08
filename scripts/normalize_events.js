const fs = require('fs');
const path = require('path');
const { normalizeEvents } = require('../lib/eventFormatters');

const DATA_PATH = path.join(process.cwd(), 'data/events.json');

const events = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const normalized = normalizeEvents(events);

fs.writeFileSync(DATA_PATH, JSON.stringify(normalized, null, 2));
console.log(`Normalized ${normalized.length} events in data/events.json`);
