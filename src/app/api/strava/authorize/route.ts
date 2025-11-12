import { NextResponse } from 'next/server';

const STATE_TOKEN = 'drew-marathon';

export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  const scopes = process.env.STRAVA_SCOPES ?? '';

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing STRAVA_CLIENT_ID or STRAVA_REDIRECT_URI' },
      { status: 500 },
    );
  }

  const authorizeUrl = new URL('https://www.strava.com/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scopes);
  authorizeUrl.searchParams.set('approval_prompt', 'auto');
  authorizeUrl.searchParams.set('state', STATE_TOKEN);

  return NextResponse.redirect(authorizeUrl);
}
