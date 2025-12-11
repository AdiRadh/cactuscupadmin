/**
 * Hooks barrel export
 *
 * Hooks are organized into categories:
 * - auth: Authentication and authorization hooks
 * - config: Site configuration and settings hooks
 * - data: Data fetching and management hooks
 */

// Auth hooks
export { useAuth } from './auth';
export type { AuthState, UseAuthReturn } from './auth';

export { useIsAdmin } from './auth';

export { useUserRole, isPathAllowedForOrganizer, ORGANIZER_ALLOWED_PATHS } from './auth';
export type { UserRole } from './auth';

// Config hooks
export { useSiteSettings } from './config';
export type { SiteSettings, FooterLink } from './config';

export { useStripeConfig, getStripeConfig } from './config';
export type { StripeConfig, StripeEnvironment } from './config';

export { useSiteLogo } from './config';

export { useEventRegistrationSettings } from './config';
export type { EventRegistrationSettings } from './config';

export { useHotelBookingUrl } from './config';

// Data hooks
export { useAdmin } from './data';
export type { AdminState, UseAdminReturn, ListOptions } from './data';
