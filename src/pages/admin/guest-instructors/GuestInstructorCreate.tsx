import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestInstructorForm, type GuestInstructorFormData } from '@/components/admin/forms/GuestInstructorForm';
import { useAdmin } from '@/hooks';

/**
 * Create guest instructor page
 */
export const GuestInstructorCreate: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { createGuestInstructor } = useAdmin();

  const handleSubmit = async (data: GuestInstructorFormData) => {
    // Convert form data to database format
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
      await createGuestInstructor(dbData);
      navigate('/guest-instructors');
    } catch (error) {
      console.error('Error creating guest instructor:', error);
      alert('Failed to create guest instructor. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/guest-instructors');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-viking text-turquoise-900">Add Guest Instructor</h1>
        <p className="text-turquoise-700 mt-2">
          Create a new guest instructor profile
        </p>
      </div>

      <GuestInstructorForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        submitText="Create Guest Instructor"
      />
    </div>
  );
};
