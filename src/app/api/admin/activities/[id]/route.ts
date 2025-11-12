import { NextResponse } from 'next/server';

import { supabase } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const MILES_TO_METERS = 1609.34;
const FEET_TO_METERS = 0.3048;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

type RouteParams = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, context: RouteParams) {
  const authFailure = requireAdmin(request);

  if (authFailure) {
    return authFailure;
  }

  const paramId = context?.params?.id;
  const pathId = request.url ? new URL(request.url).pathname.split('/').filter(Boolean).pop() : undefined;
  const activityId = paramId ?? pathId ?? '';

  if (!activityId || activityId === 'undefined') {
    return NextResponse.json({ error: 'Invalid activity id' }, { status: 400 });
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

  const payload: Record<string, unknown> = {};
  const data = body as Record<string, unknown>;

  if ('start_time' in data && data.start_time !== undefined) {
    if (typeof data.start_time !== 'string' || Number.isNaN(Date.parse(data.start_time))) {
      return NextResponse.json({ error: 'Invalid start_time' }, { status: 400 });
    }
    payload.start_time = new Date(data.start_time).toISOString();
  }

  if ('miles' in data && data.miles !== undefined) {
    if (!isFiniteNumber(data.miles)) {
      return NextResponse.json({ error: 'Invalid miles' }, { status: 400 });
    }
    payload.distance_m = Math.round(data.miles * MILES_TO_METERS);
  }

  if ('moving_time_s' in data && data.moving_time_s !== undefined) {
    if (!isFiniteNumber(data.moving_time_s)) {
      return NextResponse.json({ error: 'Invalid moving_time_s' }, { status: 400 });
    }
    payload.moving_time_s = Math.round(data.moving_time_s);
  }

  if ('avg_hr' in data && data.avg_hr !== undefined) {
    if (!isFiniteNumber(data.avg_hr)) {
      return NextResponse.json({ error: 'Invalid avg_hr' }, { status: 400 });
    }
    payload.avg_hr = Math.round(data.avg_hr);
  }

  if ('elev_gain_ft' in data && data.elev_gain_ft !== undefined) {
    if (!isFiniteNumber(data.elev_gain_ft)) {
      return NextResponse.json({ error: 'Invalid elev_gain_ft' }, { status: 400 });
    }
    payload.elev_gain_m = Math.round(data.elev_gain_ft * FEET_TO_METERS);
  }

  if ('type' in data && data.type !== undefined) {
    if (data.type !== null && typeof data.type !== 'string') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    payload.type = data.type;
  }

  if ('perceived_exertion' in data && data.perceived_exertion !== undefined) {
    if (data.perceived_exertion !== null && !isFiniteNumber(data.perceived_exertion)) {
      return NextResponse.json({ error: 'Invalid perceived_exertion' }, { status: 400 });
    }
    payload.perceived_exertion =
      data.perceived_exertion === null ? null : Math.round(data.perceived_exertion);
  }

  if ('shoe' in data && data.shoe !== undefined) {
    if (data.shoe !== null && typeof data.shoe !== 'string') {
      return NextResponse.json({ error: 'Invalid shoe' }, { status: 400 });
    }
    payload.shoe = data.shoe;
  }

  if ('notes' in data && data.notes !== undefined) {
    if (typeof data.notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
    }
    payload.notes = data.notes;
  }

  if ('title' in data && data.title !== undefined) {
    if (data.title !== null && typeof data.title !== 'string') {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }
    payload.title = data.title;
  }

  if ('is_public' in data && data.is_public !== undefined) {
    if (typeof data.is_public !== 'boolean') {
      return NextResponse.json({ error: 'Invalid is_public' }, { status: 400 });
    }
    payload.is_public = data.is_public;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  const { data: activity, error } = await supabase
    .from('activities')
    .update(payload)
    .eq('id', activityId)
    .eq('source', 'manual')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  return NextResponse.json({ activity }, { status: 200 });
}

export async function DELETE(request: Request, context: RouteParams) {
  const authFailure = requireAdmin(request);

  if (authFailure) {
    return authFailure;
  }

  const paramId = context?.params?.id;
  const pathId = request.url ? new URL(request.url).pathname.split('/').filter(Boolean).pop() : undefined;
  const activityId = paramId ?? pathId ?? '';

  console.log('[api] DELETE /api/admin/activities params id:', paramId, 'path id:', pathId); // Log sources

  if (!activityId || activityId === 'undefined') {
    return NextResponse.json({ error: 'Invalid activity id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)
    .eq('source', 'manual')
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
