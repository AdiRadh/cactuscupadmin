/**
 * Utility functions for uploading documents (PDFs) to Supabase Storage
 */

import { supabase } from '@/lib/api/supabase';

export const SITE_DOCUMENTS_BUCKET = 'site-documents';
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];

/**
 * Upload a document to Supabase Storage
 */
export async function uploadDocument(
  file: File,
  documentType: string // e.g., 'privacy-policy', 'terms-conditions'
): Promise<{ url: string; path: string } | { error: string }> {
  try {
    // Validate file size
    if (file.size > MAX_DOCUMENT_SIZE) {
      return { error: `File size must be less than ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB` };
    }

    // Validate file type
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      return { error: 'Invalid file type. Please upload a PDF document.' };
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${documentType}-${timestamp}.${fileExt}`;
    const filePath = `legal/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(SITE_DOCUMENTS_BUCKET)
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
      .from(SITE_DOCUMENTS_BUCKET)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return { error: 'An unexpected error occurred while uploading the document.' };
  }
}

/**
 * Delete a document from Supabase Storage
 */
export async function deleteDocument(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(SITE_DOCUMENTS_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected delete error:', error);
    return { success: false, error: 'An unexpected error occurred while deleting the document.' };
  }
}

/**
 * Extract the file path from a public URL
 */
export function getDocumentPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const match = url.match(/\/site-documents\/(.+)$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Validate document file
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_DOCUMENT_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`,
    };
  }

  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a PDF document.',
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
 * Get filename from URL
 */
export function getFilenameFromUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parts = url.split('/');
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}
