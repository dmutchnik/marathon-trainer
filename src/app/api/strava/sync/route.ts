import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { supabase } from '@/lib/db';
import {
  StravaSummaryActivity,
  getStravaCredentials,
  getValidAccessToken,
  mapStravaActivityToDbRow,
} from '@/lib/strava';

type StravaDetailedActivity = {
  description?: string | null;
};

export async function POST(request: Request) {
  const authFailure = requireAdmin(request);

  if (authFailure) {
    return authFailure;
  }

  try {
    const accessToken = await getValidAccessToken();
    const credentials = await getStravaCredentials();

    const response = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=50',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const message = await response.text();
      console.error('Failed to fetch Strava activities:', message);
      throw new Error('Strava activities fetch failed');
    }

    const summaryActivities = (await response.json()) as StravaSummaryActivity[];
    const activities = await Promise.all(
      summaryActivities.map(async (activity) => {
        try {
          const detailResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activity.id}?include_all_efforts=false`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              cache: 'no-store',
            },
          );

          if (!detailResponse.ok) {
            const message = await detailResponse.text();
            console.error(`Failed to fetch Strava activity ${activity.id} detail:`, message);
            return {
              ...activity,
              description: activity.description ?? null,
            };
          }

          const detail = (await detailResponse.json()) as StravaDetailedActivity;

          return {
            ...activity,
            description: detail.description ?? activity.description ?? null,
          };
        } catch (detailError) {
          console.error(`Error enriching Strava activity ${activity.id}:`, detailError);
          return {
            ...activity,
            description: activity.description ?? null,
          };
        }
      }),
    );

    const rows = activities.map((activity) =>
      mapStravaActivityToDbRow(activity, credentials.athlete_id),
    );

    if (rows.length > 0) {
      const { error } = await supabase
        .from('activities')
        .upsert(rows, { onConflict: 'strava_activity_id' });

      if (error) {
        console.error('Failed to upsert Strava activities:', error);
        throw new Error('Strava upsert failed');
      }
    }

    return NextResponse.json({ imported: activities.length, upserted: rows.length }, { status: 200 });
  } catch (error) {
    console.error('Strava sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Strava activities' },
      { status: 500 },
    );
  }
}
