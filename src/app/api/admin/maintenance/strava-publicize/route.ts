// Admin maintenance task to backfill Strava entries as public.
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authFailure = requireAdmin(request);

  if (authFailure) {
    return authFailure;
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .update({ is_public: true })
    .eq('source', 'strava')
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 }, { status: 200 });
}
