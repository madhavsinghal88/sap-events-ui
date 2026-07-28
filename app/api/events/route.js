export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';


import { hasSupabaseCredentials, readEventsFromDb, writeEventsToDb, readLastSyncFromDb } from '../../../lib/supabase';
import { normalizeEvents } from '../../../lib/eventFormatters';
import { syncEvents } from '../../../scripts/sync_events';

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
    const result = await syncEvents();
    const { sap = 0, gitex = 0, oracle = 0, globalAi = 0 } = result.sources || {};
    const message = result.source === 'sap_api'
      ? `Synced ${result.count} events (SAP ${sap}, GITEX ${gitex}, Oracle ${oracle}, Global AI ${globalAi}).`
      : `Partner sources synced; SAP API unavailable — kept ${sap} existing SAP events. Total ${result.count} (GITEX ${gitex}, Oracle ${oracle}, Global AI ${globalAi}).`;

    return NextResponse.json({
      message,
      count: result.count,
      source: result.source,
      sources: result.sources,
      lastSynced: result.lastSynced,
      hint: result.source === 'sap_api'
        ? undefined
        : 'SAP API blocked from this server (Akamai). Partner APIs (GITEX/Oracle/Global AI) were still refreshed. Use browser import for fresh SAP data.',
    });
  } catch (error) {
    const isReadOnly = error.code === 'EROFS' || error.message.includes('read-only') || error.message.includes('EROFS');
    const hint = isReadOnly
      ? 'Configure Supabase env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) in your Vercel project settings.'
      : error.message;

    return NextResponse.json({
      error: 'Failed to refresh data: ' + error.message,
      hint,
    }, { status: 500 });
  }
}
