import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, UserPlus, Search } from 'lucide-react';
import type { Addon } from '@/types';
import type { CreateAddonWaitlistEntryData, RegisteredUser } from '@/hooks/data/useAddonWaitlist';
import { useAddonWaitlist } from '@/hooks/data/useAddonWaitlist';

interface AddonWaitlistCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addons: Addon[];
  onSave: (data: CreateAddonWaitlistEntryData) => Promise<{ id: string; position: number }>;
  preselectedAddonId?: string;
}

export const AddonWaitlistCreateModal: FC<AddonWaitlistCreateModalProps> = ({
  open,
  onOpenChange,
  addons,
  onSave,
  preselectedAddonId,
}) => {
  const [addonId, setAddonId] = useState<string>('');
  const [variantName, setVariantName] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { getRegisteredUsers } = useAddonWaitlist();

  // Derive the selected addon object
  const selectedAddon = useMemo(
    () => addons.find((a) => a.id === addonId) ?? null,
    [addons, addonId]
  );

  const showVariantSelect = Boolean(
    selectedAddon?.hasVariants && selectedAddon.variants?.length
  );

  // Fetch users when modal opens
  useEffect(() => {
    if (open) {
      setAddonId(preselectedAddonId || '');
      setVariantName('');
      setSelectedUser(null);
      setSearchQuery('');
      setError(null);
      setSuccessMessage(null);
      setIsDropdownOpen(false);

      const fetchUsers = async (): Promise<void> => {
        setIsLoadingUsers(true);
        try {
          const userData = await getRegisteredUsers();
          setUsers(userData);
        } catch (err) {
          console.error('Error fetching users:', err);
          setError('Failed to load users');
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [open, preselectedAddonId, getRegisteredUsers]);

  // Reset variant selection when addon changes
  useEffect(() => {
    setVariantName('');
  }, [addonId]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleSelectUser = (user: RegisteredUser): void => {
    setSelectedUser(user);
    setSearchQuery(user.fullName);
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (value: string): void => {
    setSearchQuery(value);
    setSelectedUser(null);
    setIsDropdownOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    // Validation
    if (!addonId) {
      setError('Please select an add-on');
      return;
    }
    if (showVariantSelect && !variantName) {
      setError('Please select a variant');
      return;
    }
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await onSave({
        addonId,
        variantName: showVariantSelect ? variantName : null,
        userId: selectedUser.id,
        email: selectedUser.email,
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
      });

      const addon = addons.find((a) => a.id === addonId);
      const addonLabel = addon?.name || 'add-on';
      const variantLabel =
        showVariantSelect && variantName ? ` (variant: ${variantName})` : '';

      setSuccessMessage(
        `${selectedUser.fullName} added to ${addonLabel}${variantLabel} at position #${result.position}`
      );

      // Clear selection for another entry
      setSelectedUser(null);
      setSearchQuery('');
    } catch (err) {
      console.error('Error creating addon waitlist entry:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to waitlist';
      if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        setError('This user is already on the waitlist for this add-on');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = (): void => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add to Add-on Waitlist
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Select a registered user to add to an add-on waitlist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded p-2">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded p-2">
              {successMessage}
            </div>
          )}

          {/* Add-on selector */}
          <div className="space-y-2">
            <Label htmlFor="addon" className="text-white">
              Add-on <span className="text-red-400">*</span>
            </Label>
            <select
              id="addon"
              value={addonId}
              onChange={(e) => setAddonId(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select an add-on...</option>
              {addons.map((addon) => (
                <option key={addon.id} value={addon.id}>
                  {addon.name}
                </option>
              ))}
            </select>
          </div>

          {/* Variant selector (conditional) */}
          {showVariantSelect && (
            <div className="space-y-2">
              <Label htmlFor="variant" className="text-white">
                Variant <span className="text-red-400">*</span>
              </Label>
              <select
                id="variant"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a variant...</option>
                {selectedAddon?.variants?.map((variant) => (
                  <option key={variant.name} value={variant.name}>
                    {variant.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User search */}
          <div className="space-y-2">
            <Label htmlFor="user-search" className="text-white">
              User <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="user-search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder={isLoadingUsers ? 'Loading users...' : 'Search by name or email...'}
                  disabled={isLoadingUsers}
                  className="bg-slate-800 border-slate-600 text-white pl-10"
                />
              </div>

              {/* Dropdown */}
              {isDropdownOpen && !isLoadingUsers && (
                <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-slate-800 border border-slate-600 rounded-md shadow-lg">
                  {filteredUsers.length === 0 ? (
                    <div className="px-3 py-2 text-slate-400 text-sm">
                      {searchQuery ? 'No users found' : 'Start typing to search...'}
                    </div>
                  ) : (
                    filteredUsers.slice(0, 50).map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-700 focus:bg-slate-700 focus:outline-none"
                      >
                        <div className="text-white text-sm font-medium">{user.fullName}</div>
                        <div className="text-slate-400 text-xs">{user.email}</div>
                      </button>
                    ))
                  )}
                  {filteredUsers.length > 50 && (
                    <div className="px-3 py-2 text-slate-500 text-xs text-center border-t border-slate-700">
                      Showing first 50 results. Refine your search.
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="text-xs text-green-400 mt-1">
                Selected: {selectedUser.fullName} ({selectedUser.email})
              </div>
            )}

            <p className="text-xs text-slate-500">
              Search for a registered user by name or email
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
              className="border-slate-600 text-white hover:bg-slate-700"
            >
              {successMessage ? 'Done' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !selectedUser}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add to Waitlist
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Click outside to close dropdown */}
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
