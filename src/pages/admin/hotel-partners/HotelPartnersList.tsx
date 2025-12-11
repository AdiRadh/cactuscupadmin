import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useTable } from '@refinedev/core';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Plus, Edit, Trash2, MapPin, Phone, Globe } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useAdmin } from '@/hooks';
import type { HotelPartner, DbHotelPartner } from '@/types';
import { dbToHotelPartner } from '@/types';

/**
 * Admin hotel partners list page
 * Displays all hotel partners with CRUD actions
 */
export const HotelPartnersList: FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<HotelPartner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { tableQuery } = useTable<DbHotelPartner>({
    resource: 'hotel_partners',
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

  const { deleteHotelPartner } = useAdmin();

  // Convert database format (snake_case) to domain format (camelCase)
  const hotels = useMemo(
    () => (tableQuery.data?.data || []).map(dbToHotelPartner),
    [tableQuery.data?.data]
  );
  const isLoading = tableQuery.isLoading;

  const handleDelete = (hotel: HotelPartner) => {
    setDeleteItem(hotel);
    setDeleteId(hotel.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteHotelPartner(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteItem(null);
      alert('Hotel partner deleted successfully!');
      tableQuery.refetch();
    } catch (error) {
      setIsDeleting(false);
      console.error('Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete hotel partner: ${errorMessage}. Check the browser console for details.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Hotel Partners</h1>
          <p className="text-white/80 mt-2">
            Manage hotel partnership information and booking codes
          </p>
        </div>
        <Link to="/admin/hotel-partners/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Hotel Partner
          </Button>
        </Link>
      </div>

      {/* Hotels List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">
              Loading hotel partners...
            </div>
          </CardContent>
        </Card>
      ) : hotels.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">
              No hotel partners found. Add your first hotel partner to get started.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <Card key={hotel.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-viking text-white">
                      {hotel.name}
                    </CardTitle>
                    <div className="flex gap-2 mt-2">
                      {hotel.isPrimary && (
                        <Badge variant="default">Primary</Badge>
                      )}
                      {hotel.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Address */}
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-orange-500 mt-0.5" />
                    <div className="text-white/90">
                      <div>{hotel.address}</div>
                      <div>
                        {hotel.city}, {hotel.state} {hotel.zipCode}
                      </div>
                    </div>
                  </div>

                  {/* Phone */}
                  {hotel.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-orange-500" />
                      <span className="text-white/90">{hotel.phone}</span>
                    </div>
                  )}

                  {/* Distance */}
                  {hotel.distanceFromVenue && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-orange-500" />
                      <span className="text-white/90">
                        {hotel.distanceFromVenue} from venue
                      </span>
                    </div>
                  )}

                  {/* Booking Code */}
                  {hotel.bookingCode && (
                    <div className="bg-white/10 rounded p-2 mt-3">
                      <p className="text-xs text-white/70 font-medium">Booking Code</p>
                      <p className="text-sm font-mono font-semibold text-white">
                        {hotel.bookingCode}
                      </p>
                    </div>
                  )}

                  {/* Description */}
                  {hotel.description && (
                    <p className="text-sm text-white/70 line-clamp-2 mt-3">
                      {hotel.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                    <Link to={`/admin/hotel-partners/edit/${hotel.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(hotel)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
        itemType="Hotel Partner"
        isLoading={isDeleting}
      />
    </div>
  );
};
