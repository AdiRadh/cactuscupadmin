import type { FC } from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Loader2, Save } from 'lucide-react';
import type { WaitlistEntry, WaitlistStatus } from '@/types';

interface WaitlistEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: WaitlistEntry | null;
  onSave: (id: string, data: { position?: number; status?: WaitlistStatus }) => Promise<void>;
}

export const WaitlistEditModal: FC<WaitlistEditModalProps> = ({
  open,
  onOpenChange,
  entry,
  onSave,
}) => {
  const [position, setPosition] = useState<number>(1);
  const [status, setStatus] = useState<WaitlistStatus>('waiting');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setPosition(entry.position);
      setStatus(entry.status);
      setError(null);
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(entry.id, { position, status });
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving waitlist entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            Edit Waitlist Entry
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {entry.firstName} {entry.lastName} - {entry.tournamentName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded p-2">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="position" className="text-white">
              Position
            </Label>
            <Input
              id="position"
              type="number"
              min={1}
              value={position}
              onChange={(e) => setPosition(parseInt(e.target.value, 10) || 1)}
              className="bg-slate-800 border-slate-600 text-white"
            />
            <p className="text-xs text-slate-500">
              Lower numbers are higher priority in the queue
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-white">
              Status
            </Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as WaitlistStatus)}
              className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="waiting">Waiting</option>
              <option value="promoted">Promoted</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <p className="text-xs text-slate-500">
              {status === 'promoted' && 'User has been offered a spot and needs to complete registration'}
              {status === 'waiting' && 'User is actively waiting for a spot'}
              {status === 'cancelled' && 'User has left the waitlist or been removed'}
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="border-slate-600 text-white hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
