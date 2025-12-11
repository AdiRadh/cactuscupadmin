/**
 * Utility functions for uploading images to Supabase Storage
 */

import { supabase } from '@/lib/api/supabase';

export const TOURNAMENTS_BUCKET = 'tournaments-images';
export const ACTIVITIES_BUCKET = 'activities-images';
export const HOTEL_PARTNERS_BUCKET = 'hotel-partners-images';
export const GUEST_INSTRUCTORS_BUCKET = 'guest-instructors-images';
export const ORGANIZERS_BUCKET = 'organizers-images';
export const ABOUT_IMAGES_BUCKET = 'about-images';
export const SITE_LOGOS_BUCKET = 'site-logos';
export const SITE_IMAGES_BUCKET = 'site-images';
export const ADDONS_BUCKET = 'addons-images';
export const SPONSORS_BUCKET = 'sponsors-images';
export const SPECIAL_EVENTS_BUCKET = 'special-events-images';
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Upload an image to Supabase Storage
 */
export async function uploadTournamentImage(
  file: File,
  tournamentId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' };
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = type === 'header'
      ? `header.${fileExt}`
      : `gallery/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const filePath = `tournaments/${tournamentId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(TOURNAMENTS_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: type === 'header', // Allow header image to be replaced
      });

    if (error) {
      console.error('Upload error:', error);
      return { error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(TOURNAMENTS_BUCKET)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return { error: 'An unexpected error occurred while uploading the image.' };
  }
}

/**
 * Delete an image from Supabase Storage
 */
export async function deleteTournamentImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(TOURNAMENTS_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected delete error:', error);
    return { success: false, error: 'An unexpected error occurred while deleting the image.' };
  }
}

/**
 * Extract the file path from a public URL
 */
export function getFilePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const match = url.match(/\/tournaments-images\/(.+)$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.',
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Upload an image to Supabase Storage (generic version for any bucket)
 */
export async function uploadImage(
  file: File,
  bucket: string,
  resourceType: string,
  resourceId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' };
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = type === 'header'
      ? `header.${fileExt}`
      : `gallery/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const filePath = `${resourceType}/${resourceId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: type === 'header', // Allow header image to be replaced
      });

    if (error) {
      console.error('Upload error:', error);
      return { error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return { error: 'An unexpected error occurred while uploading the image.' };
  }
}

/**
 * Delete an image from Supabase Storage (generic version for any bucket)
 */
export async function deleteImage(
  bucket: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected delete error:', error);
    return { success: false, error: 'An unexpected error occurred while deleting the image.' };
  }
}

/**
 * Upload an activity image
 */
export async function uploadActivityImage(
  file: File,
  activityId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  return uploadImage(file, ACTIVITIES_BUCKET, 'activities', activityId, type);
}

/**
 * Delete an activity image
 */
export async function deleteActivityImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(ACTIVITIES_BUCKET, filePath);
}

/**
 * Upload a hotel partner image
 */
export async function uploadHotelPartnerImage(
  file: File,
  hotelId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  return uploadImage(file, HOTEL_PARTNERS_BUCKET, 'hotel-partners', hotelId, type);
}

/**
 * Delete a hotel partner image
 */
export async function deleteHotelPartnerImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(HOTEL_PARTNERS_BUCKET, filePath);
}

/**
 * Extract the file path from a public URL (generic version)
 */
export function getFilePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  try {
    const match = url.match(new RegExp(`\\/${bucket}\\/(.+)$`));
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Upload a guest instructor image
 */
export async function uploadGuestInstructorImage(
  file: File,
  instructorId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  return uploadImage(file, GUEST_INSTRUCTORS_BUCKET, 'guest-instructors', instructorId, type);
}

/**
 * Delete a guest instructor image
 */
export async function deleteGuestInstructorImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(GUEST_INSTRUCTORS_BUCKET, filePath);
}

/**
 * Upload an organizer image
 */
export async function uploadOrganizerImage(
  file: File,
  organizerId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  return uploadImage(file, ORGANIZERS_BUCKET, 'organizers', organizerId, type);
}

/**
 * Delete an organizer image
 */
export async function deleteOrganizerImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(ORGANIZERS_BUCKET, filePath);
}

/**
 * Upload an about section image
 */
export async function uploadAboutImage(
  file: File,
  sectionId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  return uploadImage(file, ABOUT_IMAGES_BUCKET, 'about-sections', sectionId, type);
}

/**
 * Delete an about section image
 */
export async function deleteAboutImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(ABOUT_IMAGES_BUCKET, filePath);
}

/**
 * Upload an addon image
 */
export async function uploadAddonImage(
  file: File,
  addonId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  return uploadImage(file, ADDONS_BUCKET, 'addons', addonId, type);
}

/**
 * Delete an addon image
 */
export async function deleteAddonImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(ADDONS_BUCKET, filePath);
}

/**
 * Upload a site logo
 */
export async function uploadSiteLogo(
  file: File
): Promise<{ url: string; path: string } | { error: string }> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' };
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `logo-${timestamp}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(SITE_LOGOS_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return { error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SITE_LOGOS_BUCKET)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return { error: 'An unexpected error occurred while uploading the logo.' };
  }
}

/**
 * Delete a site logo
 */
export async function deleteSiteLogo(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(SITE_LOGOS_BUCKET, filePath);
}

/**
 * Extract the logo path from a public URL
 */
export function getLogoPathFromUrl(url: string | null | undefined): string | null {
  return getFilePathFromPublicUrl(url, SITE_LOGOS_BUCKET);
}

/**
 * Get filename from URL for display
 */
export function getFilenameFromUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parts = url.split('/');
    return parts[parts.length - 1] ?? '';
  } catch {
    return '';
  }
}

/**
 * Upload a hero image
 */
export async function uploadHeroImage(
  file: File
): Promise<{ url: string; path: string } | { error: string }> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' };
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `hero-${timestamp}.${fileExt}`;
    const filePath = `hero/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(SITE_IMAGES_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return { error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SITE_IMAGES_BUCKET)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return { error: 'An unexpected error occurred while uploading the hero image.' };
  }
}

/**
 * Delete a hero image
 */
export async function deleteHeroImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(SITE_IMAGES_BUCKET, filePath);
}

/**
 * Extract the hero image path from a public URL
 */
export function getHeroImagePathFromUrl(url: string | null | undefined): string | null {
  return getFilePathFromPublicUrl(url, SITE_IMAGES_BUCKET);
}

/**
 * Upload a sponsor/vendor image
 */
export async function uploadSponsorImage(
  file: File,
  sponsorId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  return uploadImage(file, SPONSORS_BUCKET, 'sponsors', sponsorId, type);
}

/**
 * Delete a sponsor/vendor image
 */
export async function deleteSponsorImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(SPONSORS_BUCKET, filePath);
}

/**
 * Upload a special event image
 */
export async function uploadSpecialEventImage(
  file: File,
  eventId: string,
  type: 'header' | 'gallery'
): Promise<{ url: string; path: string } | { error: string }> {
  return uploadImage(file, SPECIAL_EVENTS_BUCKET, 'special-events', eventId, type);
}

/**
 * Delete a special event image
 */
export async function deleteSpecialEventImage(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(SPECIAL_EVENTS_BUCKET, filePath);
}

/**
 * Extract the special event image path from a public URL
 */
export function getSpecialEventImagePathFromUrl(url: string | null | undefined): string | null {
  return getFilePathFromPublicUrl(url, SPECIAL_EVENTS_BUCKET);
}
