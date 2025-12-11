/**
 * UTC Date Utilities
 *
 * All dates should be stored and compared in UTC.
 * This module provides consistent UTC handling throughout the application.
 */

/**
 * Get the current date/time in UTC as an ISO string
 */
export function nowUTC(): string {
  return new Date().toISOString();
}

/**
 * Get the current date/time in UTC as a Date object
 */
export function nowUTCDate(): Date {
  return new Date();
}

/**
 * Parse a date string and return a UTC Date object
 * Handles both ISO strings (already UTC) and local datetime strings
 */
export function parseToUTC(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  // If the string already has timezone info (Z or +/-), parse directly
  if (dateString.includes('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return new Date(dateString);
  }

  // For datetime-local inputs (e.g., "2024-07-17T14:00"), treat as UTC
  // This ensures consistent behavior regardless of user's timezone
  return new Date(dateString + 'Z');
}

/**
 * Convert a datetime-local input value to UTC ISO string
 * Use this when saving form data with datetime-local inputs to the database
 */
export function datetimeLocalToUTC(localDatetime: string | null | undefined): string | null {
  if (!localDatetime) return null;

  // datetime-local format: "2024-07-17T14:00"
  // Append 'Z' to treat as UTC, then convert to ISO string
  const date = new Date(localDatetime + 'Z');
  return date.toISOString();
}

/**
 * Convert a UTC ISO string to datetime-local format for form inputs
 * Use this when loading data from the database into datetime-local inputs
 */
export function utcToDatetimeLocal(utcString: string | null | undefined): string {
  if (!utcString) return '';

  const date = new Date(utcString);
  // Format: YYYY-MM-DDTHH:MM (without timezone)
  return date.toISOString().slice(0, 16);
}

/**
 * Convert a date input value to UTC ISO string (date only, time set to 00:00:00Z)
 */
export function dateInputToUTC(dateValue: string | null | undefined): string | null {
  if (!dateValue) return null;

  // date input format: "2024-07-17"
  return new Date(dateValue + 'T00:00:00Z').toISOString();
}

/**
 * Convert a UTC ISO string to date input format
 */
export function utcToDateInput(utcString: string | null | undefined): string {
  if (!utcString) return '';

  const date = new Date(utcString);
  // Format: YYYY-MM-DD
  return date.toISOString().slice(0, 10);
}

/**
 * Compare two dates in UTC
 * Returns true if dateA is before dateB
 */
export function isBeforeUTC(dateA: string | Date, dateB: string | Date): boolean {
  const a = typeof dateA === 'string' ? new Date(dateA) : dateA;
  const b = typeof dateB === 'string' ? new Date(dateB) : dateB;
  return a.getTime() < b.getTime();
}

/**
 * Compare two dates in UTC
 * Returns true if dateA is after dateB
 */
export function isAfterUTC(dateA: string | Date, dateB: string | Date): boolean {
  const a = typeof dateA === 'string' ? new Date(dateA) : dateA;
  const b = typeof dateB === 'string' ? new Date(dateB) : dateB;
  return a.getTime() > b.getTime();
}

/**
 * Check if current time (UTC) is between two dates
 */
export function isCurrentlyBetween(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): boolean {
  if (!startDate || !endDate) return false;

  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  return now >= start && now <= end;
}

/**
 * Check if current time (UTC) is before a date
 */
export function isCurrentlyBefore(date: string | null | undefined): boolean {
  if (!date) return false;
  return Date.now() < new Date(date).getTime();
}

/**
 * Check if current time (UTC) is after a date
 */
export function isCurrentlyAfter(date: string | null | undefined): boolean {
  if (!date) return false;
  return Date.now() > new Date(date).getTime();
}

/**
 * Format a UTC date for display in a specific timezone
 * Default to 'America/Phoenix' (Arizona - MST, no DST) for event display
 */
export function formatDateForDisplay(
  utcString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
  locale: string = 'en-US',
  timeZone: string = 'America/Phoenix'
): string {
  if (!utcString) return '';

  const date = new Date(utcString);
  return date.toLocaleString(locale, { timeZone, ...options });
}

/**
 * Format a UTC date for display (date only)
 */
export function formatDateOnly(
  utcString: string | null | undefined,
  locale: string = 'en-US',
  timeZone: string = 'America/Phoenix'
): string {
  return formatDateForDisplay(utcString, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }, locale, timeZone);
}

/**
 * Format a UTC date for display (time only)
 */
export function formatTimeOnly(
  utcString: string | null | undefined,
  locale: string = 'en-US',
  timeZone: string = 'America/Phoenix'
): string {
  return formatDateForDisplay(utcString, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }, locale, timeZone);
}

/**
 * Format a UTC date for display (date and time)
 */
export function formatDateTime(
  utcString: string | null | undefined,
  locale: string = 'en-US',
  timeZone: string = 'America/Phoenix'
): string {
  return formatDateForDisplay(utcString, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }, locale, timeZone);
}

/**
 * Calculate time remaining until a target date (in UTC)
 * Returns object with days, hours, minutes, seconds
 */
export function getTimeRemaining(targetDate: string | null | undefined): {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
} {
  if (!targetDate) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const total = target - now;

  if (total <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    isPast: false,
  };
}
