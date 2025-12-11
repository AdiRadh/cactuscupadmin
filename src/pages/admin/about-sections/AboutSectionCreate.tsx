import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AboutSectionForm, type AboutSectionFormData } from '@/components/admin/forms/AboutSectionForm';
import { useAdmin } from '@/hooks';

export const AboutSectionCreate: FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { createAboutSection } = useAdmin();

  const handleSubmit = async (data: AboutSectionFormData) => {
    setIsLoading(true);
    try {
      await createAboutSection({
        section_key: data.sectionKey,
        title: data.title,
        content: data.content,
        image_url: data.imageUrl || null,
        gallery_urls: data.galleryUrls || [],
        display_order: data.displayOrder,
        is_published: data.isPublished,
        icon: null,
        metadata: null,
        section_type: null,
      });
      navigate('/admin/about-sections');
    } catch (error) {
      console.error('Error creating about section:', error);
      alert('Failed to create about section. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-viking text-turquoise-900">Add About Section</h1>
        <p className="text-turquoise-700 mt-2">Create a new content section for the About page</p>
      </div>
      <AboutSectionForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/about-sections')}
        isLoading={isLoading}
        submitText="Create Section"
      />
    </div>
  );
};
