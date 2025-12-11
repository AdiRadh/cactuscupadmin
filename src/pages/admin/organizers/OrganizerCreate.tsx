import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrganizerForm, type OrganizerFormData } from '@/components/admin/forms/OrganizerForm';
import { useAdmin } from '@/hooks';

export const OrganizerCreate: FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { createOrganizer } = useAdmin();

  const handleSubmit = async (data: OrganizerFormData) => {
    setIsLoading(true);
    try {
      await createOrganizer({
        name: data.name,
        role: data.role,
        bio: data.bio || null,
        photo_url: data.photoUrl || null,
        email: data.email || null,
        phone: data.phone || null,
        social_links: {
          instagram: data.socialInstagram || undefined,
          facebook: data.socialFacebook || undefined,
          youtube: data.socialYoutube || undefined,
        },
        display_order: data.displayOrder,
      });
      navigate('/admin/organizers');
    } catch (error) {
      console.error('Error creating organizer:', error);
      alert('Failed to create organizer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-viking text-turquoise-900">Add Organizer</h1>
        <p className="text-turquoise-700 mt-2">Create a new organizer profile</p>
      </div>
      <OrganizerForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/organizers')}
        isLoading={isLoading}
        submitText="Create Organizer"
      />
    </div>
  );
};
