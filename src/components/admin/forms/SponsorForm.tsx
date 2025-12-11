import type { FC, FormEvent, ChangeEvent } from 'react';
import { useState } from 'react';
import { Store } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Button, Badge } from '@/components/ui';
import type { Sponsor } from '@/types';
import { ImageUpload } from './ImageUpload';
import { uploadSponsorImage, deleteSponsorImage, getFilePathFromPublicUrl, SPONSORS_BUCKET } from '@/lib/utils/imageUpload';

export interface SponsorFormData {
  name: string;
  type: 'sponsor' | 'vendor';
  tier: 'cholla' | 'creosote' | 'opuntia' | 'saguaro' | 'ocotillo' | null;
  description: string;
  logoUrl: string | null;
  websiteUrl: string;
  boothNumber: string;
  color: string;
  visible: boolean;
  displayOrder: number;
}

interface SponsorFormProps {
  onSubmit: (data: SponsorFormData) => void | Promise<void>;
  onCancel: () => void;
  initialData?: Partial<Sponsor>;
  isLoading?: boolean;
  submitText?: string;
}

/**
 * Form component for creating/editing sponsors
 */
export const SponsorForm: FC<SponsorFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
  submitText = 'Save',
}) => {
  const validTiers = ['cholla', 'creosote', 'opuntia', 'saguaro', 'ocotillo'];
  const [formData, setFormData] = useState<SponsorFormData>({
    name: initialData?.name || '',
    type: initialData?.type || 'sponsor',
    tier: (initialData?.tier && validTiers.includes(initialData.tier)) ? initialData.tier as SponsorFormData['tier'] : null,
    description: initialData?.description || '',
    logoUrl: initialData?.logoUrl || null,
    websiteUrl: initialData?.websiteUrl || '',
    boothNumber: initialData?.boothNumber || '',
    color: initialData?.color || '#10b981',
    visible: initialData?.visible ?? true,
    displayOrder: initialData?.displayOrder || 0,
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked :
              type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>

            {/* Name */}
            <div>
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Company or organization name"
                required
              />
            </div>

            {/* Type */}
            <div>
              <Label htmlFor="type">
                Type <span className="text-red-500">*</span>
              </Label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-900 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="sponsor">Sponsor</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>

            {/* Tier (only for sponsors) */}
            {formData.type === 'sponsor' && (
              <div>
                <Label htmlFor="tier">Tier</Label>
                <select
                  id="tier"
                  name="tier"
                  value={formData.tier || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, tier: (e.target.value || null) as SponsorFormData['tier'] }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-900 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select tier (optional)</option>
                  <option value="cholla">Cholla ($1,200+)</option>
                  <option value="creosote">Creosote ($900 - $1,199)</option>
                  <option value="opuntia">Opuntia ($600 - $899)</option>
                  <option value="saguaro">Saguaro ($300 - $599)</option>
                  <option value="ocotillo">Ocotillo ($1 - $299)</option>
                </select>
              </div>
            )}

            {/* Color (for sponsors) */}
            {formData.type === 'sponsor' && (
              <div>
                <Label htmlFor="color">Badge & Header Color</Label>
                <div className="flex items-center gap-3 mb-4">
                  <input
                    id="color"
                    name="color"
                    type="color"
                    value={formData.color}
                    onChange={handleChange}
                    className="h-10 w-16 rounded-md border border-input cursor-pointer"
                  />
                  <Input
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    placeholder="#10b981"
                    className="flex-1"
                  />
                </div>

                {/* Live Card Preview */}
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Card Preview:</p>
                  <div className="bg-gradient-to-b from-teal-800 to-teal-700 p-4 rounded-lg">
                    <Card className="max-w-xs cursor-pointer hover:border-orange-500/60 transition-all">
                      <CardHeader className="pb-3">
                        {formData.logoUrl ? (
                          <div className="w-full aspect-[4/3] rounded-lg overflow-hidden mb-4 bg-white p-4 flex items-center justify-center">
                            <img
                              src={formData.logoUrl}
                              alt={formData.name || 'Sponsor'}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/3] rounded-lg bg-teal-700/50 flex items-center justify-center mb-4">
                            <Store className="h-16 w-16 text-teal-400" />
                          </div>
                        )}
                        <CardTitle className="text-xl text-white">{formData.name || 'Sponsor Name'}</CardTitle>
                        {formData.tier && (
                          <Badge
                            className="w-fit mt-2 text-white"
                            style={{ backgroundColor: formData.color }}
                          >
                            {formData.tier.charAt(0).toUpperCase() + formData.tier.slice(1)} Sponsor
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-white/80">
                          {formData.description ? formData.description.substring(0, 100) + (formData.description.length > 100 ? '...' : '') : 'Click to view details'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of the sponsor/vendor"
                rows={3}
              />
            </div>
          </div>

          {/* Media */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Media & Links</h3>

            {/* Logo Image Upload */}
            <ImageUpload
              label="Logo Image"
              value={formData.logoUrl}
              onChange={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
              onUpload={async (file) => {
                const sponsorId = initialData?.id || 'temp-' + Date.now();
                return uploadSponsorImage(file, sponsorId, 'header');
              }}
              onDelete={async (url) => {
                const path = getFilePathFromPublicUrl(url, SPONSORS_BUCKET);
                if (path) {
                  await deleteSponsorImage(path);
                }
              }}
              helperText="Upload a logo image for this sponsor/vendor. Recommended: PNG with transparent background."
              aspectRatio="square"
            />

            {/* Website URL */}
            <div>
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                value={formData.websiteUrl}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Event Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Event Information</h3>

            {/* Booth Number */}
            <div>
              <Label htmlFor="boothNumber">Booth Number (for vendors)</Label>
              <Input
                id="boothNumber"
                name="boothNumber"
                value={formData.boothNumber}
                onChange={handleChange}
                placeholder="A12"
              />
            </div>

            {/* Display Order */}
            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                name="displayOrder"
                type="number"
                min="0"
                value={formData.displayOrder}
                onChange={handleChange}
                placeholder="0"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Lower numbers appear first
              </p>
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Visibility</h3>

            <div className="flex items-center space-x-2">
              <input
                id="visible"
                name="visible"
                type="checkbox"
                checked={formData.visible}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label
                htmlFor="visible"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Visible on public page
              </Label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : submitText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};
