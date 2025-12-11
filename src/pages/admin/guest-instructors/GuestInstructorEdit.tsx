import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GuestInstructorForm, type GuestInstructorFormData } from '@/components/admin/forms/GuestInstructorForm';
import type { GuestInstructor } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { useAdmin } from '@/hooks';

/**
 * Edit guest instructor page
 */
export const GuestInstructorEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [instructor, setInstructor] = useState<GuestInstructor | null>(null);
  const { getGuestInstructor, updateGuestInstructor } = useAdmin();

  useEffect(() => {
    const fetchInstructor = async () => {
      if (!id) return;

      setIsFetching(true);
      try {
        const data = await getGuestInstructor(id);
        setInstructor(data);
      } catch (error) {
        console.error('Error fetching guest instructor:', error);
        alert('Failed to load guest instructor data.');
      } finally {
        setIsFetching(false);
      }
    };

    fetchInstructor();
  }, [id, getGuestInstructor]);

  const handleSubmit = async (data: GuestInstructorFormData) => {
    if (!id) return;

    const dbData = {
      name: data.name,
      bio: data.bio,
      specialties: data.specialties
        ? data.specialties.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      teaching_focus: data.teachingFocus || null,
      photo_url: data.photoUrl || null,
      website_url: data.websiteUrl || null,
      social_links: {
        instagram: data.socialInstagram || undefined,
        facebook: data.socialFacebook || undefined,
        youtube: data.socialYoutube || undefined,
      },
      is_featured: data.isFeatured,
      display_order: data.displayOrder,
    };

    setIsLoading(true);
    try {
      await updateGuestInstructor(id, dbData);
      navigate('/guest-instructors');
    } catch (error) {
      console.error('Error updating guest instructor:', error);
      alert('Failed to update guest instructor. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/guest-instructors');
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

  if (!instructor) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">Instructor not found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-viking text-turquoise-900">Edit Guest Instructor</h1>
        <p className="text-turquoise-700 mt-2">
          Update guest instructor information
        </p>
      </div>

      <GuestInstructorForm
        initialData={instructor}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        submitText="Update Guest Instructor"
      />
    </div>
  );
};
