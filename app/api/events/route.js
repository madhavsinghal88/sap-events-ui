export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';


import { fetchAllSapEvents, mergeWithExistingStatuses } from '../../../lib/sapFetcher';
import { hasGoogleCredentials, readEventsFromSheet, writeEventsToSheet, readLastSyncFromSheet, writeLastSyncToSheet } from '../../../lib/googleSheets';

const DATA_PATH = path.join(process.cwd(), 'data/events.json');
const LAST_SYNC_PATH = path.join(process.cwd(), 'data/last_sync.json');

export async function GET() {
  try {
    let lastSynced = null;
    let events = [];

    if (hasGoogleCredentials()) {
      events = await readEventsFromSheet();
      try {
        lastSynced = await readLastSyncFromSheet();
      } catch (e) {
        console.warn('Failed to read last sync from Sheet:', e.message);
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

    return NextResponse.json({ events, lastSynced });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read data: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { id, status } = await request.json();
    
    if (hasGoogleCredentials()) {
      const data = await readEventsFromSheet();
      const updatedData = data.map(event =>
        event.id === id ? { ...event, status } : event
      );
      await writeEventsToSheet(updatedData);
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
      ? "Cannot save updates because Vercel's filesystem is read-only. Please configure Google Sheets in your Vercel project environment settings to enable status tracking."
      : error.message;
    return NextResponse.json({ error: 'Failed to update data: ' + msg }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const useGoogle = hasGoogleCredentials();
    const existingEvents = useGoogle
      ? await readEventsFromSheet()
      : JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

    try {
      const fetchedEvents = await fetchAllSapEvents();
      const events = mergeWithExistingStatuses(fetchedEvents, existingEvents);
      
      const timestamp = new Date().toISOString();
      if (useGoogle) {
        await writeEventsToSheet(events);
        await writeLastSyncToSheet(timestamp);
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
        ? `Vercel's filesystem is read-only. Please configure Google Sheets environment variables (GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID) in your Vercel project settings to enable server-side updates.`
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
