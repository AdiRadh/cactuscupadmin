import type { FC } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils/formatting';
import type { Tournament } from '@/types';

interface DraggableTournamentItemProps {
  tournament: Tournament;
  onToggleVisibility: (tournament: Tournament) => void;
  onDelete: (tournament: Tournament) => void;
  isTogglingVisibility: boolean;
  getStatusBadge: (status: string) => React.ReactNode;
}

const DraggableTournamentItem: FC<DraggableTournamentItemProps> = ({
  tournament,
  onToggleVisibility,
  onDelete,
  isTogglingVisibility,
  getStatusBadge,
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={tournament}
      id={tournament.id}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
    >
      {/* Drag Handle */}
      <div
        className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-white/10 rounded"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripVertical className="h-5 w-5 text-white/50" />
      </div>

      {/* Tournament Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white truncate">{tournament.name}</p>
          {getStatusBadge(tournament.status)}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-white/70">
          <span className="capitalize">{tournament.weapon}</span>
          <span className="capitalize">{tournament.division}</span>
          <span>
            {tournament.currentParticipants} / {tournament.maxParticipants} participants
          </span>
          <span>{formatPrice(tournament.registrationFee)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleVisibility(tournament)}
          disabled={isTogglingVisibility}
          title={tournament.visible ? 'Hide from public' : 'Show on public'}
          className={tournament.visible ? 'hover:bg-green-500/20' : 'hover:bg-gray-500/20'}
        >
          {tournament.visible ? (
            <Eye className="h-4 w-4 text-green-400" />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-400" />
          )}
        </Button>
        <Link to={`/admin/tournaments/edit/${tournament.id}`}>
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(tournament)}
          className="hover:bg-red-500/20"
        >
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
      </div>
    </Reorder.Item>
  );
};

interface DraggableTournamentListProps {
  tournaments: Tournament[];
  onReorder: (tournaments: Tournament[]) => void;
  onToggleVisibility: (tournament: Tournament) => void;
  onDelete: (tournament: Tournament) => void;
  togglingIds: Set<string>;
  getStatusBadge: (status: string) => React.ReactNode;
}

/**
 * Draggable list component for reordering tournaments
 * Uses framer-motion's Reorder components for smooth drag-and-drop
 */
export const DraggableTournamentList: FC<DraggableTournamentListProps> = ({
  tournaments,
  onReorder,
  onToggleVisibility,
  onDelete,
  togglingIds,
  getStatusBadge,
}) => {
  return (
    <Reorder.Group
      axis="y"
      values={tournaments}
      onReorder={onReorder}
      className="space-y-2"
    >
      {tournaments.map((tournament) => (
        <DraggableTournamentItem
          key={tournament.id}
          tournament={tournament}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
          isTogglingVisibility={togglingIds.has(tournament.id)}
          getStatusBadge={getStatusBadge}
        />
      ))}
    </Reorder.Group>
  );
};
