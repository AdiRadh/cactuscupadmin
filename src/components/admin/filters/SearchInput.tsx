import type { FC, ChangeEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Search input with clear button
 * Includes search icon and clear functionality
 */
export const SearchInput: FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <Input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-10 pr-8 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus-visible:ring-orange-500"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-slate-700"
        >
          <X className="h-4 w-4 text-slate-400" />
        </Button>
      )}
    </div>
  );
};
