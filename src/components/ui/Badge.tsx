import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-orange-500 text-white hover:bg-orange-600',
        secondary: 'border-transparent bg-orange-500 text-white hover:bg-orange-600',
        destructive: 'border-transparent bg-red-500 text-white hover:bg-red-600',
        outline: 'text-turquoise-800 border-turquoise-500 bg-turquoise-50',
        success: 'border-transparent bg-green-600 text-white hover:bg-green-700',
        warning: 'border-transparent bg-orange-500 text-white hover:bg-orange-600',
        draft: 'border-transparent bg-yellow-500 text-gray-900 hover:bg-yellow-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge component for status indicators, labels, and counts
 * Supports multiple variants for different use cases
 */
export function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
