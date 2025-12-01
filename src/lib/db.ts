// Added server-only supabaseAdmin client alongside the existing anon client.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
}

const globalForSupabase = globalThis as typeof globalThis & {
  _supabaseAnon?: SupabaseClient;
  _supabaseAdmin?: SupabaseClient;
};

const anonClient =
  globalForSupabase._supabaseAnon ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase._supabaseAnon = anonClient;
}

export const supabase = anonClient;

const createSupabaseAdmin = (): SupabaseClient => {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin is only available in server environments.');
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE environment variable.');
  }

  const adminClient =
    globalForSupabase._supabaseAdmin ??
    createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

  if (process.env.NODE_ENV !== 'production') {
    globalForSupabase._supabaseAdmin = adminClient;
  }

  return adminClient;
};

export const supabaseAdmin = createSupabaseAdmin();
