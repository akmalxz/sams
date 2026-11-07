import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Project,
  ProjectTask,
  ProjectTaskStatus,
  LearningNote,
  QuickTodoItem,
  AreaOfResponsibility,
  ArchivedProject,
  ProjectMemoryCapsule,
  ProjectMemoryDocType,
} from './types/sams';
import { ProjectRadarCard } from './components/projects/ProjectRadarCard';
import { ProjectMemoryDrawer } from './components/projects/ProjectMemoryDrawer';
import { LearnSection } from './components/learn/LearnSection';
import { QuickTodoSection } from './components/todo/QuickTodoSection';
import { UnifiedKanbanBoard } from './components/kanban/UnifiedKanbanBoard';
import { AreasSection } from './components/secondbrain/AreasSection';
import { ArchivesSection } from './components/secondbrain/ArchivesSection';
import { MarkdownNoteDrawer } from './components/secondbrain/MarkdownNoteDrawer';
import { LinkProjectDialog } from './components/projects/LinkProjectDialog';
import { ReanalyzeProjectModal } from './components/projects/ReanalyzeProjectModal';
import { ThreeBotCanvas, BotMood } from './components/bot/ThreeBotCanvas';
import {
  IconArchiveBox,
  IconClose,
  IconCompass,
  IconFolderCode,
  IconKanban,
  IconSearch,
} from './components/ui/Icons';

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
        lastCommitHash: 'a919628',
        lastCommitMessage:
          'feat(second-brain): complete P.A.R.A. Second Brain with Areas and Archives views',
        remoteUrl: 'https://github.com/akmalxz/sams.git',
      },
      tasks: [
        {
          id: 't-1',
          projectId: 'personal-ai-platform',
          title: 'Split layout into Projects | Learn | To do Bento Deck',
          status: 'done',
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-2',
          projectId: 'personal-ai-platform',
          title: 'Implement Unified Cross-Project Drag-and-Drop Kanban',
          status: 'done',
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-3',
          projectId: 'personal-ai-platform',
          title: 'Add ⌘K Global Search & Split-Preview Markdown Drawer',
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
      note: 'Set enablement: true on actions/configure-pages@v5 to avoid HttpError 404 when activating Pages.',
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
    {
      id: 'todo-1',
      text: 'Review 3-column Projects | Learn | To do Bento symmetry',
      completed: true,
      priority: 'normal',
      createdAt: Date.now(),
    },
    {
      id: 'todo-2',
      text: 'Verify drag-and-drop Kanban board task transitions',
      completed: true,
      priority: 'urgent',
      createdAt: Date.now(),
    },
    {
      id: 'todo-3',
      text: 'Test ⌘K Global Search & Split-Preview Markdown Drawer',
      completed: false,
      priority: 'urgent',
      createdAt: Date.now(),
    },
  ];

  const DEFAULT_AREAS: AreaOfResponsibility[] = [
    {
      id: 'area-1',
      name: 'DevOps & Cloud CI/CD',
      icon: '🚀',
      description: 'GitHub Actions, GitHub Pages deployment, DNS, and serverless hosting.',
      standards: [
        "Always set base: './' in Vite config for GitHub Pages subpath deployment.",
        'Include enablement: true on actions/configure-pages@v5 for auto-activation.',
        'Keep build steps isolated so web builds pass without network access when sandboxed.',
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
        'Use native HTML5 <dialog> with closedby="any" and overscroll-behavior: contain.',
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
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [activeProjectDeckFilter, setActiveProjectDeckFilter] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
  const [activeMemoryProject, setActiveMemoryProject] = useState<Project | null>(null);
  const [activeMemoryCapsule, setActiveMemoryCapsule] = useState<ProjectMemoryCapsule | null>(null);
  const [activeMemoryTab, setActiveMemoryTab] = useState<ProjectMemoryDocType>('overview');
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [reanalyzingProject, setReanalyzingProject] = useState<Project | null>(null);

  // Global keyboard shortcut Cmd+K / Ctrl+K to focus Second-Brain search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // --- Filtered Collections via Global Search (Including Vault Memory Capsules) ---
  const normalizedQuery = globalSearchQuery.trim().toLowerCase();

  const searchMatchedProjects = useMemo(() => {
    if (!normalizedQuery) return projects;
    return projects.filter((p) => {
      const inTitle = p.name.toLowerCase().includes(normalizedQuery);
      const inDesc = (p.description || '').toLowerCase().includes(normalizedQuery);
      const inFocus = (p.currentFocus || '').toLowerCase().includes(normalizedQuery);
      const inPath = (p.workspacePath || '').toLowerCase().includes(normalizedQuery);
      const inRepo = (p.githubRepo || '').toLowerCase().includes(normalizedQuery);
      const inBranch = (p.git?.branch || '').toLowerCase().includes(normalizedQuery);
      const inTasks = (p.tasks || []).some((t) =>
        t.title.toLowerCase().includes(normalizedQuery)
      );

      // Search inside cached/loaded Vault Memory Capsule (Overview, Theme, Rules, Pulse)
      let inMemoryCapsule = false;
      try {
        const rawCapsule = localStorage.getItem(`sams-memory-${p.id}`);
        if (rawCapsule && rawCapsule.toLowerCase().includes(normalizedQuery)) {
          inMemoryCapsule = true;
        }
      } catch {}

      return inTitle || inDesc || inFocus || inPath || inRepo || inBranch || inTasks || inMemoryCapsule;
    });
  }, [projects, normalizedQuery]);

  const filteredProjects = useMemo(() => {
    return searchMatchedProjects.filter((p) => {
      if (activeProjectDeckFilter !== 'all' && p.id !== activeProjectDeckFilter) return false;
      return true;
    });
  }, [searchMatchedProjects, activeProjectDeckFilter]);

  const filteredLearnings = useMemo(() => {
    if (!normalizedQuery) return learnings;
    return learnings.filter(
      (l) =>
        l.title.toLowerCase().includes(normalizedQuery) ||
        l.note.toLowerCase().includes(normalizedQuery) ||
        (l.projectName || '').toLowerCase().includes(normalizedQuery) ||
        l.category.toLowerCase().includes(normalizedQuery)
    );
  }, [learnings, normalizedQuery]);

  const filteredTodos = useMemo(() => {
    if (!normalizedQuery) return todos;
    return todos.filter((t) => t.text.toLowerCase().includes(normalizedQuery));
  }, [todos, normalizedQuery]);

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
    status: ProjectTaskStatus = 'backlog',
    priority: 'low' | 'medium' | 'high' = 'medium'
  ) => {
    const newTask: ProjectTask = {
      id: `task-${Date.now()}`,
      projectId,
      title,
      priority,
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
          body: JSON.stringify({ title, priority, status }),
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
      accomplishments.unshift(
        `${project.git.lastCommitMessage} (${project.git.lastCommitHash || 'HEAD'})`
      );
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

  // --- Project Memory Capsule & Obsidian Vault Handlers ---
  const createDefaultMockCapsule = (project: Project): ProjectMemoryCapsule => {
    const isPersonalAI = project.id.includes('personal-ai');
    const stylingEngine = isPersonalAI ? 'tailwind-v4' : 'tailwind-v3';
    const colorTokens = isPersonalAI
      ? [
          { name: '--color-canvas', value: '#FFFFFF', category: 'canvas' as const },
          { name: '--color-surface', value: '#F8FAFC', category: 'surface' as const },
          { name: '--color-elevated', value: '#F1F5F9', category: 'elevated' as const },
          { name: '--color-blue', value: '#0A84FF', category: 'brand' as const },
          { name: '--color-ink', value: '#0F172A', category: 'ink' as const },
          { name: '--color-line', value: '#E2E8F0', category: 'line' as const },
        ]
      : [
          { name: '--primary', value: '#10B981', category: 'brand' as const },
          { name: '--background', value: '#0F172A', category: 'canvas' as const },
          { name: '--surface', value: '#1E293B', category: 'surface' as const },
          { name: '--accent', value: '#38BDF8', category: 'accent' as const },
        ];

    const packageManager = isPersonalAI ? 'bun' : 'pnpm';
    const slug = project.id;
    const vaultPath = `_Projects/${slug}`;

    const overviewMd = `---
type: project_overview
project_slug: "${slug}"
name: "${project.name}"
status: "${project.status}"
workspace_path: "${project.workspacePath}"
generated_by: "sams_memory_capsule"
---

# Project Charter: ${project.name}

> ${project.description || 'Modern system managed via SAMS and Google Antigravity.'}

## System Overview & Architecture
- **Workspace**: \`${project.workspacePath}\`
- **Current Active Focus**: ${project.currentFocus || 'Core architecture milestone'}
- **Deliverables Total**: ${(project.tasks || []).length} items tracked
- **Repository**: ${project.githubRepo ? `https://github.com/${project.githubRepo}` : 'Local Git repository'}

### Key Architectural Layers
- **Frontend**: React 18, Vite, Modern Web Guidance, Native HTML5 Top-Layer Dialogs
- **Backend Services**: Bun runtime, SQLite WAL, Atomic Staging Guard, Obsidian Vault Two-Way Sync
- **AI Agent Integration**: Google Antigravity Brain, Serial Queue, Multi-Persona Routing
`;

    const themeMd = `---
type: project_theme_and_design
project_slug: "${slug}"
name: "${project.name}"
styling_engine: "${stylingEngine}"
---

# UI Theme & Design System DNA: ${project.name}

> Visual DNA, detected CSS tokens, and typography for ${project.name}.

## Styling Engine
- **Framework**: \`${stylingEngine}\`
- **Color Scheme**: Dual Light / Dark with \`data-theme\` attribute

## Design Tokens & Palette
| Token Name | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
${colorTokens.map((t) => `| \`${t.name}\` | \`${t.value}\` | ${t.category} |`).join('\n')}

## Typography & Hierarchy
- **Sans Font**: Inter, system-ui, -apple-system, sans-serif
- **Mono Font**: JetBrains Mono, Fira Code, ui-monospace, monospace
- **Contrast Standard**: WCAG AA 4.5:1 minimum on all interactive controls
`;

    const rulesMd = `---
type: project_working_rules
project_slug: "${slug}"
name: "${project.name}"
package_manager: "${packageManager}"
---

# Working Rules & Agent Preferences: ${project.name}

> User preferences, developer guardrails, and architectural invariants for ${project.name}.

## Environment & Build Rules
- **Package Manager**: Always use \`${packageManager}\` (avoid global npm/yarn).
- **TypeScript**: Strict typing without \`any\` escapes.
- **Components**: Functional React with clean hook dependencies.

## Antigravity Agent Directives
- **Theme Preservation**: Always preserve existing styling tokens from \`01_Theme_and_Design.md\`.
- **Top-Layer Modals**: Use native HTML5 \`<dialog>\` with \`closedby="any"\` and \`overscroll-behavior: contain\`.
- **No Mock Regressions**: Real endpoints with offline graceful localStorage fallbacks.
- **Verification**: Run build and test suites before completing turns.
`;

    const pulseMd = `---
type: project_tasks_and_pulse
project_slug: "${slug}"
name: "${project.name}"
status: "${project.status}"
---

# Live Deliverables & Git Pulse: ${project.name}

> Real-time deliverables and git activity for ${project.name}.

## Deliverables Kanban Board
${(project.tasks || []).map((t) => `- [${t.status === 'done' ? 'x' : ' '}] **${t.title}** (${t.priority.toUpperCase()}) — Assigned: ${t.assignedAgent || 'architect'}`).join('\n')}

## Git Activity Pulse
- **Branch**: \`${project.git?.branch || 'main'}\`
- **Uncommitted Changes**: ${project.git?.uncommittedChanges ?? 0}
- **Last Commit**: ${project.git?.lastCommitHash ? `\`${project.git.lastCommitHash}\` - ${project.git.lastCommitMessage}` : 'Initialized'}
`;

    return {
      projectId: slug,
      projectSlug: slug,
      themeProfile: {
        stylingEngine: stylingEngine as any,
        colorTokens,
        palette: {
          hexColors: colorTokens.map((c) => c.value),
          rgbColors: [],
          oklchColors: [],
          hasLightDark: true,
        },
        fonts: {
          sans: 'Inter, system-ui',
          mono: 'JetBrains Mono',
          googleFonts: [],
        },
        themeMode: 'auto',
        detectedThemeAttrs: ['data-theme="light"', 'data-theme="dark"'],
      },
      workingRules: {
        packageManager: packageManager as any,
        scripts: { build: `${packageManager} run build`, test: `${packageManager} test` },
        agentInstructions: [],
        antigravityPreferences: [
          `Always run ${packageManager} commands inside the project directory`,
          'Keep TypeScript strict and zero build warnings',
          'Use native <dialog> with closedby="any" for all modals and drawers',
        ],
        architecturalConstraints: [
          'Local-first storage with two-way Obsidian vault mirroring',
          'StagingGuard atomic writes to prevent disk corruption',
        ],
      },
      architectureMap: {
        directories: [
          { name: 'web', path: 'web', role: 'React/Vite Frontend Client' },
          { name: 'server', path: 'server', role: 'Bun Express API & Vault Service' },
        ],
        entryPoints: ['server/src/index.ts', 'web/src/main.tsx'],
        ciWorkflows: [{ name: 'Deploy to GitHub Pages', path: '.github/workflows/deploy.yml', triggers: ['push'], targets: ['deploy'] }],
        safeEnvKeys: ['PORT', 'SSD_ROOT', 'NODE_ENV'],
      },
      docs: {
        overviewMd,
        themeMd,
        rulesMd,
        pulseMd,
        vaultPath,
        syncState: 'browser_only',
        lastSyncedAt: Date.now(),
      },
      vaultPath,
      syncState: 'browser_only',
      generatedAt: Date.now(),
    };
  };

  const handleOpenProjectMemory = async (
    project: Project,
    initialTab: ProjectMemoryDocType = 'overview'
  ) => {
    setActiveMemoryTab(initialTab);
    setActiveMemoryProject(project);
    setIsMemoryLoading(true);

    // 1. Try fetching live memory capsule from server
    try {
      const res = await fetch(`/api/projects/${project.id}/memory`);
      if (res.ok) {
        const capsule: ProjectMemoryCapsule = await res.json();
        setActiveMemoryCapsule(capsule);
        try {
          localStorage.setItem(`sams-memory-${project.id}`, JSON.stringify(capsule));
        } catch {}
        setIsMemoryLoading(false);
        return;
      }
    } catch {}

    // 2. Check localStorage cache
    try {
      const cached = localStorage.getItem(`sams-memory-${project.id}`);
      if (cached) {
        const parsed: ProjectMemoryCapsule = JSON.parse(cached);
        setActiveMemoryCapsule(parsed);
        setIsMemoryLoading(false);
        return;
      }
    } catch {}

    // 3. Fallback to client-side default capsule
    const defaultCapsule = createDefaultMockCapsule(project);
    setActiveMemoryCapsule(defaultCapsule);
    try {
      localStorage.setItem(`sams-memory-${project.id}`, JSON.stringify(defaultCapsule));
    } catch {}
    setIsMemoryLoading(false);
  };

  const handleSaveMemoryDoc = async (docType: ProjectMemoryDocType, content: string) => {
    if (!activeMemoryProject) return;

    let savedOnServer = false;
    try {
      const res = await fetch(`/api/projects/${activeMemoryProject.id}/memory/${docType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        savedOnServer = true;
      }
    } catch {}

    setActiveMemoryCapsule((prev) => {
      if (!prev) return prev;
      const docKey = `${docType}Md` as keyof typeof prev.docs;
      const updatedDocs = {
        ...prev.docs,
        [docKey]: content,
        lastSyncedAt: Date.now(),
        syncState: savedOnServer ? prev.syncState : 'browser_only',
      };
      const updatedCapsule: ProjectMemoryCapsule = {
        ...prev,
        docs: updatedDocs,
        syncState: savedOnServer ? prev.syncState : 'browser_only',
      };
      try {
        localStorage.setItem(`sams-memory-${activeMemoryProject.id}`, JSON.stringify(updatedCapsule));
      } catch {}
      return updatedCapsule;
    });
  };

  const handleRegenerateMemory = async () => {
    if (!activeMemoryProject) return;
    setIsMemoryLoading(true);

    try {
      const res = await fetch(`/api/projects/${activeMemoryProject.id}/memory/regenerate`, {
        method: 'POST',
      });
      if (res.ok) {
        const regenerated: ProjectMemoryCapsule = await res.json();
        setActiveMemoryCapsule(regenerated);
        try {
          localStorage.setItem(`sams-memory-${activeMemoryProject.id}`, JSON.stringify(regenerated));
        } catch {}
        setIsMemoryLoading(false);
        return;
      }
    } catch {}

    // Fallback client-side regeneration
    const freshCapsule = createDefaultMockCapsule(activeMemoryProject);
    setActiveMemoryCapsule(freshCapsule);
    try {
      localStorage.setItem(`sams-memory-${activeMemoryProject.id}`, JSON.stringify(freshCapsule));
    } catch {}
    setIsMemoryLoading(false);
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
      handleAddTask(targetProject.id, `Apply learning: ${title}`, 'backlog', 'medium');
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

  // Derive Bot Mood, Global Velocity & Status Message
  const botTelemetry = useMemo(() => {
    const totalTasks = projects.reduce((acc, p) => acc + (p.tasks?.length || 0), 0);
    const doneTasks = projects.reduce(
      (acc, p) => acc + (p.tasks?.filter((t) => t.status === 'done').length || 0),
      0
    );
    const velocityPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    if (projects.length === 0) {
      return {
        mood: 'focus' as BotMood,
        velocityPct: 0,
        doneTasks: 0,
        totalTasks: 0,
        message: 'Second Brain initialized. Click "+ Link Project" to track your codebases.',
      };
    }

    const dirtyProjects = projects.filter((p) => (p.git?.uncommittedChanges ?? 0) > 0);

    if (dirtyProjects.length > 0) {
      return {
        mood: 'dirty' as BotMood,
        velocityPct,
        doneTasks,
        totalTasks,
        message: `${dirtyProjects.length} workspace has uncommitted changes. ${doneTasks}/${totalTasks} deliverables shipped across ${projects.length} projects.`,
      };
    }

    return {
      mood: 'clean' as BotMood,
      velocityPct,
      doneTasks,
      totalTasks,
      message: backendOnline
        ? `Live Second Brain: ${projects.length} codebases clean & synced · ${learnings.length} technical notes indexed.`
        : `Cloud Second Brain: ${projects.length} repositories active · ${doneTasks}/${totalTasks} deliverables completed (${velocityPct}%).`,
    };
  }, [projects, backendOnline, learnings.length]);

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans transition-colors duration-200 flex flex-col">
      {/* 1. Slim Executive Navigation Header */}
      <header className="border-b border-line bg-surface/90 backdrop-blur-md px-5 py-2.5 sticky top-0 z-30 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue text-white flex items-center justify-center shadow-xs font-bold text-sm">
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

        {/* Center: Primary P.A.R.A. Navigation Switcher */}
        <nav
          aria-label="P.A.R.A. Views"
          className="hidden md:flex items-center gap-1 bg-elevated/70 p-1 rounded-xl border border-line text-xs font-mono"
        >
          <button
            type="button"
            onClick={() => setActiveParaTab('deck')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeParaTab === 'deck'
                ? 'bg-surface text-ink font-bold shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <IconKanban className="w-3.5 h-3.5 text-blue" />
            <span>Command Deck</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveParaTab('areas')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeParaTab === 'areas'
                ? 'bg-surface text-purple-600 dark:text-purple-400 font-bold shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <IconCompass className="w-3.5 h-3.5 text-purple-500" />
            <span>Areas ({areas.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveParaTab('archives')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeParaTab === 'archives'
                ? 'bg-surface text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <IconArchiveBox className="w-3.5 h-3.5 text-emerald-500" />
            <span>Archives ({archives.length})</span>
          </button>
        </nav>

        {/* Right Toolbar */}
        <div className="flex items-center gap-2.5">
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
            className="px-3.5 py-1.5 rounded-xl bg-blue text-white text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-1.5 shadow-xs"
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
              <svg
                aria-hidden="true"
                className="w-4 h-4 text-amber-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
              <svg
                aria-hidden="true"
                className="w-4 h-4 text-slate-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Executive 3D SAM Companion & Global Second-Brain Search Banner */}
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* 3D WebGL Canvas Container */}
            <div className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-canvas border border-line/60 relative overflow-hidden shadow-2xs">
              <ThreeBotCanvas mood={botTelemetry.mood} isDark={themeMode === 'dark'} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue">
                  SAM · 3D Spatial Companion
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue/10 text-blue font-semibold border border-blue/20">
                  Interactive Gaze
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-ink mt-1 leading-relaxed">
                {botTelemetry.message}
              </p>
            </div>
          </div>

          {/* Right: Global Second-Brain Search (⌘K) + Global Delivery Velocity */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Global Search Input */}
            <div className="relative flex items-center min-w-[260px] sm:min-w-[300px]">
              <IconSearch className="w-4 h-4 text-ink-subtle absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                    setGlobalSearchQuery('');
                  }
                }}
                placeholder="Search projects, vault memory, notes, tasks..."
                aria-label="Search across Second Brain"
                className="w-full rounded-xl border border-line bg-canvas pl-9 pr-14 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none transition-colors"
              />
              {globalSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setGlobalSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 text-ink-muted hover:text-ink cursor-pointer p-0.5"
                >
                  <IconClose className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono text-ink-subtle bg-surface border border-line rounded-md pointer-events-none">
                  ⌘K
                </kbd>
              )}
            </div>

            {/* Global Velocity Progress Pill */}
            <div className="px-3.5 py-2 rounded-xl border border-line bg-canvas flex items-center gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted block">
                  Global Velocity
                </span>
                <span className="text-xs font-mono font-bold text-ink">
                  {botTelemetry.doneTasks}/{botTelemetry.totalTasks} Shipped ({botTelemetry.velocityPct}%)
                </span>
              </div>
              <div className="w-12 bg-elevated rounded-full h-2 overflow-hidden border border-line/50">
                <div
                  className="bg-blue h-full rounded-full transition-all duration-300"
                  style={{ width: `${botTelemetry.velocityPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Active Global Search Results Status Bar */}
        {normalizedQuery && (
          <div className="px-4 py-2.5 rounded-xl bg-blue/10 border border-blue/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-ink">
              <IconSearch className="w-3.5 h-3.5 text-blue shrink-0" />
              <span>
                Showing Second-Brain matches for <strong className="text-blue">"{globalSearchQuery}"</strong>:
              </span>
              <span className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px]">
                {filteredProjects.length} Projects & Vault Memory
              </span>
              <span className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px]">
                {filteredLearnings.length} Notes
              </span>
              <span className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px]">
                {filteredTodos.length} Todos
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalSearchQuery('')}
              className="px-2.5 py-1 rounded-lg bg-surface border border-line text-ink-muted hover:text-ink text-[11px] font-semibold cursor-pointer"
            >
              Clear Filter (Esc)
            </button>
          </div>
        )}

        {/* Mobile View Switcher */}
        <div className="flex md:hidden items-center justify-around bg-elevated/70 p-1 rounded-xl border border-line text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveParaTab('deck')}
            className={`flex-1 py-1.5 text-center rounded-lg ${
              activeParaTab === 'deck' ? 'bg-surface text-ink font-bold shadow-2xs' : 'text-ink-muted'
            }`}
          >
            Deck
          </button>
          <button
            type="button"
            onClick={() => setActiveParaTab('areas')}
            className={`flex-1 py-1.5 text-center rounded-lg ${
              activeParaTab === 'areas'
                ? 'bg-surface text-purple-600 font-bold shadow-2xs'
                : 'text-ink-muted'
            }`}
          >
            Areas ({areas.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveParaTab('archives')}
            className={`flex-1 py-1.5 text-center rounded-lg ${
              activeParaTab === 'archives'
                ? 'bg-surface text-emerald-600 font-bold shadow-2xs'
                : 'text-ink-muted'
            }`}
          >
            Archives ({archives.length})
          </button>
        </div>

        {/* --- VIEW 1: COMMAND DECK (Symmetrical 3-Column Bento + Unified Kanban) --- */}
        {activeParaTab === 'deck' && (
          <div className="space-y-6">
            {/* Top 3 Symmetrical Bento Columns [ Projects (P) | Learn / Resources (R) | To do ] */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* 1. Projects Bento Panel (Synchronized lg:h-[580px] container) */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col gap-3 lg:h-[580px]">
                {/* Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-line shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue/10 border border-blue/20 text-blue flex items-center justify-center">
                      <IconFolderCode className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-sm font-bold text-ink tracking-tight">Projects (P)</h2>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-elevated border border-line text-ink-muted font-semibold">
                      {filteredProjects.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLinkDialogOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-blue/10 text-blue border border-blue/20 hover:bg-blue hover:text-white transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>+</span> Link
                  </button>
                </div>

                {/* Project Quick-Isolate Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 shrink-0 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setActiveProjectDeckFilter('all')}
                    className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer shrink-0 ${
                      activeProjectDeckFilter === 'all'
                        ? 'bg-elevated border-blue/40 text-ink font-semibold'
                        : 'bg-transparent border-transparent text-ink-muted hover:text-ink'
                    }`}
                  >
                    All ({projects.length})
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActiveProjectDeckFilter(p.id)}
                      className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer truncate max-w-[130px] shrink-0 ${
                        activeProjectDeckFilter === p.id
                          ? 'bg-elevated border-blue/40 text-blue font-semibold'
                          : 'bg-transparent border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                {/* Scrollable Project Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-0">
                  {filteredProjects.length === 0 ? (
                    <div className="h-full min-h-[200px] rounded-xl border border-dashed border-line/70 flex flex-col items-center justify-center p-6 text-center gap-2">
                      <IconFolderCode className="w-5 h-5 text-ink-subtle" />
                      <p className="text-xs font-medium text-ink-muted">No matching projects</p>
                      <button
                        type="button"
                        onClick={() => setIsLinkDialogOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-blue text-white text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        + Link Codebase
                      </button>
                    </div>
                  ) : (
                    filteredProjects.map((project) => (
                      <ProjectRadarCard
                        key={project.id}
                        project={project}
                        onToggleTask={handleToggleTask}
                        onAddTask={(id, title) => handleAddTask(id, title, 'backlog', 'medium')}
                        onUpdateFocus={handleUpdateFocus}
                        onSyncPulse={(p) => setReanalyzingProject(p)}
                        onUnlinkProject={handleUnlinkProject}
                        onOpenMemory={handleOpenProjectMemory}
                        onArchiveProject={handleArchiveProject}
                        onUpdateProject={handleUpdateProject}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 2. Learn / Resources Bento Panel */}
              <LearnSection
                learnings={filteredLearnings}
                onAddLearning={handleAddLearning}
                onDeleteLearning={handleDeleteLearning}
                onSelectNote={(n) => setActiveNoteDrawer(n)}
              />

              {/* 3. To do / Daily Execution Bento Panel */}
              <QuickTodoSection
                todos={filteredTodos}
                onToggleTodo={handleToggleTodo}
                onAddTodo={handleAddTodo}
                onDeleteTodo={handleDeleteTodo}
              />
            </div>

            {/* Bottom: Unified Cross-Project Kanban Board */}
            <UnifiedKanbanBoard
              projects={searchMatchedProjects}
              selectedProjectFilter={activeProjectDeckFilter}
              onSelectProjectFilter={setActiveProjectDeckFilter}
              onOpenProjectMemory={handleOpenProjectMemory}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
            />
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

      {/* Project Memory Capsule & Obsidian Vault Drawer */}
      <ProjectMemoryDrawer
        project={activeMemoryProject}
        isOpen={Boolean(activeMemoryProject)}
        onClose={() => setActiveMemoryProject(null)}
        memoryCapsule={activeMemoryCapsule}
        isLoading={isMemoryLoading}
        initialTab={activeMemoryTab}
        onSaveDoc={handleSaveMemoryDoc}
        onRegenerate={handleRegenerateMemory}
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
