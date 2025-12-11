import { dataProvider as supabaseDataProvider } from '@refinedev/supabase';
import { supabase, supabaseAdmin } from '@/lib/api/supabase';

/**
 * Resources that should use the admin client to bypass RLS
 * These resources need full access regardless of user permissions
 */
const ADMIN_RESOURCES = new Set([
  'event_registrations',
  'audit_logs',
]);

/**
 * Standard data provider using anon key (respects RLS)
 */
const standardProvider = supabaseDataProvider(supabase);

/**
 * Admin data provider using service role key (bypasses RLS)
 * Only created if the service role key is configured
 */
const adminProvider = supabaseAdmin
  ? supabaseDataProvider(supabaseAdmin)
  : null;

type ProviderType = typeof standardProvider;

/**
 * Get the appropriate provider for a resource
 */
function getProviderForResource(resource: string): ProviderType {
  if (ADMIN_RESOURCES.has(resource) && adminProvider) {
    return adminProvider;
  }
  return standardProvider;
}

/**
 * Refine data provider configured for Supabase
 *
 * Uses the admin client (service role key) for sensitive resources
 * that need to bypass RLS policies, and the standard client for others.
 *
 * If the service role key is not configured, falls back to standard
 * provider for all resources (which may result in empty data for
 * RLS-protected tables).
 */
export const dataProvider: ProviderType = {
  ...standardProvider,
  getList: (params) => getProviderForResource(params.resource).getList(params),
  getOne: (params) => getProviderForResource(params.resource).getOne(params),
  getMany: (params) => getProviderForResource(params.resource).getMany(params),
  create: (params) => getProviderForResource(params.resource).create(params),
  update: (params) => getProviderForResource(params.resource).update(params),
  deleteOne: (params) => getProviderForResource(params.resource).deleteOne(params),
  deleteMany: (params) => {
    const provider = getProviderForResource(params.resource);
    return provider.deleteMany(params);
  },
};

/**
 * Check if admin provider is available
 */
export function isAdminProviderConfigured(): boolean {
  return adminProvider !== null;
}
