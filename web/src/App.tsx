import React, { useEffect, useState, useMemo } from 'react';
import { Project, ProjectTask, ProjectTaskStatus, LearningNote, QuickTodoItem } from './types/sams';
import { ProjectRadarCard } from './components/projects/ProjectRadarCard';
import { LearnSection } from './components/learn/LearnSection';
import { QuickTodoSection } from './components/todo/QuickTodoSection';
import { UnifiedKanbanBoard } from './components/kanban/UnifiedKanbanBoard';
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

  // Demo initial projects when running purely statically or offline
  const DEFAULT_DEMO_PROJECTS: Project[] = [
    {
      id: 'personal-ai-platform',
      name: 'Personal AI Platform',
      workspacePath: '~/Projects/personal_ai',
      githubRepo: 'akmalxz/sams',
      description: 'SAMS Multi-Project Command Centre & 3D Spatial Agent',
      status: 'on_track',
      currentFocus: '3-tier layout: Projects | Learn | To do with Unified Cross-Project Kanban',
      progressPercent: 75,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now(),
      git: {
        isGitRepo: true,
        branch: 'main',
        uncommittedChanges: 0,
        lastCommitHash: '5c8c3f8',
        lastCommitMessage: 'feat(github): add serverless direct GitHub API commit & repo pulse sync',
        remoteUrl: 'https://github.com/akmalxz/sams.git',
      },
      tasks: [
        {
          id: 't-1',
          projectId: 'personal-ai-platform',
          title: 'Split layout into Projects | Learn | To do',
          status: 'in_progress',
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-2',
          projectId: 'personal-ai-platform',
          title: 'Implement Unified Cross-Project Kanban Board',
          status: 'in_progress',
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-3',
          projectId: 'personal-ai-platform',
          title: 'Publish to GitHub Pages via automated Actions workflow',
          status: 'done',
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    },
    {
      id: 'ewallet-app',
      name: 'EWallet App',
      workspacePath: '~/Projects/eWallet_App',
      githubRepo: 'akmalxz/eWallet-App',
      description: 'Financial portfolio and modern expense analytics',
      status: 'on_track',
      currentFocus: 'Modernizing analytics overview tab with responsive category charts',
      progressPercent: 50,
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now(),
      git: {
        isGitRepo: true,
        branch: 'main',
        uncommittedChanges: 0,
        lastCommitHash: '160ee10',
        lastCommitMessage: 'improve the analytics in the categories tab',
        remoteUrl: 'https://github.com/akmalxz/eWallet-App.git',
      },
      tasks: [
        {
          id: 't-4',
          projectId: 'ewallet-app',
          title: 'Improve analytics in categories tab',
          status: 'done',
          priority: 'medium',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-5',
          projectId: 'ewallet-app',
          title: 'Add interactive budget drilldown widgets',
          status: 'backlog',
          priority: 'medium',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-6',
          projectId: 'ewallet-app',
          title: 'Review transaction categorizer model',
          status: 'review',
          priority: 'low',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    },
  ];

  const DEFAULT_LEARNINGS: LearningNote[] = [
    {
      id: 'l-1',
      title: 'Vite Relative Base for GitHub Pages',
      note: "Always set base: './' in vite.config.ts so assets resolve on repository subpaths (e.g. /sams/).",
      category: 'architecture',
      projectName: 'SAMS',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'l-2',
      title: 'Auto-Enablement on configure-pages Action',
      note: "Set enablement: true on actions/configure-pages@v5 to avoid HttpError 404 when activating Pages.",
      category: 'bugfix',
      projectName: 'DevOps',
      createdAt: Date.now() - 1800000,
    },
    {
      id: 'l-3',
      title: 'WebGL Visibility Lifecycle Guard',
      note: 'Listen to document.hidden / visibilitychange to pause requestAnimationFrame and save unified memory.',
      category: 'insight',
      projectName: 'ThreeBot',
      createdAt: Date.now() - 900000,
    },
  ];

  const DEFAULT_TODOS: QuickTodoItem[] = [
    { id: 'todo-1', text: 'Review 3-column Projects | Learn | To do layout', completed: true, priority: 'normal', createdAt: Date.now() },
    { id: 'todo-2', text: 'Verify cross-project Kanban board task transitions', completed: false, priority: 'urgent', createdAt: Date.now() },
    { id: 'todo-3', text: 'Push live build to GitHub Pages and test on mobile', completed: false, priority: 'normal', createdAt: Date.now() },
  ];

  // State Management
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('sams-projects');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_DEMO_PROJECTS;
  });

  const [learnings, setLearnings] = useState<LearningNote[]>(() => {
    try {
      const saved = localStorage.getItem('sams-learnings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_LEARNINGS;
  });

  const [todos, setTodos] = useState<QuickTodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('sams-quick-todos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TODOS;
  });

  const [backendOnline, setBackendOnline] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [reanalyzingProject, setReanalyzingProject] = useState<Project | null>(null);

  // Fetch Projects from Backend (with fallback to localStorage/demo)
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const list = data.projects || [];
        setProjects(list);
        setBackendOnline(true);
        try {
          localStorage.setItem('sams-projects', JSON.stringify(list));
        } catch {}
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

  // --- Task & Project Handlers ---
  const handleToggleTask = async (projectId: string, task: ProjectTask) => {
    const nextStatus: ProjectTaskStatus = task.status === 'done' ? 'backlog' : 'done';

    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== projectId) return p;
        const newTasks = (p.tasks || []).map((t) =>
          t.id === task.id ? { ...t, status: nextStatus } : t
        );
        return { ...p, tasks: newTasks };
      });
      try {
        localStorage.setItem('sams-projects', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (backendOnline) {
      try {
        await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
      } catch (err) {
        console.error('Failed to toggle task on backend:', err);
      }
    }
  };

  const handleUpdateTaskStatus = async (
    projectId: string,
    taskId: string,
    newStatus: ProjectTaskStatus
  ) => {
    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== projectId) return p;
        const newTasks = (p.tasks || []).map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        );
        return { ...p, tasks: newTasks };
      });
      try {
        localStorage.setItem('sams-projects', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (backendOnline) {
      try {
        await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch (err) {
        console.error('Failed to update task status on backend:', err);
      }
    }
  };

  const handleAddTask = async (
    projectId: string,
    title: string,
    status: ProjectTaskStatus = 'backlog'
  ) => {
    const newTask: ProjectTask = {
      id: `task-${Date.now()}`,
      projectId,
      title,
      priority: 'medium',
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, tasks: [...(p.tasks || []), newTask] };
      });
      try {
        localStorage.setItem('sams-projects', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (backendOnline) {
      try {
        await fetch(`/api/projects/${projectId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, priority: 'medium', status }),
        });
      } catch (err) {
        console.error('Failed to create task on backend:', err);
      }
    }
  };

  const handleDeleteTask = async (projectId: string, taskId: string) => {
    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, tasks: (p.tasks || []).filter((t) => t.id !== taskId) };
      });
      try {
        localStorage.setItem('sams-projects', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (backendOnline) {
      try {
        await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete task on backend:', err);
      }
    }
  };

  const handleUpdateFocus = async (projectId: string, currentFocus: string) => {
    setProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === projectId ? { ...p, currentFocus } : p
      );
      try {
        localStorage.setItem('sams-projects', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (backendOnline) {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentFocus }),
        });
      } catch (err) {
        console.error('Failed to update focus on backend:', err);
      }
    }
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          ...updates,
          git: updates.git ? { ...p.git, ...updates.git } : p.git,
        };
      });
      try {
        localStorage.setItem('sams-projects', JSON.stringify(next));
      } catch {}
      return next;
    });

    if (backendOnline) {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      } catch (err) {
        console.error('Failed to update project on backend:', err);
      }
    }
  };

  const handleUnlinkProject = async (projectId: string) => {
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== projectId);
      try {
        localStorage.setItem('sams-projects', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (backendOnline) {
      try {
        await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to unlink project on backend:', err);
      }
    }
  };

  // --- Learning Notes Handlers ---
  const handleAddLearning = (item: Omit<LearningNote, 'id' | 'createdAt'>) => {
    const newNote: LearningNote = {
      ...item,
      id: `learn-${Date.now()}`,
      createdAt: Date.now(),
    };
    setLearnings((prev) => {
      const next = [newNote, ...prev];
      try {
        localStorage.setItem('sams-learnings', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleDeleteLearning = (id: string) => {
    setLearnings((prev) => {
      const next = prev.filter((l) => l.id !== id);
      try {
        localStorage.setItem('sams-learnings', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // --- Quick Todos Handlers ---
  const handleToggleTodo = (id: string) => {
    setTodos((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
      try {
        localStorage.setItem('sams-quick-todos', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleAddTodo = (text: string, priority: 'normal' | 'urgent' = 'normal') => {
    const newItem: QuickTodoItem = {
      id: `todo-${Date.now()}`,
      text,
      completed: false,
      priority,
      createdAt: Date.now(),
    };
    setTodos((prev) => {
      const next = [newItem, ...prev];
      try {
        localStorage.setItem('sams-quick-todos', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleDeleteTodo = (id: string) => {
    setTodos((prev) => {
      const next = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem('sams-quick-todos', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Derive Bot Mood & Status Message
  const botTelemetry = useMemo(() => {
    if (projects.length === 0) {
      return {
        mood: 'focus' as BotMood,
        message: 'Welcome to SAMS! Click "+ Link Project" to track your codebases.',
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
        message: `Tracking ${projects.length} projects. ${dirtyProjects.length} with pending local changes. ${totalOpenTasks} open deliverables in Kanban.`,
      };
    }

    return {
      mood: 'clean' as BotMood,
      message: backendOnline
        ? `Live Mac Sync: All ${projects.length} codebases clean & synced! ${totalOpenTasks} deliverables in Kanban.`
        : `Interactive Cloud Mode: Tracking ${projects.length} codebases with 3D SAM. Pull latest commits anytime via GitHub Sync!`,
    };
  }, [projects, backendOnline]);

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans transition-colors duration-200 flex flex-col">
      {/* 1. Slim Executive Navigation Header */}
      <header className="border-b border-line bg-surface/90 backdrop-blur-md px-5 py-2.5 sticky top-0 z-30 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center text-blue shadow-xs font-bold text-sm">
            ✦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-tight text-ink">SAMS</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue/10 text-blue font-semibold border border-blue/20">
                Command Deck
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-ink-muted">
              Projects · Learn · To do · Cross-Project Kanban
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
                : 'bg-blue/10 text-blue border-blue/20'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-blue'
              }`}
            />
            <span className="hidden md:inline font-medium">
              {backendOnline ? 'Live Backend (Mac)' : 'Cloud Web Mode'}
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

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Executive 3D SAM Companion Banner */}
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* 3D WebGL Canvas Container */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-canvas border border-line/60 relative overflow-hidden shadow-2xs">
              <ThreeBotCanvas
                mood={botTelemetry.mood}
                isDark={themeMode === 'dark'}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue">
                  SAM · 3D Agent Companion
                </span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-blue/10 text-blue font-semibold border border-blue/20">
                  Gaze Tracking
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-ink mt-1 leading-relaxed">
                {botTelemetry.message}
              </p>
            </div>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center font-mono text-xs">
            <div className="px-3 py-1.5 rounded-xl border border-line bg-canvas text-center">
              <span className="text-[10px] text-ink-muted uppercase block">Projects</span>
              <span className="font-bold text-ink">{projects.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl border border-line bg-canvas text-center">
              <span className="text-[10px] text-ink-muted uppercase block">Learnings</span>
              <span className="font-bold text-purple-500">{learnings.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl border border-line bg-canvas text-center">
              <span className="text-[10px] text-ink-muted uppercase block">Todos</span>
              <span className="font-bold text-emerald-500">{todos.filter((t) => !t.completed).length}</span>
            </div>
          </div>
        </div>

        {/* --- SECTION 1 (TOP TIER): 3 Columns [ Projects | Learn | To do ] --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* 1. Projects Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="text-blue font-bold">🔷</span>
                <h2 className="text-sm font-bold text-ink tracking-tight">Projects</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-elevated border border-line text-ink-muted">
                  {projects.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkDialogOpen(true)}
                className="text-xs font-semibold text-blue hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>+</span> Link
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="p-8 rounded-2xl border-2 border-dashed border-line text-center space-y-2">
                <p className="text-xs text-ink-muted">No projects tracked yet.</p>
                <button
                  type="button"
                  onClick={() => setIsLinkDialogOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue text-white text-xs font-semibold shadow-xs"
                >
                  Link First Project
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <ProjectRadarCard
                    key={project.id}
                    project={project}
                    onToggleTask={handleToggleTask}
                    onAddTask={handleAddTask}
                    onUpdateFocus={handleUpdateFocus}
                    onSyncPulse={(p) => setReanalyzingProject(p)}
                    onUnlinkProject={handleUnlinkProject}
                    onUpdateProject={handleUpdateProject}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 2. Learn Column */}
          <div>
            <LearnSection
              learnings={learnings}
              onAddLearning={handleAddLearning}
              onDeleteLearning={handleDeleteLearning}
            />
          </div>

          {/* 3. To do Column */}
          <div>
            <QuickTodoSection
              todos={todos}
              onToggleTodo={handleToggleTodo}
              onAddTodo={handleAddTodo}
              onDeleteTodo={handleDeleteTodo}
            />
          </div>
        </div>

        {/* --- SECTION 2 (BOTTOM TIER): 1 Unified Cross-Project Kanban Board --- */}
        <div>
          <UnifiedKanbanBoard
            projects={projects}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
          />
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
