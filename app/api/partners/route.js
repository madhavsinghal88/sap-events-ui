import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const page = searchParams.get('page') || '0';
    const filter = searchParams.get('filter') || '';
    const order = searchParams.get('order') || 'bestmatch';

    // Construct URL with query parameters as separate query parameters
    const url = `https://partnerfinder.sap.com/sap/search/api/search/bm/results?q=${encodeURIComponent(q)}&qField=partner&pageSize=12&pageNumber=${page}&order=${order}${filter ? `&filter=${encodeURIComponent(filter)}` : ''}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 300 } // Cache results for 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch SAP Partner Finder: ${res.statusText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      partners: data.results || [],
      count: data.count || 0,
      distributions: data.distributions || {}
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
