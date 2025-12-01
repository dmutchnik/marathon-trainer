// Ensured manual activity updates/deletes use supabaseAdmin for RLS-safe access.
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const MILES_TO_METERS = 1609.34;
const FEET_TO_METERS = 0.3048;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authFailure = requireAdmin(request);

  if (authFailure) {
    return authFailure;
  }

  const resolvedParams = await context.params;
  const id = resolvedParams?.id;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
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

  const payload = body as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if (typeof payload.start_time === 'string' && !Number.isNaN(Date.parse(payload.start_time))) {
    update.start_time = new Date(payload.start_time).toISOString();
  }

  if (isFiniteNumber(payload.miles)) {
    update.distance_m = Math.round(payload.miles * MILES_TO_METERS);
  }

  if (isFiniteNumber(payload.moving_time_s)) {
    update.moving_time_s = Math.round(payload.moving_time_s);
  }

  if (isFiniteNumber(payload.avg_hr)) {
    update.avg_hr = Math.round(payload.avg_hr);
  }

  if (isFiniteNumber(payload.elev_gain_ft)) {
    update.elev_gain_m = Math.round(payload.elev_gain_ft * FEET_TO_METERS);
  }

  if (typeof payload.type === 'string') {
    update.type = payload.type;
  }

  if (isFiniteNumber(payload.perceived_exertion)) {
    update.perceived_exertion = Math.round(payload.perceived_exertion);
  }

  if (typeof payload.shoe === 'string') {
    update.shoe = payload.shoe;
  }

  if (typeof payload.notes === 'string') {
    update.notes = payload.notes;
  }

  if (typeof payload.title === 'string') {
    update.title = payload.title;
  }

  if (typeof payload.is_public === 'boolean') {
    update.is_public = payload.is_public;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .update(update)
    .eq('id', id)
    .eq('source', 'manual')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Failed to update activity', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  return NextResponse.json({ activity: data }, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authFailure = requireAdmin(request);

  if (authFailure) {
    return authFailure;
  }

  const resolvedParams = await context.params;
  const id = resolvedParams?.id;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .delete()
    .eq('id', id)
    .eq('source', 'manual')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to delete activity', error);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
