import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  mobileLabel?: string;
  hiddenOnMobile?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
  mobileCardClassName?: string;
}

/**
 * ResponsiveTable component that displays as a table on desktop
 * and as stacked cards on mobile screens.
 */
export function ResponsiveTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyField,
  onRowClick,
  actions,
  emptyMessage = 'No data found.',
  isLoading = false,
  mobileCardClassName,
}: ResponsiveTableProps<T>) {
  // Filter and sort columns by priority for mobile
  const mobileColumns = columns
    .filter(col => !col.hiddenOnMobile)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']);
    });

  const getValue = (item: T, col: Column<T>): React.ReactNode => {
    if (col.render) return col.render(item);
    const key = col.key as keyof T;
    const value = item[key];
    if (value === null || value === undefined) return '-';
    return String(value);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-white/70">
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-white/70">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/20">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="text-left py-3 px-4 font-semibold text-white"
                >
                  {col.header}
                </th>
              ))}
              {actions && (
                <th className="text-right py-3 px-4 font-semibold text-white">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={String(item[keyField])}
                className={cn(
                  'border-b border-white/10 hover:bg-white/5 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="py-3 px-4 text-white/90">
                    {getValue(item, col)}
                  </td>
                ))}
                {actions && (
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {actions(item)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {data.map((item) => {
          const highPriorityColumns = mobileColumns.filter(c => c.priority === 'high');
          const otherColumns = mobileColumns.filter(c => c.priority !== 'high');

          return (
            <div
              key={String(item[keyField])}
              className={cn(
                'bg-turquoise-700/50 rounded-lg p-4 border border-turquoise-500/30',
                onRowClick && 'cursor-pointer active:bg-turquoise-600/50',
                mobileCardClassName
              )}
              onClick={() => onRowClick?.(item)}
            >
              {/* Primary info - first high priority column */}
              {highPriorityColumns.slice(0, 1).map((col) => (
                <div key={String(col.key)} className="font-medium text-white text-lg mb-2">
                  {getValue(item, col)}
                </div>
              ))}

              {/* Remaining high priority items */}
              {highPriorityColumns.slice(1).map((col) => (
                <div key={String(col.key)} className="text-white/80 text-sm mb-2">
                  {getValue(item, col)}
                </div>
              ))}

              {/* Secondary info grid */}
              {otherColumns.length > 0 && (
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  {otherColumns.slice(0, 4).map((col) => (
                    <div key={String(col.key)}>
                      <span className="text-white/60 text-xs block">
                        {col.mobileLabel || col.header}
                      </span>
                      <span className="text-white/90">{getValue(item, col)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions row */}
              {actions && (
                <div
                  className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actions(item)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
