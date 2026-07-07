export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { syncEvents } from '../../../scripts/sync_events';

export async function GET(request) {
  // Security check: Verify Vercel Cron authorization header to prevent unauthorized triggers
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncEvents();
    return NextResponse.json({
      success: true,
      message: 'Vercel Cron sync complete',
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Sync failed: ' + error.message },
      { status: 500 }
    );
  }
}
