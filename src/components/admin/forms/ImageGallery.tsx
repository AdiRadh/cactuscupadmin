import type { FC } from 'react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui';
import { Upload, X, Loader2 } from 'lucide-react';
import { validateImageFile } from '@/lib/utils/imageUpload';

interface ImageGalleryProps {
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  onUpload: (file: File) => Promise<{ url: string } | { error: string }>;
  onDelete?: (url: string) => Promise<void>;
  helperText?: string;
  maxImages?: number;
  disabled?: boolean;
}

/**
 * Image gallery component for multiple image uploads
 * Supports preview, validation, deletion, and reordering
 */
export const ImageGallery: FC<ImageGalleryProps> = ({
  label,
  value,
  onChange,
  onUpload,
  onDelete,
  helperText,
  maxImages = 10,
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check max images limit
    if (value.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setError(null);
    setIsUploading(true);

    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      setUploadingIndex(value.length + i);

      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        continue;
      }

      try {
        // Upload file
        const result = await onUpload(file);

        if ('error' in result) {
          setError(result.error);
        } else {
          newUrls.push(result.url);
        }
      } catch (err) {
        setError('Failed to upload image');
      }
    }

    onChange([...value, ...newUrls]);
    setIsUploading(false);
    setUploadingIndex(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (index: number) => {
    const urlToDelete = value[index];
    if (!urlToDelete) return;

    setIsUploading(true);
    setError(null);

    try {
      if (onDelete) {
        await onDelete(urlToDelete);
      }
      const newUrls = value.filter((_, i) => i !== index);
      onChange(newUrls);
    } catch (err) {
      setError('Failed to delete image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (value.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {helperText && (
        <p className="text-sm text-turquoise-600">{helperText}</p>
      )}

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {value.map((url, index) => (
          <div key={url} className="relative group">
            <img
              src={url}
              alt={`Gallery ${index + 1}`}
              className="w-full h-32 object-cover rounded-lg border-2 border-turquoise-200"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(index)}
                disabled={disabled || isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {uploadingIndex === index && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
          </div>
        ))}

        {/* Upload Button */}
        {value.length < maxImages && (
          <div
            onClick={handleClick}
            className="w-full h-32 border-2 border-dashed border-turquoise-300 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-turquoise-500 hover:bg-turquoise-50 transition-colors"
          >
            {isUploading && uploadingIndex === value.length ? (
              <Loader2 className="h-6 w-6 text-turquoise-600 animate-spin" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-turquoise-400" />
                <p className="text-xs text-turquoise-700 font-medium text-center px-2">
                  Add Image
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Image count */}
      <p className="text-sm text-turquoise-600">
        {value.length} / {maxImages} images
      </p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        multiple
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
