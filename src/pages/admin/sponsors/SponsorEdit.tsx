import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { SponsorForm, type SponsorFormData } from '@/components/admin/forms/SponsorForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import type { Sponsor } from '@/types';

/**
 * Edit sponsor/vendor page
 */
export const SponsorEdit: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const { getSponsor, updateSponsor } = useAdmin();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    const fetchSponsor = async () => {
      if (!id) return;

      setIsFetching(true);
      try {
        const data = await getSponsor(id);
        setSponsor(data);
        setIsFetching(false);
      } catch (error) {
        setIsFetching(false);
        console.error('Error fetching sponsor:', error);
        alert('Failed to load sponsor');
        navigate('/admin/sponsors');
      }
    };

    void fetchSponsor();
  }, [id, getSponsor, navigate]);

  const handleSubmit = async (data: SponsorFormData) => {
    if (!id) return;

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
      await updateSponsor(id, dbData);
      setIsLoading(false);
      navigate('/admin/sponsors');
    } catch (error) {
      setIsLoading(false);
      console.error('Error updating sponsor:', error);
      alert('Failed to update sponsor');
    }
  };

  const handleCancel = () => {
    navigate('/admin/sponsors');
  };

  if (isFetching) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-700">
              Loading sponsor...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sponsor) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-700">
              Sponsor not found
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
        <Link to="/admin/sponsors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-white">Edit {sponsor.name}</h1>
          <p className="text-white mt-2">
            Update sponsor/vendor information
          </p>
        </div>
      </div>

      {/* Form */}
      <SponsorForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialData={sponsor}
        isLoading={isLoading}
        submitText="Update Sponsor/Vendor"
      />
    </div>
  );
};
