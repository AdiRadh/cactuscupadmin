import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui';
import { Loader2, Search, UserPlus, Swords } from 'lucide-react';
import {
  addManualTournamentEntry,
  searchUsers,
  getAvailableTournaments,
  type UserSearchResult,
  type AvailableTournament,
} from '@/lib/utils/manualRegistration';

interface AddTournamentEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  // Pre-selected user (when opened from RegistrationDetailModal)
  preselectedUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export const AddTournamentEntryModal: FC<AddTournamentEntryModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  preselectedUser,
}) => {
  // User search state
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [showUserResults, setShowUserResults] = useState(false);

  // Tournament selection
  const [tournaments, setTournaments] = useState<AvailableTournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(false);

  // Form fields
  const [amountPaid, setAmountPaid] = useState('0');
  const [adminNotes, setAdminNotes] = useState('');
  const [createOrder, setCreateOrder] = useState(true);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      // Reset form
      setError(null);
      setSuccessMessage(null);
      setSelectedTournamentId('');
      setAmountPaid('0');
      setAdminNotes('');
      setCreateOrder(true);

      // If preselected user provided, use it
      if (preselectedUser) {
        setSelectedUser({
          id: preselectedUser.id,
          firstName: preselectedUser.firstName || '',
          lastName: preselectedUser.lastName || '',
          club: null,
        });
        setUserQuery(`${preselectedUser.firstName || ''} ${preselectedUser.lastName || ''}`.trim());
        setShowUserResults(false);
      } else {
        setSelectedUser(null);
        setUserQuery('');
        setUserResults([]);
        setShowUserResults(false);
      }

      // Load tournaments
      loadTournaments();
    }
  }, [open, preselectedUser]);

  const loadTournaments = async () => {
    setIsLoadingTournaments(true);
    try {
      const data = await getAvailableTournaments();
      setTournaments(data);
    } catch (err) {
      console.error('Error loading tournaments:', err);
    } finally {
      setIsLoadingTournaments(false);
    }
  };

  // Debounced user search
  const handleUserSearch = useCallback(async (query: string) => {
    setUserQuery(query);

    if (query.length < 2) {
      setUserResults([]);
      setShowUserResults(false);
      return;
    }

    setIsSearching(true);
    setShowUserResults(true);

    try {
      const results = await searchUsers(query);
      setUserResults(results);
    } catch (err) {
      console.error('Error searching users:', err);
      setUserResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setUserQuery(`${user.firstName} ${user.lastName}`.trim());
    setShowUserResults(false);
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    if (!selectedTournamentId) {
      setError('Please select a tournament');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Convert dollars to cents
      const amountInCents = Math.round(parseFloat(amountPaid || '0') * 100);

      const result = await addManualTournamentEntry({
        userId: selectedUser.id,
        tournamentId: selectedTournamentId,
        amountPaid: amountInCents,
        adminNotes: adminNotes || undefined,
        createOrder,
      });

      if (result.success) {
        setSuccessMessage('Tournament entry added successfully!');
        // Call onSuccess callback after short delay
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
        }, 1000);
      } else {
        setError(result.error || 'Failed to add tournament entry');
      }
    } catch (err) {
      console.error('Error adding tournament entry:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Tournament Entry
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Manually add a tournament entry for a user (bypasses payment)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Search */}
          <div className="space-y-2">
            <Label className="text-white">User *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name..."
                value={userQuery}
                onChange={(e) => handleUserSearch(e.target.value)}
                onFocus={() => userResults.length > 0 && setShowUserResults(true)}
                className="pl-9 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                disabled={!!preselectedUser}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {showUserResults && userResults.length > 0 && !preselectedUser && (
              <div className="absolute z-10 w-full max-w-[calc(100%-3rem)] mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {userResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors"
                    onClick={() => handleSelectUser(user)}
                  >
                    <p className="text-white font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    {user.club && (
                      <p className="text-sm text-slate-400">{user.club}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {showUserResults && userResults.length === 0 && userQuery.length >= 2 && !isSearching && (
              <p className="text-sm text-slate-400 mt-1">No users found</p>
            )}

            {selectedUser && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success">Selected: {selectedUser.firstName} {selectedUser.lastName}</Badge>
              </div>
            )}
          </div>

          {/* Tournament Selection */}
          <div className="space-y-2">
            <Label className="text-white">Tournament *</Label>
            {isLoadingTournaments ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tournaments...
              </div>
            ) : (
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a tournament...</option>
                {tournaments.map((tournament) => {
                  const isFull = Boolean(tournament.maxParticipants && tournament.currentParticipants >= tournament.maxParticipants);
                  return (
                    <option key={tournament.id} value={tournament.id} disabled={isFull}>
                      {tournament.name} ({tournament.weapon}, {tournament.division}) - {formatDate(tournament.date)}
                      {isFull && ' [FULL]'}
                    </option>
                  );
                })}
              </select>
            )}

            {selectedTournament && (
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
                <Swords className="h-4 w-4" />
                <span>
                  {selectedTournament.currentParticipants}/{selectedTournament.maxParticipants || '∞'} participants
                </span>
              </div>
            )}
          </div>

          {/* Amount Paid */}
          <div className="space-y-2">
            <Label className="text-white">Amount Paid ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
            />
            <p className="text-xs text-slate-400">Enter 0 for comped entries</p>
          </div>

          {/* Admin Notes */}
          <div className="space-y-2">
            <Label className="text-white">Admin Notes</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Reason for manual entry, comp code, etc."
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 min-h-[80px]"
            />
          </div>

          {/* Create Order Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createOrder"
              checked={createOrder}
              onCheckedChange={(checked) => setCreateOrder(checked === true)}
            />
            <label
              htmlFor="createOrder"
              className="text-sm font-medium text-slate-300 leading-none"
            >
              Create order record for audit trail
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded border border-red-500/30">
              {error}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="text-green-400 text-sm bg-green-500/10 p-3 rounded border border-green-500/30">
              {successMessage}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-slate-600 text-white hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedUser || !selectedTournamentId}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Entry'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
