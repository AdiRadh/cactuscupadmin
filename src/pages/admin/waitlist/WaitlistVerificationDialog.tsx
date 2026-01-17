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
  Trophy,
  Trash2,
} from 'lucide-react';
import type { WaitlistDuplicateEntry, WaitlistVerificationResult } from '@/hooks/data/useWaitlist';
import type { WaitlistStatus } from '@/types';

interface WaitlistVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verificationResult: WaitlistVerificationResult | null;
  isLoading: boolean;
  error: string | null;
  onRemoveFromWaitlist?: (entryId: string) => Promise<void>;
}

export const WaitlistVerificationDialog: FC<WaitlistVerificationDialogProps> = ({
  open,
  onOpenChange,
  verificationResult,
  isLoading,
  error,
  onRemoveFromWaitlist,
}) => {
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null);

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

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Paid</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'refunded':
        return <Badge variant="secondary">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWaitlistStatusBadge = (status: WaitlistStatus) => {
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

  const handleRemove = async (entryId: string) => {
    if (!onRemoveFromWaitlist) return;
    setRemovingEntryId(entryId);
    try {
      await onRemoveFromWaitlist(entryId);
    } finally {
      setRemovingEntryId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Waitlist Verification Results
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Users who are on the waitlist but already have a tournament registration
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <span className="ml-3 text-white">Checking waitlist against registrations...</span>
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

            {/* Results */}
            {verificationResult.duplicateCount === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-green-400 text-lg font-medium">No Duplicates Found</p>
                <p className="text-slate-400 mt-2">
                  All waitlist users are not yet registered for their respective tournaments.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-yellow-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  The following users are on the waitlist but already have a registration for the
                  same tournament:
                </p>
                {verificationResult.duplicates.map((duplicate) => (
                  <DuplicateCard
                    key={duplicate.waitlistEntryId}
                    duplicate={duplicate}
                    formatDate={formatDate}
                    getPaymentBadge={getPaymentBadge}
                    getWaitlistStatusBadge={getWaitlistStatusBadge}
                    onRemove={onRemoveFromWaitlist ? handleRemove : undefined}
                    isRemoving={removingEntryId === duplicate.waitlistEntryId}
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

interface DuplicateCardProps {
  duplicate: WaitlistDuplicateEntry;
  formatDate: (dateString: string | null) => string;
  getPaymentBadge: (status: string) => JSX.Element;
  getWaitlistStatusBadge: (status: WaitlistStatus) => JSX.Element;
  onRemove?: (entryId: string) => void;
  isRemoving: boolean;
}

const DuplicateCard: FC<DuplicateCardProps> = ({
  duplicate,
  formatDate,
  getPaymentBadge,
  getWaitlistStatusBadge,
  onRemove,
  isRemoving,
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

            {/* Tournament */}
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-orange-400" />
              <span className="text-white">{duplicate.tournamentName}</span>
            </div>

            {/* Two columns for waitlist and registration info */}
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

              {/* Registration Info */}
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Tournament Registration
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Payment:</span>
                    {getPaymentBadge(duplicate.registrationPaymentStatus)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    Registered {formatDate(duplicate.registrationDate)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          {onRemove && (
            <div className="ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(duplicate.waitlistEntryId)}
                disabled={isRemoving}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                title="Remove from waitlist"
              >
                {isRemoving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
