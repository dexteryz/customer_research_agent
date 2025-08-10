import { BarChart3, Users } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'full' | 'icon' | 'text';
}

export function Logo({ size = 'md', showText = true, variant = 'full' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-10 w-10'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  if (variant === 'text') {
    return (
      <div className="flex items-center">
        <span className={`font-bold text-slate-900 ${textSizeClasses[size]}`}>
          Customer Research
        </span>
        <span className={`font-light text-slate-600 ml-2 ${textSizeClasses[size]}`}>
          Insights
        </span>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <div className="relative">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2 shadow-sm">
          <div className="relative">
            <BarChart3 className={`${sizeClasses[size]} text-white`} />
            <Users className="h-3 w-3 text-blue-200 absolute -bottom-1 -right-1" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2 shadow-sm">
          <div className="relative">
            <BarChart3 className={`${sizeClasses[size]} text-white`} />
            <Users className="h-3 w-3 text-blue-200 absolute -bottom-1 -right-1" />
          </div>
        </div>
      </div>
      {showText && (
        <div className="flex items-center">
          <span className={`font-bold text-slate-900 ${textSizeClasses[size]}`}>
            Customer Research
          </span>
          <span className={`font-light text-slate-600 ml-2 ${textSizeClasses[size]}`}>
            Insights
          </span>
        </div>
      )}
    </div>
  );
}

// LogoVariants component removed - unused demo component