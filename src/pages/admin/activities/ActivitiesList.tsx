import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Plus, Edit, Trash2, Eye, EyeOff, Package, RefreshCw } from 'lucide-react';
import { formatPrice, formatTime } from '@/lib/utils/formatting';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import { syncActivityPricing } from '@/lib/utils/stripe';
import type { Activity } from '@/types';

/**
 * Admin activities list page
 * Displays all activities/workshops with CRUD actions
 */
export const ActivitiesList: FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<Activity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const { listActivities, updateActivity, deleteActivity } = useAdmin();

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const data = await listActivities();
      setActivities(data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleToggleVisibility = async (activity: Activity) => {
    setTogglingIds((prev) => new Set(prev).add(activity.id));

    try {
      await updateActivity(activity.id, {
        visible: !activity.visible,
      });
      await fetchActivities();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Failed to update visibility');
    } finally {
      setTogglingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(activity.id);
        return newSet;
      });
    }
  };

  const handleDelete = (activity: Activity) => {
    setDeleteItem(activity);
    setDeleteId(activity.id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      setIsDeleting(true);
      try {
        await deleteActivity(deleteId);
        await fetchActivities();
        setDeleteId(null);
        setDeleteItem(null);
      } catch (error) {
        console.error('Error deleting activity:', error);
        alert('Failed to delete activity');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleSyncToStripe = async (activity: Activity) => {
    setSyncingIds((prev) => new Set(prev).add(activity.id));

    try {
      await syncActivityPricing(
        activity.id,
        activity.title,
        activity.description,
        activity.fee,
        activity.earlyBirdPrice,
        activity.earlyBirdStartDate,
        activity.earlyBirdEndDate
      );

      await fetchActivities();
      alert(`Successfully synced "${activity.title}" to Stripe!`);
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
        newSet.delete(activity.id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="draft">Draft</Badge>;
      case 'open':
        return <Badge variant="success">Open</Badge>;
      case 'closed':
        return <Badge variant="warning">Closed</Badge>;
      case 'full':
        return <Badge variant="warning">Full</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Activities</h1>
          <p className="text-orange-200 mt-2">
            Manage workshops, classes, and special events
          </p>
        </div>
        <Link to="/activities/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>
        </Link>
      </div>

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-white">
              Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-white">
              No activities found. Create your first activity to get started.
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
                      Instructor
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Time
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Participants
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Fee
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Status
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
                  {activities.map((activity) => (
                    <tr
                      key={activity.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-white">
                          {activity.title}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {activity.instructor || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {activity.type}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {formatTime(activity.startTime)}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {activity.requiresRegistration
                          ? `${activity.currentParticipants} / ${activity.maxParticipants}`
                          : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {activity.fee === 0 ? 'Free' : formatPrice(activity.fee)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(activity.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {activity.stripeProductId ? (
                            <>
                              <Badge variant="success">Synced</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncToStripe(activity)}
                                disabled={syncingIds.has(activity.id)}
                                title="Re-sync pricing with Stripe"
                              >
                                <RefreshCw className={`h-4 w-4 ${syncingIds.has(activity.id) ? 'animate-spin' : ''}`} />
                              </Button>
                            </>
                          ) : activity.fee > 0 ? (
                            <>
                              <Badge variant="warning">Not Synced</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncToStripe(activity)}
                                disabled={syncingIds.has(activity.id)}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleVisibility(activity)}
                            disabled={togglingIds.has(activity.id)}
                            title={activity.visible ? 'Hide from public' : 'Show on public'}
                            className={activity.visible ? 'hover:bg-green-500/20' : 'hover:bg-gray-500/20'}
                          >
                            {activity.visible ? (
                              <Eye className="h-4 w-4 text-green-400" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                          <Link to={`/activities/edit/${activity.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(activity)}
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
        itemType="Activity"
        isLoading={isDeleting}
      />
    </div>
  );
};
