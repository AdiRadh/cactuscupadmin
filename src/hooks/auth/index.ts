/**
 * Auth hooks - Authentication and authorization
 */

export { useAuth } from './useAuth';
export type { AuthState, UseAuthReturn } from './useAuth';

export { useIsAdmin } from './useIsAdmin';

export { useUserRole, isPathAllowedForOrganizer, ORGANIZER_ALLOWED_PATHS } from './useUserRole';
export type { UserRole } from './useUserRole';
