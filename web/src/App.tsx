import React, { useEffect, useState, useMemo } from 'react';
import {
  Project,
  ProjectTask,
  ProjectTaskStatus,
  LearningNote,
  QuickTodoItem,
  AreaOfResponsibility,
  ArchivedProject,
} from './types/sams';
import { ProjectRadarCard } from './components/projects/ProjectRadarCard';
import { LearnSection } from './components/learn/LearnSection';
import { QuickTodoSection } from './components/todo/QuickTodoSection';
import { UnifiedKanbanBoard } from './components/kanban/UnifiedKanbanBoard';
import { AreasSection } from './components/secondbrain/AreasSection';
import { ArchivesSection } from './components/secondbrain/ArchivesSection';
import { MarkdownNoteDrawer } from './components/secondbrain/MarkdownNoteDrawer';
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

  // --- Initial Default Seeds for Full Second Brain ---
  const DEFAULT_DEMO_PROJECTS: Project[] = [
    {
      id: 'personal-ai-platform',
      name: 'Personal AI Platform',
      workspacePath: '~/Projects/personal_ai',
      githubRepo: 'akmalxz/sams',
      description: 'SAMS Full Developer Second Brain & 3D Spatial Agent',
      status: 'on_track',
      currentFocus: 'Full Second Brain System: Projects, Areas, Resources, Archives (PARA)',
      progressPercent: 85,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now(),
      git: {
        isGitRepo: true,
        branch: 'main',
        uncommittedChanges: 0,
        lastCommitHash: 'b5252b6',
        lastCommitMessage: 'feat(layout): implement Projects | Learn | To do tri-split and Unified Cross-Project Kanban Board',
        remoteUrl: 'https://github.com/akmalxz/sams.git',
      },
      tasks: [
        {
          id: 't-1',
          projectId: 'personal-ai-platform',
          title: 'Split layout into Projects | Learn | To do',
          status: 'done',
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-2',
          projectId: 'personal-ai-platform',
          title: 'Implement Unified Cross-Project Kanban Board',
          status: 'done',
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-3',
          projectId: 'personal-ai-platform',
          title: 'Implement Full P.A.R.A. Second Brain with Markdown Drawer & Archives',
          status: 'in_progress',
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
      content: `# Vite Relative Base for GitHub Pages\n\nWhen deploying a Single Page App (SPA) to GitHub Pages, the project is served on a subpath (e.g. \`https://username.github.io/repo-name/\`).\n\n### The Problem\nBy default, Vite assumes \`base: '/'\`, causing browsers to request \`https://username.github.io/assets/...\` instead of \`.../repo-name/assets/...\`, resulting in white 404 screens.\n\n### The Solution\nIn \`vite.config.ts\`:\n\`\`\`typescript\nexport default defineConfig({\n  base: './',\n  plugins: [react(), tailwindcss()]\n});\n\`\`\`\nThis generates relative asset paths (\`./assets/...\`) that load seamlessly on any domain or subpath!`,
      category: 'architecture',
      projectName: 'SAMS',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'l-2',
      title: 'Auto-Enablement on configure-pages Action',
      note: "Set enablement: true on actions/configure-pages@v5 to avoid HttpError 404 when activating Pages.",
      content: `# Auto-Enablement on configure-pages Action\n\nWhen setting up GitHub Actions for GitHub Pages on a newly created repository, the Pages site API resource may not exist yet.\n\n### The Fix\nPass \`enablement: true\` in \`.github/workflows/deploy.yml\`:\n\`\`\`yaml\n- name: Setup Pages\n  uses: actions/configure-pages@v5\n  with:\n    enablement: true\n\`\`\`\nThis tells GitHub Actions to activate Pages automatically via the GitHub REST API!`,
      category: 'bugfix',
      projectName: 'DevOps',
      createdAt: Date.now() - 1800000,
    },
    {
      id: 'l-3',
      title: 'WebGL Visibility Lifecycle Guard',
      note: 'Listen to document.hidden / visibilitychange to pause requestAnimationFrame and save unified memory.',
      content: `# WebGL Visibility Lifecycle Guard\n\nContinuous Three.js render loops (\`requestAnimationFrame\`) can consume significant CPU and battery when running in hidden tabs.\n\n### The Guard\n\`\`\`typescript\nconst handleVisibilityChange = () => {\n  if (document.hidden) {\n    isPaused = true;\n    cancelAnimationFrame(animId);\n  } else {\n    isPaused = false;\n    clock.start();\n    animate();\n  }\n};\ndocument.addEventListener('visibilitychange', handleVisibilityChange);\n\`\`\`\nSaves battery and keeps unified memory cool on Apple Silicon!`,
      category: 'insight',
      projectName: 'ThreeBot',
      createdAt: Date.now() - 900000,
    },
  ];

  const DEFAULT_TODOS: QuickTodoItem[] = [
    { id: 'todo-1', text: 'Review 3-column Projects | Learn | To do layout', completed: true, priority: 'normal', createdAt: Date.now() },
    { id: 'todo-2', text: 'Verify cross-project Kanban board task transitions', completed: true, priority: 'urgent', createdAt: Date.now() },
    { id: 'todo-3', text: 'Explore P.A.R.A. Areas of Responsibility & Archives view', completed: false, priority: 'urgent', createdAt: Date.now() },
  ];

  const DEFAULT_AREAS: AreaOfResponsibility[] = [
    {
      id: 'area-1',
      name: 'DevOps & Cloud CI/CD',
      icon: '🚀',
      description: 'GitHub Actions, GitHub Pages deployment, DNS, and serverless hosting.',
      standards: [
        "Always set base: './' in Vite config for GitHub Pages subpath deployment.",
        "Include enablement: true on actions/configure-pages@v5 for auto-activation.",
        "Keep build steps isolated so web builds pass without network access when sandboxed.",
      ],
      color: '#3B82F6',
    },
    {
      id: 'area-2',
      name: 'Agentic AI & Antigravity',
      icon: '🤖',
      description: 'Subagent orchestration, plan milestones, and prompt engineering.',
      standards: [
        'Targeted file reads (<50ms) over deep directory traversal to protect M1 unified memory.',
        'Auto-analyze codebases on link to derive accomplishments and actionable deliverables.',
        'Always explore pros, cons, and better proposals before architectural pivots.',
      ],
      color: '#8B5CF6',
    },
    {
      id: 'area-3',
      name: 'Modern Frontend & 3D UI',
      icon: '🎨',
      description: 'React 18, Tailwind CSS v4, Three.js WebGL, and accessible design.',
      standards: [
        'Conserve battery and memory by pausing requestAnimationFrame on document.hidden.',
        'Maintain crisp dual themes (White+Blue light mode and Deep Slate dark mode).',
        'Use native HTML5 <dialog> with backdrop dismiss and Esc accessibility.',
      ],
      color: '#10B981',
    },
    {
      id: 'area-4',
      name: 'Data Architecture & Storage',
      icon: '💾',
      description: 'Local-first SQLite, browser localStorage caching, and external SSD vault.',
      standards: [
        'Dual-Mode persistence: operate serverless on GitHub Pages and sync to local backend.',
        'Store project notes in Markdown with YAML frontmatter for Obsidian compatibility.',
      ],
      color: '#F59E0B',
    },
  ];

  const DEFAULT_ARCHIVES: ArchivedProject[] = [
    {
      id: 'sams-phase-a',
      name: 'SAMS Phase A Architecture',
      workspacePath: '~/Projects/personal_ai/legacy',
      githubRepo: 'akmalxz/sams',
      completedAt: Date.now() - 86400000 * 2,
      summary: 'Initial spatial management system blueprint and server middleware setup.',
      accomplishments: [
        'Express + Bun server setup with SQLite WAL journal mode',
        'Initial 3D room SVG wireframe and bot visor states',
        'Multi-project database schema and task persistence',
      ],
      totalTasksCompleted: 4,
    },
  ];

  // --- Second Brain State (P.A.R.A.) ---
  const [activeParaTab, setActiveParaTab] = useState<'deck' | 'areas' | 'archives'>('deck');

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

  const [areas, setAreas] = useState<AreaOfResponsibility[]>(() => {
    try {
      const saved = localStorage.getItem('sams-para-areas');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_AREAS;
  });

  const [archives, setArchives] = useState<ArchivedProject[]>(() => {
    try {
      const saved = localStorage.getItem('sams-para-archives');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ARCHIVES;
  });

  const [activeNoteDrawer, setActiveNoteDrawer] = useState<LearningNote | null>(null);
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

  // --- Archive Project (P -> A in PARA) ---
  const handleArchiveProject = (project: Project) => {
    const doneTasks = (project.tasks || []).filter((t) => t.status === 'done');
    const accomplishments = doneTasks.map((t) => t.title.replace(/\*\*/g, ''));
    if (project.git?.lastCommitMessage) {
      accomplishments.unshift(`${project.git.lastCommitMessage} (${project.git.lastCommitHash || 'HEAD'})`);
    }

    const archivedItem: ArchivedProject = {
      id: `archive-${project.id}-${Date.now()}`,
      name: project.name,
      workspacePath: project.workspacePath,
      githubRepo: project.githubRepo,
      completedAt: Date.now(),
      summary: project.currentFocus || project.description || 'Project delivered and archived.',
      accomplishments,
      totalTasksCompleted: doneTasks.length,
    };

    setArchives((prev) => {
      const next = [archivedItem, ...prev];
      try {
        localStorage.setItem('sams-para-archives', JSON.stringify(next));
      } catch {}
      return next;
    });

    handleUnlinkProject(project.id);
  };

  const handleRestoreArchivedProject = (archived: ArchivedProject) => {
    const restored: Project = {
      id: archived.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: archived.name,
      workspacePath: archived.workspacePath,
      githubRepo: archived.githubRepo,
      description: archived.summary,
      status: 'on_track',
      currentFocus: `Resumed from archive: ${archived.summary}`,
      progressPercent: 100,
      createdAt: archived.completedAt,
      updatedAt: Date.now(),
      git: {
        isGitRepo: true,
        branch: 'main',
        uncommittedChanges: 0,
      },
      tasks: archived.accomplishments.map((acc, i) => ({
        id: `task-restored-${i}`,
        projectId: archived.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: acc,
        status: 'done',
        priority: 'medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
    };

    setProjects((prev) => {
      const next = [restored, ...prev];
      try {
        localStorage.setItem('sams-projects', JSON.stringify(next));
      } catch {}
      return next;
    });

    setArchives((prev) => {
      const next = prev.filter((a) => a.id !== archived.id);
      try {
        localStorage.setItem('sams-para-archives', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleDeleteArchive = (id: string) => {
    setArchives((prev) => {
      const next = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem('sams-para-archives', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // --- Learning Notes Handlers (Resources in PARA) ---
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

  const handleSaveNote = (updated: LearningNote) => {
    setLearnings((prev) => {
      const next = prev.map((l) => (l.id === updated.id ? updated : l));
      try {
        localStorage.setItem('sams-learnings', JSON.stringify(next));
      } catch {}
      return next;
    });
    setActiveNoteDrawer(updated);
  };

  const handleDeleteLearning = (id: string) => {
    setLearnings((prev) => {
      const next = prev.filter((l) => l.id !== id);
      try {
        localStorage.setItem('sams-learnings', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (activeNoteDrawer?.id === id) {
      setActiveNoteDrawer(null);
    }
  };

  const handleConvertNoteToTask = (title: string, projectName?: string) => {
    const targetProject =
      projects.find((p) => p.name.toLowerCase() === projectName?.toLowerCase()) ||
      (projects.length > 0 ? projects[0] : null);

    if (targetProject) {
      handleAddTask(targetProject.id, `Apply learning: ${title}`, 'backlog');
    }
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

  // --- Areas Handlers (Areas in PARA) ---
  const handleAddAreaStandard = (areaId: string, standard: string) => {
    setAreas((prev) => {
      const next = prev.map((a) => {
        if (a.id !== areaId) return a;
        return { ...a, standards: [...a.standards, standard] };
      });
      try {
        localStorage.setItem('sams-para-areas', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleRemoveAreaStandard = (areaId: string, index: number) => {
    setAreas((prev) => {
      const next = prev.map((a) => {
        if (a.id !== areaId) return a;
        return { ...a, standards: a.standards.filter((_, i) => i !== index) };
      });
      try {
        localStorage.setItem('sams-para-areas', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Derive Bot Mood & Status Message
  const botTelemetry = useMemo(() => {
    if (projects.length === 0) {
      return {
        mood: 'focus' as BotMood,
        message: 'Second Brain initialized. Click "+ Link Project" to track your codebases.',
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
        message: `Second Brain: ${projects.length} active projects, ${areas.length} areas of standard, ${archives.length} archived retrospectives.`,
      };
    }

    return {
      mood: 'clean' as BotMood,
      message: backendOnline
        ? `Live Second Brain: All ${projects.length} codebases clean & synced! ${learnings.length} resource notes documented.`
        : `Cloud Second Brain: P.A.R.A. active with 3D SAM. Syncing real-time commits via GitHub API!`,
    };
  }, [projects, backendOnline, areas.length, archives.length, learnings.length]);

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
                Second Brain
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-ink-muted">
              P.A.R.A. Method · Projects · Areas · Resources · Archives
            </p>
          </div>
        </div>

        {/* Center: P.A.R.A. Navigation Switcher */}
        <div className="hidden md:flex items-center gap-1 bg-elevated/70 p-1 rounded-xl border border-line text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveParaTab('deck')}
            className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
              activeParaTab === 'deck'
                ? 'bg-surface text-ink font-bold shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            ☷ Command Deck
          </button>
          <button
            type="button"
            onClick={() => setActiveParaTab('areas')}
            className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
              activeParaTab === 'areas'
                ? 'bg-surface text-purple-600 dark:text-purple-400 font-bold shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            🌐 Areas ({areas.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveParaTab('archives')}
            className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
              activeParaTab === 'archives'
                ? 'bg-surface text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            📦 Archives ({archives.length})
          </button>
        </div>

        {/* Right Toolbar */}
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
            <span className="hidden lg:inline font-medium">
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
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveParaTab('deck')}
              className={`px-3 py-1.5 rounded-xl border transition-colors text-center cursor-pointer ${
                activeParaTab === 'deck' ? 'border-blue bg-blue/5' : 'border-line bg-canvas'
              }`}
            >
              <span className="text-[10px] text-ink-muted uppercase block">Projects</span>
              <span className="font-bold text-blue">{projects.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveParaTab('areas')}
              className={`px-3 py-1.5 rounded-xl border transition-colors text-center cursor-pointer ${
                activeParaTab === 'areas' ? 'border-purple-500 bg-purple-500/5' : 'border-line bg-canvas'
              }`}
            >
              <span className="text-[10px] text-ink-muted uppercase block">Areas</span>
              <span className="font-bold text-purple-500">{areas.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveParaTab('deck')}
              className="px-3 py-1.5 rounded-xl border border-line bg-canvas text-center cursor-pointer"
            >
              <span className="text-[10px] text-ink-muted uppercase block">Resources</span>
              <span className="font-bold text-ink">{learnings.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveParaTab('archives')}
              className={`px-3 py-1.5 rounded-xl border transition-colors text-center cursor-pointer ${
                activeParaTab === 'archives' ? 'border-emerald-500 bg-emerald-500/5' : 'border-line bg-canvas'
              }`}
            >
              <span className="text-[10px] text-ink-muted uppercase block">Archives</span>
              <span className="font-bold text-emerald-500">{archives.length}</span>
            </button>
          </div>
        </div>

        {/* Mobile View Switcher */}
        <div className="flex md:hidden items-center justify-around bg-elevated/70 p-1 rounded-xl border border-line text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveParaTab('deck')}
            className={`flex-1 py-1 text-center rounded-lg ${
              activeParaTab === 'deck' ? 'bg-surface text-ink font-bold' : 'text-ink-muted'
            }`}
          >
            Deck
          </button>
          <button
            type="button"
            onClick={() => setActiveParaTab('areas')}
            className={`flex-1 py-1 text-center rounded-lg ${
              activeParaTab === 'areas' ? 'bg-surface text-purple-600 font-bold' : 'text-ink-muted'
            }`}
          >
            Areas
          </button>
          <button
            type="button"
            onClick={() => setActiveParaTab('archives')}
            className={`flex-1 py-1 text-center rounded-lg ${
              activeParaTab === 'archives' ? 'bg-surface text-emerald-600 font-bold' : 'text-ink-muted'
            }`}
          >
            Archives
          </button>
        </div>

        {/* --- VIEW 1: COMMAND DECK (P.A.R.A. Projects & Resources & Kanban) --- */}
        {activeParaTab === 'deck' && (
          <div className="space-y-6">
            {/* Top 3 Columns [ Projects (P) | Learn / Resources (R) | To do ] */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* 1. Projects Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div className="flex items-center gap-2">
                    <span className="text-blue font-bold">🔷</span>
                    <h2 className="text-sm font-bold text-ink tracking-tight">Projects (P)</h2>
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
                        onArchiveProject={handleArchiveProject}
                        onUpdateProject={handleUpdateProject}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Learn / Resources Column */}
              <div>
                <LearnSection
                  learnings={learnings}
                  onAddLearning={handleAddLearning}
                  onDeleteLearning={handleDeleteLearning}
                  onSelectNote={(n) => setActiveNoteDrawer(n)}
                />
              </div>

              {/* 3. To do / Immediate Action Column */}
              <div>
                <QuickTodoSection
                  todos={todos}
                  onToggleTodo={handleToggleTodo}
                  onAddTodo={handleAddTodo}
                  onDeleteTodo={handleDeleteTodo}
                />
              </div>
            </div>

            {/* Bottom: Unified Cross-Project Kanban Board */}
            <div>
              <UnifiedKanbanBoard
                projects={projects}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onAddTask={handleAddTask}
                onDeleteTask={handleDeleteTask}
              />
            </div>
          </div>
        )}

        {/* --- VIEW 2: AREAS OF RESPONSIBILITY (P.A.R.A. Areas) --- */}
        {activeParaTab === 'areas' && (
          <AreasSection
            areas={areas}
            onAddStandard={handleAddAreaStandard}
            onRemoveStandard={handleRemoveAreaStandard}
          />
        )}

        {/* --- VIEW 3: ARCHIVES & RETROSPECTIVES (P.A.R.A. Archives) --- */}
        {activeParaTab === 'archives' && (
          <ArchivesSection
            archives={archives}
            onRestoreProject={handleRestoreArchivedProject}
            onDeleteArchive={handleDeleteArchive}
          />
        )}
      </main>

      {/* Markdown Note Deep Editor Drawer */}
      <MarkdownNoteDrawer
        isOpen={Boolean(activeNoteDrawer)}
        note={activeNoteDrawer}
        onClose={() => setActiveNoteDrawer(null)}
        onSaveNote={handleSaveNote}
        onConvertToKanbanTask={handleConvertNoteToTask}
      />

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
