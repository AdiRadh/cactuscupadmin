import type { FC } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DeleteConfirmDialog, ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { FilterBar } from '@/components/admin/FilterBar';
import { SearchInput, FilterSelect, DateRangeFilter } from '@/components/admin/filters';
import { SortableTableHeader, TableHeader } from '@/components/admin/SortableTableHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
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
  CheckCircle2,
} from 'lucide-react';
import { useSpecialEventWaitlist } from '@/hooks/data/useSpecialEventWaitlist';
import type { CreateSEWaitlistEntryData } from '@/hooks/data/useSpecialEventWaitlist';
import { useAdmin } from '@/hooks/data/useAdmin';
import { useListFilters } from '@/hooks/useListFilters';
import type {
  SpecialEventWaitlistEntry,
  SEInvoiceCalculation,
  SEVerificationResult,
  WaitlistStatus,
  SendInvoicesRequest,
  SendInvoicesResponse,
  SpecialEvent,
} from '@/types';
import {
  WAITLIST_STATUS_OPTIONS,
  DEFAULT_SE_WAITLIST_FILTERS,
  type SEWaitlistFilters,
  type SEWaitlistSortField,
} from '@/types/filters';
import { WaitlistEditModal } from './WaitlistEditModal';
import { SEWaitlistCreateModal } from './SEWaitlistCreateModal';
import { SEVerificationDialog } from './SEVerificationDialog';
import { BulkStatusUpdateDialog } from './BulkStatusUpdateDialog';

// ============================================================================
// SESendInvoicesDialog
// ============================================================================

interface SESendInvoicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntryIds: string[];
  calculateInvoices: (ids: string[]) => Promise<SEInvoiceCalculation[]>;
  sendInvoices: (request: SendInvoicesRequest) => Promise<SendInvoicesResponse>;
  onSuccess: () => void;
}

const SESendInvoicesDialog: FC<SESendInvoicesDialogProps> = ({
  open,
  onOpenChange,
  selectedEntryIds,
  calculateInvoices,
  sendInvoices,
  onSuccess,
}) => {
  const [calculations, setCalculations] = useState<SEInvoiceCalculation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendInvoicesResponse | null>(null);

  // Calculate invoices when dialog opens
  useEffect(() => {
    let cancelled = false;

    if (open && selectedEntryIds.length > 0) {
      setIsLoading(true);
      setError(null);
      setResult(null);
      setCalculations([]);

      calculateInvoices(selectedEntryIds)
        .then((calcs) => {
          if (!cancelled) setCalculations(calcs);
        })
        .catch((err) => {
          console.error('Error calculating SE invoices:', err);
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to calculate invoices');
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [open, selectedEntryIds, calculateInvoices]);

  const handleSend = async () => {
    setIsSending(true);
    setError(null);

    try {
      const response = await sendInvoices({
        waitlistEntryIds: selectedEntryIds,
      });

      setResult(response);

      if (response.success) {
        // Close dialog and refresh after a short delay to show success
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      console.error('Error sending SE invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invoices');
    } finally {
      setIsSending(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const totalAmount = calculations.reduce((sum, calc) => sum + calc.totalAmount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-400" />
            Send Invoices
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span className="ml-3 text-white">Calculating invoice amounts...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
              <AlertCircle className="h-5 w-5 inline mr-2" />
              {error}
            </div>
          )}

          {/* Result State */}
          {result && (
            <div className="space-y-4">
              {result.success ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400">
                  <CheckCircle2 className="h-5 w-5 inline mr-2" />
                  Successfully sent {result.totalSent} invoice{result.totalSent !== 1 ? 's' : ''}!
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-400">
                  <AlertCircle className="h-5 w-5 inline mr-2" />
                  Sent {result.totalSent} invoice{result.totalSent !== 1 ? 's' : ''},{' '}
                  {result.totalFailed} failed.
                </div>
              )}

              {/* Show individual results */}
              {result.results.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {result.results.map((r) => {
                    const calc = calculations.find((c) => c.waitlistEntryId === r.waitlistEntryId);
                    return (
                      <div
                        key={r.waitlistEntryId}
                        className={`flex items-center justify-between p-2 rounded ${
                          r.success ? 'bg-green-500/5' : 'bg-red-500/5'
                        }`}
                      >
                        <span className="text-white">
                          {calc ? `${calc.firstName} ${calc.lastName}` : r.waitlistEntryId}
                        </span>
                        <span className={r.success ? 'text-green-400' : 'text-red-400'}>
                          {r.success ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-4 w-4" />
                              <span className="text-sm">{r.error}</span>
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Invoice Preview */}
          {!isLoading && !error && !result && calculations.length > 0 && (
            <div className="space-y-4">
              <p className="text-slate-300">
                You are about to send invoices to {calculations.length} promoted waitlist member
                {calculations.length !== 1 ? 's' : ''}. Each invoice will be due in 7 days.
              </p>

              {/* Invoice Table */}
              <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800">
                      <th className="text-left py-2 px-3 font-semibold text-white text-sm">Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-white text-sm">Special Event</th>
                      <th className="text-right py-2 px-3 font-semibold text-white text-sm">Ticket Price</th>
                      <th className="text-right py-2 px-3 font-semibold text-white text-sm">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculations.map((calc) => (
                      <tr
                        key={calc.waitlistEntryId}
                        className="border-b border-slate-700/50"
                      >
                        <td className="py-2 px-3 text-white text-sm">
                          {calc.firstName} {calc.lastName}
                        </td>
                        <td className="py-2 px-3 text-slate-300 text-sm">{calc.specialEventTitle}</td>
                        <td className="py-2 px-3 text-slate-300 text-sm text-right">
                          {formatCurrency(calc.ticketPrice)}
                        </td>
                        <td className="py-2 px-3 text-white text-sm text-right font-medium">
                          {formatCurrency(calc.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/50">
                      <td colSpan={3} className="py-2 px-3 text-white font-semibold text-right">
                        Grand Total:
                      </td>
                      <td className="py-2 px-3 text-white font-bold text-right">
                        {formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* No calculations */}
          {!isLoading && !error && !result && calculations.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No promoted entries found to invoice.
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button
              onClick={() => {
                onOpenChange(false);
                if (result.totalSent > 0) {
                  onSuccess();
                }
              }}
              className="bg-slate-600 hover:bg-slate-500"
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
                className="border-slate-600 text-white hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={isLoading || isSending || calculations.length === 0}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {calculations.length} Invoice{calculations.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// SpecialEventWaitlistTab
// ============================================================================

export const SpecialEventWaitlistTab: FC = () => {
  const [entries, setEntries] = useState<SpecialEventWaitlistEntry[]>([]);
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
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
  } = useListFilters<SEWaitlistFilters, SEWaitlistSortField>({
    defaultFilters: DEFAULT_SE_WAITLIST_FILTERS,
    defaultSort: { field: 'position', order: 'asc' },
    paramMapping: {
      specialEventId: 'event',
      dateFrom: 'from',
      dateTo: 'to',
    },
  });

  // Edit modal state
  const [editEntry, setEditEntry] = useState<SpecialEventWaitlistEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete confirmation state
  const [deleteEntry, setDeleteEntry] = useState<SpecialEventWaitlistEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Invoice selection state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isBulkStatusDialogOpen, setIsBulkStatusDialogOpen] = useState(false);

  // Filter change confirmation state (when selections exist)
  const [pendingFilterAction, setPendingFilterAction] = useState<(() => void) | null>(null);

  // Verification dialog state
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<SEVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const {
    getEntries,
    createEntry,
    updateEntry,
    deleteEntry: deleteWaitlistEntry,
    confirmEntry,
    confirmEntries,
    bulkUpdateStatus,
    promoteUser,
    calculateInvoices,
    sendInvoices,
    verifyRegistrations,
  } = useSpecialEventWaitlist();
  const { listSpecialEvents } = useAdmin();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch special events for the filter dropdown
      const eventData = await listSpecialEvents({
        sorters: [{ field: 'title', order: 'asc' }],
      });
      setSpecialEvents(eventData);

      // Fetch waitlist entries
      const specialEventId = filters.specialEventId === 'all' ? undefined : filters.specialEventId;
      const waitlistData = await getEntries(specialEventId);
      setEntries(waitlistData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [listSpecialEvents, getEntries, filters.specialEventId]);

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

  // Check if all filtered entries are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredAndSortedEntries.length === 0) return false;
    return filteredAndSortedEntries.every((e) => selectedEntries.has(e.id));
  }, [filteredAndSortedEntries, selectedEntries]);

  // Handle select all filtered entries
  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered entries (keep selections from other filters)
      const filteredIds = new Set(filteredAndSortedEntries.map((e) => e.id));
      setSelectedEntries((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) {
          next.delete(id);
        }
        return next;
      });
    } else {
      // Select all filtered entries (add to existing selections)
      setSelectedEntries((prev) => {
        const next = new Set(prev);
        for (const entry of filteredAndSortedEntries) {
          next.add(entry.id);
        }
        return next;
      });
    }
  };

  // Handle bulk status update success
  const handleBulkStatusSuccess = async () => {
    setSelectedEntries(new Set());
    await fetchData();
  };

  // Wrapper for filter changes - confirms with user if selections exist
  const handleFilterChange = useCallback((action: () => void) => {
    if (selectedEntries.size > 0) {
      setPendingFilterAction(() => action);
    } else {
      action();
    }
  }, [selectedEntries.size]);

  // Confirm filter change and clear selections
  const confirmFilterChange = () => {
    if (pendingFilterAction) {
      setSelectedEntries(new Set());
      pendingFilterAction();
      setPendingFilterAction(null);
    }
  };

  // Cancel filter change
  const cancelFilterChange = () => {
    setPendingFilterAction(null);
  };

  // Auto-execute pending filter action if selections are cleared while dialog would be open
  useEffect(() => {
    if (pendingFilterAction && selectedEntries.size === 0) {
      pendingFilterAction();
      setPendingFilterAction(null);
    }
  }, [pendingFilterAction, selectedEntries.size]);

  // Handle reset filters with confirmation
  const handleResetFilters = () => {
    handleFilterChange(() => resetFilters());
  };

  // Handle search input - clears selections silently (no confirmation dialog)
  // This avoids showing a dialog on every keystroke
  const handleSearchChange = (value: string) => {
    if (selectedEntries.size > 0) {
      setSelectedEntries(new Set());
    }
    setFilter('search', value);
  };

  // Handle invoice send success
  const handleInvoiceSent = async () => {
    setSelectedEntries(new Set());
    await fetchData();
  };

  // Get held spots for selected special event
  const selectedEventData = useMemo(() => {
    if (filters.specialEventId === 'all') return null;
    return specialEvents.find((e) => e.id === filters.specialEventId) || null;
  }, [filters.specialEventId, specialEvents]);

  // Special event dropdown options
  const specialEventOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Special Events' },
      ...specialEvents.map((e) => ({ value: e.id, label: e.title })),
    ];
  }, [specialEvents]);

  // Handle edit
  const handleEdit = (entry: SpecialEventWaitlistEntry) => {
    setEditEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (id: string, data: { position?: number; status?: WaitlistStatus }) => {
    await updateEntry(id, data);
    await fetchData();
  };

  // Handle create
  const handleCreate = async (data: CreateSEWaitlistEntryData) => {
    const result = await createEntry(data);
    await fetchData();
    return result;
  };

  // Handle delete
  const handleDelete = (entry: SpecialEventWaitlistEntry) => {
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
      console.error('Error deleting special event waitlist entry:', err);
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
      'Special Event',
      'Status',
      'Joined At',
      'Promoted At',
    ];

    const rows = filteredAndSortedEntries.map((entry) => [
      entry.position.toString(),
      entry.firstName,
      entry.lastName,
      entry.email,
      entry.specialEventTitle || '',
      entry.status,
      entry.joinedAt ? new Date(entry.joinedAt).toISOString() : '',
      entry.promotedAt ? new Date(entry.promotedAt).toISOString() : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${(cell || '').replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const eventName =
      filters.specialEventId === 'all'
        ? 'all-events'
        : specialEvents.find((e) => e.id === filters.specialEventId)?.title.replace(/[^a-z0-9]/gi, '_') ||
          'event';
    const date = new Date().toISOString().split('T')[0];
    link.download = `se-waitlist-${eventName}-${date}.csv`;

    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Handle verification
  const handleVerifyWaitlist = async () => {
    setIsVerifying(true);
    setVerificationError(null);
    setIsVerificationDialogOpen(true);

    try {
      const specialEventId = filters.specialEventId === 'all' ? undefined : filters.specialEventId;
      const result = await verifyRegistrations(specialEventId);
      setVerificationResult(result);
    } catch (err) {
      console.error('Error verifying special event waitlist:', err);
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
      const specialEventId = filters.specialEventId === 'all' ? undefined : filters.specialEventId;
      const result = await verifyRegistrations(specialEventId);
      setVerificationResult(result);
      // Also refresh the main list
      await fetchData();
    } catch (err) {
      console.error('Error removing special event waitlist entry:', err);
    }
  };

  // Handle confirming a single duplicate entry
  const handleConfirmEntry = async (entryId: string) => {
    try {
      await confirmEntry(entryId);
      // Refresh verification results
      const specialEventId = filters.specialEventId === 'all' ? undefined : filters.specialEventId;
      const result = await verifyRegistrations(specialEventId);
      setVerificationResult(result);
      // Also refresh the main list
      await fetchData();
    } catch (err) {
      console.error('Error confirming special event waitlist entry:', err);
    }
  };

  // Handle confirming all duplicate entries
  const handleConfirmAll = async () => {
    if (!verificationResult || verificationResult.duplicates.length === 0) return;

    try {
      const entryIds = verificationResult.duplicates.map((d) => d.waitlistEntryId);
      await confirmEntries(entryIds);
      // Refresh verification results
      const specialEventId = filters.specialEventId === 'all' ? undefined : filters.specialEventId;
      const result = await verifyRegistrations(specialEventId);
      setVerificationResult(result);
      // Also refresh the main list
      await fetchData();
    } catch (err) {
      console.error('Error confirming all special event waitlist entries:', err);
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
      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        {selectedEntries.size > 0 && (
          <>
            <Button
              size="sm"
              onClick={() => setIsBulkStatusDialogOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Update Status ({selectedEntries.size})
            </Button>
            <Button
              size="sm"
              onClick={() => setIsInvoiceDialogOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Invoices ({selectedEntries.size})
            </Button>
          </>
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

      {/* Filters */}
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onReset={handleResetFilters}
        title="Filters"
      >
        <FilterSelect
          label="Special Event"
          value={filters.specialEventId}
          onChange={(value) => handleFilterChange(() => setFilter('specialEventId', value))}
          options={specialEventOptions}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) =>
            handleFilterChange(() => setFilter('status', value as SEWaitlistFilters['status']))
          }
          options={WAITLIST_STATUS_OPTIONS}
        />
        <SearchInput
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Search name or email..."
          className="w-64"
        />
        <DateRangeFilter
          label="Joined Date"
          fromValue={filters.dateFrom}
          toValue={filters.dateTo}
          onFromChange={(value) => handleFilterChange(() => setFilter('dateFrom', value))}
          onToChange={(value) => handleFilterChange(() => setFilter('dateTo', value))}
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

      {/* Held Spots Info - shown when a specific special event is selected */}
      {selectedEventData &&
        typeof (selectedEventData as SpecialEvent & { waitlistHeldSpots?: number }).waitlistHeldSpots === 'number' &&
        (selectedEventData as SpecialEvent & { waitlistHeldSpots?: number }).waitlistHeldSpots! > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                {(() => {
                  const heldSpots = (selectedEventData as SpecialEvent & { waitlistHeldSpots?: number }).waitlistHeldSpots!;
                  return (
                    <>
                      <p className="text-white font-medium">
                        {heldSpots} spot{heldSpots !== 1 ? 's' : ''} held for waitlist
                      </p>
                      <p className="text-sm text-slate-400">
                        {selectedEventData.currentRegistrations} /{' '}
                        {selectedEventData.maxCapacity ?? 'unlimited'} registered
                        {selectedEventData.maxCapacity != null &&
                          ` (${selectedEventData.maxCapacity - selectedEventData.currentRegistrations - heldSpots} available for new signups)`}
                      </p>
                    </>
                  );
                })()}
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
                      checked={allFilteredSelected}
                      onChange={handleSelectAll}
                      disabled={filteredAndSortedEntries.length === 0}
                      className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500 disabled:opacity-50"
                      title={
                        filteredAndSortedEntries.length === 0
                          ? 'No entries to select'
                          : 'Select all entries'
                      }
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
                  {filters.specialEventId === 'all' && (
                    <TableHeader>Special Event</TableHeader>
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
                          className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                          title="Select for bulk actions"
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
                      {filters.specialEventId === 'all' && (
                        <td className="py-3 px-4 text-slate-300">{entry.specialEventTitle}</td>
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
      <SEWaitlistCreateModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        specialEvents={specialEvents}
        onSave={handleCreate}
        preselectedSpecialEventId={
          filters.specialEventId !== 'all' ? filters.specialEventId : undefined
        }
      />

      {/* Edit Modal */}
      <WaitlistEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        entry={editEntry ? { ...editEntry, entityName: editEntry.specialEventTitle } : null}
        onSave={handleSaveEdit}
        promoteWaitlistUser={promoteUser}
        onPromotionSuccess={fetchData}
        entityLabel="Special Event"
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
      <SESendInvoicesDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        selectedEntryIds={Array.from(selectedEntries)}
        calculateInvoices={calculateInvoices}
        sendInvoices={sendInvoices}
        onSuccess={handleInvoiceSent}
      />

      {/* Verification Dialog */}
      <SEVerificationDialog
        open={isVerificationDialogOpen}
        onOpenChange={setIsVerificationDialogOpen}
        verificationResult={verificationResult}
        isLoading={isVerifying}
        error={verificationError}
        onRemoveFromWaitlist={handleRemoveFromWaitlist}
        onConfirmEntry={handleConfirmEntry}
        onConfirmAll={handleConfirmAll}
      />

      {/* Bulk Status Update Dialog */}
      <BulkStatusUpdateDialog
        open={isBulkStatusDialogOpen}
        onOpenChange={setIsBulkStatusDialogOpen}
        selectedEntryIds={Array.from(selectedEntries)}
        bulkUpdateWaitlistStatus={bulkUpdateStatus}
        onSuccess={handleBulkStatusSuccess}
      />

      {/* Filter Change Confirmation Dialog */}
      <ConfirmDialog
        open={pendingFilterAction !== null && selectedEntries.size > 0}
        onOpenChange={(open) => {
          if (!open) cancelFilterChange();
        }}
        onConfirm={confirmFilterChange}
        title="Clear Selections?"
        description={`You have ${selectedEntries.size} ${selectedEntries.size === 1 ? 'entry' : 'entries'} selected. Changing filters will clear your selections. Do you want to continue?`}
        confirmText="Clear & Continue"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
};
