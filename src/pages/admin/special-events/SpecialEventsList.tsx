import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Plus, Edit, Trash2, CheckCircle, Package, RefreshCw } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import { syncSpecialEventPricing } from '@/lib/utils/stripe';
import type { SpecialEvent } from '@/types';

/**
 * Admin special events list page
 * Displays all special events with CRUD actions
 */
export const SpecialEventsList: FC = () => {
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<SpecialEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [activatingIds, setActivatingIds] = useState<Set<string>>(new Set());

  const { listSpecialEvents, deleteSpecialEvent, activateSpecialEvent, deactivateSpecialEvent } = useAdmin();

  useEffect(() => {
    const fetchSpecialEvents = async () => {
      try {
        const data = await listSpecialEvents();
        setSpecialEvents(data);
      } catch (error) {
        console.error('Error fetching special events:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpecialEvents();
  }, [listSpecialEvents]);

  const handleDelete = (specialEvent: SpecialEvent) => {
    setDeleteItem(specialEvent);
    setDeleteId(specialEvent.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteSpecialEvent(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteItem(null);
      // Refresh the list
      const data = await listSpecialEvents();
      setSpecialEvents(data);
    } catch (error) {
      setIsDeleting(false);
      console.error('Error deleting special event:', error);
      alert('Failed to delete special event');
    }
  };

  const handleActivate = async (specialEvent: SpecialEvent) => {
    setActivatingIds((prev) => new Set(prev).add(specialEvent.id));

    try {
      await activateSpecialEvent(specialEvent.id);

      // Refresh the list
      const data = await listSpecialEvents();
      setSpecialEvents(data);
    } catch (error) {
      console.error('Error activating special event:', error);
      alert('Failed to activate special event');
    } finally {
      setActivatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(specialEvent.id);
        return newSet;
      });
    }
  };

  const handleDeactivate = async (specialEvent: SpecialEvent) => {
    setActivatingIds((prev) => new Set(prev).add(specialEvent.id));

    try {
      await deactivateSpecialEvent(specialEvent.id);

      // Refresh the list
      const data = await listSpecialEvents();
      setSpecialEvents(data);
    } catch (error) {
      console.error('Error deactivating special event:', error);
      alert('Failed to deactivate special event');
    } finally {
      setActivatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(specialEvent.id);
        return newSet;
      });
    }
  };

  const handleSyncToStripe = async (event: SpecialEvent) => {
    if (!event.ticketPrice) {
      alert('Cannot sync: Event has no ticket price set');
      return;
    }

    setSyncingIds((prev) => new Set(prev).add(event.id));

    try {
      await syncSpecialEventPricing(
        event.id,
        event.title,
        event.description || '',
        event.ticketPrice,
        event.earlyBirdTicketPrice,
        event.earlyBirdStartDate,
        event.earlyBirdEndDate
      );

      // Refresh the list
      const data = await listSpecialEvents();
      setSpecialEvents(data);

      alert(`Successfully synced "${event.title}" to Stripe!`);
    } catch (error) {
      console.error('Error syncing to Stripe:', error);
      alert(
        `Failed to sync to Stripe: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setSyncingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(event.id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="draft">Draft</Badge>;
      case 'published':
        return <Badge variant="success">Published</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Special Events</h1>
          <p className="text-orange-200 mt-2">
            Manage special events and registrations
          </p>
        </div>
        <Link to="/admin/special-events/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Special Event
          </Button>
        </Link>
      </div>

      {/* Special Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Special Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-white">
              Loading special events...
            </div>
          ) : specialEvents.length === 0 ? (
            <div className="text-center py-8 text-white">
              No special events found. Create your first special event to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Title
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Active
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Stripe
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {specialEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-white">
                          {event.title}
                        </p>
                        <p className="text-sm text-white/70">
                          {event.subtitle || event.navDisplayName}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {formatDate(event.date)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(event.status)}
                      </td>
                      <td className="py-3 px-4">
                        {event.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(event)}
                            disabled={activatingIds.has(event.id)}
                            title="Deactivate this event"
                            className="hover:bg-red-500/20"
                          >
                            <Badge variant="success" className="cursor-pointer">Active</Badge>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleActivate(event)}
                            disabled={activatingIds.has(event.id)}
                            title="Activate this event"
                            className="hover:bg-green-500/20"
                          >
                            <CheckCircle className="h-4 w-4 text-gray-400" />
                          </Button>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {event.stripeProductId ? (
                            <>
                              <Badge variant="success">Synced</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncToStripe(event)}
                                disabled={syncingIds.has(event.id)}
                                title="Re-sync pricing with Stripe"
                              >
                                <RefreshCw className={`h-4 w-4 ${syncingIds.has(event.id) ? 'animate-spin' : ''}`} />
                              </Button>
                            </>
                          ) : event.ticketPrice && event.ticketPrice > 0 ? (
                            <>
                              <Badge variant="warning">Not Synced</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncToStripe(event)}
                                disabled={syncingIds.has(event.id)}
                                title="Create Stripe Product"
                              >
                                <Package className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Badge variant="secondary">Free</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/admin/special-events/edit/${event.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(event)}
                            className="hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
        itemName={deleteItem?.title || ''}
        itemType="Special Event"
        isLoading={isDeleting}
      />
    </div>
  );
};
