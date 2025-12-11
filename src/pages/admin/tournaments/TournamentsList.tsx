import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Plus, Edit, Trash2, Package, Eye, EyeOff, RefreshCw, Save, GripVertical, Layers } from 'lucide-react';
import { formatPrice } from '@/lib/utils/formatting';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import type { Tournament } from '@/types';
import { syncTournamentToStripe, syncTournamentPricing, bulkSyncTournamentsToStripe } from '@/lib/utils/stripe';
import { DraggableTournamentList } from '@/components/admin/DraggableTournamentList';
import { supabase } from '@/lib/api/supabase';

/**
 * Admin tournaments list page
 * Displays all tournaments with CRUD actions
 */
export const TournamentsList: FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<Tournament | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState<{ current: number; total: number } | null>(null);

  const { listTournaments, deleteTournament, updateTournament } = useAdmin();

  const fetchTournaments = useCallback(async () => {
    try {
      const data = await listTournaments({
        sorters: [{ field: 'display_order', order: 'asc' }],
      });
      setTournaments(data);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [listTournaments]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handleReorder = (newOrder: Tournament[]) => {
    setTournaments(newOrder);
    setHasOrderChanged(true);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      // Update display_order for each tournament
      const updates = tournaments.map((tournament, index) => ({
        id: tournament.id,
        display_order: index + 1,
      }));

      // Batch update using individual updates (Supabase doesn't support bulk upsert with different values)
      for (const update of updates) {
        const { error } = await supabase
          .from('tournaments')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      setHasOrderChanged(false);
      setIsReorderMode(false);
      // Refresh to get updated data
      await fetchTournaments();
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Failed to save tournament order');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleCancelReorder = async () => {
    setIsReorderMode(false);
    setHasOrderChanged(false);
    // Refresh to restore original order
    await fetchTournaments();
  };

  const handleDelete = (tournament: Tournament) => {
    setDeleteItem(tournament);
    setDeleteId(tournament.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteTournament(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteItem(null);
      // Refresh the list
      await fetchTournaments();
    } catch (error) {
      setIsDeleting(false);
      console.error('Error deleting tournament:', error);
      alert('Failed to delete tournament');
    }
  };

  const handleSyncToStripe = async (tournament: Tournament) => {
    setSyncingIds((prev) => new Set(prev).add(tournament.id));

    try {
      await syncTournamentToStripe(
        tournament.id,
        tournament.name,
        tournament.description,
        tournament.registrationFee
      );

      // Refresh the list
      await fetchTournaments();

      alert(`Successfully synced "${tournament.name}" to Stripe!`);
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
        newSet.delete(tournament.id);
        return newSet;
      });
    }
  };

  const handleResyncToStripe = async (tournament: Tournament) => {
    setSyncingIds((prev) => new Set(prev).add(tournament.id));

    try {
      await syncTournamentPricing(
        tournament.id,
        tournament.name,
        tournament.description,
        tournament.registrationFee,
        tournament.earlyBirdPrice,
        tournament.earlyBirdStartDate,
        tournament.earlyBirdEndDate
      );

      // Refresh the list
      await fetchTournaments();

      alert(`Successfully re-synced "${tournament.name}" pricing to Stripe!`);
    } catch (error) {
      console.error('Error re-syncing to Stripe:', error);
      alert(
        `Failed to re-sync to Stripe: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setSyncingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tournament.id);
        return newSet;
      });
    }
  };

  const handleToggleVisibility = async (tournament: Tournament) => {
    setTogglingIds((prev) => new Set(prev).add(tournament.id));

    try {
      await updateTournament(tournament.id, {
        visible: !tournament.visible,
      });

      // Refresh the list
      await fetchTournaments();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Failed to update tournament visibility');
    } finally {
      setTogglingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tournament.id);
        return newSet;
      });
    }
  };

  const handleBulkSync = async () => {
    if (tournaments.length === 0) {
      alert('No tournaments to sync.');
      return;
    }

    const confirmed = window.confirm(
      `This will sync all ${tournaments.length} tournaments to Stripe.\n\n• Existing products will be UPDATED (name, description)\n• New prices will be created (Stripe prices are immutable)\n• New products will be created for tournaments not yet synced\n\nContinue?`
    );

    if (!confirmed) return;

    setIsBulkSyncing(true);
    setBulkSyncProgress({ current: 0, total: tournaments.length });

    try {
      const results = await bulkSyncTournamentsToStripe(
        (current, total, result) => {
          setBulkSyncProgress({ current, total });
          console.log(`Synced ${current}/${total}: ${result.name} - ${result.success ? 'Success' : result.error}`);
        }
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      // Refresh the list
      await fetchTournaments();

      if (failCount === 0) {
        alert(`Successfully synced all ${successCount} tournaments to Stripe!`);
      } else {
        const failedNames = results.filter(r => !r.success).map(r => r.name).join(', ');
        alert(`Synced ${successCount} tournaments. ${failCount} failed:\n${failedNames}`);
      }
    } catch (error) {
      console.error('Error bulk syncing tournaments:', error);
      alert(`Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBulkSyncing(false);
      setBulkSyncProgress(null);
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
          <h1 className="text-3xl font-viking text-white">Tournaments</h1>
          <p className="text-orange-200 mt-2">
            Manage tournament events and registrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isReorderMode ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancelReorder}
                disabled={isSavingOrder}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveOrder}
                disabled={!hasOrderChanged || isSavingOrder}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSavingOrder ? 'Saving...' : 'Save Order'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleBulkSync}
                disabled={isBulkSyncing || tournaments.length === 0}
              >
                {isBulkSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {bulkSyncProgress ? `Syncing ${bulkSyncProgress.current}/${bulkSyncProgress.total}...` : 'Syncing...'}
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Sync All to Stripe
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsReorderMode(true)}
                disabled={tournaments.length < 2}
              >
                <GripVertical className="h-4 w-4 mr-2" />
                Reorder
              </Button>
              <Link to="/admin/tournaments/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tournament
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tournaments List/Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {isReorderMode ? 'Drag to Reorder Tournaments' : 'All Tournaments'}
            </CardTitle>
            {isReorderMode && (
              <p className="text-sm text-orange-200">
                Drag tournaments to set their display order in the registration flow
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-white">
              Loading tournaments...
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-8 text-white">
              No tournaments found. Create your first tournament to get started.
            </div>
          ) : isReorderMode ? (
            <DraggableTournamentList
              tournaments={tournaments}
              onReorder={handleReorder}
              onToggleVisibility={handleToggleVisibility}
              onDelete={handleDelete}
              togglingIds={togglingIds}
              getStatusBadge={getStatusBadge}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Weapon
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Division
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
                  {tournaments.map((tournament) => (
                    <tr
                      key={tournament.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-white">
                          {tournament.name}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {tournament.weapon}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {tournament.division}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {tournament.currentParticipants} / {tournament.maxParticipants}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {formatPrice(tournament.registrationFee)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(tournament.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {tournament.stripeProductId ? (
                            <>
                              <Badge variant="success">Synced</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResyncToStripe(tournament)}
                                disabled={syncingIds.has(tournament.id)}
                                title="Re-sync pricing with Stripe"
                              >
                                <RefreshCw className={`h-4 w-4 ${syncingIds.has(tournament.id) ? 'animate-spin' : ''}`} />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge variant="warning">Not Synced</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncToStripe(tournament)}
                                disabled={syncingIds.has(tournament.id)}
                                title="Create Stripe Product"
                              >
                                <Package className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleVisibility(tournament)}
                            disabled={togglingIds.has(tournament.id)}
                            title={tournament.visible ? 'Hide from public' : 'Show on public'}
                            className={tournament.visible ? 'hover:bg-green-500/20' : 'hover:bg-gray-500/20'}
                          >
                            {tournament.visible ? (
                              <Eye className="h-4 w-4 text-green-400" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                          <Link to={`/admin/tournaments/edit/${tournament.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tournament)}
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
        itemName={deleteItem?.name || ''}
        itemType="Tournament"
        isLoading={isDeleting}
      />
    </div>
  );
};
