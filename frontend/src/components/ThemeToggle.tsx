import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
  size = 'md',
}) => {
  const { toggleTheme, isDark } = useTheme();

  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
        isSmall ? 'p-1.5' : 'p-2'
      } ${
        isDark
          ? 'bg-slate-800/90 text-amber-300 hover:text-amber-200 hover:bg-slate-700 border border-slate-700 shadow-sm'
          : 'bg-white text-slate-700 hover:text-[#0e4a5c] hover:bg-[#f0f9f8] border border-teal-200/80 shadow-2xs'
      } ${className}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className={`${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-amber-400 animate-in fade-in zoom-in duration-200`} />
      ) : (
        <Moon className={`${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-slate-700 animate-in fade-in zoom-in duration-200`} />
      )}

      {showLabel && (
        <span className="ml-2 text-xs font-semibold">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};
