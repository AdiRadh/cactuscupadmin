/**
 * Formats a price in cents to a currency string.
 *
 * @param cents - Price in cents
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted price string (e.g., "$50.00")
 *
 * @throws {Error} If cents is negative
 *
 * @example
 * ```ts
 * formatPrice(5000); // "$50.00"
 * formatPrice(1550); // "$15.50"
 * ```
 */
export function formatPrice(cents: number, currency: string = 'USD'): string {
  if (cents < 0) {
    throw new Error('Price cannot be negative');
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Formats a date to a readable string.
 *
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 *
 * @example
 * ```ts
 * formatDate(new Date('2025-06-15')); // "June 15, 2025"
 * ```
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
}

/**
 * Formats a date and time to a readable string.
 *
 * @param date - Date to format
 * @returns Formatted date and time string
 *
 * @example
 * ```ts
 * formatDateTime(new Date('2025-06-15T14:30:00')); // "June 15, 2025 at 2:30 PM"
 * ```
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
}

/**
 * Formats a time string to 12-hour format.
 *
 * @param time - Time in HH:MM format
 * @returns Formatted time string (e.g., "2:30 PM")
 *
 * @example
 * ```ts
 * formatTime('14:30'); // "2:30 PM"
 * formatTime('09:00'); // "9:00 AM"
 * ```
 */
export function formatTime(time: string): string {
  const parts = time.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1];

  if (hours === undefined || minutes === undefined) {
    throw new Error('Invalid time format. Expected HH:MM');
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Pluralizes a word based on count.
 *
 * @param count - Number to check
 * @param singular - Singular form
 * @param plural - Plural form (optional, defaults to singular + 's')
 * @returns Pluralized string with count
 *
 * @example
 * ```ts
 * pluralize(1, 'spot'); // "1 spot"
 * pluralize(5, 'spot'); // "5 spots"
 * pluralize(1, 'activity', 'activities'); // "1 activity"
 * ```
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const word = count === 1 ? singular : plural || `${singular}s`;
  return `${count} ${word}`;
}
