import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OrganizerForm, type OrganizerFormData } from '@/components/admin/forms/OrganizerForm';
import type { Organizer } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { useAdmin } from '@/hooks';

export const OrganizerEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const { getOrganizer, updateOrganizer } = useAdmin();

  useEffect(() => {
    const fetchOrganizer = async () => {
      if (!id) return;

      setIsFetching(true);
      try {
        const data = await getOrganizer(id);
        setOrganizer(data);
      } catch (error) {
        console.error('Error fetching organizer:', error);
        alert('Failed to load organizer data.');
      } finally {
        setIsFetching(false);
      }
    };

    fetchOrganizer();
  }, [id, getOrganizer]);

  const handleSubmit = async (data: OrganizerFormData) => {
    if (!id) return;

    setIsLoading(true);
    try {
      await updateOrganizer(id, {
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
      console.error('Error updating organizer:', error);
      alert('Failed to update organizer. Please try again.');
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

  if (!organizer) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">Organizer not found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-viking text-turquoise-900">Edit Organizer</h1>
        <p className="text-turquoise-700 mt-2">Update organizer information</p>
      </div>
      <OrganizerForm
        initialData={organizer}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/organizers')}
        isLoading={isLoading}
        submitText="Update Organizer"
      />
    </div>
  );
};
