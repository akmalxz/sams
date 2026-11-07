import React, { useEffect, useState, useMemo } from 'react';
import { Project, ProjectTask } from './types/sams';
import { ProjectRadarCard } from './components/projects/ProjectRadarCard';
import { LinkProjectDialog } from './components/projects/LinkProjectDialog';
import { ReanalyzeProjectModal } from './components/projects/ReanalyzeProjectModal';
import { ThreeBotCanvas, BotMood } from './components/bot/ThreeBotCanvas';

export function App() {
  // Theme Management (White + SAMS Blue vs Deep Slate)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('sams-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    document.documentElement.setAttribute('data-theme', next);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', next);
    localStorage.setItem('sams-theme', next);
  };

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [backendOnline, setBackendOnline] = useState(true);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [reanalyzingProject, setReanalyzingProject] = useState<Project | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'clean' | 'dirty'>('all');

  // Fetch Projects from Backend
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setBackendOnline(true);
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 4000);
    return () => clearInterval(interval);
  }, []);

  // Task & Project Actions
  const handleToggleTask = async (projectId: string, task: ProjectTask) => {
    const nextStatus = task.status === 'done' ? 'backlog' : 'done';
    try {
      await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleAddTask = async (projectId: string, title: string) => {
    try {
      await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority: 'medium', status: 'backlog' }),
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleUpdateFocus = async (projectId: string, currentFocus: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentFocus }),
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to update focus:', err);
    }
  };

  const handleUnlinkProject = async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      fetchProjects();
    } catch (err) {
      console.error('Failed to unlink project:', err);
    }
  };

  // Derive Bot Mood & Status Message
  const botTelemetry = useMemo(() => {
    if (!backendOnline) {
      return {
        mood: 'error' as BotMood,
        message: 'Backend is currently offline. Please run "bun run server" in your terminal.',
      };
    }

    if (projects.length === 0) {
      return {
        mood: 'focus' as BotMood,
        message: 'Welcome! Click "+ Link Project" to begin tracking your local codebases.',
      };
    }

    const dirtyProjects = projects.filter(
      (p) => (p.git?.uncommittedChanges ?? 0) > 0
    );
    const totalOpenTasks = projects.reduce(
      (acc, p) => acc + (p.tasks?.filter((t) => t.status !== 'done').length || 0),
      0
    );

    if (dirtyProjects.length > 0) {
      return {
        mood: 'dirty' as BotMood,
        message: `Tracking ${projects.length} projects. ${dirtyProjects.length} ${
          dirtyProjects.length === 1 ? 'project has' : 'projects have'
        } uncommitted changes.`,
      };
    }

    return {
      mood: 'clean' as BotMood,
      message: `All ${projects.length} codebases are clean and in sync! Total of ${totalOpenTasks} open deliverables.`,
    };
  }, [projects, backendOnline]);

  // Filtered projects
  const filteredProjects = projects.filter((p) => {
    const isClean = (p.git?.uncommittedChanges ?? 0) === 0;
    if (filterMode === 'clean') return isClean;
    if (filterMode === 'dirty') return !isClean;
    return true;
  });

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans transition-colors duration-200 flex flex-col">
      {/* 1. Slim Executive Navigation Header */}
      <header className="border-b border-line bg-surface/90 backdrop-blur-md px-6 py-3 sticky top-0 z-30 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center text-blue shadow-xs font-bold text-sm">
            ✦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-tight text-ink">SAMS</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue/10 text-blue font-semibold border border-blue/20">
                Project Radar
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-ink-muted">
              Spatial Agentic Management & Multi-Project Command Centre
            </p>
          </div>
        </div>

        {/* Center / Right Toolbar */}
        <div className="flex items-center gap-3">
          {/* Backend Connection Indicator */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
              backendOnline
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="hidden md:inline font-medium">
              {backendOnline ? 'Backend 3001' : 'Backend Offline'}
            </span>
          </div>

          {/* Link Project Button */}
          <button
            type="button"
            onClick={() => setIsLinkDialogOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-blue text-white text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>+</span> Link Project
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-xl bg-elevated border border-line text-ink hover:border-blue hover:text-blue transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
            title={themeMode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {themeMode === 'dark' ? (
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
        </div>
      </header>

      {/* 2. Main Dashboard Layout: Project Radar + 3D Bot Companion */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Project Radar Cards */}
        <div className="lg:col-span-8 space-y-5">
          {/* Section Subheader & Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-line">
            <div>
              <h2 className="text-base font-bold text-ink tracking-tight">
                Active Codebases
              </h2>
              <p className="text-xs text-ink-muted">
                Track what you are doing, real-time Git status, and immediate next deliverables.
              </p>
            </div>

            {/* Quick Filters */}
            <div className="flex rounded-lg border border-line bg-elevated/60 p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                  filterMode === 'all'
                    ? 'bg-surface text-ink font-bold shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                All ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('clean')}
                className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                  filterMode === 'clean'
                    ? 'bg-surface text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Clean ({projects.filter((p) => (p.git?.uncommittedChanges ?? 0) === 0).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('dirty')}
                className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                  filterMode === 'dirty'
                    ? 'bg-surface text-amber-600 dark:text-amber-400 font-bold shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Dirty ({projects.filter((p) => (p.git?.uncommittedChanges ?? 0) > 0).length})
              </button>
            </div>
          </div>

          {/* Project Radar Grid */}
          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-line p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue/10 text-blue flex items-center justify-center mx-auto text-xl font-bold">
                +
              </div>
              <h3 className="text-sm font-bold text-ink">No projects found</h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                {projects.length === 0
                  ? 'Link any local repository to track its current goals, commits, and Kanban deliverables.'
                  : 'No projects match the selected filter.'}
              </p>
              {projects.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsLinkDialogOpen(true)}
                  className="mt-2 px-4 py-2 rounded-xl bg-blue text-white text-xs font-semibold hover:opacity-95 cursor-pointer shadow-sm"
                >
                  Link Your First Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {filteredProjects.map((project) => (
                <ProjectRadarCard
                  key={project.id}
                  project={project}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onUpdateFocus={handleUpdateFocus}
                  onSyncPulse={(p) => setReanalyzingProject(p)}
                  onUnlinkProject={handleUnlinkProject}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column (4 cols): 3D SAM Companion & Telemetry Deck */}
        <div className="lg:col-span-4 space-y-5 sticky top-20">
          {/* 3D Bot Card */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col items-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between pb-2 border-b border-line/60">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue" />
                SAM · 3D Agent
              </span>
              <span className="text-[10px] font-mono text-ink-muted">
                Interactive Companion
              </span>
            </div>

            {/* Three.js Canvas Container */}
            <div className="w-full h-72">
              <ThreeBotCanvas
                mood={botTelemetry.mood}
                message={botTelemetry.message}
                isDark={themeMode === 'dark'}
              />
            </div>
          </div>

          {/* Quick Metrics Deck */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <span className="text-[10px] font-mono text-ink-muted block uppercase">
                Projects
              </span>
              <span className="text-xl font-bold text-ink mt-0.5 block">
                {projects.length}
              </span>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <span className="text-[10px] font-mono text-ink-muted block uppercase">
                Open Tasks
              </span>
              <span className="text-xl font-bold text-blue mt-0.5 block">
                {projects.reduce(
                  (acc, p) => acc + (p.tasks?.filter((t) => t.status !== 'done').length || 0),
                  0
                )}
              </span>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <span className="text-[10px] font-mono text-ink-muted block uppercase">
                Clean Repos
              </span>
              <span className="text-xl font-bold text-emerald-500 mt-0.5 block">
                {projects.filter((p) => (p.git?.uncommittedChanges ?? 0) === 0).length}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Modals & Dialogs */}
      <LinkProjectDialog
        isOpen={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        onProjectLinked={() => {
          fetchProjects();
        }}
      />

      <ReanalyzeProjectModal
        isOpen={Boolean(reanalyzingProject)}
        onClose={() => setReanalyzingProject(null)}
        project={reanalyzingProject}
        onAnalysisApplied={() => {
          fetchProjects();
        }}
      />
    </div>
  );
}

export default App;
