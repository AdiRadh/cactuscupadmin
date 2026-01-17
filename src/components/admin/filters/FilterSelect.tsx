import type { FC } from 'react';
import { cn } from '@/lib/utils/cn';

interface FilterOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface FilterSelectProps {
  /** Current selected value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Available options */
  options: readonly FilterOption[] | FilterOption[];
  /** Label displayed above the select */
  label?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Labeled dropdown filter component
 * Styled for dark admin theme
 */
export const FilterSelect: FC<FilterSelectProps> = ({
  value,
  onChange,
  options,
  label,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-xs text-slate-400 font-medium">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 rounded-md bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
