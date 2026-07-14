import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mapImportedPayload, mergeWithExistingStatuses } from '../../../../lib/sapFetcher';
import { normalizeEvents } from '../../../../lib/eventFormatters';
import { hasSupabaseCredentials, readEventsFromDb, writeEventsToDb } from '../../../../lib/supabase';

const DATA_PATH = path.join(process.cwd(), 'data/events.json');

async function readExistingEvents() {
  if (hasSupabaseCredentials()) {
    return await readEventsFromDb();
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return [];
  }
}

async function writeEvents(events) {
  if (hasSupabaseCredentials()) {
    await writeEventsToDb(events);
  } else {
    fs.writeFileSync(DATA_PATH, JSON.stringify(events, null, 2));
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const existingEvents = await readExistingEvents();
    const fetchedEvents = mapImportedPayload(payload);
    const events = normalizeEvents(mergeWithExistingStatuses(fetchedEvents, existingEvents));

    await writeEvents(events);

    return NextResponse.json({
      success: true,
      count: events.length,
      message: `Imported ${events.length} SAP events`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
