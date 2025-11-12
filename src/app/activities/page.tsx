import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Activity = {
  id: string;
  start_time: string;
  distance_m: number;
  moving_time_s: number;
  avg_pace_s: number | null;
  avg_hr: number | null;
  elev_gain_m: number | null;
  type: string | null;
  shoe: string | null;
  notes: string | null;
  title: string | null;
  is_public: boolean;
  source: string | null;
};

const MILES_PER_METER = 1 / 1609.34;

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

const formatMiles = (distanceMeters: number) =>
  (distanceMeters * MILES_PER_METER).toFixed(2);

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];

  if (hrs) parts.push(`${hrs}h`);
  if (mins || hrs) parts.push(`${mins}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
};

const formatPace = (paceSeconds: number | null) => {
  if (paceSeconds === null || paceSeconds <= 0) {
    return '—';
  }

  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.round(paceSeconds % 60);

  return `${mins}:${secs.toString().padStart(2, '0')} /mi`;
};

async function fetchActivities(): Promise<Activity[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const response = await fetch(new URL('/api/public/activities', baseUrl), {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch public activities');
  }

  const { activities } = (await response.json()) as { activities?: Activity[] };
  return activities ?? [];
}

export default async function ActivitiesPage() {
  const activities = await fetchActivities();

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-background text-foreground">
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Start Time</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Title</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Miles</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Duration</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Pace</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Avg HR</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Elev (m)</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Type</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Shoe</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Notes</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Public</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activities.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-muted-foreground"
                    colSpan={12}
                  >
                    No public activities yet.
                  </td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(activity.start_time)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{activity.title ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatMiles(activity.distance_m)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDuration(activity.moving_time_s)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatPace(activity.avg_pace_s)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {activity.avg_hr !== null ? Math.round(activity.avg_hr) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {activity.elev_gain_m !== null ? Math.round(activity.elev_gain_m) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{activity.type ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{activity.shoe ?? '—'}</td>
                    <td className="max-w-xs px-4 py-3">
                      {activity.notes ? (
                        <span className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                          {activity.notes}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{activity.is_public ? 'Yes' : 'No'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{activity.source ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
