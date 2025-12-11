import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { AddonForm, type AddonFormData } from '@/components/admin/forms/AddonForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import type { Addon } from '@/types';

/**
 * Edit existing add-on page
 */
export const AddonEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [addon, setAddon] = useState<Addon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { getAddon, updateAddon } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    getAddon(id)
      .then(setAddon)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id, getAddon]);

  const handleSubmit = async (formData: AddonFormData) => {
    if (!id) return;

    // Convert form data to database format
    const dbData = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description || null,
      category: formData.category,
      price: Math.round(formData.price * 100), // Convert dollars to cents
      has_inventory: formData.hasInventory,
      stock_quantity: formData.stockQuantity,
      max_per_order: formData.maxPerOrder,
      is_active: formData.isActive,
      image_url: formData.imageUrl,
      gallery_urls: formData.galleryUrls.length > 0 ? formData.galleryUrls : null,
    };

    setIsUpdating(true);
    try {
      await updateAddon(id, dbData);
      setIsUpdating(false);
      navigate('/admin/addons');
    } catch (error) {
      setIsUpdating(false);
      console.error('Error updating addon:', error);
      alert('Failed to update add-on');
    }
  };

  const handleCancel = () => {
    navigate('/admin/addons');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/addons">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-white">Edit Add-On</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-white/70">
              Loading add-on data...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!addon) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/addons">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-white">Edit Add-On</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-white/70">
              Add-on not found
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
        <Link to="/admin/addons">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-white">Edit Add-On</h1>
          <p className="text-white/70 mt-2">{addon.name}</p>
        </div>
      </div>

      {/* Form */}
      <AddonForm
        initialData={addon}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isUpdating}
        submitText="Update Add-On"
      />
    </div>
  );
};
