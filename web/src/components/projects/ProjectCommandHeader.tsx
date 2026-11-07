import React from 'react';
import { Project } from '../../types/sams';
import { BlackDot } from '../ui/BlackDot';
import { IconChevronDown, IconPulse } from '../ui/Icons';

interface ProjectCommandHeaderProps {
  currentProject: Project | null;
  onOpenPortfolio: () => void;
  onOpenLinkDialog: () => void;
  onOpenReanalyze?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  ssdMounted: boolean;
  freeSpaceGB: number;
}

export const ProjectCommandHeader: React.FC<ProjectCommandHeaderProps> = ({
  currentProject,
  onOpenPortfolio,
  onOpenLinkDialog,
  onOpenReanalyze,
  theme,
  onToggleTheme,
  ssdMounted,
  freeSpaceGB,
}) => {
  const isClean = (currentProject?.git?.uncommittedChanges ?? 0) === 0;

  return (
    <header className="border-b border-line bg-surface/90 backdrop-blur-md px-5 py-2 flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue/10 border border-blue/20 flex items-center justify-center text-blue shadow-xs">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="14" rx="4" />
            <circle cx="8" cy="11" r="2" fill="currentColor" />
            <circle cx="16" cy="11" r="2" fill="currentColor" />
          </svg>
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight text-ink">SAMS</span>
          <span className="hidden sm:inline text-[11px] font-mono text-ink-muted ml-2">
            Spatial Agentic Management
          </span>
        </div>
      </div>

      {/* Center: Clean Floating Project Pill (Clicking opens Portfolio Drawer) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenPortfolio}
          className="group px-3.5 py-1.5 rounded-full border border-line bg-elevated/80 hover:bg-surface hover:border-blue/50 transition-all cursor-pointer flex items-center gap-2.5 shadow-xs"
          title="Click to view all projects or switch codebase"
        >
          <span
            className={`w-2 h-2 rounded-full ${isClean ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
          <span className="text-xs font-semibold text-ink group-hover:text-blue transition-colors">
            {currentProject?.name || 'Select Project'}
          </span>
          {currentProject && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-line text-ink-muted">
              {currentProject.progressPercent}%
            </span>
          )}
          <IconChevronDown className="w-3.5 h-3.5 text-ink-subtle group-hover:text-blue transition-colors" />
        </button>

        {currentProject && onOpenReanalyze && (
          <button
            type="button"
            onClick={onOpenReanalyze}
            className="px-2.5 py-1.5 rounded-full border border-line bg-elevated/80 hover:bg-surface hover:border-blue/50 text-xs font-medium text-ink-muted hover:text-blue transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Auto-Analyze & Sync Codebase Pulse"
          >
            <IconPulse className="w-3.5 h-3.5 text-blue" />
            <span className="hidden md:inline text-[11px] font-semibold">Pulse</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLinkDialog}
          className="w-7 h-7 rounded-full border border-line bg-elevated text-xs font-bold text-ink-muted hover:border-blue hover:text-blue hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
          title="Link another local project"
        >
          +
        </button>
      </div>

      {/* Right: Theme & SSD Telemetry */}
      <div className="flex items-center gap-2.5">
        {/* Theme Toggle (Light: White+Blue / Dark: Deep Slate) */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="w-8 h-8 rounded-lg bg-elevated border border-line text-ink hover:border-blue hover:text-blue transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
          title={theme === 'dark' ? 'Switch to White + SAMS Blue (Light)' : 'Switch to Deep Slate (Dark)'}
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* SSD Status Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-elevated border border-line text-[11px] font-mono text-ink">
          <BlackDot pulsing={ssdMounted} size="sm" />
          <span className="font-medium">{ssdMounted ? 'SSD' : 'OFFLINE'}</span>
          <span className="text-ink-muted">· {freeSpaceGB}G</span>
        </div>
      </div>
    </header>
  );
};
