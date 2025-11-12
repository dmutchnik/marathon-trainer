import { NextResponse } from 'next/server';

import { getValidAccessToken } from '@/lib/strava';

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();

    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Strava athlete API error:', errorBody);
      return NextResponse.json({ error: 'Failed to fetch Strava athlete' }, { status: 502 });
    }

    const athlete = await response.json();
    return NextResponse.json({ athlete }, { status: 200 });
  } catch (error) {
    console.error('Strava test route error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
