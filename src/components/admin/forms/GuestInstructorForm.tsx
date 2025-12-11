import type { FC } from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Button } from '@/components/ui';
import type { GuestInstructor } from '@/types';
import { ImageUpload } from './ImageUpload';
import { uploadGuestInstructorImage, deleteGuestInstructorImage, getFilePathFromPublicUrl, GUEST_INSTRUCTORS_BUCKET } from '@/lib/utils/imageUpload';

export interface GuestInstructorFormData {
  name: string;
  bio: string;
  specialties: string; // comma-separated (converted to/from array)
  teachingFocus: string;
  photoUrl: string | null;
  websiteUrl: string;
  socialInstagram: string;
  socialFacebook: string;
  socialYoutube: string;
  isFeatured: boolean;
  displayOrder: number;
}

interface GuestInstructorFormProps {
  initialData?: GuestInstructor;
  onSubmit: (data: GuestInstructorFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitText?: string;
}

/**
 * Reusable guest instructor form component
 * Used for both creating and editing guest instructors
 */
export const GuestInstructorForm: FC<GuestInstructorFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText = 'Save Guest Instructor',
}) => {
  const [formData, setFormData] = useState<GuestInstructorFormData>({
    name: initialData?.name || '',
    bio: initialData?.bio || '',
    specialties: initialData?.specialties ? initialData.specialties.join(', ') : '',
    teachingFocus: initialData?.teachingFocus || '',
    photoUrl: initialData?.photoUrl || null,
    websiteUrl: initialData?.websiteUrl || '',
    socialInstagram: initialData?.socialLinks?.instagram || '',
    socialFacebook: initialData?.socialLinks?.facebook || '',
    socialYoutube: initialData?.socialLinks?.youtube || '',
    isFeatured: initialData?.isFeatured || false,
    displayOrder: initialData?.displayOrder || 0,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof GuestInstructorFormData, string>>>({});

  const handleChange = (
    field: keyof GuestInstructorFormData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof GuestInstructorFormData, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.bio.trim()) newErrors.bio = 'Bio is required';
    if (formData.displayOrder < 0) newErrors.displayOrder = 'Display order cannot be negative';

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
          <div>
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., John Smith"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <Label htmlFor="bio">
              Bio <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Brief biography of the instructor..."
              rows={5}
              className={errors.bio ? 'border-red-500' : ''}
            />
            {errors.bio && (
              <p className="text-sm text-red-600 mt-1">{errors.bio}</p>
            )}
          </div>

          <div>
            <Label htmlFor="specialties">Specialties (comma-separated)</Label>
            <Input
              id="specialties"
              value={formData.specialties}
              onChange={(e) => handleChange('specialties', e.target.value)}
              placeholder="e.g., Longsword, Rapier, Historical Fencing"
            />
            <p className="text-sm text-turquoise-600 mt-1">
              Separate specialties with commas
            </p>
          </div>

          <div>
            <Label htmlFor="teachingFocus">Teaching Focus</Label>
            <Textarea
              id="teachingFocus"
              value={formData.teachingFocus}
              onChange={(e) => handleChange('teachingFocus', e.target.value)}
              placeholder="What this instructor focuses on teaching..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact & Links */}
      <Card>
        <CardHeader>
          <CardTitle>Contact & Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => handleChange('websiteUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="socialInstagram">Instagram</Label>
              <Input
                id="socialInstagram"
                value={formData.socialInstagram}
                onChange={(e) => handleChange('socialInstagram', e.target.value)}
                placeholder="@username"
              />
            </div>

            <div>
              <Label htmlFor="socialFacebook">Facebook</Label>
              <Input
                id="socialFacebook"
                value={formData.socialFacebook}
                onChange={(e) => handleChange('socialFacebook', e.target.value)}
                placeholder="Username or URL"
              />
            </div>

            <div>
              <Label htmlFor="socialYoutube">YouTube</Label>
              <Input
                id="socialYoutube"
                value={formData.socialYoutube}
                onChange={(e) => handleChange('socialYoutube', e.target.value)}
                placeholder="Channel URL"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                min="0"
                value={formData.displayOrder}
                onChange={(e) => handleChange('displayOrder', parseInt(e.target.value) || 0)}
                className={errors.displayOrder ? 'border-red-500' : ''}
              />
              {errors.displayOrder && (
                <p className="text-sm text-red-600 mt-1">{errors.displayOrder}</p>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <input
                type="checkbox"
                id="isFeatured"
                checked={formData.isFeatured}
                onChange={(e) => handleChange('isFeatured', e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isFeatured">Featured Instructor</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo */}
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload
            label="Instructor Photo"
            value={formData.photoUrl}
            onChange={(url) => handleChange('photoUrl', url || '')}
            onUpload={async (file) => {
              const instructorId = initialData?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'temp-' + Date.now();
              return uploadGuestInstructorImage(file, instructorId, 'header');
            }}
            onDelete={async (url) => {
              const path = getFilePathFromPublicUrl(url, GUEST_INSTRUCTORS_BUCKET);
              if (path) {
                await deleteGuestInstructorImage(path);
              }
            }}
            helperText="Recommended size: 400x400px (1:1 square). This image will be displayed as the instructor's profile photo."
            aspectRatio="square"
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
