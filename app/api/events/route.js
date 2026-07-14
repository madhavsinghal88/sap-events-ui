export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';


import { fetchAllSapEvents, mergeWithExistingStatuses } from '../../../lib/sapFetcher';
import { hasSupabaseCredentials, readEventsFromDb, writeEventsToDb, readLastSyncFromDb, writeLastSyncToDb } from '../../../lib/supabase';
import { normalizeEvents } from '../../../lib/eventFormatters';

const DATA_PATH = path.join(process.cwd(), 'data/events.json');
const LAST_SYNC_PATH = path.join(process.cwd(), 'data/last_sync.json');

export async function GET() {
  try {
    let lastSynced = null;
    let events = [];

    if (hasSupabaseCredentials()) {
      events = await readEventsFromDb();
      try {
        lastSynced = await readLastSyncFromDb();
      } catch (e) {
        console.warn('Failed to read last sync from Supabase:', e.message);
      }
    } else {
      const data = fs.readFileSync(DATA_PATH, 'utf8');
      events = JSON.parse(data);
      try {
        const syncData = JSON.parse(fs.readFileSync(LAST_SYNC_PATH, 'utf8'));
        lastSynced = syncData.lastSynced;
      } catch (e) {
        try {
          lastSynced = fs.statSync(DATA_PATH).mtime.toISOString();
        } catch {
          lastSynced = new Date().toISOString();
        }
      }
    }

    if (!lastSynced) {
      lastSynced = new Date().toISOString();
    }

    return NextResponse.json({ events: normalizeEvents(events), lastSynced });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read data: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { id, status } = await request.json();

    if (hasSupabaseCredentials()) {
      const data = await readEventsFromDb();
      const updatedData = data.map(event =>
        event.id === id ? { ...event, status } : event
      );
      await writeEventsToDb(updatedData);
      return NextResponse.json({ success: true });
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const updatedData = data.map(event =>
      event.id === id ? { ...event, status } : event
    );

    fs.writeFileSync(DATA_PATH, JSON.stringify(updatedData, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    const isReadOnly = error.code === 'EROFS' || error.message.includes('read-only') || error.message.includes('EROFS');
    const msg = isReadOnly
      ? "Cannot save updates. Configure Supabase env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) in your Vercel project settings."
      : error.message;
    return NextResponse.json({ error: 'Failed to update data: ' + msg }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const useSupabase = hasSupabaseCredentials();
    const existingEvents = useSupabase
      ? await readEventsFromDb()
      : JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

    try {
      const fetchedEvents = await fetchAllSapEvents();
      const nonSapEvents = existingEvents.filter(e => e.company && e.company !== 'SAP');
      const sapEvents = mergeWithExistingStatuses(fetchedEvents, existingEvents.filter(e => !e.company || e.company === 'SAP'));
      const events = normalizeEvents([...sapEvents, ...nonSapEvents]);

      const timestamp = new Date().toISOString();
      if (useSupabase) {
        await writeEventsToDb(events);
        await writeLastSyncToDb(timestamp);
      } else {
        fs.writeFileSync(DATA_PATH, JSON.stringify(events, null, 2));
        try {
          fs.writeFileSync(LAST_SYNC_PATH, JSON.stringify({ lastSynced: timestamp }, null, 2));
        } catch (e) {}
      }

      return NextResponse.json({ message: 'SAP sync complete', count: events.length, source: 'sap_api', lastSynced: timestamp });
    } catch (error) {
      const isReadOnly = error.code === 'EROFS' || error.message.includes('read-only') || error.message.includes('EROFS');
      const hint = isReadOnly
        ? `Configure Supabase env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) in your Vercel project settings.`
        : `SAP API request failed (${error.message}). Vercel cloud server IPs are protected/blocked by SAP's Akamai CDN firewall. Run a local sync (npm run sync) from your home/office network, or copy & run the browser import script.`;

      return NextResponse.json({
        message: isReadOnly ? 'Vercel filesystem is read-only.' : 'SAP API blocked from server. Use browser import instead.',
        count: existingEvents.length,
        source: 'local',
        hint,
        error: error.message,
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to refresh data: ' + error.message }, { status: 500 });
  }
}
