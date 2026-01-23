import type { FC } from 'react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Loader2, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type { WaitlistStatus } from '@/types';

interface BulkStatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntryIds: string[];
  bulkUpdateWaitlistStatus: (
    ids: string[],
    targetStatus: WaitlistStatus,
    onProgress?: (current: number, total: number) => void
  ) => Promise<{ succeeded: string[]; failed: { id: string; error: string }[] }>;
  onSuccess: () => void;
}

// Status options for the dropdown (excluding 'All Statuses')
const STATUS_OPTIONS: { value: WaitlistStatus; label: string }[] = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'promoted', label: 'Promoted' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

type DialogState = 'idle' | 'processing' | 'complete';

export const BulkStatusUpdateDialog: FC<BulkStatusUpdateDialogProps> = ({
  open,
  onOpenChange,
  selectedEntryIds,
  bulkUpdateWaitlistStatus,
  onSuccess,
}) => {
  const [targetStatus, setTargetStatus] = useState<WaitlistStatus>('confirmed');
  const [state, setState] = useState<DialogState>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{
    succeeded: string[];
    failed: { id: string; error: string }[];
  } | null>(null);

  const handleUpdate = async () => {
    setState('processing');
    setProgress({ current: 0, total: selectedEntryIds.length });
    setResult(null);

    try {
      const updateResult = await bulkUpdateWaitlistStatus(
        selectedEntryIds,
        targetStatus,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      setResult(updateResult);
      setState('complete');
    } catch (err) {
      console.error('Error in bulk status update:', err);
      setResult({
        succeeded: [],
        failed: selectedEntryIds.map((id) => ({
          id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })),
      });
      setState('complete');
    }
  };

  const handleClose = () => {
    if (state === 'complete' && result && result.succeeded.length > 0) {
      onSuccess();
    }
    // Reset state when closing
    setState('idle');
    setProgress({ current: 0, total: 0 });
    setResult(null);
    onOpenChange(false);
  };

  const getStatusLabel = (status: WaitlistStatus) => {
    return STATUS_OPTIONS.find((opt) => opt.value === status)?.label || status;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && state !== 'processing') {
        handleClose();
      }
    }}>
      <DialogContent className="max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-400" />
            Bulk Update Status
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Idle State - Show form */}
          {state === 'idle' && (
            <>
              <p className="text-slate-300">
                Update the status of {selectedEntryIds.length} selected{' '}
                {selectedEntryIds.length === 1 ? 'entry' : 'entries'}.
              </p>

              <div className="space-y-2">
                <label htmlFor="target-status" className="block text-sm font-medium text-slate-300">
                  Target Status
                </label>
                <select
                  id="target-status"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as WaitlistStatus)}
                  className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {targetStatus === 'promoted' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-sm">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Promoting entries will check tournament capacity for each entry.
                </div>
              )}
            </>
          )}

          {/* Processing State - Show progress */}
          {state === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
              <p className="text-white">
                Processing {progress.current} of {progress.total}...
              </p>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Complete State - Show results */}
          {state === 'complete' && result && (
            <div className="space-y-4">
              {result.succeeded.length > 0 && result.failed.length === 0 ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400">
                  <CheckCircle className="h-5 w-5 inline mr-2" />
                  Successfully updated {result.succeeded.length}{' '}
                  {result.succeeded.length === 1 ? 'entry' : 'entries'} to "{getStatusLabel(targetStatus)}"
                </div>
              ) : result.failed.length > 0 && result.succeeded.length === 0 ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                  <XCircle className="h-5 w-5 inline mr-2" />
                  Failed to update all entries.
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-400">
                  <AlertCircle className="h-5 w-5 inline mr-2" />
                  Updated {result.succeeded.length} of {selectedEntryIds.length} entries.
                </div>
              )}

              {/* Show failure details if any */}
              {result.failed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-300">Failed entries:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-900/50 rounded-lg p-2">
                    {result.failed.map((failure) => (
                      <div
                        key={failure.id}
                        className="flex items-start gap-2 p-2 bg-red-500/5 rounded text-sm"
                      >
                        <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-red-300">{failure.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {state === 'idle' && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-600 text-white hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Update {selectedEntryIds.length} {selectedEntryIds.length === 1 ? 'Entry' : 'Entries'}
              </Button>
            </>
          )}

          {state === 'processing' && (
            <Button disabled className="bg-slate-600 text-slate-400">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </Button>
          )}

          {state === 'complete' && (
            <Button
              onClick={handleClose}
              className="bg-slate-600 hover:bg-slate-500"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
