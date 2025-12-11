import type { FC } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { validateImageFile } from '@/lib/utils/imageUpload';

interface ImageUploadProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onUpload: (file: File) => Promise<{ url: string } | { error: string }>;
  onDelete?: (url: string) => Promise<void>;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  aspectRatio?: 'square' | 'landscape' | 'portrait';
}

/**
 * Image upload component for single image uploads
 * Supports preview, validation, and deletion
 */
export const ImageUpload: FC<ImageUploadProps> = ({
  label,
  value,
  onChange,
  onUpload,
  onDelete,
  helperText,
  required = false,
  disabled = false,
  aspectRatio = 'landscape',
}) => {
  const aspectRatioClass = {
    square: 'aspect-square',
    landscape: 'h-48',
    portrait: 'aspect-[3/4]',
  }[aspectRatio];
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview with value prop changes (important for edit mode)
  useEffect(() => {
    setPreview(value);
  }, [value]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Create a preview of the image
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Upload the original file directly (no cropping)
      const result = await onUpload(file);

      if ('error' in result) {
        setError(result.error);
        setPreview(value);
        URL.revokeObjectURL(previewUrl);
      } else {
        onChange(result.url);
        setPreview(result.url);
        URL.revokeObjectURL(previewUrl);
      }
    } catch (err) {
      setError('Failed to upload image');
      setPreview(value);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!value) return;

    setIsUploading(true);
    setError(null);

    try {
      if (onDelete) {
        await onDelete(value);
      }
      onChange(null);
      setPreview(null);
    } catch (err) {
      setError('Failed to delete image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>

      {helperText && (
        <p className="text-sm text-turquoise-600">{helperText}</p>
      )}

      {/* Preview or Upload Area */}
      {preview ? (
        <div className="relative group">
          <img
            src={preview}
            alt={label}
            className={`w-full ${aspectRatioClass} object-contain rounded-lg border-2 border-turquoise-200`}
          />
          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleClick}
              disabled={disabled || isUploading}
            >
              <Upload className="h-4 w-4 mr-1" />
              Replace
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={disabled || isUploading}
            >
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={`w-full ${aspectRatioClass} border-2 border-dashed border-turquoise-300 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-turquoise-500 hover:bg-turquoise-50 transition-colors`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-turquoise-600 animate-spin" />
              <p className="text-sm text-turquoise-700">Uploading...</p>
            </>
          ) : (
            <>
              <ImageIcon className="h-12 w-12 text-turquoise-400" />
              <p className="text-sm text-turquoise-700 font-medium">
                Click to upload image
              </p>
              <p className="text-xs text-turquoise-600">
                PNG, JPG, WebP or GIF (max 5MB)
              </p>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

    </div>
  );
};
