import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { SponsorForm, type SponsorFormData } from '@/components/admin/forms/SponsorForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';

/**
 * Create new sponsor/vendor page
 */
export const SponsorCreate: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { createSponsor } = useAdmin();
  const navigate = useNavigate();

  const handleSubmit = async (data: SponsorFormData) => {
    // Convert form data to database format (snake_case)
    const dbData = {
      name: data.name,
      type: data.type,
      tier: data.tier,
      description: data.description || null,
      logo_url: data.logoUrl || null,
      website_url: data.websiteUrl || null,
      booth_number: data.boothNumber || null,
      color: data.color || null,
      visible: data.visible,
      display_order: data.displayOrder,
    };

    setIsLoading(true);
    try {
      await createSponsor(dbData);
      setIsLoading(false);
      navigate('/sponsors');
    } catch (error) {
      setIsLoading(false);
      console.error('Error creating sponsor:', error);
      alert('Failed to create sponsor');
    }
  };

  const handleCancel = () => {
    navigate('/sponsors');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/sponsors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-turquoise-900">Create Sponsor/Vendor</h1>
          <p className="text-turquoise-700 mt-2">
            Add a new sponsor or vendor to the event
          </p>
        </div>
      </div>

      {/* Form */}
      <SponsorForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        submitText="Create Sponsor/Vendor"
      />
    </div>
  );
};
