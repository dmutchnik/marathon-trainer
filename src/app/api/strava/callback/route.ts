// Stored Strava OAuth credentials via supabaseAdmin to bypass RLS.
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/db';

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number;
  scope?: string;
  athlete: {
    id: number;
    username?: string | null;
    firstname?: string | null;
    lastname?: string | null;
  };
};

const redirectWithStatus = (path: string, origin: string) =>
  NextResponse.redirect(new URL(path, origin));

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const errorParam = requestUrl.searchParams.get('error');

  if (errorParam) {
    console.error('Strava authorization error:', errorParam);
    return redirectWithStatus('/?strava=error', requestUrl.origin);
  }

  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET' },
      { status: 500 },
    );
  }

  const tokenResponse = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const message = await tokenResponse.text();
    console.error('Strava token exchange failed:', message);
    return redirectWithStatus('/?strava=token_error', requestUrl.origin);
  }

  const tokenJson = (await tokenResponse.json()) as StravaTokenResponse;

  const expiresAtIso = new Date(tokenJson.expires_at * 1000).toISOString();

  const { error: upsertError } = await supabaseAdmin.from('strava_credentials').upsert(
    {
      athlete_id: tokenJson.athlete.id,
      athlete_username: tokenJson.athlete.username ?? null,
      athlete_firstname: tokenJson.athlete.firstname ?? null,
      athlete_lastname: tokenJson.athlete.lastname ?? null,
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      token_type: tokenJson.token_type,
      scope: tokenJson.scope ?? null,
      expires_at: expiresAtIso,
    },
    { onConflict: 'athlete_id' },
  );

  if (upsertError) {
    console.error('Failed to store Strava credentials:', upsertError);
    return redirectWithStatus('/?strava=store_error', requestUrl.origin);
  }

  return redirectWithStatus('/?strava=connected', requestUrl.origin);
}
