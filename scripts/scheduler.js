require('dotenv').config({ path: '.env.local' });

const { syncEvents } = require('./sync_events');

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

async function runSync(label) {
  console.log(`[${new Date().toISOString()}] ${label}`);
  try {
    const result = await syncEvents();
    console.log(`[scheduler] synced ${result.count} events via ${result.source}`);
  } catch (error) {
    console.error('[scheduler] sync failed:', error.message);
  }
}

console.log('SAP Events scheduler started (every 12 hours)');
console.log('Press Ctrl+C to stop.');

runSync('Initial sync on startup');
setInterval(() => {
  runSync('Scheduled 12-hour sync');
}, TWELVE_HOURS_MS);
