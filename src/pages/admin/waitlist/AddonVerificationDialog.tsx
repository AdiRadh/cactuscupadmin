import type { FC } from 'react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Clock,
  Calendar,
  Package,
  Trash2,
  Check,
  CheckCheck,
} from 'lucide-react';
import type { AddonVerificationResult, AddonWaitlistDuplicateEntry } from '@/types';
import type { WaitlistStatus } from '@/types';

interface AddonVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verificationResult: AddonVerificationResult | null;
  isLoading: boolean;
  error: string | null;
  onRemoveFromWaitlist?: (entryId: string) => Promise<void>;
  onConfirmEntry?: (entryId: string) => Promise<void>;
  onConfirmAll?: () => Promise<void>;
}

export const AddonVerificationDialog: FC<AddonVerificationDialogProps> = ({
  open,
  onOpenChange,
  verificationResult,
  isLoading,
  error,
  onRemoveFromWaitlist,
  onConfirmEntry,
  onConfirmAll,
}) => {
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null);
  const [confirmingEntryId, setConfirmingEntryId] = useState<string | null>(null);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWaitlistStatusBadge = (status: WaitlistStatus): JSX.Element => {
    switch (status) {
      case 'waiting':
        return <Badge variant="warning">Waiting</Badge>;
      case 'promoted':
        return <Badge className="bg-orange-500">Promoted</Badge>;
      case 'invoiced':
        return <Badge className="bg-blue-500">Invoiced</Badge>;
      case 'confirmed':
        return <Badge variant="success">Confirmed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRemove = async (entryId: string): Promise<void> => {
    if (!onRemoveFromWaitlist) return;
    setRemovingEntryId(entryId);
    try {
      await onRemoveFromWaitlist(entryId);
    } finally {
      setRemovingEntryId(null);
    }
  };

  const handleConfirm = async (entryId: string): Promise<void> => {
    if (!onConfirmEntry) return;
    setConfirmingEntryId(entryId);
    try {
      await onConfirmEntry(entryId);
    } finally {
      setConfirmingEntryId(null);
    }
  };

  const handleConfirmAll = async (): Promise<void> => {
    if (!onConfirmAll) return;
    setIsConfirmingAll(true);
    try {
      await onConfirmAll();
    } finally {
      setIsConfirmingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Add-on Waitlist Verification Results
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Users who are on the add-on waitlist but have already purchased the add-on
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <span className="ml-3 text-white">Checking waitlist against purchases...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded p-4">
            Error: {error}
          </div>
        ) : verificationResult ? (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {verificationResult.totalWaitlistChecked}
                  </p>
                  <p className="text-sm text-slate-400">Waitlist Entries Checked</p>
                </CardContent>
              </Card>
              <Card
                className={`border-slate-700 ${
                  verificationResult.duplicateCount > 0
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                }`}
              >
                <CardContent className="py-3 text-center">
                  <p
                    className={`text-2xl font-bold ${
                      verificationResult.duplicateCount > 0
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    {verificationResult.duplicateCount}
                  </p>
                  <p className="text-sm text-slate-400">Duplicates Found</p>
                </CardContent>
              </Card>
            </div>

            {/* Confirm All Button */}
            {verificationResult.duplicateCount > 0 && onConfirmAll && (
              <div className="flex justify-end">
                <Button
                  onClick={handleConfirmAll}
                  disabled={isConfirmingAll}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isConfirmingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Confirming All...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-4 w-4 mr-2" />
                      Confirm All ({verificationResult.duplicateCount})
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Results */}
            {verificationResult.duplicateCount === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-green-400 text-lg font-medium">No Duplicates Found</p>
                <p className="text-slate-400 mt-2">
                  All waitlist users have not yet purchased their respective add-ons.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-yellow-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  The following users are on the add-on waitlist but have already purchased the
                  same add-on:
                </p>
                {verificationResult.duplicates.map((duplicate) => (
                  <AddonDuplicateCard
                    key={duplicate.waitlistEntryId}
                    duplicate={duplicate}
                    formatDate={formatDate}
                    getWaitlistStatusBadge={getWaitlistStatusBadge}
                    onRemove={onRemoveFromWaitlist ? handleRemove : undefined}
                    isRemoving={removingEntryId === duplicate.waitlistEntryId}
                    onConfirm={onConfirmEntry ? handleConfirm : undefined}
                    isConfirming={confirmingEntryId === duplicate.waitlistEntryId}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// AddonDuplicateCard
// ============================================================================

interface AddonDuplicateCardProps {
  duplicate: AddonWaitlistDuplicateEntry;
  formatDate: (dateString: string | null) => string;
  getWaitlistStatusBadge: (status: WaitlistStatus) => JSX.Element;
  onRemove?: (entryId: string) => void;
  isRemoving: boolean;
  onConfirm?: (entryId: string) => void;
  isConfirming: boolean;
}

const AddonDuplicateCard: FC<AddonDuplicateCardProps> = ({
  duplicate,
  formatDate,
  getWaitlistStatusBadge,
  onRemove,
  isRemoving,
  onConfirm,
  isConfirming,
}) => {
  return (
    <Card className="bg-slate-800 border-yellow-500/30">
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            {/* User Info */}
            <div>
              <p className="font-medium text-white text-lg">
                {duplicate.firstName} {duplicate.lastName}
              </p>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                <Mail className="h-3 w-3" />
                <span>{duplicate.email}</span>
              </div>
            </div>

            {/* Add-on */}
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-orange-400" />
              <span className="text-white">{duplicate.addonName}</span>
              {duplicate.variantName && (
                <span className="text-slate-400">— {duplicate.variantName}</span>
              )}
            </div>

            {/* Two columns for waitlist and order info */}
            <div className="grid grid-cols-2 gap-4 mt-3">
              {/* Waitlist Info */}
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Waitlist Entry
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Status:</span>
                    {getWaitlistStatusBadge(duplicate.waitlistStatus)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Position:</span>
                    <span className="text-white font-medium">#{duplicate.waitlistPosition}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    Joined {formatDate(duplicate.waitlistJoinedAt)}
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Add-on Purchase
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    Ordered {formatDate(duplicate.orderDate)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {(onConfirm || onRemove) && (
            <div className="ml-4 flex flex-col gap-2">
              {onConfirm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfirm(duplicate.waitlistEntryId)}
                  disabled={isConfirming || isRemoving}
                  className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  title="Confirm waitlist entry"
                >
                  {isConfirming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              )}
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(duplicate.waitlistEntryId)}
                  disabled={isRemoving || isConfirming}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  title="Remove from waitlist"
                >
                  {isRemoving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
