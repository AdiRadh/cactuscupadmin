import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AboutSectionForm, type AboutSectionFormData } from '@/components/admin/forms/AboutSectionForm';
import type { AboutSection } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { useAdmin } from '@/hooks';

export const AboutSectionEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [section, setSection] = useState<AboutSection | null>(null);
  const { getAboutSection, updateAboutSection } = useAdmin();

  useEffect(() => {
    const fetchSection = async () => {
      if (!id) return;

      setIsFetching(true);
      try {
        const data = await getAboutSection(id);
        setSection(data);
      } catch (error) {
        console.error('Error fetching about section:', error);
        alert('Failed to load about section data.');
      } finally {
        setIsFetching(false);
      }
    };

    fetchSection();
  }, [id, getAboutSection]);

  const handleSubmit = async (data: AboutSectionFormData) => {
    if (!id) return;

    setIsLoading(true);
    try {
      await updateAboutSection(id, {
        section_key: data.sectionKey,
        title: data.title,
        content: data.content,
        image_url: data.imageUrl || null,
        gallery_urls: data.galleryUrls || [],
        display_order: data.displayOrder,
        is_published: data.isPublished,
      });
      navigate('/admin/about-sections');
    } catch (error) {
      console.error('Error updating about section:', error);
      alert('Failed to update about section. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-turquoise-600">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!section) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">Section not found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-viking text-turquoise-900">Edit About Section</h1>
        <p className="text-turquoise-700 mt-2">Update content section information</p>
      </div>
      <AboutSectionForm
        initialData={section}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/about-sections')}
        isLoading={isLoading}
        submitText="Update Section"
      />
    </div>
  );
};
