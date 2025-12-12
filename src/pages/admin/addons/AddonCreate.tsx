import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { AddonForm, type AddonFormData } from '@/components/admin/forms/AddonForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';

/**
 * Create new add-on page
 */
export const AddonCreate: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { createAddon } = useAdmin();
  const navigate = useNavigate();

  const handleSubmit = async (data: AddonFormData) => {
    // Convert form data to database format
    const dbData = {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      category: data.category,
      price: Math.round(data.price * 100), // Convert dollars to cents
      has_inventory: data.hasInventory,
      stock_quantity: data.stockQuantity,
      max_per_order: data.maxPerOrder,
      has_variants: false, // Not supporting variants yet
      variants: null,
      is_active: data.isActive,
      featured: false,
      sort_order: 0,
      image_url: data.imageUrl,
      gallery_urls: data.galleryUrls.length > 0 ? data.galleryUrls : null,
      available_from: null,
      available_until: null,
      stripe_product_id: null,
      stripe_price_id: null,
    };

    setIsLoading(true);
    try {
      await createAddon(dbData);
      setIsLoading(false);
      navigate('/addons');
    } catch (error) {
      setIsLoading(false);
      console.error('Error creating addon:', error);
      alert('Failed to create add-on');
    }
  };

  const handleCancel = () => {
    navigate('/addons');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/addons">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-white">Create Add-On</h1>
          <p className="text-white/70 mt-2">
            Add a new product or service for event attendees
          </p>
        </div>
      </div>

      {/* Form */}
      <AddonForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        submitText="Create Add-On"
      />
    </div>
  );
};
