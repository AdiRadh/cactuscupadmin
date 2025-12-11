/**
 * Utility functions barrel export
 */

export { cn } from './cn';
export * from './imageUpload';
export * from './dateUtils';
// formatting.ts has duplicate formatDateTime, so we export specific functions
export { formatPrice, formatDate, formatTime, pluralize } from './formatting';
export { formatDateTime } from './dateUtils';
export * from './stripe';
// documentUpload has duplicates of formatFileSize and getFilenameFromUrl from imageUpload
export {
  SITE_DOCUMENTS_BUCKET,
  MAX_DOCUMENT_SIZE,
  ALLOWED_DOCUMENT_TYPES,
  uploadDocument,
  deleteDocument,
  getDocumentPathFromUrl,
  validateDocumentFile,
} from './documentUpload';
export * from './email';
