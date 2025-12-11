import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, NativeSelect, Button } from '@/components/ui';
import type { Activity, ActivityType, ActivityStatus, SkillLevel } from '@/types';
import { ImageUpload } from './ImageUpload';
import { ImageGallery } from './ImageGallery';
import { uploadActivityImage, deleteActivityImage, getFilePathFromPublicUrl, ACTIVITIES_BUCKET } from '@/lib/utils/imageUpload';
import { utcToDatetimeLocal, formatDateTime } from '@/lib/utils/dateUtils';

export interface ActivityFormData {
  title: string;
  slug: string;
  type: ActivityType;
  instructor: string;
  description: string;
  date: string;
  startTime: string;
  duration: number; // in minutes
  maxParticipants: number | null;
  fee: number; // in dollars (converted to/from cents)
  earlyBirdPrice: number | null; // in dollars (converted to/from cents)
  earlyBirdStartDate: string;
  earlyBirdEndDate: string;
  requiresRegistration: boolean;
  skillLevel: SkillLevel | null;
  status: ActivityStatus;
  visible: boolean;
  headerImageUrl: string | null;
  galleryImages: string[];
}

interface ActivityFormProps {
  initialData?: Activity;
  onSubmit: (data: ActivityFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitText?: string;
}

const TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'social', label: 'Social' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'other', label: 'Other' },
];

const SKILL_LEVEL_OPTIONS: { value: SkillLevel; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const STATUS_OPTIONS: { value: ActivityStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open for Registration' },
  { value: 'closed', label: 'Closed' },
  { value: 'full', label: 'Full' },
  { value: 'completed', label: 'Completed' },
];

/**
 * Reusable activity form component
 * Used for both creating and editing activities
 */
export const ActivityForm: FC<ActivityFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText = 'Save Activity',
}) => {
  const [formData, setFormData] = useState<ActivityFormData>({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    type: initialData?.type || 'workshop',
    instructor: initialData?.instructor || '',
    description: initialData?.description || '',
    date: initialData?.date || '',
    startTime: initialData?.startTime || '',
    duration: initialData?.duration || 60,
    maxParticipants: initialData?.maxParticipants || null,
    fee: initialData ? initialData.fee / 100 : 0, // Convert cents to dollars
    earlyBirdPrice: initialData?.earlyBirdPrice ? initialData.earlyBirdPrice / 100 : null, // Convert cents to dollars
    earlyBirdStartDate: utcToDatetimeLocal(initialData?.earlyBirdStartDate),
    earlyBirdEndDate: utcToDatetimeLocal(initialData?.earlyBirdEndDate),
    requiresRegistration: initialData?.requiresRegistration ?? true,
    skillLevel: initialData?.skillLevel || 'all',
    status: initialData?.status || 'draft',
    visible: initialData?.visible ?? true,
    headerImageUrl: initialData?.headerImageUrl || null,
    galleryImages: initialData?.galleryImages || [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ActivityFormData, string>>>({});

  // Auto-generate slug from title
  useEffect(() => {
    if (!initialData && formData.title) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  }, [formData.title, initialData]);

  const handleChange = (
    field: keyof ActivityFormData,
    value: string | number | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ActivityFormData, string>> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.slug.trim()) newErrors.slug = 'Slug is required';
    if (!formData.instructor.trim()) newErrors.instructor = 'Instructor is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.startTime) newErrors.startTime = 'Start time is required';
    if (formData.duration < 1) newErrors.duration = 'Duration must be at least 1 minute';
    if (formData.fee < 0) newErrors.fee = 'Fee cannot be negative';
    if (formData.maxParticipants !== null && formData.maxParticipants < 1) {
      newErrors.maxParticipants = 'Must be at least 1';
    }

    // Validate early bird pricing
    if (formData.earlyBirdPrice !== null) {
      if (formData.earlyBirdPrice >= formData.fee) {
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
              <Label htmlFor="title">
                Activity Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Introduction to Longsword"
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-sm text-red-600 mt-1">{errors.title}</p>
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
                placeholder="introduction-to-longsword"
                className={errors.slug ? 'border-red-500' : ''}
              />
              {errors.slug && (
                <p className="text-sm text-red-600 mt-1">{errors.slug}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="type">Activity Type <span className="text-red-500">*</span></Label>
              <NativeSelect
                id="type"
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value as ActivityType)}
                options={TYPE_OPTIONS}
              />
            </div>

            <div>
              <Label htmlFor="instructor">
                Instructor <span className="text-red-500">*</span>
              </Label>
              <Input
                id="instructor"
                value={formData.instructor}
                onChange={(e) => handleChange('instructor', e.target.value)}
                placeholder="e.g., John Smith"
                className={errors.instructor ? 'border-red-500' : ''}
              />
              {errors.instructor && (
                <p className="text-sm text-red-600 mt-1">{errors.instructor}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Detailed description of the activity..."
              rows={4}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
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
              <Label htmlFor="duration">
                Duration (minutes) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => handleChange('duration', parseInt(e.target.value) || 0)}
                className={errors.duration ? 'border-red-500' : ''}
              />
              {errors.duration && (
                <p className="text-sm text-red-600 mt-1">{errors.duration}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Registration Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="maxParticipants">Max Participants (Optional)</Label>
              <Input
                id="maxParticipants"
                type="number"
                min="1"
                value={formData.maxParticipants ?? ''}
                onChange={(e) =>
                  handleChange('maxParticipants', e.target.value ? parseInt(e.target.value) : null)
                }
                placeholder="Leave empty for unlimited"
                className={errors.maxParticipants ? 'border-red-500' : ''}
              />
              {errors.maxParticipants && (
                <p className="text-sm text-red-600 mt-1">{errors.maxParticipants}</p>
              )}
            </div>

            <div>
              <Label htmlFor="fee">
                Fee ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="0.01"
                value={formData.fee}
                onChange={(e) => handleChange('fee', parseFloat(e.target.value) || 0)}
                className={errors.fee ? 'border-red-500' : ''}
              />
              {errors.fee && (
                <p className="text-sm text-red-600 mt-1">{errors.fee}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">Enter 0 for free activities</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="skillLevel">Skill Level</Label>
              <NativeSelect
                id="skillLevel"
                value={formData.skillLevel || 'all'}
                onChange={(e) => handleChange('skillLevel', e.target.value as SkillLevel)}
                options={SKILL_LEVEL_OPTIONS}
              />
            </div>

            <div>
              <Label htmlFor="requiresRegistration">Requires Registration</Label>
              <NativeSelect
                id="requiresRegistration"
                value={formData.requiresRegistration ? 'true' : 'false'}
                onChange={(e) => handleChange('requiresRegistration', e.target.value === 'true')}
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status <span className="text-red-500">*</span></Label>
            <NativeSelect
              id="status"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value as ActivityStatus)}
              options={STATUS_OPTIONS}
            />
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
                placeholder="e.g., 25.00"
                className={errors.earlyBirdPrice ? 'border-red-500' : ''}
              />
              {errors.earlyBirdPrice && (
                <p className="text-sm text-red-600 mt-1">{errors.earlyBirdPrice}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Must be less than regular price (${formData.fee})
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
              // Use activity slug or 'new' for new activities
              const activityId = initialData?.slug || 'temp-' + Date.now();
              return uploadActivityImage(file, activityId, 'header');
            }}
            onDelete={async (url) => {
              const path = getFilePathFromPublicUrl(url, ACTIVITIES_BUCKET);
              if (path) {
                await deleteActivityImage(path);
              }
            }}
            helperText="Recommended size: 1200x400px. This image will be displayed at the top of the activity page."
          />

          <ImageGallery
            label="Image Gallery"
            value={formData.galleryImages}
            onChange={(urls) => setFormData(prev => ({ ...prev, galleryImages: urls }))}
            onUpload={async (file) => {
              const activityId = initialData?.slug || 'temp-' + Date.now();
              return uploadActivityImage(file, activityId, 'gallery');
            }}
            onDelete={async (url) => {
              const path = getFilePathFromPublicUrl(url, ACTIVITIES_BUCKET);
              if (path) {
                await deleteActivityImage(path);
              }
            }}
            helperText="Upload additional images to showcase the activity. Maximum 10 images."
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
