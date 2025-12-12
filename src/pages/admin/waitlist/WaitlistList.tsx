import type { FC } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  Loader2,
  Users,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
} from 'lucide-react';
import { useWaitlist } from '@/hooks/data/useWaitlist';
import type { CreateWaitlistEntryData } from '@/hooks/data/useWaitlist';
import { useAdmin } from '@/hooks/data/useAdmin';
import type { WaitlistEntry, WaitlistStatus, Tournament } from '@/types';
import { WaitlistEditModal } from './WaitlistEditModal';
import { WaitlistCreateModal } from './WaitlistCreateModal';

export const WaitlistList: FC = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editEntry, setEditEntry] = useState<WaitlistEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete confirmation state
  const [deleteEntry, setDeleteEntry] = useState<WaitlistEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { getWaitlistEntries, createWaitlistEntry, updateWaitlistEntry, deleteWaitlistEntry } = useWaitlist();
  const { listTournaments } = useAdmin();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch tournaments for the filter dropdown
      const tournamentData = await listTournaments({
        sorters: [{ field: 'name', order: 'asc' }],
      });
      setTournaments(tournamentData);

      // Fetch waitlist entries
      const tournamentId = selectedTournament === 'all' ? undefined : selectedTournament;
      const waitlistData = await getWaitlistEntries(tournamentId);
      setEntries(waitlistData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [listTournaments, getWaitlistEntries, selectedTournament]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = entries.length;
    const waiting = entries.filter((e) => e.status === 'waiting').length;
    const promoted = entries.filter((e) => e.status === 'promoted').length;
    const cancelled = entries.filter((e) => e.status === 'cancelled').length;
    return { total, waiting, promoted, cancelled };
  }, [entries]);

  // Handle edit
  const handleEdit = (entry: WaitlistEntry) => {
    setEditEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (id: string, data: { position?: number; status?: WaitlistStatus }) => {
    await updateWaitlistEntry(id, data);
    await fetchData();
  };

  // Handle create
  const handleCreate = async (data: CreateWaitlistEntryData) => {
    const result = await createWaitlistEntry(data);
    await fetchData();
    return result;
  };

  // Handle delete
  const handleDelete = (entry: WaitlistEntry) => {
    setDeleteEntry(entry);
  };

  const confirmDelete = async () => {
    if (!deleteEntry) return;

    setIsDeleting(true);
    try {
      await deleteWaitlistEntry(deleteEntry.id);
      await fetchData();
      setDeleteEntry(null);
    } catch (err) {
      console.error('Error deleting waitlist entry:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (entries.length === 0) return;

    const headers = [
      'Position',
      'First Name',
      'Last Name',
      'Email',
      'Tournament',
      'Status',
      'Joined At',
      'Promoted At',
    ];

    const rows = entries.map((entry) => [
      entry.position.toString(),
      entry.firstName,
      entry.lastName,
      entry.email,
      entry.tournamentName || '',
      entry.status,
      entry.joinedAt ? new Date(entry.joinedAt).toISOString() : '',
      entry.promotedAt ? new Date(entry.promotedAt).toISOString() : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const tournamentName =
      selectedTournament === 'all'
        ? 'all-tournaments'
        : tournaments.find((t) => t.id === selectedTournament)?.name.replace(/[^a-z0-9]/gi, '_') ||
          'tournament';
    const date = new Date().toISOString().split('T')[0];
    link.download = `waitlist-${tournamentName}-${date}.csv`;

    link.click();
    URL.revokeObjectURL(link.href);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: WaitlistStatus) => {
    switch (status) {
      case 'waiting':
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Waiting
          </Badge>
        );
      case 'promoted':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Promoted
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-orange-500" />
          <h1 className="text-3xl font-viking text-white">Waitlist Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add to Waitlist
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label htmlFor="tournament-filter" className="text-white font-medium">
          Filter by Tournament:
        </label>
        <select
          id="tournament-filter"
          value={selectedTournament}
          onChange={(e) => setSelectedTournament(e.target.value)}
          className="h-10 px-3 rounded-md bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Tournaments</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-sm text-slate-400">Total Entries</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-orange-400">{stats.waiting}</p>
            <p className="text-sm text-slate-400">Waiting</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-green-400">{stats.promoted}</p>
            <p className="text-sm text-slate-400">Promoted</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-slate-400">{stats.cancelled}</p>
            <p className="text-sm text-slate-400">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Error State */}
      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded p-4">
          Error: {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <span className="ml-3 text-white">Loading waitlist...</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No waitlist entries found.</p>
          {selectedTournament !== 'all' && (
            <p className="mt-2">Try selecting "All Tournaments" to see all entries.</p>
          )}
        </div>
      ) : (
        /* Table */
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="text-left py-3 px-4 font-semibold text-white">Pos</th>
                  <th className="text-left py-3 px-4 font-semibold text-white">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-white">Email</th>
                  {selectedTournament === 'all' && (
                    <th className="text-left py-3 px-4 font-semibold text-white">Tournament</th>
                  )}
                  <th className="text-left py-3 px-4 font-semibold text-white">Joined</th>
                  <th className="text-left py-3 px-4 font-semibold text-white">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 font-bold">
                        {entry.position}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white">
                      {entry.firstName} {entry.lastName}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{entry.email}</td>
                    {selectedTournament === 'all' && (
                      <td className="py-3 px-4 text-slate-300">{entry.tournamentName}</td>
                    )}
                    <td className="py-3 px-4 text-slate-400 text-sm">
                      {formatDate(entry.joinedAt)}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(entry.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                          className="text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(entry)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <WaitlistCreateModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        tournaments={tournaments}
        onSave={handleCreate}
        preselectedTournamentId={selectedTournament !== 'all' ? selectedTournament : undefined}
      />

      {/* Edit Modal */}
      <WaitlistEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        entry={editEntry}
        onSave={handleSaveEdit}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteEntry !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteEntry(null);
        }}
        onConfirm={confirmDelete}
        itemName={deleteEntry ? `${deleteEntry.firstName} ${deleteEntry.lastName}` : ''}
        itemType="Waitlist Entry"
        isLoading={isDeleting}
      />
    </div>
  );
};
