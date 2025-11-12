import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/db';

const resolveBaseUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const METERS_PER_MILE = 1609.34;
const FEET_PER_METER = 3.28084;

type ManualActivityDetail = {
  id: string;
  start_time: string;
  distance_m: number;
  moving_time_s: number;
  avg_hr: number | null;
  elev_gain_m: number | null;
  type: string | null;
  shoe: string | null;
  notes: string | null;
  title: string | null;
  is_public: boolean;
  perceived_exertion: number | null;
};

const formatDateTimeLocal = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const tzOffset = date.getTimezoneOffset() * 60000;
  const localISOTime = new Date(date.getTime() - tzOffset).toISOString();
  return localISOTime.slice(0, 16);
};

const toFixedOrEmpty = (value: number | null | undefined, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return value.toFixed(digits);
};

type EditManualActivityPageProps = {
  params: {
    id: string;
  } | Promise<{ id: string }>;
};

export default async function EditManualActivityPage({ params }: EditManualActivityPageProps) {
  const resolvedParams = await params;
  const activityId = resolvedParams.id;

  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, start_time, distance_m, moving_time_s, avg_hr, elev_gain_m, type, shoe, notes, title, is_public, perceived_exertion',
    )
    .eq('id', activityId)
    .eq('source', 'manual')
    .single<ManualActivityDetail>();

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-xl bg-background text-foreground">
          <CardHeader>
            <CardTitle>Activity not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t find the manual activity you&apos;re trying to edit.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const startTimeDefault = formatDateTimeLocal(data.start_time);
  const milesDefault = toFixedOrEmpty(data.distance_m / METERS_PER_MILE);
  const durationMinutes = Math.floor((data.moving_time_s ?? 0) / 60);
  const durationSeconds = Math.max((data.moving_time_s ?? 0) % 60, 0);
  const avgHrDefault = data.avg_hr ?? '';
  const elevGainFtDefault =
    data.elev_gain_m !== null && data.elev_gain_m !== undefined
      ? toFixedOrEmpty(data.elev_gain_m * FEET_PER_METER, 0)
      : '';
  const perceivedExertionDefault = data.perceived_exertion ?? '';

  async function updateManualActivity(formData: FormData) {
    'use server';

    const adminKey = process.env.ADMIN_KEY;

    if (!adminKey) {
      throw new Error('Missing ADMIN_KEY environment variable.');
    }

    const startTime = formData.get('start_time');
    if (typeof startTime !== 'string' || !startTime.trim()) {
      throw new Error('Start time is required.');
    }

    const milesInput = formData.get('miles');
    const miles = typeof milesInput === 'string' ? parseFloat(milesInput) : NaN;

    if (!Number.isFinite(miles)) {
      throw new Error('Miles is required.');
    }

    const minutesInput = formData.get('duration_minutes');
    const secondsInput = formData.get('duration_seconds');
    const minutes =
      typeof minutesInput === 'string' && minutesInput.trim() ? parseInt(minutesInput, 10) : 0;
    const seconds =
      typeof secondsInput === 'string' && secondsInput.trim() ? parseInt(secondsInput, 10) : 0;
    const movingTimeSeconds = Math.max(0, minutes * 60 + seconds);

    const avgHrValue = formData.get('avg_hr');
    const elevGainFtValue = formData.get('elev_gain_ft');
    const typeValue = formData.get('type');
    const shoeValue = formData.get('shoe');
    const perceivedExertionValue = formData.get('perceived_exertion');
    const notesValue = formData.get('notes');
    const titleValue = formData.get('title');
    const isPublicValue = formData.get('is_public');

    const payload: Record<string, unknown> = {
      start_time: new Date(startTime).toISOString(),
      miles,
      moving_time_s: movingTimeSeconds,
    };

    if (typeof avgHrValue === 'string' && avgHrValue.trim()) {
      const avgHr = Number(avgHrValue);
      if (!Number.isNaN(avgHr)) {
        payload.avg_hr = avgHr;
      }
    }

    if (typeof elevGainFtValue === 'string' && elevGainFtValue.trim()) {
      const elevFt = Number(elevGainFtValue);
      if (!Number.isNaN(elevFt)) {
        payload.elev_gain_ft = elevFt;
      }
    }

    if (typeof typeValue === 'string') {
      payload.type = typeValue.trim() || null;
    }

    if (typeof shoeValue === 'string') {
      payload.shoe = shoeValue.trim() || null;
    }

    if (typeof perceivedExertionValue === 'string') {
      const trimmed = perceivedExertionValue.trim();
      if (trimmed) {
        const perceived = Number(trimmed);
        if (!Number.isNaN(perceived)) {
          payload.perceived_exertion = perceived;
        }
      } else {
        payload.perceived_exertion = null;
      }
    }

    if (typeof notesValue === 'string') {
      payload.notes = notesValue;
    }

    if (typeof titleValue === 'string') {
      payload.title = titleValue.trim() || null;
    }

    payload.is_public = isPublicValue === 'on';

    const baseUrl = resolveBaseUrl();
    const response = await fetch(new URL(`/api/admin/activities/${activityId}`, baseUrl), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Update manual activity failed:', body);
      throw new Error(body || 'Failed to update manual activity.');
    }

    revalidatePath('/admin');
    revalidatePath('/activities');
    redirect('/admin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-3xl bg-background text-foreground">
        <CardHeader>
          <CardTitle>Edit manual activity</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateManualActivity} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                name="start_time"
                type="datetime-local"
                defaultValue={startTimeDefault}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" type="text" defaultValue={data.title ?? ''} />
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
                defaultValue={milesDefault}
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
                defaultValue={durationMinutes.toString()}
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
                defaultValue={durationSeconds.toString()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="avg_hr">Average HR</Label>
              <Input
                id="avg_hr"
                name="avg_hr"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={avgHrDefault.toString()}
              />
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
                defaultValue={elevGainFtDefault}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <Input id="type" name="type" type="text" defaultValue={data.type ?? ''} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="shoe">Shoe</Label>
              <Input id="shoe" name="shoe" type="text" defaultValue={data.shoe ?? ''} />
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
                defaultValue={perceivedExertionDefault.toString()}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={data.notes ?? ''}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Input
                id="is_public"
                name="is_public"
                type="checkbox"
                className="h-4 w-4"
                defaultChecked={data.is_public}
              />
              <Label htmlFor="is_public" className="text-muted-foreground">
                Public
              </Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full md:w-auto">
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
