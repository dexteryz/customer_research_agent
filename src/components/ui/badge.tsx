import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variant === 'default' && 'bg-slate-900 text-white',
        variant === 'secondary' && 'bg-slate-200 text-slate-700',
        className
      )}
      {...props}
    />
  );
} 