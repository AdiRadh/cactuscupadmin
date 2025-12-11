import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { ActivityForm, type ActivityFormData } from '@/components/admin/forms/ActivityForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { hasStripeProduct, syncActivityPricing } from '@/lib/utils/stripe';
import { datetimeLocalToUTC } from '@/lib/utils/dateUtils';
import type { Activity } from '@/types';

/**
 * Edit existing activity page
 */
export const ActivityEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getActivity, updateActivity } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchActivity = async () => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await getActivity(id);
        setActivity(data);
      } catch (error) {
        console.error('Error fetching activity:', error);
        setError('Failed to load activity');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [id, getActivity]);

  const handleSubmit = async (formData: ActivityFormData) => {
    if (!id) return;

    // Convert form data to database format
    const dbData = {
      title: formData.title,
      slug: formData.slug,
      type: formData.type,
      instructor: formData.instructor || null,
      description: formData.description,
      date: formData.date,
      start_time: formData.startTime,
      duration: formData.duration,
      max_participants: formData.maxParticipants,
      fee: Math.round(formData.fee * 100), // Convert dollars to cents
      early_bird_price: formData.earlyBirdPrice ? Math.round(formData.earlyBirdPrice * 100) : null,
      early_bird_start_date: datetimeLocalToUTC(formData.earlyBirdStartDate),
      early_bird_end_date: datetimeLocalToUTC(formData.earlyBirdEndDate),
      requires_registration: formData.requiresRegistration,
      skill_level: formData.skillLevel,
      status: formData.status,
      visible: formData.visible,
      header_image_url: formData.headerImageUrl || null,
      gallery_images: formData.galleryImages,
    };

    setIsUpdating(true);
    try {
      // Update activity in database
      await updateActivity(id, dbData);

      // Check if Stripe product exists and sync if it does
      if (activity && hasStripeProduct(activity)) {
        try {
          await syncActivityPricing(
            id,
            formData.title,
            formData.description,
            Math.round(formData.fee * 100),
            formData.earlyBirdPrice ? Math.round(formData.earlyBirdPrice * 100) : null,
            datetimeLocalToUTC(formData.earlyBirdStartDate),
            datetimeLocalToUTC(formData.earlyBirdEndDate)
          );
          console.log('Stripe product synced successfully');
        } catch (syncError) {
          console.error('Failed to sync Stripe product:', syncError);
          alert('Activity updated, but failed to sync pricing with Stripe. Please try manual sync.');
        }
      } else if (formData.fee > 0) {
        // Show notification that no Stripe product exists
        alert('Activity updated successfully. Note: No Stripe product exists for this activity yet. Create one from the activities list to enable payments.');
      }

      setIsUpdating(false);
      navigate('/admin/activities');
    } catch (error) {
      setIsUpdating(false);
      console.error('Error updating activity:', error);
      alert('Failed to update activity');
    }
  };

  const handleCancel = () => {
    navigate('/admin/activities');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/activities">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-turquoise-900">Edit Activity</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-600">
              Loading activity data...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/activities">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-turquoise-900">Edit Activity</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-600">
              {error || 'Activity not found'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/activities">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-turquoise-900">Edit Activity</h1>
          <p className="text-turquoise-700 mt-2">{activity.title}</p>
        </div>
      </div>

      {/* Form */}
      <ActivityForm
        initialData={activity}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isUpdating}
        submitText="Update Activity"
      />
    </div>
  );
};
