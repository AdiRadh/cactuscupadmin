/**
 * Filter type definitions for admin list views
 */

import type { WaitlistStatus, TournamentStatus, WeaponType, DivisionType, AddonCategory, PaymentStatus } from './index';

// ============================================================================
// Common Types
// ============================================================================

export type SortOrder = 'asc' | 'desc';

export interface SortConfig<T extends string = string> {
  field: T;
  order: SortOrder;
}

// ============================================================================
// Waitlist Filters
// ============================================================================

export interface WaitlistFilters {
  status: WaitlistStatus | '';
  tournamentId: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

export type WaitlistSortField = 'position' | 'name' | 'email' | 'joinedAt';

export const WAITLIST_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'promoted', label: 'Promoted' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
] as const;

// ============================================================================
// Registration Filters
// ============================================================================

export interface RegistrationFilters {
  paymentStatus: PaymentStatus | '';
  waiverStatus: 'signed' | 'pending' | 'none' | '';
  club: string;
  eventYear: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

export type RegistrationSortField = 'name' | 'club' | 'fee' | 'registeredAt';

export const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'All Payment Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially Refunded' },
] as const;

export const WAIVER_STATUS_OPTIONS = [
  { value: '', label: 'All Waiver Statuses' },
  { value: 'signed', label: 'Signed' },
  { value: 'pending', label: 'Pending' },
  { value: 'none', label: 'None' },
] as const;

// ============================================================================
// Tournament Filters
// ============================================================================

export interface TournamentFilters {
  weapon: WeaponType | '';
  division: DivisionType | '';
  status: TournamentStatus | '';
  visible: 'all' | 'visible' | 'hidden';
}

export type TournamentSortField = 'name' | 'participants' | 'fee' | 'date';

export const WEAPON_OPTIONS = [
  { value: '', label: 'All Weapons' },
  { value: 'longsword', label: 'Longsword' },
  { value: 'saber', label: 'Saber' },
  { value: 'rapier', label: 'Rapier' },
  { value: 'sword-buckler', label: 'Sword & Buckler' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'other', label: 'Other' },
] as const;

export const DIVISION_OPTIONS = [
  { value: '', label: 'All Divisions' },
  { value: 'open', label: 'Open' },
  { value: 'womens', label: 'Womens' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

export const TOURNAMENT_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'full', label: 'Full' },
  { value: 'completed', label: 'Completed' },
] as const;

export const VISIBILITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'visible', label: 'Visible Only' },
  { value: 'hidden', label: 'Hidden Only' },
] as const;

// ============================================================================
// Addon Filters
// ============================================================================

export interface AddonFilters {
  category: AddonCategory | '';
  isActive: 'all' | 'active' | 'inactive';
  inStock: 'all' | 'instock' | 'outofstock';
}

export type AddonSortField = 'name' | 'price' | 'stock' | 'sold';

export const ADDON_CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'food', label: 'Food' },
  { value: 'other', label: 'Other' },
] as const;

export const ACTIVE_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
] as const;

export const IN_STOCK_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'instock', label: 'In Stock' },
  { value: 'outofstock', label: 'Out of Stock' },
] as const;

// ============================================================================
// Default Filter Values
// ============================================================================

export const DEFAULT_WAITLIST_FILTERS: WaitlistFilters = {
  status: '',
  tournamentId: 'all',
  search: '',
  dateFrom: '',
  dateTo: '',
};

export const DEFAULT_REGISTRATION_FILTERS: RegistrationFilters = {
  paymentStatus: '',
  waiverStatus: '',
  club: '',
  eventYear: '',
  search: '',
  dateFrom: '',
  dateTo: '',
};

export const DEFAULT_TOURNAMENT_FILTERS: TournamentFilters = {
  weapon: '',
  division: '',
  status: '',
  visible: 'all',
};

export const DEFAULT_ADDON_FILTERS: AddonFilters = {
  category: '',
  isActive: 'all',
  inStock: 'all',
};
