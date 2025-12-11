import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-orange-500 text-white hover:bg-orange-600',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline:
          'border border-orange-500 bg-transparent text-orange-500 hover:bg-orange-500/20 hover:text-white',
        secondary: 'bg-turquoise-700 text-white hover:bg-turquoise-800',
        turquoise: 'bg-turquoise-700 text-white shadow-lg shadow-orange-500/50 hover:bg-turquoise-800 hover:shadow-xl hover:shadow-orange-500/60',
        ghost: 'text-white hover:bg-turquoise-700/50 hover:text-white',
        link: 'text-orange-400 underline-offset-4 hover:underline hover:text-orange-300',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * Button component based on Radix UI Slot
 *
 * @example
 * ```tsx
 * <Button variant="default" size="lg">
 *   Register Now
 * </Button>
 *
 * <Button variant="outline" onClick={() => {}}>
 *   Learn More
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
