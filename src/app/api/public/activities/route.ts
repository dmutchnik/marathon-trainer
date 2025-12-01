// Switched public activities API to admin client with better error handling.
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/db';

const SELECT_FIELDS =
  'id, start_time, distance_m, moving_time_s, avg_pace_s, avg_hr, elev_gain_m, type, shoe, notes, title, is_public, source';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('activities')
    .select(SELECT_FIELDS)
    .eq('is_public', true)
    .order('start_time', { ascending: false })
    .limit(100);

  if (error) {
    console.error('public activities error:', error);
    return NextResponse.json({ error: 'Failed to load activities' }, { status: 500 });
  }

  return NextResponse.json({ activities: data ?? [] }, { status: 200 });
}
