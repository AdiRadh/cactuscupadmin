import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

/**
 * Supabase client instance (using anon key)
 * Used for authentication and user-scoped operations
 * Configured with auth persistence and automatic token refresh
 *
 * Security: Uses sessionStorage instead of localStorage to reduce XSS attack surface.
 * Tokens are cleared when the browser tab is closed.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use sessionStorage for improved security - tokens cleared on tab close
    storage: {
      getItem: (key: string) => {
        if (typeof window === 'undefined') return null;
        return sessionStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem(key);
      },
    },
  },
});

/**
 * Admin Supabase client instance (using service role key)
 * BYPASSES ALL RLS POLICIES - Use with caution!
 *
 * Only use this client for admin operations that need to access all data
 * regardless of RLS policies (e.g., viewing all registrations).
 *
 * WARNING: This key has full database access. Never expose to non-admin users.
 */
export const supabaseAdmin: SupabaseClient | null = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Check if admin client is available
 */
export function hasAdminClient(): boolean {
  return supabaseAdmin !== null;
}

/**
 * Get the admin client or throw if not configured
 */
export function getAdminClient(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error(
      'Admin client not configured. Please set VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.'
    );
  }
  return supabaseAdmin;
}

/**
 * Helper to check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session !== null;
}

/**
 * Helper to get current user
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Sign out helper
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
