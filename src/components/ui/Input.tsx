import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Input component for form fields
 * Styled with consistent focus states and accessibility
 * Uses text-base on mobile to prevent iOS auto-zoom
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 min-h-[44px] w-full rounded-md border border-turquoise-400 bg-white text-gray-900 px-3 py-2',
          'text-base sm:text-sm', // Larger text on mobile prevents iOS zoom
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-gray-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
