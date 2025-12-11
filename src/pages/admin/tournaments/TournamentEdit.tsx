import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { TournamentForm, type TournamentFormData } from '@/components/admin/forms/TournamentForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { hasStripeProduct, syncTournamentPricing } from '@/lib/utils/stripe';
import { datetimeLocalToUTC } from '@/lib/utils/dateUtils';
import type { Tournament } from '@/types';

/**
 * Edit existing tournament page
 */
export const TournamentEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { getTournament, updateTournament } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    getTournament(id)
      .then(setTournament)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id, getTournament]);

  const handleSubmit = async (formData: TournamentFormData) => {
    if (!id) return;

    // Convert form data to database format
    const dbData = {
      name: formData.name,
      slug: formData.slug,
      weapon: formData.weapon,
      division: formData.division,
      description: formData.description || null,
      rules: formData.rules || null,
      max_participants: formData.maxParticipants,
      registration_fee: Math.round(formData.registrationFee * 100), // Convert dollars to cents
      early_bird_price: formData.earlyBirdPrice ? Math.round(formData.earlyBirdPrice * 100) : null,
      early_bird_start_date: datetimeLocalToUTC(formData.earlyBirdStartDate),
      early_bird_end_date: datetimeLocalToUTC(formData.earlyBirdEndDate),
      date: formData.date,
      start_time: formData.startTime,
      end_time: formData.endTime || null,
      location: formData.location,
      status: formData.status,
      visible: formData.visible,
      header_image_url: formData.headerImageUrl || null,
      gallery_images: formData.galleryImages,
    };

    setIsUpdating(true);
    try {
      // Update tournament in database
      await updateTournament(id, dbData);

      // Check if Stripe product exists and sync if it does
      if (tournament && hasStripeProduct(tournament)) {
        try {
          await syncTournamentPricing(
            id,
            formData.name,
            formData.description,
            Math.round(formData.registrationFee * 100),
            formData.earlyBirdPrice ? Math.round(formData.earlyBirdPrice * 100) : null,
            datetimeLocalToUTC(formData.earlyBirdStartDate),
            datetimeLocalToUTC(formData.earlyBirdEndDate)
          );
          console.log('Stripe product synced successfully');
        } catch (syncError) {
          console.error('Failed to sync Stripe product:', syncError);
          alert('Tournament updated, but failed to sync pricing with Stripe. Please try manual sync.');
        }
      } else if (formData.registrationFee > 0) {
        // Show notification that no Stripe product exists
        alert('Tournament updated successfully. Note: No Stripe product exists for this tournament yet. Create one from the tournaments list to enable payments.');
      }

      setIsUpdating(false);
      navigate('/admin/tournaments');
    } catch (error) {
      setIsUpdating(false);
      console.error('Error updating tournament:', error);
      alert('Failed to update tournament');
    }
  };

  const handleCancel = () => {
    navigate('/admin/tournaments');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/tournaments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-turquoise-900">Edit Tournament</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-600">
              Loading tournament data...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/tournaments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-turquoise-900">Edit Tournament</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-600">
              Tournament not found
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
        <Link to="/admin/tournaments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-turquoise-900">Edit Tournament</h1>
          <p className="text-turquoise-700 mt-2">{tournament.name}</p>
        </div>
      </div>

      {/* Form */}
      <TournamentForm
        initialData={tournament}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isUpdating}
        submitText="Update Tournament"
      />
    </div>
  );
};
