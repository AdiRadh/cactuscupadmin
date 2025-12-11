import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, NativeSelect, Button } from '@/components/ui';
import type { Addon, AddonCategory } from '@/types';
import { ImageUpload } from './ImageUpload';
import { ImageGallery } from './ImageGallery';
import { uploadAddonImage, deleteAddonImage, getFilePathFromPublicUrl, ADDONS_BUCKET } from '@/lib/utils/imageUpload';

export interface AddonFormData {
  name: string;
  slug: string;
  description: string;
  category: AddonCategory;
  price: number; // in dollars (converted to/from cents)
  hasInventory: boolean;
  stockQuantity: number | null;
  maxPerOrder: number | null;
  isActive: boolean;
  imageUrl: string | null;
  galleryUrls: string[];
}

interface AddonFormProps {
  initialData?: Addon;
  onSubmit: (data: AddonFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitText?: string;
}

const CATEGORY_OPTIONS: { value: AddonCategory; label: string }[] = [
  { value: 'apparel', label: 'Apparel' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'other', label: 'Other' },
];

/**
 * Reusable add-on form component
 * Used for both creating and editing add-ons
 */
export const AddonForm: FC<AddonFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText = 'Save Add-On',
}) => {
  const [formData, setFormData] = useState<AddonFormData>({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    category: initialData?.category || 'merchandise',
    price: initialData ? initialData.price / 100 : 0, // Convert cents to dollars
    hasInventory: initialData?.hasInventory ?? false,
    stockQuantity: initialData?.stockQuantity ?? null,
    maxPerOrder: initialData?.maxPerOrder ?? null,
    isActive: initialData?.isActive ?? true,
    imageUrl: initialData?.imageUrl ?? null,
    galleryUrls: initialData?.galleryUrls ?? [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AddonFormData, string>>>({});

  // Auto-generate slug from name
  useEffect(() => {
    if (!initialData && formData.name) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  }, [formData.name, initialData]);

  const handleChange = (
    field: keyof AddonFormData,
    value: string | number | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AddonFormData, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.slug.trim()) newErrors.slug = 'Slug is required';
    if (formData.price < 0) newErrors.price = 'Price cannot be negative';
    if (formData.hasInventory && (formData.stockQuantity === null || formData.stockQuantity < 0)) {
      newErrors.stockQuantity = 'Stock quantity is required when inventory tracking is enabled';
    }
    if (formData.maxPerOrder !== null && formData.maxPerOrder < 1) {
      newErrors.maxPerOrder = 'Max per order must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">
                Add-On Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Event T-Shirt"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="slug">
                URL Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                placeholder="event-t-shirt"
                className={errors.slug ? 'border-red-500' : ''}
              />
              {errors.slug && (
                <p className="text-sm text-red-600 mt-1">{errors.slug}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
            <NativeSelect
              id="category"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value as AddonCategory)}
              options={CATEGORY_OPTIONS}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of the add-on..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload
            label="Main Image"
            value={formData.imageUrl}
            onChange={(url) => handleChange('imageUrl', url)}
            onUpload={(file) => uploadAddonImage(file, initialData?.id || 'new', 'header')}
            onDelete={async (url) => {
              const path = getFilePathFromPublicUrl(url, ADDONS_BUCKET);
              if (path) await deleteAddonImage(path);
            }}
            helperText="Primary image displayed in listings. Recommended size: 800x600px"
            aspectRatio="landscape"
          />

          <ImageGallery
            label="Gallery Images"
            value={formData.galleryUrls}
            onChange={(urls) => setFormData((prev) => ({ ...prev, galleryUrls: urls }))}
            onUpload={(file) => uploadAddonImage(file, initialData?.id || 'new', 'gallery')}
            onDelete={async (url) => {
              const path = getFilePathFromPublicUrl(url, ADDONS_BUCKET);
              if (path) await deleteAddonImage(path);
            }}
            helperText="Additional images for the add-on detail view"
            maxImages={6}
          />
        </CardContent>
      </Card>

      {/* Pricing & Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing & Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="price">
                Price ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                className={errors.price ? 'border-red-500' : ''}
              />
              {errors.price && (
                <p className="text-sm text-red-600 mt-1">{errors.price}</p>
              )}
            </div>

            <div>
              <Label htmlFor="maxPerOrder">Max Per Order (Optional)</Label>
              <Input
                id="maxPerOrder"
                type="number"
                min="1"
                value={formData.maxPerOrder || ''}
                onChange={(e) => handleChange('maxPerOrder', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="No limit"
                className={errors.maxPerOrder ? 'border-red-500' : ''}
              />
              {errors.maxPerOrder && (
                <p className="text-sm text-red-600 mt-1">{errors.maxPerOrder}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasInventory"
                checked={formData.hasInventory}
                onChange={(e) => handleChange('hasInventory', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <Label htmlFor="hasInventory" className="cursor-pointer">
                Track inventory for this add-on
              </Label>
            </div>

            {formData.hasInventory && (
              <div>
                <Label htmlFor="stockQuantity">
                  Stock Quantity <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="stockQuantity"
                  type="number"
                  min="0"
                  value={formData.stockQuantity || ''}
                  onChange={(e) => handleChange('stockQuantity', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className={errors.stockQuantity ? 'border-red-500' : ''}
                />
                {errors.stockQuantity && (
                  <p className="text-sm text-red-600 mt-1">{errors.stockQuantity}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Add-on is active and available for purchase
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Information (Read-only) */}
      {initialData?.stripeProductId && (
        <Card>
          <CardHeader>
            <CardTitle>Stripe Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-white/70">Stripe Product ID</Label>
              <p className="text-sm text-white font-mono bg-turquoise-900/50 px-3 py-2 rounded">
                {initialData.stripeProductId}
              </p>
            </div>
            {initialData.stripePriceId && (
              <div>
                <Label className="text-white/70">Stripe Price ID</Label>
                <p className="text-sm text-white font-mono bg-turquoise-900/50 px-3 py-2 rounded">
                  {initialData.stripePriceId}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitText}
        </Button>
      </div>
    </form>
  );
};
