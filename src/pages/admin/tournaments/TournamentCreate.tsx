import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { TournamentForm, type TournamentFormData } from '@/components/admin/forms/TournamentForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { datetimeLocalToUTC } from '@/lib/utils/dateUtils';

/**
 * Create new tournament page
 */
export const TournamentCreate: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { createTournament } = useAdmin();
  const navigate = useNavigate();

  const handleSubmit = async (data: TournamentFormData) => {
    // Convert form data to database format
    const dbData = {
      name: data.name,
      slug: data.slug,
      weapon: data.weapon,
      division: data.division,
      description: data.description || null,
      rules: data.rules || null,
      max_participants: data.maxParticipants,
      current_participants: 0,
      registration_fee: Math.round(data.registrationFee * 100), // Convert dollars to cents
      early_bird_price: data.earlyBirdPrice ? Math.round(data.earlyBirdPrice * 100) : null,
      early_bird_start_date: datetimeLocalToUTC(data.earlyBirdStartDate),
      early_bird_end_date: datetimeLocalToUTC(data.earlyBirdEndDate),
      stripe_early_bird_price_id: null,
      date: data.date,
      start_time: data.startTime,
      end_time: data.endTime || null,
      location: data.location,
      status: data.status,
      visible: data.visible,
      header_image_url: data.headerImageUrl || null,
      gallery_images: data.galleryImages,
      equipment_requirements: null,
      registration_end_date: null,
      registration_start_date: null,
      rules_content: null,
      rules_pdf_url: null,
      stripe_price_id: null,
      stripe_product_id: null,
      display_order: 0,
    };

    setIsLoading(true);
    try {
      await createTournament(dbData);
      setIsLoading(false);
      navigate('/admin/tournaments');
    } catch (error) {
      setIsLoading(false);
      console.error('Error creating tournament:', error);
      alert('Failed to create tournament');
    }
  };

  const handleCancel = () => {
    navigate('/admin/tournaments');
  };

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
          <h1 className="text-3xl font-viking text-turquoise-900">Create Tournament</h1>
          <p className="text-turquoise-700 mt-2">
            Add a new tournament to the event schedule
          </p>
        </div>
      </div>

      {/* Form */}
      <TournamentForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        submitText="Create Tournament"
      />
    </div>
  );
};
