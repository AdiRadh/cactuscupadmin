import type { FC } from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils/cn';

interface DateRangeFilterProps {
  /** Start date value (YYYY-MM-DD) */
  fromValue: string;
  /** End date value (YYYY-MM-DD) */
  toValue: string;
  /** Callback when start date changes */
  onFromChange: (value: string) => void;
  /** Callback when end date changes */
  onToChange: (value: string) => void;
  /** Label displayed above the inputs */
  label?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Date range filter with start and end date inputs
 */
export const DateRangeFilter: FC<DateRangeFilterProps> = ({
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  label,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-xs text-slate-400 font-medium">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="date"
            value={fromValue}
            onChange={(e) => onFromChange(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-600 text-white text-sm focus-visible:ring-orange-500 [&::-webkit-calendar-picker-indicator]:invert"
            max={toValue || undefined}
          />
        </div>
        <span className="text-slate-400 text-sm">to</span>
        <div className="relative flex-1">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="date"
            value={toValue}
            onChange={(e) => onToChange(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-600 text-white text-sm focus-visible:ring-orange-500 [&::-webkit-calendar-picker-indicator]:invert"
            min={fromValue || undefined}
          />
        </div>
      </div>
    </div>
  );
};
