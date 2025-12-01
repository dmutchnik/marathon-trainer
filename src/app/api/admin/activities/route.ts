// Updated admin activity creation to use supabaseAdmin for manual inserts.
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const MILES_TO_METERS = 1609.34;
const FEET_TO_METERS = 0.3048;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export async function POST(request: Request) {
  const authFailure = requireAdmin(request);

  if (authFailure) {
    return authFailure;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    start_time: rawStartTime,
    miles,
    moving_time_s,
    avg_hr: rawAvgHr,
    elev_gain_ft: rawElevGainFt,
    type: rawType,
    perceived_exertion: rawPerceivedExertion,
    shoe: rawShoe,
    notes: rawNotes,
    is_public: rawIsPublic,
  } = body as Record<string, unknown>;

  if (typeof rawStartTime !== 'string' || Number.isNaN(Date.parse(rawStartTime))) {
    return NextResponse.json({ error: 'Invalid start_time' }, { status: 400 });
  }

  if (!isFiniteNumber(miles)) {
    return NextResponse.json({ error: 'Invalid miles' }, { status: 400 });
  }

  if (!isFiniteNumber(moving_time_s)) {
    return NextResponse.json({ error: 'Invalid moving_time_s' }, { status: 400 });
  }

  let avgHr: number | undefined;
  if (rawAvgHr !== undefined) {
    if (!isFiniteNumber(rawAvgHr)) {
      return NextResponse.json({ error: 'Invalid avg_hr' }, { status: 400 });
    }
    avgHr = rawAvgHr;
  }

  let elevationGainFt: number | undefined;
  if (rawElevGainFt !== undefined) {
    if (!isFiniteNumber(rawElevGainFt)) {
      return NextResponse.json({ error: 'Invalid elev_gain_ft' }, { status: 400 });
    }
    elevationGainFt = rawElevGainFt;
  }

  let activityType: string | undefined;
  if (rawType !== undefined) {
    if (typeof rawType !== 'string') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    activityType = rawType;
  }

  let perceivedExertion: number | undefined;
  if (rawPerceivedExertion !== undefined) {
    if (!isFiniteNumber(rawPerceivedExertion)) {
      return NextResponse.json({ error: 'Invalid perceived_exertion' }, { status: 400 });
    }
    perceivedExertion = rawPerceivedExertion;
  }

  let shoe: string | undefined;
  if (rawShoe !== undefined) {
    if (typeof rawShoe !== 'string') {
      return NextResponse.json({ error: 'Invalid shoe' }, { status: 400 });
    }
    shoe = rawShoe;
  }

  let notes: string | undefined;
  if (rawNotes !== undefined) {
    if (typeof rawNotes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
    }
    notes = rawNotes;
  }

  let isPublic: boolean | undefined;
  if (rawIsPublic !== undefined) {
    if (typeof rawIsPublic !== 'boolean') {
      return NextResponse.json({ error: 'Invalid is_public' }, { status: 400 });
    }
    isPublic = rawIsPublic;
  }

  const distanceMeters = miles * MILES_TO_METERS;
  const elevationGainMeters =
    elevationGainFt !== undefined ? elevationGainFt * FEET_TO_METERS : undefined;

  const insertPayload: Record<string, unknown> = {
    start_time: new Date(rawStartTime).toISOString(),
    distance_m: Math.round(distanceMeters),
    moving_time_s: Math.round(moving_time_s),
    source: 'manual',
    is_public: isPublic ?? true,
  };

  if (avgHr !== undefined) {
    insertPayload.avg_hr = Math.round(avgHr);
  }

  if (elevationGainMeters !== undefined) {
    insertPayload.elev_gain_m = Math.round(elevationGainMeters);
  }

  if (activityType !== undefined) {
    insertPayload.type = activityType;
  }

  if (perceivedExertion !== undefined) {
    insertPayload.perceived_exertion = Math.round(perceivedExertion);
  }

  if (shoe !== undefined) {
    insertPayload.shoe = shoe;
  }

  if (notes !== undefined) {
    insertPayload.notes = notes;
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activity: data }, { status: 201 });
}
