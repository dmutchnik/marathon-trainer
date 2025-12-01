// Made admin dashboard dynamic and moved manual queries to supabaseAdmin.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

const resolveBaseUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const getNumberFromForm = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

type ManualActivity = {
  id: string;
  start_time: string;
  distance_m: number;
  title: string | null;
};

const MANUAL_MILES_DIVISOR = 1609.34;

const formatManualDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

async function getManualActivities(): Promise<ManualActivity[]> {
  const { data, error } = await supabaseAdmin
    .from('activities')
    .select('id, start_time, distance_m, title')
    .eq('source', 'manual')
    .order('start_time', { ascending: false })
    .limit(20);

  if (error || !data) {
    console.error('Failed to load manual activities:', error?.message);
    return [];
  }

  return data as ManualActivity[];
}

async function createActivity(formData: FormData) {
  'use server';

  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    throw new Error('Missing ADMIN_KEY environment variable.');
  }

  const startTime = formData.get('start_time');
  const milesValue = formData.get('miles');
  const minutesValue = formData.get('duration_minutes');
  const secondsValue = formData.get('duration_seconds');

  if (typeof startTime !== 'string' || !startTime.trim() || Number.isNaN(Date.parse(startTime))) {
    throw new Error('A valid start time is required.');
  }

  const miles = getNumberFromForm(milesValue);

  if (miles === undefined) {
    throw new Error('Miles is required.');
  }

  const minutes = getNumberFromForm(minutesValue) ?? 0;
  const seconds = getNumberFromForm(secondsValue) ?? 0;
  const movingTimeSeconds = Math.max(0, minutes * 60 + seconds);

  const avgHr = getNumberFromForm(formData.get('avg_hr'));
  const elevGainFt = getNumberFromForm(formData.get('elev_gain_ft'));
  const perceivedExertion = getNumberFromForm(formData.get('perceived_exertion'));

  const type = formData.get('type');
  const shoe = formData.get('shoe');
  const notes = formData.get('notes');
  const isPublic = formData.get('is_public') === 'on';

  const payload: Record<string, unknown> = {
    start_time: new Date(startTime).toISOString(),
    miles,
    moving_time_s: movingTimeSeconds,
    is_public: isPublic,
  };

  if (avgHr !== undefined) {
    payload.avg_hr = avgHr;
  }

  if (elevGainFt !== undefined) {
    payload.elev_gain_ft = elevGainFt;
  }

  if (perceivedExertion !== undefined) {
    payload.perceived_exertion = perceivedExertion;
  }

  if (typeof type === 'string' && type.trim()) {
    payload.type = type;
  }

  if (typeof shoe === 'string' && shoe.trim()) {
    payload.shoe = shoe;
  }

  if (typeof notes === 'string' && notes.trim()) {
    payload.notes = notes;
  }

  const response = await fetch(new URL('/api/admin/activities', resolveBaseUrl()), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to create activity.');
  }

  revalidatePath('/admin');
  revalidatePath('/activities');
  redirect('/admin');
}

async function syncStrava() {
  'use server';

  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    throw new Error('Missing ADMIN_KEY environment variable.');
  }

  const baseUrl = resolveBaseUrl();
  const response = await fetch(new URL('/api/strava/sync', baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Strava sync failed:', body);
    throw new Error('Failed to sync Strava activities.');
  }

  revalidatePath('/activities');
}

async function deleteManualActivity(formData: FormData) {
  'use server';

  const rawId = formData.get('id');
  console.log('[admin] deleteManualActivity raw id:', rawId); // Log the submitted id for debugging

  if (typeof rawId !== 'string') {
    throw new Error('Activity id is required.');
  }

  const id = rawId.trim();

  if (!id || id === 'undefined') {
    throw new Error('Activity id is missing from delete request.');
  }

  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    throw new Error('Missing ADMIN_KEY environment variable.');
  }

  const baseUrl = resolveBaseUrl();
  const targetUrl = new URL(`/api/admin/activities/${id}`, baseUrl);
  console.log('[admin] deleteManualActivity fetch URL:', targetUrl.toString()); // Log target URL

  const response = await fetch(targetUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Delete manual activity failed:', body);
    throw new Error(body || 'Failed to delete manual activity.');
  }

  revalidatePath('/admin');
  revalidatePath('/activities');
}

export default async function AdminPage() {
  const manualActivities = await getManualActivities();

  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-3xl bg-background text-foreground">
        <CardHeader>
          <CardTitle>Create Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createActivity} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input id="start_time" name="start_time" type="datetime-local" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="miles">Miles</Label>
              <Input
                id="miles"
                name="miles"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration_minutes">Duration (Minutes)</Label>
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration_seconds">Duration (Seconds)</Label>
              <Input
                id="duration_seconds"
                name="duration_seconds"
                type="number"
                min="0"
                max="59"
                step="1"
                inputMode="numeric"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="avg_hr">Average HR</Label>
              <Input id="avg_hr" name="avg_hr" type="number" min="0" step="1" inputMode="numeric" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="elev_gain_ft">Elevation Gain (ft)</Label>
              <Input
                id="elev_gain_ft"
                name="elev_gain_ft"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <Input id="type" name="type" type="text" placeholder="Run" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="shoe">Shoe</Label>
              <Input id="shoe" name="shoe" type="text" placeholder="Nike Pegasus" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="perceived_exertion">Perceived Exertion</Label>
              <Input
                id="perceived_exertion"
                name="perceived_exertion"
                type="number"
                min="0"
                max="10"
                step="1"
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Input id="is_public" name="is_public" type="checkbox" className="h-4 w-4" defaultChecked />
              <Label htmlFor="is_public" className="text-muted-foreground">
                Public
              </Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full md:w-auto">
                Save Activity
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="w-full max-w-3xl bg-background text-foreground">
        <CardHeader>
          <CardTitle>Sync Strava</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={syncStrava} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pull the most recent Strava workouts into your activities list.
            </p>
            <Button type="submit">Sync Strava</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="w-full max-w-3xl bg-background text-foreground">
        <CardHeader>
          <CardTitle>Manual activities</CardTitle>
        </CardHeader>
        <CardContent>
          {manualActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No manual activities yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2 text-left font-medium">Date</th>
                    <th className="whitespace-nowrap px-4 py-2 text-left font-medium">Title</th>
                    <th className="whitespace-nowrap px-4 py-2 text-left font-medium">Miles</th>
                    <th className="whitespace-nowrap px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {manualActivities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-muted/20">
                      <td className="whitespace-nowrap px-4 py-2">{formatManualDate(activity.start_time)}</td>
                      <td className="whitespace-nowrap px-4 py-2">{activity.title ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {(activity.distance_m / MANUAL_MILES_DIVISOR).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/activities/${activity.id}`}>
                            <Button type="button" variant="secondary" size="sm">
                              Edit
                            </Button>
                          </Link>
                          <form action={deleteManualActivity}>
                            <input type="hidden" name="id" value={activity.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Delete
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
