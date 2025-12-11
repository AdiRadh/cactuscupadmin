import type { FC } from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Button } from '@/components/ui';
import type { AboutSection } from '@/types';
import { ImageUpload } from './ImageUpload';
import { ImageGallery } from './ImageGallery';
import { uploadAboutImage, deleteAboutImage, getFilePathFromPublicUrl, ABOUT_IMAGES_BUCKET } from '@/lib/utils/imageUpload';

export interface AboutSectionFormData {
  sectionKey: string;
  title: string;
  content: string;
  imageUrl: string | null;
  galleryUrls: string[];
  displayOrder: number;
  isPublished: boolean;
}

interface AboutSectionFormProps {
  initialData?: AboutSection;
  onSubmit: (data: AboutSectionFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitText?: string;
}

export const AboutSectionForm: FC<AboutSectionFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText = 'Save Section',
}) => {
  const [formData, setFormData] = useState<AboutSectionFormData>({
    sectionKey: initialData?.sectionKey || 'mission',
    title: initialData?.title || '',
    content: initialData?.content || '',
    imageUrl: initialData?.imageUrl || null,
    galleryUrls: initialData?.galleryUrls || [],
    displayOrder: initialData?.displayOrder || 0,
    isPublished: initialData?.isPublished ?? true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AboutSectionFormData, string>>>({});

  const handleChange = (field: keyof AboutSectionFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AboutSectionFormData, string>> = {};
    if (!formData.sectionKey.trim()) newErrors.sectionKey = 'Section key is required';
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.content.trim()) newErrors.content = 'Content is required';
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
        <CardHeader><CardTitle>Section Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sectionKey">Section Key <span className="text-red-500">*</span></Label>
            <select id="sectionKey" value={formData.sectionKey} onChange={(e) => handleChange('sectionKey', e.target.value)} className="w-full px-3 py-2 border rounded" disabled={!!initialData}>
              <option value="mission">Mission</option>
              <option value="history">History</option>
              <option value="values">Values</option>
              <option value="venue_info">Venue Info</option>
            </select>
            {errors.sectionKey && <p className="text-sm text-red-600 mt-1">{errors.sectionKey}</p>}
          </div>
          <div>
            <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
            <Input id="title" value={formData.title} onChange={(e) => handleChange('title', e.target.value)} className={errors.title ? 'border-red-500' : ''} />
            {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
          </div>
          <div>
            <Label htmlFor="content">Content <span className="text-red-500">*</span></Label>
            <Textarea id="content" value={formData.content} onChange={(e) => handleChange('content', e.target.value)} rows={6} className={errors.content ? 'border-red-500' : ''} />
            {errors.content && <p className="text-sm text-red-600 mt-1">{errors.content}</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label htmlFor="displayOrder">Display Order</Label><Input id="displayOrder" type="number" min="0" value={formData.displayOrder} onChange={(e) => handleChange('displayOrder', parseInt(e.target.value) || 0)} /></div>
            <div className="flex items-center space-x-2 pt-8"><input type="checkbox" id="isPublished" checked={formData.isPublished} onChange={(e) => handleChange('isPublished', e.target.checked)} className="rounded border-gray-300" /><Label htmlFor="isPublished">Published</Label></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Images</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload label="Main Image" value={formData.imageUrl} onChange={(url) => handleChange('imageUrl', url || '')} onUpload={async (file) => uploadAboutImage(file, formData.sectionKey, 'header')} onDelete={async (url) => { const path = getFilePathFromPublicUrl(url, ABOUT_IMAGES_BUCKET); if (path) await deleteAboutImage(path); }} />
          <ImageGallery label="Image Gallery" value={formData.galleryUrls} onChange={(urls) => handleChange('galleryUrls', urls)} onUpload={async (file) => uploadAboutImage(file, formData.sectionKey, 'gallery')} onDelete={async (url) => { const path = getFilePathFromPublicUrl(url, ABOUT_IMAGES_BUCKET); if (path) await deleteAboutImage(path); }} maxImages={10} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : submitText}</Button>
      </div>
    </form>
  );
};
