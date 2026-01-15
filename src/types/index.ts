/**
 * Central type definitions for the application
 * Uses Supabase generated types as the source of truth
 */

import type { Database } from './database.types';

// ============================================================================
// Database Table Types
// ============================================================================

// Re-export database types for convenience
export type DbTournament = Database['public']['Tables']['tournaments']['Row'];
export type DbActivity = Database['public']['Tables']['activities']['Row'];
export type DbProfile = Database['public']['Tables']['profiles']['Row'];
export type DbTournamentRegistration = Database['public']['Tables']['tournament_registrations']['Row'];
export type DbActivityRegistration = Database['public']['Tables']['activity_registrations']['Row'];
export type DbSpecialEvent = Database['public']['Tables']['special_events']['Row'];
export type DbEventRegistration = Database['public']['Tables']['event_registrations']['Row'];
export type DbAddon = Database['public']['Tables']['addons']['Row'];
export type DbOrder = Database['public']['Tables']['orders']['Row'];
export type DbOrderItem = Database['public']['Tables']['order_items']['Row'];
export type DbHotelPartner = Database['public']['Tables']['hotel_partners']['Row'];
export type DbSponsor = Database['public']['Tables']['sponsors']['Row'];
export type DbGuestInstructor = Database['public']['Tables']['guest_instructors']['Row'];
export type DbOrganizer = Database['public']['Tables']['organizers']['Row'];
export type DbAboutSection = Database['public']['Tables']['about_sections']['Row'];
export type DbSiteSetting = Database['public']['Tables']['site_settings']['Row'];

// ============================================================================
// Domain Types (converted from database types to camelCase)
// ============================================================================

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  weapon: WeaponType;
  division: DivisionType;
  description: string | null;
  rules: string | null;
  maxParticipants: number;
  currentParticipants: number;
  waitlistHeldSpots: number;
  registrationFee: number; // in cents
  earlyBirdPrice: number | null; // in cents
  earlyBirdStartDate: string | null;
  earlyBirdEndDate: string | null;
  stripeEarlyBirdPriceId: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  location: string;
  status: TournamentStatus;
  visible: boolean;
  displayOrder: number;
  headerImageUrl: string | null;
  galleryImages: string[];
  stripeProductId: string | null;
  stripePriceId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type WeaponType = 'longsword' | 'saber' | 'rapier' | 'sword-buckler' | 'cutting' | 'other';

export type DivisionType = 'open' | 'womens' | 'beginner' | 'intermediate' | 'advanced';

export type TournamentStatus = 'draft' | 'open' | 'closed' | 'full' | 'completed';

export interface Activity {
  id: string;
  title: string;
  slug: string;
  type: ActivityType;
  instructor: string | null;
  description: string;
  date: string;
  startTime: string;
  duration: number; // in minutes
  maxParticipants: number | null;
  currentParticipants: number;
  fee: number; // in cents (0 for free)
  earlyBirdPrice: number | null; // in cents
  earlyBirdStartDate: string | null;
  earlyBirdEndDate: string | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  stripeEarlyBirdPriceId: string | null;
  requiresRegistration: boolean | null;
  skillLevel: SkillLevel | null;
  status: ActivityStatus;
  visible: boolean;
  headerImageUrl: string | null;
  galleryImages: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export type ActivityType = 'workshop' | 'seminar' | 'social' | 'vendor' | 'other';

export type ActivityStatus = 'draft' | 'open' | 'closed' | 'full' | 'completed';

export type SkillLevel = 'all' | 'beginner' | 'intermediate' | 'advanced';

export interface SpecialEvent {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  heroImageUrl: string | null;
  heroSubtitle: string | null;
  navDisplayName: string; // What shows in nav bar

  // Basic info
  description: string;
  date: string;
  startTime: string | null;
  endTime: string | null;

  // Location
  location: string;
  venue: string;
  locationDetails: LocationDetails;
  directionsText: string | null;
  parkingInfo: string | null;

  // Itinerary
  itinerary: ItineraryItem[];

  // Dress code
  dressCode: string | null; // e.g., "Formal", "Semi-formal", "Cocktail"
  dressCodeDetails: string | null;

  // Pricing
  ticketPrice: number; // in cents
  eventRegistrantPrice: number | null; // null = free for registrants
  earlyBirdTicketPrice: number | null; // in cents
  earlyBirdStartDate: string | null;
  earlyBirdEndDate: string | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  stripeEarlyBirdPriceId: string | null;
  allowNonRegistrants: boolean;
  allowStandalonePurchase: boolean; // When false, redirects to event registration flow

  // Capacity
  maxCapacity: number | null;
  currentRegistrations: number;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;

  // Gallery
  galleryImages: string[];

  // Register Button (optional)
  registerButtonText: string | null;
  registerButtonUrl: string | null;

  // Status
  isActive: boolean; // Only one can be true
  status: SpecialEventStatus;
  visible: boolean;

  // Timestamps
  createdAt: string | null;
  updatedAt: string | null;
}

export type SpecialEventStatus = 'draft' | 'published' | 'archived';

export interface LocationDetails {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  mapUrl?: string; // Google Maps embed URL
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface ItineraryItem {
  id: string;
  time: string; // e.g., "7:00 PM"
  title: string;
  description: string;
  icon?: string; // Lucide icon name
}

export interface SpecialEventRegistration {
  id: string;
  userId: string;
  eventId: string; // Using event_id from database
  ticketPricePaid: number;
  isEventRegistrant: boolean;
  hasPlusOne: boolean;
  plusOneName: string | null;
  plusOnePricePaid: number;
  paymentStatus: PaymentStatus;
  registrationStatus: RegistrationStatus;
  stripePaymentIntentId: string | null;
  dietaryRestrictions: string | null;
  specialRequests: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
}

export type RegistrationStatus = 'confirmed' | 'cancelled' | 'waitlist';

// ============================================================================
// Waitlist Types
// ============================================================================

export type WaitlistStatus = 'waiting' | 'promoted' | 'invoiced' | 'confirmed' | 'cancelled' | 'expired';

export interface WaitlistEntry {
  id: string;
  userId: string;
  tournamentId: string;
  position: number;
  joinedAt: string;
  email: string;
  firstName: string;
  lastName: string;
  status: WaitlistStatus;
  promotedAt: string | null;
  invoiceSentAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined from tournaments table
  tournamentName?: string;
  // Joined invoice info (optional)
  invoice?: WaitlistInvoice;
}

// ============================================================================
// Waitlist Invoice Types
// ============================================================================

export type WaitlistInvoiceStatus = 'pending' | 'paid' | 'cancelled' | 'voided' | 'expired';

export interface WaitlistInvoice {
  id: string;
  waitlistEntryId: string;
  userId: string;
  tournamentId: string;
  stripeInvoiceId: string;
  stripeCustomerId: string;
  stripeHostedInvoiceUrl: string | null;
  tournamentFee: number;
  eventRegistrationFee: number;
  totalAmount: number;
  status: WaitlistInvoiceStatus;
  dueDate: string;
  createdAt: string;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  expiredAt: string | null;
  includesEventRegistration: boolean;
}

export interface InvoiceCalculation {
  waitlistEntryId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  tournamentId: string;
  tournamentName: string;
  tournamentFee: number;
  needsEventRegistration: boolean;
  eventRegistrationFee: number;
  totalAmount: number;
}

export interface SendInvoicesRequest {
  waitlistEntryIds: string[];
}

export interface SendInvoicesResponse {
  success: boolean;
  results: {
    waitlistEntryId: string;
    success: boolean;
    invoiceId?: string;
    stripeInvoiceId?: string;
    error?: string;
  }[];
  totalSent: number;
  totalFailed: number;
}

// ============================================================================
// Event Registration Types
// ============================================================================

export interface EventRegistration {
  id: string;
  userId: string;
  eventYear: number;
  registrationFee: number; // in cents
  paymentStatus: PaymentStatus;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';

// ============================================================================
// Add-on Types
// ============================================================================

export interface Addon {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: AddonCategory;
  price: number; // in cents
  hasInventory: boolean;
  stockQuantity: number | null;
  maxPerOrder: number | null;
  hasVariants: boolean;
  variants: AddonVariant[] | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  imageUrl: string | null;
  galleryUrls: string[] | null;
  availableFrom: string | null;
  availableUntil: string | null;
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type AddonCategory = 'apparel' | 'merchandise' | 'equipment' | 'food' | 'other';

export interface AddonVariant {
  name: string; // e.g., "Small"
  sku: string; // e.g., "SHIRT-S"
  priceModifier: number; // in cents (0 for no change, positive for upcharge)
  stock: number | null;
}

// ============================================================================
// Order Types
// ============================================================================

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  orderStatus: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber: string | null;
  customerNotes: string | null;
  adminNotes: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
export type FulfillmentStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'pickup_ready' | 'picked_up';

export interface OrderItem {
  id: string;
  orderId: string;
  itemType: OrderItemType;
  eventRegistrationId: string | null;
  tournamentRegistrationId: string | null;
  activityRegistrationId: string | null;
  addonId: string | null;
  specialEventRegistrationId: string | null;
  itemName: string;
  itemDescription: string | null;
  itemSku: string | null;
  variantName: string | null;
  variantData: Record<string, unknown> | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  tax: number;
  total: number;
  discountAmount: number;
  discountCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrderItemType = 'event_registration' | 'tournament' | 'activity' | 'addon' | 'special_event';

// ============================================================================
// Hotel Partner Types
// ============================================================================

export interface HotelPartner {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  bookingUrl: string;
  bookingCode: string | null;
  rateDescription: string | null;
  distance: string | null; // distance from venue (e.g., "0.5 miles")
  amenities: string[] | null;
  distanceFromVenue: string | null;
  distanceFromAirport: string | null;
  parkingInfo: string | null;
  gettingHereText: string | null;
  stayingHereText: string | null;
  hotelPerksText: string | null;
  backgroundImageUrl: string | null;
  imageUrl: string | null;
  galleryUrls: string[] | null;
  isPrimary: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Sponsor Types
// ============================================================================

export type SponsorType = 'sponsor' | 'vendor';
export type SponsorTier = 'cholla' | 'creosote' | 'opuntia' | 'saguaro' | 'ocotillo';

export interface Sponsor {
  id: string;
  name: string;
  type: SponsorType;
  tier: SponsorTier | null;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  boothNumber: string | null;
  color: string | null;
  visible: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Guest Instructor Types
// ============================================================================

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  twitter?: string;
  website?: string;
}

export interface GuestInstructor {
  id: string;
  name: string;
  bio: string;
  specialties: string[];
  teachingFocus: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  socialLinks: SocialLinks;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Organizer Types
// ============================================================================

export interface Organizer {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  socialLinks: SocialLinks;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// About Section Types
// ============================================================================

// About section types for hybrid approach
export type AboutSectionType = 'hero' | 'quick_info' | 'content' | 'schedule_day' | 'sidebar';

export type AboutSectionKey =
  | 'hero'
  | 'quick_info_when' | 'quick_info_where' | 'quick_info_attendees' | 'quick_info_tournaments'
  | 'welcome' | 'mission' | 'history' | 'values' | 'venue_info'
  | 'schedule_friday' | 'schedule_saturday' | 'schedule_sunday'
  | 'sidebar_registration' | 'sidebar_venue' | 'sidebar_hotel' | 'sidebar_contact';

// Metadata structures for different section types
export interface QuickInfoMetadata {
  secondaryText?: string;
}

export interface ScheduleDayMetadata {
  items: Array<{
    time: string;
    description: string;
  }>;
}

export interface SidebarMetadata {
  ctaText?: string;
  ctaUrl?: string;
  email?: string;
}

export type AboutSectionMetadata = QuickInfoMetadata | ScheduleDayMetadata | SidebarMetadata | Record<string, unknown>;

export interface AboutSection {
  id: string;
  sectionKey: string; // More flexible than enum
  sectionType: AboutSectionType;
  title: string;
  content: string;
  icon: string | null; // Lucide icon name for quick_info sections
  imageUrl: string | null;
  galleryUrls: string[];
  metadata: AboutSectionMetadata;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Site Settings Types
// ============================================================================

export type SettingType = 'text' | 'url' | 'json' | 'number';

export interface SiteSetting {
  id: string;
  settingKey: string;
  settingValue: string;
  settingType: SettingType;
  description: string | null;
  updatedAt: string;
}

// ============================================================================
// Registration Wizard Types
// ============================================================================

export type EntryType = 'free' | 'spectator' | 'paid';

export interface RegistrationWizardState {
  currentStep: number;
  completedSteps: number[];
  cart: Cart;
  eventRegistration: {
    wantsToPay: boolean;
    entryType?: EntryType;
    entryFee?: number;
  };
  tournaments: {
    selectedIds: string[];
  };
  addons: {
    selections: Array<{
      addonId: string;
      quantity: number;
      variantData?: Record<string, unknown>;
    }>;
  };
}

// ============================================================================
// User & Profile Types
// ============================================================================

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  club: string | null;
  experienceLevel: ExperienceLevel;
  bio: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface User {
  id: string;
  email: string;
  profile?: Profile;
  roles?: string[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface PaginatedResponse<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ============================================================================
// Form Types
// ============================================================================

export interface TournamentRegistrationForm {
  tournamentId: string;
  waiverSigned: boolean;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface ActivityRegistrationForm {
  activityId: string;
  dietaryRestrictions?: string;
  specialRequirements?: string;
}

export interface SpecialEventRegistrationForm {
  specialEventId: string;
  hasPlusOne: boolean;
  plusOneName?: string;
}

// ============================================================================
// Cart Types (Client-side Shadow Cart)
// ============================================================================

export interface CartItem {
  id: string; // Temporary client-side ID
  type: OrderItemType;
  itemId: string; // ID of the tournament, activity, addon, etc.
  name: string;
  description: string | null;
  price: number; // in cents
  quantity: number;
  variant?: {
    name: string;
    data: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>; // Store registration form data
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
      Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// ============================================================================
// Type Guards
// ============================================================================

export function isTournament(item: unknown): item is Tournament {
  return (
    typeof item === 'object' &&
    item !== null &&
    'name' in item &&
    'weapon' in item &&
    'division' in item
  );
}

export function isActivity(item: unknown): item is Activity {
  return (
    typeof item === 'object' &&
    item !== null &&
    'title' in item &&
    'type' in item &&
    'instructor' in item
  );
}

export function isSpecialEvent(item: unknown): item is SpecialEvent {
  return (
    typeof item === 'object' &&
    item !== null &&
    'title' in item &&
    'venue' in item &&
    'allowPlusOne' in item
  );
}

// ============================================================================
// Database Conversion Functions
// ============================================================================

/**
 * Convert database tournament to domain tournament
 */
export function dbToTournament(db: DbTournament): Tournament {
  return {
    id: db.id,
    name: db.name,
    slug: db.slug,
    weapon: db.weapon as WeaponType,
    division: db.division as DivisionType,
    description: db.description,
    rules: db.rules,
    maxParticipants: db.max_participants,
    currentParticipants: db.current_participants,
    waitlistHeldSpots: (db as any).waitlist_held_spots || 0,
    registrationFee: db.registration_fee,
    earlyBirdPrice: (db as any).early_bird_price || null,
    earlyBirdStartDate: (db as any).early_bird_start_date || null,
    earlyBirdEndDate: (db as any).early_bird_end_date || null,
    stripeEarlyBirdPriceId: (db as any).stripe_early_bird_price_id || null,
    date: db.date,
    startTime: db.start_time,
    endTime: db.end_time,
    location: db.location,
    status: db.status as TournamentStatus,
    visible: db.visible ?? true,
    displayOrder: (db as any).display_order ?? 0,
    headerImageUrl: db.header_image_url || null,
    galleryImages: db.gallery_images || [],
    stripeProductId: db.stripe_product_id,
    stripePriceId: db.stripe_price_id,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Convert database activity to domain activity
 */
export function dbToActivity(db: DbActivity): Activity {
  return {
    id: db.id,
    title: db.title,
    slug: db.slug,
    type: db.type as ActivityType,
    instructor: db.instructor,
    description: db.description,
    date: db.date,
    startTime: db.start_time,
    duration: db.duration,
    maxParticipants: db.max_participants,
    currentParticipants: db.current_participants,
    fee: db.fee,
    earlyBirdPrice: (db as any).early_bird_price || null,
    earlyBirdStartDate: (db as any).early_bird_start_date || null,
    earlyBirdEndDate: (db as any).early_bird_end_date || null,
    stripeProductId: (db as any).stripe_product_id || null,
    stripePriceId: (db as any).stripe_price_id || null,
    stripeEarlyBirdPriceId: (db as any).stripe_early_bird_price_id || null,
    requiresRegistration: db.requires_registration,
    skillLevel: db.skill_level as SkillLevel | null,
    status: db.status as ActivityStatus,
    visible: db.visible ?? true,
    headerImageUrl: db.header_image_url || null,
    galleryImages: db.gallery_images || [],
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Convert database profile to domain profile
 */
export function dbToProfile(db: DbProfile): Profile {
  return {
    id: db.id,
    firstName: db.first_name,
    lastName: db.last_name,
    club: db.club,
    experienceLevel: db.experience_level as ExperienceLevel,
    bio: db.bio,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Convert database event registration to domain event registration
 */
export function dbToEventRegistration(db: DbEventRegistration): EventRegistration {
  return {
    id: db.id,
    userId: db.user_id,
    eventYear: db.event_year,
    registrationFee: db.registration_fee,
    paymentStatus: db.payment_status as PaymentStatus,
    registeredAt: db.registered_at!,
    createdAt: db.created_at!,
    updatedAt: db.updated_at!,
  };
}

/**
 * Convert database addon to domain addon
 */
export function dbToAddon(db: DbAddon): Addon {
  return {
    id: db.id,
    name: db.name,
    slug: db.slug,
    description: db.description,
    category: db.category as AddonCategory,
    price: db.price,
    hasInventory: db.has_inventory!,
    stockQuantity: db.stock_quantity,
    maxPerOrder: db.max_per_order,
    hasVariants: db.has_variants!,
    variants: db.variants as AddonVariant[] | null,
    stripeProductId: db.stripe_product_id,
    stripePriceId: db.stripe_price_id,
    imageUrl: db.image_url,
    galleryUrls: db.gallery_urls,
    availableFrom: db.available_from,
    availableUntil: db.available_until,
    isActive: db.is_active!,
    featured: db.featured!,
    sortOrder: db.sort_order!,
    createdAt: db.created_at!,
    updatedAt: db.updated_at!,
  };
}

/**
 * Convert database order to domain order
 */
export function dbToOrder(db: DbOrder): Order {
  return {
    id: db.id,
    userId: db.user_id,
    orderNumber: db.order_number!,
    subtotal: db.subtotal!,
    tax: db.tax!,
    total: db.total,
    paymentStatus: db.payment_status as PaymentStatus,
    paymentMethod: db.payment_method,
    stripeSessionId: db.stripe_session_id,
    stripePaymentIntentId: db.stripe_payment_intent_id,
    stripeCustomerId: db.stripe_customer_id,
    orderStatus: db.order_status as OrderStatus,
    fulfillmentStatus: db.fulfillment_status as FulfillmentStatus,
    trackingNumber: db.tracking_number,
    customerNotes: db.customer_notes,
    adminNotes: db.admin_notes,
    paidAt: db.paid_at,
    cancelledAt: db.cancelled_at,
    createdAt: db.created_at!,
    updatedAt: db.updated_at!,
  };
}

/**
 * Convert database order item to domain order item
 */
export function dbToOrderItem(db: DbOrderItem): OrderItem {
  return {
    id: db.id,
    orderId: db.order_id,
    itemType: db.item_type as OrderItemType,
    eventRegistrationId: db.event_registration_id,
    tournamentRegistrationId: db.tournament_registration_id,
    activityRegistrationId: db.activity_registration_id,
    addonId: db.addon_id,
    specialEventRegistrationId: db.special_event_registration_id,
    itemName: db.item_name,
    itemDescription: db.item_description,
    itemSku: db.item_sku,
    variantName: db.variant_name,
    variantData: db.variant_data as Record<string, unknown> | null,
    unitPrice: db.unit_price!,
    quantity: db.quantity!,
    subtotal: db.subtotal!,
    tax: db.tax!,
    total: db.total!,
    discountAmount: db.discount_amount!,
    discountCode: db.discount_code,
    createdAt: db.created_at!,
    updatedAt: db.updated_at!,
  };
}

/**
 * Convert database hotel partner to domain hotel partner
 */
export function dbToHotelPartner(db: DbHotelPartner): HotelPartner {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    address: db.address,
    city: db.city,
    state: db.state,
    zipCode: db.zip_code,
    phone: db.phone,
    bookingUrl: db.booking_url,
    bookingCode: db.booking_code,
    rateDescription: db.rate_description,
    distance: db.distance_from_venue, // Use distanceFromVenue as distance
    amenities: db.amenities,
    distanceFromVenue: db.distance_from_venue,
    distanceFromAirport: db.distance_from_airport,
    parkingInfo: db.parking_info,
    gettingHereText: db.getting_here_text,
    stayingHereText: db.staying_here_text,
    hotelPerksText: db.hotel_perks_text,
    backgroundImageUrl: db.background_image_url,
    imageUrl: db.image_url,
    galleryUrls: db.gallery_urls,
    isPrimary: db.is_primary!,
    isActive: db.is_active!,
    displayOrder: db.display_order!,
    createdAt: db.created_at!,
    updatedAt: db.updated_at!,
  };
}

export function dbToSponsor(db: DbSponsor): Sponsor {
  return {
    id: db.id,
    name: db.name,
    type: db.type as SponsorType,
    tier: db.tier as SponsorTier | null,
    description: db.description,
    logoUrl: db.logo_url,
    websiteUrl: db.website_url,
    boothNumber: db.booth_number,
    color: db.color,
    visible: db.visible!,
    displayOrder: db.display_order!,
    createdAt: db.created_at!,
    updatedAt: db.updated_at!,
  };
}

/**
 * Convert database guest instructor to domain guest instructor
 */
export function dbToGuestInstructor(db: DbGuestInstructor): GuestInstructor {
  return {
    id: db.id,
    name: db.name,
    bio: db.bio,
    specialties: db.specialties || [],
    teachingFocus: db.teaching_focus,
    photoUrl: db.photo_url,
    websiteUrl: db.website_url,
    socialLinks: (db.social_links as SocialLinks) || {},
    isFeatured: db.is_featured!,
    displayOrder: db.display_order!,
    createdAt: db.created_at!,
    updatedAt: db.updated_at!,
  };
}

/**
 * Convert database organizer to domain organizer
 */
export function dbToOrganizer(db: DbOrganizer): Organizer {
  return {
    id: db.id,
    name: db.name,
    role: db.role,
    bio: db.bio,
    photoUrl: db.photo_url,
    email: db.email,
    phone: db.phone,
    socialLinks: (db.social_links as SocialLinks) || {},
    displayOrder: db.display_order!,
    createdAt: db.created_at!,
    updatedAt: db.updated_at!,
  };
}

/**
 * Convert database about section to domain about section
 */
export function dbToAboutSection(db: DbAboutSection): AboutSection {
  return {
    id: db.id,
    sectionKey: db.section_key,
    sectionType: (db.section_type || 'content') as AboutSectionType,
    title: db.title,
    content: db.content,
    icon: db.icon || null,
    imageUrl: db.image_url || null,
    galleryUrls: db.gallery_urls || [],
    metadata: (db.metadata as AboutSectionMetadata) || {},
    displayOrder: db.display_order || 0,
    isPublished: db.is_published ?? true,
    createdAt: db.created_at || '',
    updatedAt: db.updated_at || '',
  };
}

/**
 * Convert database site setting to domain site setting
 */
export function dbToSiteSetting(db: DbSiteSetting): SiteSetting {
  return {
    id: db.id,
    settingKey: db.setting_key,
    settingValue: db.setting_value,
    settingType: db.setting_type as SettingType,
    description: db.description,
    updatedAt: db.updated_at!,
  };
}

/**
 * Convert database special event to domain special event
 */
export function dbToSpecialEvent(db: DbSpecialEvent): SpecialEvent {
  return {
    id: db.id,
    title: db.title,
    slug: db.slug,
    subtitle: db.subtitle,
    heroImageUrl: db.hero_image_url || null,
    heroSubtitle: db.hero_subtitle || null,
    navDisplayName: db.nav_display_name || 'Special Event',
    description: db.description,
    date: db.event_date,
    startTime: db.start_time,
    endTime: db.end_time,
    location: db.location,
    venue: db.venue,
    locationDetails: (db.location_details as unknown as LocationDetails) || { address: '', city: '', state: '', zipCode: '' },
    directionsText: db.directions_text || null,
    parkingInfo: db.parking_info || null,
    itinerary: (db.itinerary as unknown as ItineraryItem[]) || [],
    dressCode: db.dress_code || null,
    dressCodeDetails: db.dress_code_details || null,
    ticketPrice: db.ticket_price || 0,
    eventRegistrantPrice: db.event_registrant_price || null,
    earlyBirdTicketPrice: (db as any).early_bird_ticket_price || null,
    earlyBirdStartDate: (db as any).early_bird_start_date || null,
    earlyBirdEndDate: (db as any).early_bird_end_date || null,
    stripeProductId: (db as any).stripe_product_id || null,
    stripePriceId: (db as any).stripe_price_id || null,
    stripeEarlyBirdPriceId: (db as any).stripe_early_bird_price_id || null,
    allowNonRegistrants: db.allow_non_registrants ?? true,
    allowStandalonePurchase: (db as any).allow_standalone_purchase ?? true,
    maxCapacity: db.max_capacity || null,
    currentRegistrations: db.current_registrations || 0,
    registrationOpensAt: db.registration_opens_at || null,
    registrationClosesAt: db.registration_closes_at || null,
    galleryImages: (db.gallery_images as string[]) || [],
    registerButtonText: db.register_button_text || null,
    registerButtonUrl: db.register_button_url || null,
    isActive: db.is_active ?? false,
    status: (db.status as SpecialEventStatus) || 'draft',
    visible: db.visible ?? true,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}
