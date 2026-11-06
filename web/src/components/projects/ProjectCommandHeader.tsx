import React from 'react';
import { Project, LayoutMode } from '../../types/sams';
import { BlackDot } from '../ui/BlackDot';

interface ProjectCommandHeaderProps {
  projects: Project[];
  selectedProjectId: string | null; // null means 'All Projects'
  onSelectProject: (projectId: string | null) => void;
  onOpenLinkDialog: () => void;
  layoutMode: LayoutMode;
  onChangeLayout: (mode: LayoutMode) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  ssdMounted: boolean;
  freeSpaceGB: number;
}

export const ProjectCommandHeader: React.FC<ProjectCommandHeaderProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenLinkDialog,
  layoutMode,
  onChangeLayout,
  theme,
  onToggleTheme,
  ssdMounted,
  freeSpaceGB,
}) => {
  return (
    <header className="border-b border-line bg-surface/90 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 transition-colors">
      {/* Left: Brand & Portfolio Switcher */}
      <div className="flex items-center gap-3">
        {/* SAMS Brand Icon */}
        <div className="flex items-center gap-2 pr-3 border-r border-line">
          <div className="w-8 h-8 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center text-blue shadow-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="14" rx="4" />
              <circle cx="8" cy="11" r="2" fill="currentColor" />
              <circle cx="16" cy="11" r="2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-ink">SAMS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue/10 text-blue font-semibold">
                COMMAND
              </span>
            </div>
            <p className="text-[10px] text-ink-muted leading-none">Spatial Multi-Project Ops</p>
          </div>
        </div>

        {/* Project Switcher Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-xl">
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              selectedProjectId === null
                ? 'bg-blue text-white shadow-sm font-semibold'
                : 'bg-elevated text-ink-muted hover:text-ink hover:bg-line/40'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            All Projects ({projects.length})
          </button>

          {projects.map((proj) => {
            const isSelected = selectedProjectId === proj.id;
            const isClean = (proj.git?.uncommittedChanges ?? 0) === 0;

            return (
              <button
                key={proj.id}
                type="button"
                onClick={() => onSelectProject(proj.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  isSelected
                    ? 'bg-blue text-white shadow-sm font-semibold'
                    : 'bg-elevated text-ink hover:text-ink hover:bg-line/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected
                      ? 'bg-white'
                      : isClean
                      ? 'bg-green-500'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="truncate max-w-[120px]">{proj.name}</span>
                <span
                  className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-surface text-ink-muted'
                  }`}
                >
                  {proj.progressPercent}%
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenLinkDialog}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue bg-blue/10 hover:bg-blue/20 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="Link another local project"
          >
            <span>+</span>
            <span>Link Project</span>
          </button>
        </div>
      </div>

      {/* Right: Layout Switcher, Theme & SSD Telemetry */}
      <div className="flex items-center gap-2.5">
        {/* Layout View Modes */}
        <div className="hidden sm:flex items-center bg-elevated rounded-lg p-0.5 border border-line">
          <button
            type="button"
            onClick={() => onChangeLayout('split')}
            className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
              layoutMode === 'split' ? 'bg-surface text-ink font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Split Workbench
          </button>
          <button
            type="button"
            onClick={() => onChangeLayout('stage')}
            className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
              layoutMode === 'stage' ? 'bg-surface text-ink font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Studio Room
          </button>
          <button
            type="button"
            onClick={() => onChangeLayout('workbench')}
            className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
              layoutMode === 'workbench' ? 'bg-surface text-ink font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Project Deck
          </button>
        </div>

        {/* Theme Toggle (Light: White+Blue / Dark: Deep Slate) */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="p-1.5 rounded-lg bg-elevated border border-line text-ink hover:border-blue hover:text-blue transition-colors cursor-pointer"
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
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-elevated border border-line text-[11px] font-mono text-ink">
          <BlackDot pulsing={ssdMounted} />
          <span className="font-medium">{ssdMounted ? 'SSD MOUNTED' : 'SSD OFFLINE'}</span>
          <span className="text-ink-muted">· {freeSpaceGB} GB</span>
        </div>
      </div>
    </header>
  );
};
