require('dotenv').config({ path: '.env.local' });

const { syncEvents } = require('./sync_events');

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function runSync(label) {
  console.log(`[${new Date().toISOString()}] ${label}`);
  try {
    const result = await syncEvents();
    console.log(`[scheduler] synced ${result.count} events via ${result.source}`);
  } catch (error) {
    console.error('[scheduler] sync failed:', error.message);
  }
}

console.log('SAP Events scheduler started (every 24 hours)');
console.log('Press Ctrl+C to stop.');

runSync('Initial sync on startup');
setInterval(() => {
  runSync('Scheduled 24-hour sync');
}, TWENTY_FOUR_HOURS_MS);
