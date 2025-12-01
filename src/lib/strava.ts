// Swapped Strava helpers to use supabaseAdmin and support credential reuse.
import 'server-only';

import { supabaseAdmin } from '@/lib/db';

type StravaCredentialsRow = {
  athlete_id: number;
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string | null;
  expires_at: string;
};

type StravaRefreshResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number;
  scope?: string;
};

const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes

export async function getStravaCredentials(): Promise<StravaCredentialsRow> {
  const { data, error } = await supabaseAdmin
    .from('strava_credentials')
    .select('athlete_id, access_token, refresh_token, token_type, scope, expires_at')
    .limit(1)
    .single<StravaCredentialsRow>();

  if (error) {
    throw new Error(`Failed to load Strava credentials: ${error.message}`);
  }

  if (!data) {
    throw new Error('Strava credentials not found');
  }

  return data;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAtIso: string;
}> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET');
  }

  const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Strava token refresh failed: ${message || response.statusText}`);
  }

  const tokenJson = (await response.json()) as StravaRefreshResponse;
  const expiresAtIso = new Date(tokenJson.expires_at * 1000).toISOString();

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from('strava_credentials')
    .update({
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      token_type: tokenJson.token_type,
      scope: tokenJson.scope ?? null,
      expires_at: expiresAtIso,
    })
    .eq('refresh_token', refreshToken)
    .select('athlete_id');

  if (updateError) {
    throw new Error(`Failed to update Strava credentials: ${updateError.message}`);
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('No Strava credentials were updated during refresh.');
  }

  return {
    accessToken: tokenJson.access_token,
    expiresAtIso,
  };
}

export async function getValidAccessToken(
  existingCredentials?: StravaCredentialsRow,
): Promise<string> {
  const credentials = existingCredentials ?? (await getStravaCredentials());
  const expiresAtMs = Date.parse(credentials.expires_at);

  if (Number.isNaN(expiresAtMs) || expiresAtMs - TOKEN_REFRESH_BUFFER_MS <= Date.now()) {
    const refreshed = await refreshAccessToken(credentials.refresh_token);
    return refreshed.accessToken;
  }

  return credentials.access_token;
}

export type StravaSummaryActivity = {
  id: number;
  name: string;
  description?: string | null;
  start_date: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_heartrate?: number | null;
  type?: string | null;
  sport_type?: string | null;
};

type ActivityUpsertRow = {
  start_time: string;
  distance_m: number;
  moving_time_s: number;
  elev_gain_m: number;
  type: string;
  notes: string;
  title: string;
  source: 'strava';
  is_public: boolean;
  strava_activity_id: number;
  strava_athlete_id: number;
  avg_hr?: number;
};

export function mapStravaActivityToDbRow(
  activity: StravaSummaryActivity,
  athleteId: number,
): ActivityUpsertRow {
  const startTime = new Date(activity.start_date).toISOString();
  const preferredType =
    (activity.sport_type && activity.sport_type.trim()) ||
    (activity.type && activity.type.trim()) ||
    'Run';
  const description = typeof activity.description === 'string' ? activity.description.trim() : '';
  const notes = description.length > 0 ? description : activity.name;
  const title = activity.name;

  const row: ActivityUpsertRow = {
    start_time: startTime,
    distance_m: Math.round(activity.distance),
    moving_time_s: Math.round(activity.moving_time),
    elev_gain_m: Math.round(activity.total_elevation_gain),
    type: preferredType,
    notes,
    title,
    source: 'strava',
    is_public: false,
    strava_activity_id: activity.id,
    strava_athlete_id: athleteId,
  };

  if (activity.average_heartrate !== undefined && activity.average_heartrate !== null) {
    row.avg_hr = Math.round(activity.average_heartrate);
  }

  return row;
}
