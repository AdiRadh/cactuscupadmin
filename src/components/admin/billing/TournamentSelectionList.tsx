import type { FC } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import type { WaitlistEntryWithTournament } from '@/types';

interface TournamentSelectionListProps {
  entries: WaitlistEntryWithTournament[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Tournament selection list with checkboxes for billing
 * Displays tournament name, date, and fee for each entry
 */
export const TournamentSelectionList: FC<TournamentSelectionListProps> = ({
  entries,
  selectedIds,
  onSelectionChange,
  disabled = false,
}) => {
  const handleToggle = (entryId: string) => {
    if (disabled) return;

    if (selectedIds.includes(entryId)) {
      onSelectionChange(selectedIds.filter(id => id !== entryId));
    } else {
      onSelectionChange([...selectedIds, entryId]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;

    if (selectedIds.length === entries.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(entries.map(e => e.id));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-4 text-white/70">
        No promoted tournaments available for billing.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Select All */}
      <div className="flex items-center gap-3 pb-2 border-b border-white/10">
        <Checkbox
          checked={selectedIds.length === entries.length}
          onCheckedChange={handleSelectAll}
          disabled={disabled}
          id="select-all"
        />
        <label
          htmlFor="select-all"
          className="text-sm font-medium text-white cursor-pointer"
        >
          Select All ({entries.length} tournament{entries.length !== 1 ? 's' : ''})
        </label>
      </div>

      {/* Tournament List */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`
              flex items-center justify-between p-3 rounded-lg border transition-colors
              ${selectedIds.includes(entry.id)
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-white/10 hover:border-white/20 bg-white/5'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            onClick={() => handleToggle(entry.id)}
          >
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.includes(entry.id)}
                onCheckedChange={() => handleToggle(entry.id)}
                disabled={disabled}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              />
              <div>
                <p className="font-medium text-white">{entry.tournament.name}</p>
                <p className="text-sm text-white/70">
                  {formatDate(entry.tournament.date)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-orange-400">
                {formatCurrency(entry.tournament.registrationFee || 0)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentSelectionList;
