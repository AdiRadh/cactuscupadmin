import type { FC, ReactNode } from 'react';
import { RotateCcw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

interface FilterBarProps {
  /** Filter components to render */
  children: ReactNode;
  /** Whether any filters are active */
  hasActiveFilters?: boolean;
  /** Callback to reset all filters */
  onReset?: () => void;
  /** Additional class names */
  className?: string;
  /** Optional title */
  title?: string;
}

/**
 * Container component for filter controls
 * Provides a consistent layout and reset functionality
 */
export const FilterBar: FC<FilterBarProps> = ({
  children,
  hasActiveFilters = false,
  onReset,
  className,
  title,
}) => {
  return (
    <div
      className={cn(
        'bg-slate-800/50 rounded-lg border border-slate-700 p-4',
        className
      )}
    >
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">{title}</span>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-4">
        {children}
        {onReset && hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
};
