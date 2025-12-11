import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useTable } from '@refinedev/core';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Plus, Edit, Trash2, ExternalLink, Award } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useAdmin } from '@/hooks';
import type { Sponsor, DbSponsor } from '@/types';
import { dbToSponsor } from '@/types';

/**
 * Admin sponsors list page
 * Displays all sponsors and vendors with CRUD actions
 */
export const SponsorsList: FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<Sponsor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { tableQuery } = useTable<DbSponsor>({
    resource: 'sponsors',
    pagination: {
      pageSize: 20,
    },
    sorters: {
      initial: [
        {
          field: 'display_order',
          order: 'asc',
        },
      ],
    },
  });

  const { deleteSponsor } = useAdmin();

  // Convert database format (snake_case) to domain format (camelCase)
  const sponsors = useMemo(
    () => (tableQuery.data?.data || []).map(dbToSponsor),
    [tableQuery.data?.data]
  );
  const isLoading = tableQuery.isLoading;

  // Separate sponsors by type
  const sponsorsList = sponsors.filter(s => s.type === 'sponsor');
  const vendorsList = sponsors.filter(s => s.type === 'vendor');

  const handleDelete = (sponsor: Sponsor) => {
    setDeleteItem(sponsor);
    setDeleteId(sponsor.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteSponsor(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteItem(null);
      alert('Sponsor deleted successfully!');
      tableQuery.refetch();
    } catch (error) {
      setIsDeleting(false);
      console.error('Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete sponsor: ${errorMessage}. Check the browser console for details.`);
    }
  };

  const getTierBadge = (tier: string | null) => {
    if (!tier) return null;

    const tierColors = {
      gold: 'bg-yellow-100 text-yellow-800',
      silver: 'bg-gray-100 text-gray-800',
      bronze: 'bg-orange-100 text-orange-800',
      vendor: 'bg-blue-100 text-blue-800',
    };

    return (
      <Badge className={tierColors[tier as keyof typeof tierColors] || ''}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </Badge>
    );
  };

  const renderSponsorCard = (sponsor: Sponsor) => (
    <Card key={sponsor.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-viking text-white">
              {sponsor.name}
            </CardTitle>
            <div className="flex gap-2 mt-2">
              {sponsor.tier && getTierBadge(sponsor.tier)}
              {sponsor.visible ? (
                <Badge variant="success">Visible</Badge>
              ) : (
                <Badge variant="secondary">Hidden</Badge>
              )}
              {sponsor.type === 'sponsor' && (
                <Badge variant="default">
                  <Award className="h-3 w-3 mr-1" />
                  Sponsor
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Logo Preview */}
          {sponsor.logoUrl && (
            <div className="bg-white rounded p-4 flex items-center justify-center">
              <img
                src={sponsor.logoUrl}
                alt={sponsor.name}
                className="h-16 w-auto object-contain"
              />
            </div>
          )}

          {/* Description */}
          {sponsor.description && (
            <p className="text-sm text-white/70 line-clamp-2">
              {sponsor.description}
            </p>
          )}

          {/* Website */}
          {sponsor.websiteUrl && (
            <a
              href={sponsor.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Visit Website
            </a>
          )}

          {/* Booth Number */}
          {sponsor.boothNumber && (
            <div className="bg-white/10 rounded p-2">
              <p className="text-xs text-white/70 font-medium">Booth Number</p>
              <p className="text-sm font-semibold text-white">
                #{sponsor.boothNumber}
              </p>
            </div>
          )}

          {/* Display Order */}
          <div className="text-xs text-white/50">
            Display Order: {sponsor.displayOrder}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-white/10">
            <Link to={`/admin/sponsors/edit/${sponsor.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(sponsor)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Sponsors & Vendors</h1>
          <p className="text-white/80 mt-2">
            Manage event sponsors and vendor information
          </p>
        </div>
        <Link to="/admin/sponsors/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Sponsor/Vendor
          </Button>
        </Link>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">
              Loading sponsors...
            </div>
          </CardContent>
        </Card>
      ) : sponsors.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">
              No sponsors or vendors found. Add your first one to get started.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Sponsors Section */}
          {sponsorsList.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-viking text-white">Sponsors</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sponsorsList.map(renderSponsorCard)}
              </div>
            </div>
          )}

          {/* Vendors Section */}
          {vendorsList.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-viking text-white">Vendors</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {vendorsList.map(renderSponsorCard)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteItem(null);
          }
        }}
        onConfirm={confirmDelete}
        itemName={deleteItem?.name || ''}
        itemType={deleteItem?.type === 'sponsor' ? 'Sponsor' : 'Vendor'}
        isLoading={isDeleting}
      />
    </div>
  );
};
