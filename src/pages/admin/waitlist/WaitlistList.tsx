import type { FC } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import { FilterBar } from '@/components/admin/FilterBar';
import { SearchInput, FilterSelect, DateRangeFilter } from '@/components/admin/filters';
import { SortableTableHeader, TableHeader } from '@/components/admin/SortableTableHeader';
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
  Send,
  Receipt,
  AlertCircle,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import { useWaitlist } from '@/hooks/data/useWaitlist';
import type { CreateWaitlistEntryData, WaitlistVerificationResult } from '@/hooks/data/useWaitlist';
import { useAdmin } from '@/hooks/data/useAdmin';
import { useListFilters } from '@/hooks/useListFilters';
import type { WaitlistEntry, WaitlistStatus, Tournament } from '@/types';
import {
  WAITLIST_STATUS_OPTIONS,
  DEFAULT_WAITLIST_FILTERS,
  type WaitlistFilters,
  type WaitlistSortField,
} from '@/types/filters';
import { WaitlistEditModal } from './WaitlistEditModal';
import { WaitlistCreateModal } from './WaitlistCreateModal';
import { SendInvoicesDialog } from './SendInvoicesDialog';
import { WaitlistVerificationDialog } from './WaitlistVerificationDialog';

export const WaitlistList: FC = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and sort state
  const {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    sort,
    toggleSort,
    getSortDirection,
    debouncedSearch,
  } = useListFilters<WaitlistFilters, WaitlistSortField>({
    defaultFilters: DEFAULT_WAITLIST_FILTERS,
    defaultSort: { field: 'position', order: 'asc' },
    paramMapping: {
      tournamentId: 'tournament',
      dateFrom: 'from',
      dateTo: 'to',
    },
  });

  // Edit modal state
  const [editEntry, setEditEntry] = useState<WaitlistEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete confirmation state
  const [deleteEntry, setDeleteEntry] = useState<WaitlistEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Invoice selection state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);

  // Verification dialog state
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<WaitlistVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const {
    getWaitlistEntries,
    createWaitlistEntry,
    updateWaitlistEntry,
    deleteWaitlistEntry,
    promoteWaitlistUser,
    calculateInvoices,
    sendInvoices,
    verifyWaitlistRegistrations,
  } = useWaitlist();
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
      const tournamentId = filters.tournamentId === 'all' ? undefined : filters.tournamentId;
      const waitlistData = await getWaitlistEntries(tournamentId);
      setEntries(waitlistData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [listTournaments, getWaitlistEntries, filters.tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering and sorting
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    // Filter by status
    if (filters.status) {
      result = result.filter((e) => e.status === filters.status);
    }

    // Filter by search (name or email)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(
        (e) =>
          e.firstName.toLowerCase().includes(searchLower) ||
          e.lastName.toLowerCase().includes(searchLower) ||
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchLower) ||
          e.email.toLowerCase().includes(searchLower)
      );
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      result = result.filter((e) => new Date(e.joinedAt) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((e) => new Date(e.joinedAt) <= toDate);
    }

    // Sort
    if (sort) {
      result.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case 'position':
            comparison = a.position - b.position;
            break;
          case 'name':
            comparison = `${a.firstName} ${a.lastName}`.localeCompare(
              `${b.firstName} ${b.lastName}`
            );
            break;
          case 'email':
            comparison = a.email.localeCompare(b.email);
            break;
          case 'joinedAt':
            comparison =
              new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
            break;
        }
        return sort.order === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [entries, filters.status, debouncedSearch, filters.dateFrom, filters.dateTo, sort]);

  // Stats calculations (based on all entries, not filtered)
  const stats = useMemo(() => {
    const total = entries.length;
    const waiting = entries.filter((e) => e.status === 'waiting').length;
    const promoted = entries.filter((e) => e.status === 'promoted').length;
    const invoiced = entries.filter((e) => e.status === 'invoiced').length;
    const confirmed = entries.filter((e) => e.status === 'confirmed').length;
    const cancelled = entries.filter((e) => e.status === 'cancelled').length;
    const expired = entries.filter((e) => e.status === 'expired').length;
    return { total, waiting, promoted, invoiced, confirmed, cancelled, expired };
  }, [entries]);

  // Entries that can be invoiced (promoted status) - from filtered list
  const invoiceableEntries = useMemo(() => {
    return filteredAndSortedEntries.filter((e) => e.status === 'promoted');
  }, [filteredAndSortedEntries]);

  // Handle selection toggle
  const handleToggleSelection = (entryId: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Handle select all promoted entries
  const handleSelectAllPromoted = () => {
    if (selectedEntries.size === invoiceableEntries.length && invoiceableEntries.length > 0) {
      // Deselect all
      setSelectedEntries(new Set());
    } else {
      // Select all promoted entries
      setSelectedEntries(new Set(invoiceableEntries.map((e) => e.id)));
    }
  };

  // Handle invoice send success
  const handleInvoiceSent = async () => {
    setSelectedEntries(new Set());
    await fetchData();
  };

  // Get held spots for selected tournament
  const selectedTournamentData = useMemo(() => {
    if (filters.tournamentId === 'all') return null;
    return tournaments.find((t) => t.id === filters.tournamentId) || null;
  }, [filters.tournamentId, tournaments]);

  // Tournament dropdown options
  const tournamentOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Tournaments' },
      ...tournaments.map((t) => ({ value: t.id, label: t.name })),
    ];
  }, [tournaments]);

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

  // Export to CSV (exports filtered/sorted entries)
  const handleExportCSV = () => {
    if (filteredAndSortedEntries.length === 0) return;

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

    const rows = filteredAndSortedEntries.map((entry) => [
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
      filters.tournamentId === 'all'
        ? 'all-tournaments'
        : tournaments.find((t) => t.id === filters.tournamentId)?.name.replace(/[^a-z0-9]/gi, '_') ||
          'tournament';
    const date = new Date().toISOString().split('T')[0];
    link.download = `waitlist-${tournamentName}-${date}.csv`;

    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Handle verification
  const handleVerifyWaitlist = async () => {
    setIsVerifying(true);
    setVerificationError(null);
    setIsVerificationDialogOpen(true);

    try {
      const tournamentId = filters.tournamentId === 'all' ? undefined : filters.tournamentId;
      const result = await verifyWaitlistRegistrations(tournamentId);
      setVerificationResult(result);
    } catch (err) {
      console.error('Error verifying waitlist:', err);
      setVerificationError(err instanceof Error ? err.message : 'Failed to verify waitlist');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle removing duplicate from waitlist
  const handleRemoveFromWaitlist = async (entryId: string) => {
    try {
      await deleteWaitlistEntry(entryId);
      // Refresh verification results
      const tournamentId = filters.tournamentId === 'all' ? undefined : filters.tournamentId;
      const result = await verifyWaitlistRegistrations(tournamentId);
      setVerificationResult(result);
      // Also refresh the main list
      await fetchData();
    } catch (err) {
      console.error('Error removing waitlist entry:', err);
    }
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
          <Badge variant="default" className="flex items-center gap-1 bg-orange-500">
            <CheckCircle className="h-3 w-3" />
            Promoted
          </Badge>
        );
      case 'invoiced':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-blue-500">
            <Receipt className="h-3 w-3" />
            Invoiced
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <FileCheck className="h-3 w-3" />
            Confirmed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Expired
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
          {selectedEntries.size > 0 && (
            <Button
              size="sm"
              onClick={() => setIsInvoiceDialogOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Invoices ({selectedEntries.size})
            </Button>
          )}
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
            variant="outline"
            size="sm"
            onClick={handleVerifyWaitlist}
            disabled={entries.length === 0}
            className="border-green-600 text-green-400 hover:bg-green-500/10"
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Verify Duplicates
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

      {/* Filters */}
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        title="Filters"
      >
        <FilterSelect
          label="Tournament"
          value={filters.tournamentId}
          onChange={(value) => setFilter('tournamentId', value)}
          options={tournamentOptions}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => setFilter('status', value as WaitlistFilters['status'])}
          options={WAITLIST_STATUS_OPTIONS}
        />
        <SearchInput
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
          placeholder="Search name or email..."
          className="w-64"
        />
        <DateRangeFilter
          label="Joined Date"
          fromValue={filters.dateFrom}
          toValue={filters.dateTo}
          onFromChange={(value) => setFilter('dateFrom', value)}
          onToChange={(value) => setFilter('dateTo', value)}
        />
      </FilterBar>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-sm text-slate-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">{stats.waiting}</p>
            <p className="text-sm text-slate-400">Waiting</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-orange-400">{stats.promoted}</p>
            <p className="text-sm text-slate-400">Promoted</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{stats.invoiced}</p>
            <p className="text-sm text-slate-400">Invoiced</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-green-400">{stats.confirmed}</p>
            <p className="text-sm text-slate-400">Confirmed</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-red-400">{stats.expired}</p>
            <p className="text-sm text-slate-400">Expired</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-slate-400">{stats.cancelled}</p>
            <p className="text-sm text-slate-400">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Held Spots Info - shown when a specific tournament is selected */}
      {selectedTournamentData && selectedTournamentData.waitlistHeldSpots > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-medium">
                {selectedTournamentData.waitlistHeldSpots} spot{selectedTournamentData.waitlistHeldSpots !== 1 ? 's' : ''} held for waitlist
              </p>
              <p className="text-sm text-slate-400">
                {selectedTournamentData.currentParticipants} / {selectedTournamentData.maxParticipants} registered
                {' '}({selectedTournamentData.maxParticipants - selectedTournamentData.currentParticipants - selectedTournamentData.waitlistHeldSpots} available for new signups)
              </p>
            </div>
          </div>
        </div>
      )}

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
      ) : filteredAndSortedEntries.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No waitlist entries found.</p>
          {hasActiveFilters && (
            <p className="mt-2">Try adjusting your filters or click Reset to see all entries.</p>
          )}
        </div>
      ) : (
        /* Table */
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="w-10 py-3 px-4">
                    <input
                      type="checkbox"
                      checked={
                        invoiceableEntries.length > 0 &&
                        selectedEntries.size === invoiceableEntries.length
                      }
                      onChange={handleSelectAllPromoted}
                      disabled={invoiceableEntries.length === 0}
                      className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500 disabled:opacity-50"
                      title={invoiceableEntries.length === 0 ? 'No promoted entries to select' : 'Select all promoted entries'}
                    />
                  </th>
                  <SortableTableHeader
                    field="position"
                    sortDirection={getSortDirection('position')}
                    onSort={() => toggleSort('position')}
                  >
                    Pos
                  </SortableTableHeader>
                  <SortableTableHeader
                    field="name"
                    sortDirection={getSortDirection('name')}
                    onSort={() => toggleSort('name')}
                  >
                    Name
                  </SortableTableHeader>
                  <SortableTableHeader
                    field="email"
                    sortDirection={getSortDirection('email')}
                    onSort={() => toggleSort('email')}
                  >
                    Email
                  </SortableTableHeader>
                  {filters.tournamentId === 'all' && (
                    <TableHeader>Tournament</TableHeader>
                  )}
                  <SortableTableHeader
                    field="joinedAt"
                    sortDirection={getSortDirection('joinedAt')}
                    onSort={() => toggleSort('joinedAt')}
                  >
                    Joined
                  </SortableTableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader align="right">Actions</TableHeader>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedEntries.map((entry) => {
                  const isInvoiceable = entry.status === 'promoted';
                  const isSelected = selectedEntries.has(entry.id);

                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                        isSelected ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelection(entry.id)}
                          disabled={!isInvoiceable}
                          className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500 disabled:opacity-30"
                          title={isInvoiceable ? 'Select for invoicing' : 'Only promoted entries can be invoiced'}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 font-bold">
                          {entry.position}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white">
                        {entry.firstName} {entry.lastName}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{entry.email}</td>
                      {filters.tournamentId === 'all' && (
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
                  );
                })}
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
        preselectedTournamentId={filters.tournamentId !== 'all' ? filters.tournamentId : undefined}
      />

      {/* Edit Modal */}
      <WaitlistEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        entry={editEntry}
        onSave={handleSaveEdit}
        promoteWaitlistUser={promoteWaitlistUser}
        onPromotionSuccess={fetchData}
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

      {/* Send Invoices Dialog */}
      <SendInvoicesDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        selectedEntryIds={Array.from(selectedEntries)}
        calculateInvoices={calculateInvoices}
        sendInvoices={sendInvoices}
        onSuccess={handleInvoiceSent}
      />

      {/* Verification Dialog */}
      <WaitlistVerificationDialog
        open={isVerificationDialogOpen}
        onOpenChange={setIsVerificationDialogOpen}
        verificationResult={verificationResult}
        isLoading={isVerifying}
        error={verificationError}
        onRemoveFromWaitlist={handleRemoveFromWaitlist}
      />
    </div>
  );
};
