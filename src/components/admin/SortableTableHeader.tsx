import type { FC, ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { SortOrder } from '@/types/filters';

interface SortableTableHeaderProps {
  /** Column label */
  children: ReactNode;
  /** Field name for sorting */
  field: string;
  /** Current sort direction (null if not sorted) */
  sortDirection: SortOrder | null;
  /** Callback when header is clicked */
  onSort: (field: string) => void;
  /** Additional class names */
  className?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Clickable table header with sort indicator
 * Shows up/down arrows based on current sort state
 */
export const SortableTableHeader: FC<SortableTableHeaderProps> = ({
  children,
  field,
  sortDirection,
  onSort,
  className,
  align = 'left',
}) => {
  const handleClick = () => {
    onSort(field);
  };

  const alignClasses = {
    left: 'text-left justify-start',
    center: 'text-center justify-center',
    right: 'text-right justify-end',
  };

  return (
    <th
      className={cn(
        'py-3 px-4 font-semibold text-white cursor-pointer select-none hover:bg-slate-700/50 transition-colors',
        alignClasses[align],
        className
      )}
      onClick={handleClick}
    >
      <div className={cn('flex items-center gap-1', alignClasses[align])}>
        <span>{children}</span>
        <span className="inline-flex flex-col">
          {sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4 text-orange-400" />
          ) : sortDirection === 'desc' ? (
            <ChevronDown className="h-4 w-4 text-orange-400" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-slate-500" />
          )}
        </span>
      </div>
    </th>
  );
};

interface NonSortableTableHeaderProps {
  /** Column label */
  children: ReactNode;
  /** Additional class names */
  className?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Regular table header without sort functionality
 * For columns that shouldn't be sortable
 */
export const TableHeader: FC<NonSortableTableHeaderProps> = ({
  children,
  className,
  align = 'left',
}) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <th
      className={cn(
        'py-3 px-4 font-semibold text-white',
        alignClasses[align],
        className
      )}
    >
      {children}
    </th>
  );
};
