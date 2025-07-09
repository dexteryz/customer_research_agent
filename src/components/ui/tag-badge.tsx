import { FC } from 'react';
import clsx from 'clsx';

interface TagBadgeProps {
  label: string;
  colorClass?: string; // e.g., 'bg-blue-100 text-blue-800'
  className?: string;
}

export const TagBadge: FC<TagBadgeProps> = ({ label, colorClass, className }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border border-transparent',
      colorClass || 'bg-muted text-muted-foreground',
      className
    )}
  >
    {label}
  </span>
); 