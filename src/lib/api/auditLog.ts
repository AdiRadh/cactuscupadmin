import { supabase } from './supabase';

/**
 * Severity levels for audit log entries
 */
export type AuditSeverity = 'info' | 'warning' | 'critical';

/**
 * Common audit action types
 * IMPORTANT: Do NOT include PII in any audit log data
 */
export type AuditAction =
  // Content Management
  | 'GUEST_INSTRUCTOR_CREATED'
  | 'GUEST_INSTRUCTOR_UPDATED'
  | 'GUEST_INSTRUCTOR_DELETED'
  | 'ORGANIZER_CREATED'
  | 'ORGANIZER_UPDATED'
  | 'ORGANIZER_DELETED'
  | 'ABOUT_SECTION_CREATED'
  | 'ABOUT_SECTION_UPDATED'
  | 'ABOUT_SECTION_DELETED'
  | 'SPONSOR_CREATED'
  | 'SPONSOR_UPDATED'
  | 'SPONSOR_DELETED'
  | 'HOTEL_PARTNER_CREATED'
  | 'HOTEL_PARTNER_UPDATED'
  | 'HOTEL_PARTNER_DELETED'
  // Addon Management
  | 'ADDON_CREATED'
  | 'ADDON_UPDATED'
  | 'ADDON_DELETED'
  // Email Templates
  | 'EMAIL_TEMPLATE_UPDATED'
  // Waiver Management
  | 'WAIVER_SETTINGS_UPDATED'
  | 'WAIVER_MANUALLY_APPROVED'
  // Visibility Changes
  | 'VISIBILITY_CHANGED'
  // Display Order
  | 'DISPLAY_ORDER_CHANGED'
  // Generic
  | string;

/**
 * Resource types for categorizing audit entries
 */
export type ResourceType =
  | 'guest_instructors'
  | 'organizers'
  | 'about_sections'
  | 'sponsors'
  | 'hotel_partners'
  | 'addons'
  | 'email_templates'
  | 'waiver_templates'
  | 'site_settings'
  | 'tournaments'
  | 'activities'
  | 'special_events'
  | 'orders'
  | 'tournament_registrations'
  | 'activity_registrations'
  | 'special_event_registrations'
  | 'user_roles'
  | 'profiles'
  | string;

/**
 * Parameters for creating an audit log entry
 * IMPORTANT: Never include PII (names, emails, phone numbers, addresses)
 */
export interface CreateAuditLogParams {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  resourceName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
}

/**
 * Creates an audit log entry in the database
 *
 * IMPORTANT: This function does NOT store PII.
 * - Use UUIDs for user references, not names or emails
 * - Do not include phone numbers, addresses, or other personal data
 * - Resource names should be system names (e.g., tournament name), not user names
 *
 * @example
 * // Log a guest instructor creation
 * await createAuditLog({
 *   action: 'GUEST_INSTRUCTOR_CREATED',
 *   resourceType: 'guest_instructors',
 *   resourceId: 'uuid-here',
 *   resourceName: 'Workshop Name',
 *   newValues: { visible: true },
 *   severity: 'info'
 * });
 */
export async function createAuditLog({
  action,
  resourceType,
  resourceId,
  resourceName,
  oldValues,
  newValues,
  severity = 'info',
  metadata = {},
}: CreateAuditLogParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('create_audit_log', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId || null,
      p_resource_name: resourceName || null,
      p_old_values: oldValues ? JSON.stringify(oldValues) : null,
      p_new_values: newValues ? JSON.stringify(newValues) : null,
      p_severity: severity,
      p_metadata: JSON.stringify(metadata),
    });

    if (error) {
      console.error('Failed to create audit log:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Audit log error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Helper to extract safe audit data from an object
 * Removes any fields that might contain PII
 *
 * @param obj - Object to sanitize
 * @param allowedFields - List of field names that are safe to include
 */
export function sanitizeForAudit<T extends Record<string, unknown>>(
  obj: T,
  allowedFields: (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of allowedFields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * Compares old and new values to create audit-safe change records
 * Only includes fields that have actually changed
 */
export function getChangedFields<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: T,
  allowedFields: (keyof T)[]
): { oldValues: Partial<T>; newValues: Partial<T> } | null {
  const oldValues: Partial<T> = {};
  const newValues: Partial<T> = {};
  let hasChanges = false;

  for (const field of allowedFields) {
    if (field in oldObj && field in newObj) {
      const oldVal = JSON.stringify(oldObj[field]);
      const newVal = JSON.stringify(newObj[field]);
      if (oldVal !== newVal) {
        oldValues[field] = oldObj[field];
        newValues[field] = newObj[field];
        hasChanges = true;
      }
    }
  }

  return hasChanges ? { oldValues, newValues } : null;
}
