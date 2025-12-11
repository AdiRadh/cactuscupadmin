import type { FC, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Optional width for the skeleton
   * Can be a CSS value like '100px', '50%', etc.
   */
  width?: string;

  /**
   * Optional height for the skeleton
   * Can be a CSS value like '100px', '50%', etc.
   */
  height?: string;

  /**
   * Whether to use a circular skeleton (for avatars, icons, etc.)
   */
  circle?: boolean;

  /**
   * Animation duration in seconds
   * @default 1.5
   */
  duration?: number;
}

/**
 * Skeleton loading component
 * A lightweight, performant skeleton loader using CSS animations
 *
 * @example
 * ```tsx
 * <Skeleton className="h-4 w-32" />
 * <Skeleton width="100%" height="200px" />
 * <Skeleton circle width="48px" height="48px" />
 * ```
 */
export const Skeleton: FC<SkeletonProps> = ({
  className,
  width,
  height,
  circle = false,
  duration = 1.5,
  style,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]',
        'animate-[shimmer_1.5s_ease-in-out_infinite]',
        circle ? 'rounded-full' : 'rounded-md',
        className
      )}
      style={{
        width,
        height,
        animationDuration: `${duration}s`,
        ...style,
      }}
      {...props}
    />
  );
};
