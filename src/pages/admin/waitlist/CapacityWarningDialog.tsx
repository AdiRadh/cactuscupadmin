import type { FC } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface CapacityWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  currentParticipants: number;
  maxParticipants: number;
  reservedParticipants: number;
  userName: string;
  isLoading?: boolean;
}

export const CapacityWarningDialog: FC<CapacityWarningDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  currentParticipants,
  maxParticipants,
  reservedParticipants,
  userName,
  isLoading = false,
}) => {
  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <DialogTitle className="text-lg text-white">Tournament at Capacity</DialogTitle>
              <DialogDescription className="mt-1 text-slate-400">
                This action will increase the participant cap
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-300">
            Promoting <span className="font-semibold text-white">{userName}</span> will increase the
            tournament's participant cap from{' '}
            <span className="font-semibold text-white">{maxParticipants}</span> to{' '}
            <span className="font-semibold text-white">{maxParticipants + 1}</span>.
          </p>

          <div className="bg-slate-800 rounded-lg p-3 space-y-1 border border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Current Participants:</span>
              <span className="font-medium text-white">{currentParticipants}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Max Capacity:</span>
              <span className="font-medium text-white">{maxParticipants}</span>
            </div>
            {reservedParticipants > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Reserved (checkout):</span>
                <span className="font-medium text-white">{reservedParticipants}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Promoting...
              </>
            ) : (
              'Confirm & Increase Cap'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
