import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { ActivityForm, type ActivityFormData } from '@/components/admin/forms/ActivityForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { datetimeLocalToUTC } from '@/lib/utils/dateUtils';

/**
 * Create new activity page
 */
export const ActivityCreate: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { createActivity } = useAdmin();
  const navigate = useNavigate();

  const handleSubmit = async (data: ActivityFormData) => {
    // Convert form data to database format
    const dbData = {
      title: data.title,
      slug: data.slug,
      type: data.type,
      instructor: data.instructor || null,
      description: data.description,
      date: data.date,
      start_time: data.startTime,
      duration: data.duration,
      max_participants: data.maxParticipants,
      current_participants: 0,
      fee: Math.round(data.fee * 100), // Convert dollars to cents
      early_bird_price: data.earlyBirdPrice ? Math.round(data.earlyBirdPrice * 100) : null,
      early_bird_start_date: datetimeLocalToUTC(data.earlyBirdStartDate),
      early_bird_end_date: datetimeLocalToUTC(data.earlyBirdEndDate),
      stripe_early_bird_price_id: null,
      stripe_price_id: null,
      stripe_product_id: null,
      requires_registration: data.requiresRegistration,
      skill_level: data.skillLevel,
      status: data.status,
      visible: data.visible,
      header_image_url: data.headerImageUrl || null,
      gallery_images: data.galleryImages,
    };

    setIsLoading(true);
    try {
      await createActivity(dbData);
      setIsLoading(false);
      navigate('/activities');
    } catch (error) {
      setIsLoading(false);
      console.error('Error creating activity:', error);
      alert('Failed to create activity');
    }
  };

  const handleCancel = () => {
    navigate('/activities');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/activities">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-turquoise-900">Create Activity</h1>
          <p className="text-turquoise-700 mt-2">
            Add a new activity to the event schedule
          </p>
        </div>
      </div>

      {/* Form */}
      <ActivityForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        submitText="Create Activity"
      />
    </div>
  );
};
