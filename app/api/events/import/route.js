import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mapImportedPayload, mergeWithExistingStatuses } from '../../../../lib/sapFetcher';

const DATA_PATH = path.join(process.cwd(), 'data/events.json');

function readExistingEvents() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return [];
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const existingEvents = readExistingEvents();
    const fetchedEvents = mapImportedPayload(payload);
    const events = mergeWithExistingStatuses(fetchedEvents, existingEvents);

    fs.writeFileSync(DATA_PATH, JSON.stringify(events, null, 2));

    return NextResponse.json({
      success: true,
      count: events.length,
      message: `Imported ${events.length} SAP events`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
