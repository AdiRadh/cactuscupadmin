/**
 * Config hooks - Site configuration and settings
 */

export { useSiteSettings } from './useSiteSettings';
export type { SiteSettings, FooterLink } from './useSiteSettings';

export { useStripeConfig, getStripeConfig } from './useStripeConfig';
export type { StripeConfig, StripeEnvironment } from './useStripeConfig';

export { useSiteLogo } from './useSiteLogo';

export { useEventRegistrationSettings } from './useEventRegistrationSettings';
export type { EventRegistrationSettings } from './useEventRegistrationSettings';

export { useWaiverSettings } from './useWaiverSettings';
export type { WaiverSettings, WaiverSigningStatus, WaiverTemplate, WaiverWithStatus } from './useWaiverSettings';

export { useHotelBookingUrl } from './useHotelBookingUrl';
