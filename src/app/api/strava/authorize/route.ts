// Added STRAVA redirect URI validation to avoid misconfiguration in prod.
import { NextResponse } from 'next/server';

const STATE_TOKEN = 'drew-marathon';

export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  const scopes = process.env.STRAVA_SCOPES ?? '';

  if (!clientId) {
    return NextResponse.json({ error: 'Missing STRAVA_CLIENT_ID' }, { status: 500 });
  }

  const expectedProdRedirect = 'https://marathon-trainer-gamma.vercel.app/api/strava/callback';

  if (!redirectUri) {
    return NextResponse.json(
      { error: `Missing STRAVA_REDIRECT_URI. Expected ${expectedProdRedirect}` },
      { status: 500 },
    );
  }

  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  if (isProd && redirectUri.includes('localhost')) {
    return NextResponse.json(
      { error: `STRAVA_REDIRECT_URI must be ${expectedProdRedirect} in production` },
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
