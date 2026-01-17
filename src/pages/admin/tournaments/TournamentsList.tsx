import type { FC } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { FilterBar } from '@/components/admin/FilterBar';
import { FilterSelect } from '@/components/admin/filters';
import { SortableTableHeader, TableHeader } from '@/components/admin/SortableTableHeader';
import { Plus, Edit, Trash2, Package, Eye, EyeOff, RefreshCw, Save, GripVertical, Layers, Users } from 'lucide-react';
import { formatPrice } from '@/lib/utils/formatting';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useListFilters } from '@/hooks/useListFilters';
import type { Tournament } from '@/types';
import {
  WEAPON_OPTIONS,
  DIVISION_OPTIONS,
  TOURNAMENT_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  DEFAULT_TOURNAMENT_FILTERS,
  type TournamentFilters,
  type TournamentSortField,
} from '@/types/filters';
import { syncTournamentToStripe, syncTournamentPricing, bulkSyncTournamentsToStripe } from '@/lib/utils/stripe';
import { DraggableTournamentList } from '@/components/admin/DraggableTournamentList';
import { supabase } from '@/lib/api/supabase';
import { TournamentRegistrationsModal } from './TournamentRegistrationsModal';

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
  const [registrationsTournament, setRegistrationsTournament] = useState<Tournament | null>(null);

  const { listTournaments, deleteTournament, updateTournament } = useAdmin();

  // Filter and sort state
  const {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    sort,
    toggleSort,
    getSortDirection,
  } = useListFilters<TournamentFilters, TournamentSortField>({
    defaultFilters: DEFAULT_TOURNAMENT_FILTERS,
    defaultSort: { field: 'name', order: 'asc' },
  });

  // Client-side filtering and sorting
  const filteredAndSortedTournaments = useMemo(() => {
    let result = [...tournaments];

    // Filter by weapon
    if (filters.weapon) {
      result = result.filter((t) => t.weapon === filters.weapon);
    }

    // Filter by division
    if (filters.division) {
      result = result.filter((t) => t.division === filters.division);
    }

    // Filter by status
    if (filters.status) {
      result = result.filter((t) => t.status === filters.status);
    }

    // Filter by visibility
    if (filters.visible === 'visible') {
      result = result.filter((t) => t.visible);
    } else if (filters.visible === 'hidden') {
      result = result.filter((t) => !t.visible);
    }

    // Sort
    if (sort) {
      result.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'participants':
            comparison = a.currentParticipants - b.currentParticipants;
            break;
          case 'fee':
            comparison = a.registrationFee - b.registrationFee;
            break;
          case 'date':
            comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
            break;
        }
        return sort.order === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [tournaments, filters.weapon, filters.division, filters.status, filters.visible, sort]);

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
              <Link to="/tournaments/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tournament
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      {!isReorderMode && (
        <FilterBar
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
          title="Filters"
        >
          <FilterSelect
            label="Weapon"
            value={filters.weapon}
            onChange={(value) => setFilter('weapon', value as TournamentFilters['weapon'])}
            options={WEAPON_OPTIONS}
          />
          <FilterSelect
            label="Division"
            value={filters.division}
            onChange={(value) => setFilter('division', value as TournamentFilters['division'])}
            options={DIVISION_OPTIONS}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(value) => setFilter('status', value as TournamentFilters['status'])}
            options={TOURNAMENT_STATUS_OPTIONS}
          />
          <FilterSelect
            label="Visibility"
            value={filters.visible}
            onChange={(value) => setFilter('visible', value as TournamentFilters['visible'])}
            options={VISIBILITY_OPTIONS}
          />
        </FilterBar>
      )}

      {/* Tournaments List/Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {isReorderMode ? 'Drag to Reorder Tournaments' : `Tournaments (${filteredAndSortedTournaments.length})`}
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
          ) : filteredAndSortedTournaments.length === 0 ? (
            <div className="text-center py-8 text-white">
              {hasActiveFilters
                ? 'No tournaments match your filters. Try adjusting or resetting filters.'
                : 'No tournaments found. Create your first tournament to get started.'}
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
                    <SortableTableHeader
                      field="name"
                      sortDirection={getSortDirection('name')}
                      onSort={() => toggleSort('name')}
                    >
                      Name
                    </SortableTableHeader>
                    <TableHeader>Weapon</TableHeader>
                    <TableHeader>Division</TableHeader>
                    <SortableTableHeader
                      field="participants"
                      sortDirection={getSortDirection('participants')}
                      onSort={() => toggleSort('participants')}
                    >
                      Participants
                    </SortableTableHeader>
                    <SortableTableHeader
                      field="fee"
                      sortDirection={getSortDirection('fee')}
                      onSort={() => toggleSort('fee')}
                    >
                      Fee
                    </SortableTableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Stripe</TableHeader>
                    <TableHeader align="right">Actions</TableHeader>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedTournaments.map((tournament) => (
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
                            onClick={() => setRegistrationsTournament(tournament)}
                            title="View registrations"
                            className="hover:bg-blue-500/20"
                          >
                            <Users className="h-4 w-4 text-blue-400" />
                          </Button>
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
                          <Link to={`/tournaments/edit/${tournament.id}`}>
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

      {/* Tournament Registrations Modal */}
      <TournamentRegistrationsModal
        open={registrationsTournament !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRegistrationsTournament(null);
          }
        }}
        tournament={registrationsTournament}
      />
    </div>
  );
};
