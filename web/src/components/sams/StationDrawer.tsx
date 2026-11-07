import React, { useEffect } from 'react';
import { IconClose } from '../ui/Icons';

interface StationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}

export const StationDrawer: React.FC<StationDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
}) => {
  // Listen for Escape key to close drawer (modern-web-guidance dialog/overlay)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label={title}>
      {/* Semi-transparent backdrop with light-dismiss */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
        {/* Slide-over panel */}
        <div className="pointer-events-auto w-screen max-w-xl sm:max-w-2xl bg-surface border-l border-line shadow-2xl flex flex-col transform transition-transform duration-300 ease-out animate-in slide-in-from-right">
          {/* Drawer Header */}
          <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3 bg-elevated/40">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ink tracking-tight">{title}</h2>
                {badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue/10 text-blue border border-blue/20">
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-ink-subtle hidden sm:inline">ESC to close</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
