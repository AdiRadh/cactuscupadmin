import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, NativeSelect, Button } from '@/components/ui';
import type { Tournament, WeaponType, DivisionType, TournamentStatus } from '@/types';
import { ImageUpload } from './ImageUpload';
import { ImageGallery } from './ImageGallery';
import { uploadTournamentImage, deleteTournamentImage, getFilePathFromUrl } from '@/lib/utils/imageUpload';
import { utcToDatetimeLocal, formatDateTime } from '@/lib/utils/dateUtils';

export interface TournamentFormData {
  name: string;
  slug: string;
  weapon: WeaponType;
  division: DivisionType;
  description: string;
  rules: string;
  maxParticipants: number;
  registrationFee: number; // in dollars (converted to/from cents)
  earlyBirdPrice: number | null; // in dollars (converted to/from cents)
  earlyBirdStartDate: string;
  earlyBirdEndDate: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: TournamentStatus;
  visible: boolean;
  headerImageUrl: string | null;
  galleryImages: string[];
}

interface TournamentFormProps {
  initialData?: Tournament;
  onSubmit: (data: TournamentFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitText?: string;
}

const WEAPON_OPTIONS: { value: WeaponType; label: string }[] = [
  { value: 'longsword', label: 'Longsword' },
  { value: 'saber', label: 'Saber' },
  { value: 'rapier', label: 'Rapier' },
  { value: 'sword-buckler', label: 'Sword & Buckler' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'other', label: 'Other' },
];

const DIVISION_OPTIONS: { value: DivisionType; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'womens', label: "Women's" },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const STATUS_OPTIONS: { value: TournamentStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open for Registration' },
  { value: 'closed', label: 'Closed' },
  { value: 'full', label: 'Full' },
  { value: 'completed', label: 'Completed' },
];

/**
 * Reusable tournament form component
 * Used for both creating and editing tournaments
 */
export const TournamentForm: FC<TournamentFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText = 'Save Tournament',
}) => {
  const [formData, setFormData] = useState<TournamentFormData>({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    weapon: initialData?.weapon || 'longsword',
    division: initialData?.division || 'open',
    description: initialData?.description || '',
    rules: initialData?.rules || '',
    maxParticipants: initialData?.maxParticipants || 32,
    registrationFee: initialData ? initialData.registrationFee / 100 : 35, // Convert cents to dollars
    earlyBirdPrice: initialData?.earlyBirdPrice ? initialData.earlyBirdPrice / 100 : null, // Convert cents to dollars
    earlyBirdStartDate: utcToDatetimeLocal(initialData?.earlyBirdStartDate),
    earlyBirdEndDate: utcToDatetimeLocal(initialData?.earlyBirdEndDate),
    date: initialData?.date || '',
    startTime: initialData?.startTime || '',
    endTime: initialData?.endTime || '',
    location: initialData?.location || '',
    status: initialData?.status || 'draft',
    visible: initialData?.visible ?? true,
    headerImageUrl: initialData?.headerImageUrl || null,
    galleryImages: initialData?.galleryImages || [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof TournamentFormData, string>>>({});

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
    field: keyof TournamentFormData,
    value: string | number | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TournamentFormData, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.slug.trim()) newErrors.slug = 'Slug is required';
    if (formData.maxParticipants < 1) newErrors.maxParticipants = 'Must be at least 1';
    if (formData.registrationFee < 0) newErrors.registrationFee = 'Fee cannot be negative';
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.startTime) newErrors.startTime = 'Start time is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';

    // Validate early bird pricing
    if (formData.earlyBirdPrice !== null) {
      if (formData.earlyBirdPrice >= formData.registrationFee) {
        newErrors.earlyBirdPrice = 'Early bird price must be less than regular price';
      }
      if (!formData.earlyBirdStartDate) {
        newErrors.earlyBirdStartDate = 'Start date required when early bird price is set';
      }
      if (!formData.earlyBirdEndDate) {
        newErrors.earlyBirdEndDate = 'End date required when early bird price is set';
      }
      if (formData.earlyBirdStartDate && formData.earlyBirdEndDate) {
        const start = new Date(formData.earlyBirdStartDate);
        const end = new Date(formData.earlyBirdEndDate);
        if (start >= end) {
          newErrors.earlyBirdEndDate = 'End date must be after start date';
        }
      }
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
                Tournament Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Longsword Open"
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
                placeholder="longsword-open"
                className={errors.slug ? 'border-red-500' : ''}
              />
              {errors.slug && (
                <p className="text-sm text-red-600 mt-1">{errors.slug}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="weapon">Weapon Type <span className="text-red-500">*</span></Label>
              <NativeSelect
                id="weapon"
                value={formData.weapon}
                onChange={(e) => handleChange('weapon', e.target.value as WeaponType)}
                options={WEAPON_OPTIONS}
              />
            </div>

            <div>
              <Label htmlFor="division">Division <span className="text-red-500">*</span></Label>
              <NativeSelect
                id="division"
                value={formData.division}
                onChange={(e) => handleChange('division', e.target.value as DivisionType)}
                options={DIVISION_OPTIONS}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of the tournament..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="rules">Rules & Format</Label>
            <Textarea
              id="rules"
              value={formData.rules}
              onChange={(e) => handleChange('rules', e.target.value)}
              placeholder="Tournament rules, format, and requirements..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule & Location */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule & Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="date">Date <span className="text-red-500">*</span></Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className={errors.date ? 'border-red-500' : ''}
              />
              {errors.date && (
                <p className="text-sm text-red-600 mt-1">{errors.date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="startTime">Start Time <span className="text-red-500">*</span></Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleChange('startTime', e.target.value)}
                className={errors.startTime ? 'border-red-500' : ''}
              />
              {errors.startTime && (
                <p className="text-sm text-red-600 mt-1">{errors.startTime}</p>
              )}
            </div>

            <div>
              <Label htmlFor="endTime">End Time (Optional)</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleChange('endTime', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location <span className="text-red-500">*</span></Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g., Main Arena, Ring 1"
              className={errors.location ? 'border-red-500' : ''}
            />
            {errors.location && (
              <p className="text-sm text-red-600 mt-1">{errors.location}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Registration Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Registration Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="maxParticipants">
                Max Participants <span className="text-red-500">*</span>
              </Label>
              <Input
                id="maxParticipants"
                type="number"
                min="1"
                value={formData.maxParticipants}
                onChange={(e) => handleChange('maxParticipants', parseInt(e.target.value) || 0)}
                className={errors.maxParticipants ? 'border-red-500' : ''}
              />
              {errors.maxParticipants && (
                <p className="text-sm text-red-600 mt-1">{errors.maxParticipants}</p>
              )}
            </div>

            <div>
              <Label htmlFor="registrationFee">
                Registration Fee ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="registrationFee"
                type="number"
                min="0"
                step="0.01"
                value={formData.registrationFee}
                onChange={(e) => handleChange('registrationFee', parseFloat(e.target.value) || 0)}
                className={errors.registrationFee ? 'border-red-500' : ''}
              />
              {errors.registrationFee && (
                <p className="text-sm text-red-600 mt-1">{errors.registrationFee}</p>
              )}
            </div>

            <div>
              <Label htmlFor="status">Status <span className="text-red-500">*</span></Label>
              <NativeSelect
                id="status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as TournamentStatus)}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              id="visible"
              type="checkbox"
              checked={formData.visible}
              onChange={(e) => handleChange('visible', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="visible" className="cursor-pointer">
              Visible on public site and in registration flow
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Early Bird Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Early Bird Pricing (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Set a discounted price available during a specific time period.
              Leave fields empty to disable early bird pricing.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="earlyBirdPrice">Early Bird Price ($)</Label>
              <Input
                id="earlyBirdPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.earlyBirdPrice ?? ''}
                onChange={(e) => handleChange('earlyBirdPrice', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g., 30.00"
                className={errors.earlyBirdPrice ? 'border-red-500' : ''}
              />
              {errors.earlyBirdPrice && (
                <p className="text-sm text-red-600 mt-1">{errors.earlyBirdPrice}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Must be less than regular price (${formData.registrationFee})
              </p>
            </div>

            <div>
              <Label htmlFor="earlyBirdStartDate">Start Date</Label>
              <Input
                id="earlyBirdStartDate"
                type="datetime-local"
                value={formData.earlyBirdStartDate}
                onChange={(e) => handleChange('earlyBirdStartDate', e.target.value)}
                className={errors.earlyBirdStartDate ? 'border-red-500' : ''}
              />
              {errors.earlyBirdStartDate && (
                <p className="text-sm text-red-600 mt-1">{errors.earlyBirdStartDate}</p>
              )}
            </div>

            <div>
              <Label htmlFor="earlyBirdEndDate">End Date</Label>
              <Input
                id="earlyBirdEndDate"
                type="datetime-local"
                value={formData.earlyBirdEndDate}
                onChange={(e) => handleChange('earlyBirdEndDate', e.target.value)}
                className={errors.earlyBirdEndDate ? 'border-red-500' : ''}
              />
              {errors.earlyBirdEndDate && (
                <p className="text-sm text-red-600 mt-1">{errors.earlyBirdEndDate}</p>
              )}
            </div>
          </div>

          {formData.earlyBirdPrice && formData.earlyBirdStartDate && formData.earlyBirdEndDate && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-800">
                Early bird price of <strong>${formData.earlyBirdPrice}</strong> will be available from{' '}
                {formatDateTime(formData.earlyBirdStartDate + 'Z')} to{' '}
                {formatDateTime(formData.earlyBirdEndDate + 'Z')} (Arizona Time)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload
            label="Header Image"
            value={formData.headerImageUrl}
            onChange={(url) => handleChange('headerImageUrl', url || '')}
            onUpload={async (file) => {
              // Use tournament slug or 'new' for new tournaments
              const tournamentId = initialData?.slug || 'temp-' + Date.now();
              return uploadTournamentImage(file, tournamentId, 'header');
            }}
            onDelete={async (url) => {
              const path = getFilePathFromUrl(url);
              if (path) {
                await deleteTournamentImage(path);
              }
            }}
            helperText="Recommended size: 1200x400px. This image will be displayed at the top of the tournament page."
          />

          <ImageGallery
            label="Image Gallery"
            value={formData.galleryImages}
            onChange={(urls) => setFormData(prev => ({ ...prev, galleryImages: urls }))}
            onUpload={async (file) => {
              const tournamentId = initialData?.slug || 'temp-' + Date.now();
              return uploadTournamentImage(file, tournamentId, 'gallery');
            }}
            onDelete={async (url) => {
              const path = getFilePathFromUrl(url);
              if (path) {
                await deleteTournamentImage(path);
              }
            }}
            helperText="Upload additional images to showcase the tournament. Maximum 10 images."
            maxImages={10}
          />
        </CardContent>
      </Card>

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
