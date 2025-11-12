import { NextResponse } from 'next/server';

import { supabase } from '@/lib/db';

const SELECT_FIELDS =
  'id, start_time, distance_m, moving_time_s, avg_pace_s, avg_hr, elev_gain_m, type, shoe, notes, title, is_public, source';

export async function GET() {
  const { data, error } = await supabase
    .from('activities')
    .select(SELECT_FIELDS)
    .order('start_time', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data ?? [] }, { status: 200 });
}
