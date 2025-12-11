import type { FC } from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Button } from '@/components/ui';
import type { Organizer } from '@/types';
import { ImageUpload } from './ImageUpload';
import { uploadOrganizerImage, deleteOrganizerImage, getFilePathFromPublicUrl, ORGANIZERS_BUCKET } from '@/lib/utils/imageUpload';

export interface OrganizerFormData {
  name: string;
  role: string;
  bio: string;
  photoUrl: string | null;
  email: string;
  phone: string;
  socialInstagram: string;
  socialFacebook: string;
  socialYoutube: string;
  displayOrder: number;
}

interface OrganizerFormProps {
  initialData?: Organizer;
  onSubmit: (data: OrganizerFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitText?: string;
}

export const OrganizerForm: FC<OrganizerFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText = 'Save Organizer',
}) => {
  const [formData, setFormData] = useState<OrganizerFormData>({
    name: initialData?.name || '',
    role: initialData?.role || '',
    bio: initialData?.bio || '',
    photoUrl: initialData?.photoUrl || null,
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    socialInstagram: initialData?.socialLinks?.instagram || '',
    socialFacebook: initialData?.socialLinks?.facebook || '',
    socialYoutube: initialData?.socialLinks?.youtube || '',
    displayOrder: initialData?.displayOrder || 0,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrganizerFormData, string>>>({});

  const handleChange = (field: keyof OrganizerFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof OrganizerFormData, string>> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.role.trim()) newErrors.role = 'Role is required';
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
      <Card>
        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className={errors.name ? 'border-red-500' : ''} />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="role">Role <span className="text-red-500">*</span></Label>
            <Input id="role" value={formData.role} onChange={(e) => handleChange('role', e.target.value)} placeholder="e.g., Event Director" className={errors.role ? 'border-red-500' : ''} />
            {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role}</p>}
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={formData.bio} onChange={(e) => handleChange('bio', e.target.value)} rows={4} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} /></div>
            <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label htmlFor="socialInstagram">Instagram</Label><Input id="socialInstagram" value={formData.socialInstagram} onChange={(e) => handleChange('socialInstagram', e.target.value)} /></div>
            <div><Label htmlFor="socialFacebook">Facebook</Label><Input id="socialFacebook" value={formData.socialFacebook} onChange={(e) => handleChange('socialFacebook', e.target.value)} /></div>
            <div><Label htmlFor="socialYoutube">YouTube</Label><Input id="socialYoutube" value={formData.socialYoutube} onChange={(e) => handleChange('socialYoutube', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Display Settings</CardTitle></CardHeader>
        <CardContent>
          <Label htmlFor="displayOrder">Display Order</Label>
          <Input id="displayOrder" type="number" min="0" value={formData.displayOrder} onChange={(e) => handleChange('displayOrder', parseInt(e.target.value) || 0)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Photo</CardTitle></CardHeader>
        <CardContent>
          <ImageUpload label="Organizer Photo" value={formData.photoUrl} onChange={(url) => handleChange('photoUrl', url || '')} onUpload={async (file) => { const id = initialData?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'temp-' + Date.now(); return uploadOrganizerImage(file, id, 'header'); }} onDelete={async (url) => { const path = getFilePathFromPublicUrl(url, ORGANIZERS_BUCKET); if (path) await deleteOrganizerImage(path); }} helperText="Recommended: 400x400px" />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : submitText}</Button>
      </div>
    </form>
  );
};
