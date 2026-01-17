import type { FC } from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Loader2, Receipt, ExternalLink, AlertCircle } from 'lucide-react';
import { TournamentSelectionList } from './TournamentSelectionList';
import { useWaitlist } from '@/hooks/data/useWaitlist';
import type { WaitlistEntryWithTournament } from '@/types';

interface UserBillingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  onSuccess?: () => void;
}

/**
 * Modal for creating a combined invoice for a user's promoted tournaments
 */
export const UserBillingModal: FC<UserBillingModalProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  onSuccess,
}) => {
  const { getPromotedEntriesByUser, createCombinedInvoice } = useWaitlist();

  const [entries, setEntries] = useState<WaitlistEntryWithTournament[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  // Fetch entries when modal opens
  useEffect(() => {
    if (open && userId) {
      setLoadingEntries(true);
      setError(null);
      setInvoiceUrl(null);

      getPromotedEntriesByUser(userId).then((data) => {
        setEntries(data);
        // Pre-select all entries
        setSelectedIds(data.map(e => e.id));
        setLoadingEntries(false);
      });
    }
  }, [open, userId, getPromotedEntriesByUser]);

  // Calculate totals
  const selectedEntries = entries.filter(e => selectedIds.includes(e.id));
  const tournamentTotal = selectedEntries.reduce(
    (sum, entry) => sum + (entry.tournament.registrationFee || 0),
    0
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleCreateInvoice = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one tournament');
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createCombinedInvoice({
      userId,
      waitlistEntryIds: selectedIds,
      dueDays: 7,
    });

    setCreating(false);

    if (result.success && result.invoiceUrl) {
      setInvoiceUrl(result.invoiceUrl);
      onSuccess?.();
    } else {
      setError(result.error || 'Failed to create invoice');
    }
  };

  const handleClose = () => {
    setSelectedIds([]);
    setEntries([]);
    setError(null);
    setInvoiceUrl(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-orange-500" />
            Create Invoice
          </DialogTitle>
          <DialogDescription>
            Create a combined invoice for {userName} ({userEmail})
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loadingEntries ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              <span className="ml-2 text-white/70">Loading tournaments...</span>
            </div>
          ) : invoiceUrl ? (
            // Success state
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-400 font-medium">Invoice created successfully!</p>
                <p className="text-sm text-white/70 mt-1">
                  The invoice has been sent to {userEmail}
                </p>
              </div>
              <Button
                onClick={() => window.open(invoiceUrl, '_blank')}
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Invoice in Stripe
              </Button>
            </div>
          ) : (
            // Selection state
            <div className="space-y-4">
              <TournamentSelectionList
                entries={entries}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                disabled={creating}
              />

              {/* Total */}
              {selectedIds.length > 0 && (
                <div className="pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Tournament Fees:</span>
                    <span className="text-lg font-bold text-orange-400">
                      {formatCurrency(tournamentTotal)}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    Event registration fee will be added if user is not already registered.
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {invoiceUrl ? (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={creating}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateInvoice}
                disabled={creating || selectedIds.length === 0 || loadingEntries}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4 mr-2" />
                    Create Invoice ({selectedIds.length})
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

export default UserBillingModal;
