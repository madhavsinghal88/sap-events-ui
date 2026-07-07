export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { fetchAllSapEvents, mergeWithExistingStatuses } = require('../../../lib/sapFetcher');
const { hasGoogleCredentials, readEventsFromSheet, writeEventsToSheet } = require('../../../lib/googleSheets');

const DATA_PATH = path.join(process.cwd(), 'data/events.json');

export async function GET() {
  try {
    if (hasGoogleCredentials()) {
      const events = await readEventsFromSheet();
      return NextResponse.json(events);
    }
    const data = fs.readFileSync(DATA_PATH, 'utf8');
    return NextResponse.json(JSON.parse(data));
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
    return NextResponse.json({ error: 'Failed to update data: ' + error.message }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const existingEvents = hasGoogleCredentials()
      ? await readEventsFromSheet()
      : JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

    try {
      const fetchedEvents = await fetchAllSapEvents();
      const events = mergeWithExistingStatuses(fetchedEvents, existingEvents);
      
      if (hasGoogleCredentials()) {
        await writeEventsToSheet(events);
      } else {
        fs.writeFileSync(DATA_PATH, JSON.stringify(events, null, 2));
      }
      
      return NextResponse.json({ message: 'SAP sync complete', count: events.length, source: 'sap_api' });
    } catch (error) {
      return NextResponse.json({
        message: 'SAP API blocked from server. Use browser import instead.',
        count: existingEvents.length,
        source: 'local',
        hint: 'Run npm run print-import-script and paste it in the SAP finder console.',
        error: error.message,
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to refresh data: ' + error.message }, { status: 500 });
  }
}
